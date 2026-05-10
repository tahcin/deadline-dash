#!/usr/bin/env python3
"""Send T-24h and T-1h push notifications via OneSignal for upcoming deadlines.

Reads public/deadlines.json (produced by sync_deadlines.py), tracks state in
state/notifications-sent.json so we never double-send. Designed to run hourly
on GitHub Actions; windows are loose enough to tolerate cron drift.
"""
import json
import os
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

    sent_count = 0
    for d in deadlines:
        if not visible(d, now_ts):
            continue
        try:
            due_ts = datetime.fromisoformat(d["dueAt"]).timestamp()
        except Exception:
            continue
        minutes_until = (due_ts - now_ts) / 60
        if minutes_until <= 0:
            continue

        key = deadline_key(d)
        entry = state.setdefault(key, {"dueAt": d["dueAt"], "sent": []})
        entry["dueAt"] = d["dueAt"]
        sent = set(entry.get("sent", []))

        course = d.get("courseName") or ""
        title = d.get("title") or ""
        link = d.get("link") or ""
        when = fmt_time(d["dueAt"])
        body = f"{course} — {title} (due {when})" if when else f"{course} — {title}"

        if minutes_until <= WINDOW_1H_MAX_MIN and "1h" not in sent:
            print(f"sending 1h reminder: {key}")
            send_push("Deadline in 1 hour", body, link)
            sent.add("1h")
            sent.add("24h")
            sent_count += 1
        elif minutes_until <= WINDOW_24H_MAX_MIN and "24h" not in sent:
            print(f"sending 24h reminder: {key}")
            send_push("Deadline approaching", body, link)
            sent.add("24h")
            sent_count += 1

        entry["sent"] = sorted(sent)

    save_state(state)
    print(f"sent {sent_count} notifications, tracking {len(state)} entries")


if __name__ == "__main__":
    main()
