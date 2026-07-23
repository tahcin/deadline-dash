#!/usr/bin/env python3
"""Schedule T-12h and T-1h push reminders for upcoming deadlines via OneSignal.

Instead of firing a push at cron time (which made delivery hostage to GitHub
Actions' unreliable scheduler — reminders were landing ~1 minute before the
deadline), we hand OneSignal the *exact* delivery instant via `send_after`.
OneSignal then delivers at `dueAt - 12h` and `dueAt - 1h` regardless of when
this job actually runs. The cron's only job is to schedule (and, when a
deadline moves or disappears, cancel/reschedule) future notifications.

Reads public/deadlines.json (produced by sync_deadlines.py) and tracks the
scheduled OneSignal notification ids in state/notifications-sent.json so we
never double-schedule and can cancel stale reminders. Safe to run hourly.
"""
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

ONESIGNAL_API = "https://api.onesignal.com/notifications"
APP_ID = os.environ.get("ONESIGNAL_APP_ID", "")
REST_API_KEY = os.environ.get("ONESIGNAL_REST_API_KEY", "")

ROOT = Path(__file__).resolve().parent.parent
DEADLINES = ROOT / "public" / "deadlines.json"
STATE = ROOT / "state" / "notifications-sent.json"

IST = timezone(timedelta(hours=5, minutes=30), "IST")

# (bucket name, lead time before deadline, phrase baked into the message).
# Ordered earliest-lead first. The last entry is the "imminent" final reminder.
BUCKETS = [
    ("12h", timedelta(hours=12), "12 hours"),
    ("1h", timedelta(hours=1), "1 hour"),
]
FINAL_BUCKET = BUCKETS[-1][0]

# OneSignal rejects scheduled deliveries more than 30 days out; stay under it and
# let a later hourly run schedule the reminder once it comes into range.
MAX_SCHEDULE_AHEAD = timedelta(days=29)
GRACE_SECONDS = 24 * 3600
PRUNE_DAYS = 7


# --- time helpers --------------------------------------------------------

def parse_dt(iso: str):
    try:
        return datetime.fromisoformat(iso)
    except Exception:
        return None


def bucket_is_pending(bucket: dict, now: datetime) -> bool:
    """A scheduled push OneSignal is still holding (delivery instant not reached)
    — the only kind we can cancel."""
    if bucket.get("status") != "scheduled":
        return False
    after = parse_dt(bucket.get("sendAfter") or "")
    return after is not None and after > now


# --- state ---------------------------------------------------------------

def migrate_state(raw: dict) -> dict:
    """Bring any state shape up to the current schema.

    Current schema, keyed by the deadline's dueAt (concurrent deadlines share
    one entry):
        { "<dueAt>": {"members": ["courseId|blockId", ...],
                       "buckets": {"12h": {"status", "id", "sendAfter"}, ...}} }

    Legacy schema was keyed by "courseId|blockId|dueAt" with a flat "sent" list
    (and, even older, a "24h" bucket that had already been relabelled "12h").
    Legacy buckets are folded in as status "sent" so we never resend them.
    """
    migrated: dict = {}
    for key, entry in raw.items():
        if not isinstance(entry, dict):
            continue
        # Already-current entries have "buckets".
        if "buckets" in entry:
            migrated[key] = entry
            continue
        # Legacy entry -> group by dueAt.
        due = entry.get("dueAt")
        parts = key.split("|")
        if not due and len(parts) == 3:
            due = parts[2]
        if not due:
            continue
        member = "|".join(parts[:2]) if len(parts) >= 2 else key
        sent = list(entry.get("sent") or [])
        if "24h" in sent and "12h" not in sent:  # historical relabel
            sent.append("12h")
        group = migrated.setdefault(due, {"members": [], "buckets": {}})
        if member not in group["members"]:
            group["members"].append(member)
        for name in sent:
            group["buckets"].setdefault(name, {"status": "sent", "id": None, "sendAfter": None})
    for g in migrated.values():
        g["members"] = sorted(g.get("members", []))
    return migrated


