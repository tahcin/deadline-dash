#!/usr/bin/env python3
"""Send T-24h and T-1h push notifications via OneSignal for upcoming deadlines.

Reads public/deadlines.json (produced by sync_deadlines.py), tracks state in
state/notifications-sent.json so we never double-send. Designed to run hourly
on GitHub Actions; windows are loose enough to tolerate cron drift.
"""
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

ONESIGNAL_API = "https://api.onesignal.com/notifications"
APP_ID = os.environ["ONESIGNAL_APP_ID"]
REST_API_KEY = os.environ["ONESIGNAL_REST_API_KEY"]

ROOT = Path(__file__).resolve().parent.parent
DEADLINES = ROOT / "public" / "deadlines.json"
STATE = ROOT / "state" / "notifications-sent.json"

IST = ZoneInfo("Asia/Kolkata")
WINDOW_1H_MAX_MIN = 90              # treat anything <= 90min away as "1h reminder time"
WINDOW_24H_MAX_MIN = 25 * 60        # 25 hours; gives 1h slack for cron drift
GRACE_SECONDS = 24 * 3600
PRUNE_DAYS = 7


def load_state() -> dict:
    if not STATE.exists():
        return {}
    try:
        return json.loads(STATE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_state(state: dict) -> None:
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def deadline_key(d: dict) -> str:
    block = d.get("blockId") or ""
    return f"{d['courseId']}|{block}|{d['dueAt']}"


def visible(d: dict, now_ts: float) -> bool:
    if d.get("complete"): return False
    if not d.get("learnerHasAccess"): return False
    if d.get("courseArchived"): return False
    try:
        due = datetime.fromisoformat(d["dueAt"]).timestamp()
    except Exception:
        return False
    if now_ts > due + GRACE_SECONDS:
        return False
    return True


def fmt_time(due_iso: str) -> str:
    try:
        dt = datetime.fromisoformat(due_iso).astimezone(IST)
        return dt.strftime("%a %d %b, %I:%M %p IST")
    except Exception:
        return ""


def time_until_phrase(minutes_until: float) -> str:
    if minutes_until < 60:
        m = max(1, round(minutes_until))
        return f"{m} minute{'s' if m != 1 else ''}"
    hours = round(minutes_until / 60)
    return f"{hours} hour{'s' if hours != 1 else ''}"


CATEGORY_LABELS = {
    "cla": "CLA",
    "midterm": "Mid-Term",
    "assignment": "Project",
    "liveSession": "Live Session",
}


def deadline_phrase(d: dict) -> str:
    """Build a sentence fragment like 'Module 1.11 CLA #1 of Course Name'."""
    title = (d.get("title") or "").strip()
    course = d.get("courseName") or "your course"
    category = d.get("category", "other")
    type_label = CATEGORY_LABELS.get(category, "Assignment")

    m = re.match(r'^(\d+(?:\.\d+)?)\s+(.+)$', title)
    if m:
        prefix, rest = m.group(1), m.group(2)
        sm = re.search(r'(\d+)\s*$', rest)
        suffix = sm.group(1) if sm else None
        label = f"Module {prefix} {type_label}"
        if suffix:
            label += f" #{suffix}"
    else:
        label = title or type_label

    return f"{label} of {course}"


def send_push(heading: str, body: str, link: str) -> None:
    payload = {
        "app_id": APP_ID,
        "included_segments": ["Subscribed Users"],
        "headings": {"en": heading},
        "contents": {"en": body},
    }
    if link:
        payload["web_url"] = link
        payload["url"] = link
    r = requests.post(
        ONESIGNAL_API,
        json=payload,
        headers={
            "Authorization": f"Key {REST_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        timeout=30,
    )
    if not r.ok:
        print(f"  ERROR: OneSignal {r.status_code}: {r.text}", file=sys.stderr)
        r.raise_for_status()


def main() -> None:
    if not DEADLINES.exists():
        print("no deadlines.json yet, nothing to do")
        return

    data = json.loads(DEADLINES.read_text(encoding="utf-8"))
    deadlines = data.get("deadlines", []) or []
    state = load_state()
    now_ts = datetime.now(timezone.utc).timestamp()

    pruned = {}
    for k, v in state.items():
        try:
            due = datetime.fromisoformat(v["dueAt"]).timestamp()
        except Exception:
            continue
        if now_ts - due > PRUNE_DAYS * 86400:
            continue
        pruned[k] = v
    state = pruned

    # group visible upcoming deadlines by their exact dueAt so concurrent
    # deadlines collapse into a single push instead of spamming N notifications.
    groups: dict[str, list[dict]] = {}
    for d in deadlines:
        if not visible(d, now_ts):
            continue
        try:
            due_ts = datetime.fromisoformat(d["dueAt"]).timestamp()
        except Exception:
            continue
        if due_ts <= now_ts:
            continue
        groups.setdefault(d["dueAt"], []).append(d)

    sent_count = 0
    for due_iso, items in sorted(groups.items()):
        due_ts = datetime.fromisoformat(due_iso).timestamp()
        minutes_until = (due_ts - now_ts) / 60
        time_phrase = time_until_phrase(minutes_until)
        link = items[0].get("link") or "" if len(items) == 1 else ""

        if len(items) == 1:
            d = items[0]
            heading_imminent = "Deadline imminent"
            heading_24h = "Deadline reminder"
            body = f"{deadline_phrase(d)} is due in {time_phrase}"
        else:
            n = len(items)
            heading_imminent = f"{n} deadlines imminent"
            heading_24h = f"{n} deadlines due soon"
            preview = "; ".join(deadline_phrase(d) for d in items[:3])
            if n > 3:
                preview += f"; +{n - 3} more"
            body = f"{n} deadlines due in {time_phrase} — {preview}"

        # all items in the group share the same dueAt and therefore the same
        # send window. Track sent state per-item so adding a new deadline to an
        # already-notified time still gets covered (it will just resend the
        # combined push, which is fine — better than missing it).
        keys = [deadline_key(d) for d in items]
        entries = []
        for k, d in zip(keys, items):
            entry = state.setdefault(k, {"dueAt": d["dueAt"], "sent": []})
            entry["dueAt"] = d["dueAt"]
            entries.append(entry)

        all_sent_1h = all("1h" in set(e.get("sent", [])) for e in entries)
        all_sent_24h = all("24h" in set(e.get("sent", [])) for e in entries)

        if minutes_until <= WINDOW_1H_MAX_MIN and not all_sent_1h:
            print(f"sending 1h reminder for {len(items)} deadline(s) at {due_iso}")
            send_push(heading_imminent, body, link)
            for e in entries:
                s = set(e.get("sent", []))
                s.add("1h"); s.add("24h")
                e["sent"] = sorted(s)
            sent_count += 1
        elif minutes_until <= WINDOW_24H_MAX_MIN and not all_sent_24h:
            print(f"sending 24h reminder for {len(items)} deadline(s) at {due_iso}")
            send_push(heading_24h, body, link)
            for e in entries:
                s = set(e.get("sent", []))
                s.add("24h")
                e["sent"] = sorted(s)
            sent_count += 1

    save_state(state)
    print(f"sent {sent_count} notifications, tracking {len(state)} entries")


if __name__ == "__main__":
    main()