def load_state() -> dict:
    if not STATE.exists():
        return {}
    try:
        raw = json.loads(STATE.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return migrate_state(raw)


def save_state(state: dict) -> None:
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")


# --- message building ----------------------------------------------------

def identity(d: dict) -> str:
    return f"{d['courseId']}|{d.get('blockId') or ''}"


def visible(d: dict, now_ts: float) -> bool:
    if not d.get("learnerHasAccess"):
        return False
    if d.get("courseArchived"):
        return False
    due = parse_dt(d.get("dueAt") or "")
    if due is None:
        return False
    if now_ts > due.timestamp() + GRACE_SECONDS:
        return False
    return True


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


def build_message(items: list, phrase: str, imminent: bool):
    """Return (heading, body, link) for a group of deadlines sharing a dueAt."""
    if len(items) == 1:
        d = items[0]
        heading = "Deadline imminent" if imminent else "Deadline reminder"
        body = f"{deadline_phrase(d)} is due in {phrase}"
        link = d.get("link") or ""
    else:
        n = len(items)
        heading = f"{n} deadlines imminent" if imminent else f"{n} deadlines due soon"
        preview = "; ".join(deadline_phrase(d) for d in items[:3])
        if n > 3:
            preview += f"; +{n - 3} more"
        body = f"{n} deadlines due in {phrase}: {preview}"
        link = ""
    return heading, body, link


# --- core reconciliation (pure; HTTP is injected) ------------------------

def reconcile(deadlines: list, state: dict, now: datetime, send_fn, cancel_fn) -> dict:
    """Ensure each upcoming deadline has its 12h and 1h reminders scheduled.

    send_fn(heading, body, link, send_after_iso_or_None) -> notification_id
    cancel_fn(notification_id) -> None   (best-effort)

    Returns the updated state. Deterministic given (deadlines, state, now) so it
    is fully unit-testable without a network.
    """
    now_ts = now.timestamp()

    # Drop entries whose deadline is well in the past.
    for key in list(state):
        due = parse_dt(key) or parse_dt(state[key].get("dueAt") or "")
        if due is not None and now_ts - due.timestamp() > PRUNE_DAYS * 86400:
            state.pop(key)

    # Group visible, still-upcoming deadlines by exact dueAt so concurrent
    # deadlines collapse into a single push.
    groups: dict[str, list[dict]] = {}
    for d in deadlines:
        if not visible(d, now_ts):
            continue
        due = parse_dt(d.get("dueAt") or "")
        if due is None or due.timestamp() <= now_ts:
            continue
        groups.setdefault(d["dueAt"], []).append(d)
    for items in groups.values():
        items.sort(key=identity)

    have_feed = bool(deadlines)  # guard against a failed/empty sync nuking schedules

    # Cancel reminders for deadlines that vanished from a healthy feed.
    if have_feed:
        for due_iso in list(state):
            if due_iso in groups:
                continue
            for bucket in state[due_iso].get("buckets", {}).values():
                if bucket_is_pending(bucket, now):
                    cancel_fn(bucket["id"])
            state.pop(due_iso)

    # When the set of deadlines at a given time changes, the scheduled push text
    # is stale — cancel the still-pending ones so they get rescheduled below.
    for due_iso, items in groups.items():
        members = sorted(identity(d) for d in items)
        entry = state.get(due_iso)
        if entry is None:
            state[due_iso] = {"members": members, "buckets": {}}
            continue
        if entry.get("members") != members:
            for name, bucket in list(entry.get("buckets", {}).items()):
                if bucket_is_pending(bucket, now):
                    cancel_fn(bucket["id"])
                    del entry["buckets"][name]
            entry["members"] = members

    # Schedule whatever isn't already handled.
    for due_iso, items in groups.items():
        entry = state[due_iso]
        entry["members"] = sorted(identity(d) for d in items)
        buckets = entry.setdefault("buckets", {})
        due_dt = parse_dt(due_iso)
        for name, lead, phrase in BUCKETS:
            if name in buckets:  # already scheduled, sent, or intentionally skipped
                continue
            send_after = due_dt - lead
            if send_after <= now:
                # We're already past this lead time.
                if name == FINAL_BUCKET:
                    # Still before the deadline — send the final reminder now,
                    # with the real remaining time in the copy.
                    mins = (due_dt.timestamp() - now_ts) / 60
                    heading, body, link = build_message(items, time_until_phrase(mins), imminent=True)
                    nid = send_fn(heading, body, link, None)
                    buckets[name] = {"status": "sent", "id": nid, "sendAfter": None}
                else:
                    # Missed an early reminder; skip it (the final one still covers them).
                    buckets[name] = {"status": "sent", "id": None, "sendAfter": None}
                continue
            if send_after > now + MAX_SCHEDULE_AHEAD:
                continue  # too far out; a later run will schedule it
            heading, body, link = build_message(items, phrase, imminent=(name == FINAL_BUCKET))
            nid = send_fn(heading, body, link, send_after.isoformat())
            buckets[name] = {"status": "scheduled", "id": nid, "sendAfter": send_after.isoformat()}

    return state


# --- OneSignal HTTP wiring ----------------------------------------------

def _auth_headers() -> dict:
    return {
        "Authorization": f"Key {REST_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def onesignal_send(heading: str, body: str, link: str, send_after_iso):
    payload = {
        "app_id": APP_ID,
        "target_channel": "push",
        "included_segments": ["Total Subscriptions"],
        "headings": {"en": heading},
        "contents": {"en": body},
    }
    if link:
        payload["web_url"] = link
    if send_after_iso:
        payload["send_after"] = send_after_iso

    r = requests.post(ONESIGNAL_API, json=payload, headers=_auth_headers(), timeout=30)
    if not r.ok:
        print(f"  ERROR: OneSignal {r.status_code}: {r.text}", file=sys.stderr)
        r.raise_for_status()
    try:
        data = r.json()
    except ValueError as exc:
        raise RuntimeError(f"OneSignal returned non-JSON response: {r.text[:500]}") from exc

    notification_id = data.get("id")
    if data.get("errors") or not notification_id:
        raise RuntimeError("OneSignal did not accept the notification: " + json.dumps(data, sort_keys=True))
    # For scheduled sends OneSignal hasn't fanned out yet, so recipients can be 0
    # or absent; only enforce a real audience for immediate sends.
    if not send_after_iso and data.get("recipients") == 0:
        raise RuntimeError("OneSignal queued an immediate push with 0 recipients: " + json.dumps(data, sort_keys=True))

    when = f"scheduled for {send_after_iso}" if send_after_iso else "sent now"
    print(f"  OneSignal notification {notification_id} {when}")
    return notification_id


def onesignal_cancel(notification_id: str) -> None:
    if not notification_id:
        return
    try:
        r = requests.delete(
            f"{ONESIGNAL_API}/{notification_id}",
            params={"app_id": APP_ID},
            headers=_auth_headers(),
            timeout=30,
        )
        if r.ok:
            print(f"  cancelled scheduled notification {notification_id}")
        else:
            # Already delivered / already cancelled -> nothing to undo. Don't fail the run.
            print(f"  WARN: could not cancel {notification_id}: {r.status_code} {r.text}", file=sys.stderr)
    except requests.RequestException as exc:
        print(f"  WARN: cancel request for {notification_id} failed: {exc}", file=sys.stderr)


def main() -> None:
    if not APP_ID or not REST_API_KEY:
        raise SystemExit("ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY must be set")
    if not DEADLINES.exists():
        print("no deadlines.json yet, nothing to do")
        return

    data = json.loads(DEADLINES.read_text(encoding="utf-8"))
    deadlines = data.get("deadlines", []) or []
    state = load_state()
    now = datetime.now(timezone.utc)

    before = json.dumps(state, sort_keys=True)
    state = reconcile(deadlines, state, now, onesignal_send, onesignal_cancel)
    save_state(state)

    changed = json.dumps(state, sort_keys=True) != before
    print(f"reconciled {len(deadlines)} deadlines, tracking {len(state)} time slot(s)"
          + ("" if changed else " (no changes)"))


if __name__ == "__main__":
    main()
