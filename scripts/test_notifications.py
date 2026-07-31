#!/usr/bin/env python3
"""Preview every push notification variant on a single OneSignal subscription.

Targets ONLY the subscription id passed in (or the default below) — does not
fan out to all subscribed users. Wording mirrors scripts/send_notifications.py
so what you see in your notification tray is what real subscribers receive.

Usage:
    ONESIGNAL_REST_API_KEY=<rest_api_key> \
        python scripts/test_notifications.py

    # Filter to specific cases by label substring:
    ONESIGNAL_REST_API_KEY=... python scripts/test_notifications.py --case "1h"

    # Faster / slower pacing between sends:
    ONESIGNAL_REST_API_KEY=... python scripts/test_notifications.py --delay 2
"""
import argparse
import os
import re
import sys
import time

import requests

ONESIGNAL_API = "https://api.onesignal.com/notifications"
DEFAULT_APP_ID = "f2acf5a5-1a22-4313-8c55-58251657a7fe"
DEFAULT_SUBSCRIPTION = "19ed5d41-9562-4739-adab-1dd5ca10be77"

# Mirrors send_notifications.py.CATEGORY_LABELS — kept inline so this script
# is self-contained and the prod module's env-var requirements don't apply.
CATEGORY_LABELS = {
    "cla": "CLA",
    "midterm": "Mid-Term",
    "assignment": "Project",
    "liveSession": "Live Session",
}


def deadline_phrase(d):
    title = (d.get("title") or "").strip()
    course = d.get("courseName") or "your course"
    category = d.get("category", "other")
    type_label = CATEGORY_LABELS.get(category, "Assignment")
    m = re.match(r"^(\d+(?:\.\d+)?)\s+(.+)$", title)
    if m:
        prefix, rest = m.group(1), m.group(2)
        sm = re.search(r"(\d+)\s*$", rest)
        suffix = sm.group(1) if sm else None
        label = f"Module {prefix} {type_label}"
        if suffix:
            label += f" #{suffix}"
    else:
        label = title or type_label
    return f"{label} of {course}"


def time_until_phrase(minutes_until):
    if minutes_until < 60:
        m = max(1, round(minutes_until))
        return f"{m} minute{'s' if m != 1 else ''}"
    hours = round(minutes_until / 60)
    return f"{hours} hour{'s' if hours != 1 else ''}"


def live_phrase(d):
    title = (d.get("title") or "Live Session").strip()
    course = (d.get("courseName") or "your course").strip()
    return f"{title} for the {course} course"


# Mirrors send_notifications.py copy tables.
DEADLINE_COPY = {
    "12h": ("\U0001f6a8 12 Hours Remaining! \U0001f6a8", "is due in 12 HOURS! ⏳"),
    "1h": ("ONE HOUR LEFT ⏰", "is due in AN HOUR, HURRY UP! ⏳"),
}
LIVE_COPY = {
    "24h": ("Live Session Tomorrow! \U0001f3a5", "starts in 24 hours ⏳"),
    "1h": ("Live Session in an Hour ⏰", "starts in an hour. Be there!"),
    "5m": ("\U0001f534 Starting in 5 Minutes!", "starts in 5 minutes. JOIN NOW!"),
}
TIME_TEXT = {"12h": "12 HOURS", "1h": "AN HOUR", "24h": "24 hours", "5m": "5 MINUTES"}


def preview_list(items, phrase_fn):
    preview = "; ".join(phrase_fn(d) for d in items[:3])
    if len(items) > 3:
        preview += f"; +{len(items) - 3} more"
    return preview


def build_message(items, bucket, now_phrase=None):
    live = all(d.get("category") == "liveSession" for d in items)
    n = len(items)

    if live:
        heading, tail = LIVE_COPY.get(bucket, LIVE_COPY["5m"])
        if now_phrase:
            heading = "\U0001f534 Starting Soon!"
            tail = f"starts in {now_phrase}. JOIN NOW!"
        if n == 1:
            return heading, f"{live_phrase(items[0])} {tail}", items[0].get("link") or ""
        time_text = now_phrase or TIME_TEXT.get(bucket, bucket)
        return (f"\U0001f534 {n} Live Sessions Coming Up!",
                f"{n} live sessions starting in {time_text}: {preview_list(items, live_phrase)}",
                "")

    heading, tail = DEADLINE_COPY.get(bucket, DEADLINE_COPY["1h"])
    if now_phrase:
        heading = "\U0001f6a8 Deadline Alert! \U0001f6a8"
        tail = f"is due in {now_phrase}, HURRY UP! ⏳"
    if n == 1:
        return heading, f"{deadline_phrase(items[0])} {tail}", items[0].get("link") or ""
    time_text = now_phrase or TIME_TEXT.get(bucket, bucket)
    body = f"{n} deadlines due in {time_text}: {preview_list(items, deadline_phrase)}"
    if bucket != "12h" or now_phrase:
        body += " HURRY UP! ⏳"
    else:
        body += " ⏳"
    return f"\U0001f6a8 {n} Deadlines Due! \U0001f6a8", body, ""


# Synthetic deadlines covering each category and grouping.
CLA = {
    "title": "7.2 CLA #1",
    "courseName": "Digital Design Tools and Documentation & Presentation",
    "category": "cla",
    "link": "https://onlinedegree.iimb.ac.in/",
}
MIDTERM = {
    "title": "4 Mid-Term",
    "courseName": "New Product Development",
    "category": "midterm",
    "link": "",
}
PROJECT = {
    "title": "8 Project",
    "courseName": "Generating Entrepreneurial Resources",
    "category": "assignment",
    "link": "",
}
LIVE = {
    "title": "Faculty Live Session",
    "courseName": "Supply Chain & Logistics Management",
    "category": "liveSession",
    "link": "https://teams.microsoft.com/meet/42235243414245",
}

# (label, items, bucket, now_phrase)
CASES = [
    ("single CLA · 12h",           [CLA],                              "12h", None),
    ("single Mid-Term · 12h",      [MIDTERM],                          "12h", None),
    ("single Project · 1h",        [PROJECT],                          "1h",  None),
    ("single CLA · catch-up",      [CLA],                              "1h",  "7 minutes"),
    ("live session · 24h",         [LIVE],                             "24h", None),
    ("live session · 1h",          [LIVE],                             "1h",  None),
    ("live session · 5m",          [LIVE],                             "5m",  None),
    ("live session · catch-up",    [LIVE],                             "5m",  "2 minutes"),
    ("2 deadlines · 12h",          [CLA, PROJECT],                     "12h", None),
    ("5 deadlines · 12h (+2)",     [CLA, MIDTERM, PROJECT, CLA, CLA],  "12h", None),
    ("2 deadlines · 1h",           [CLA, PROJECT],                     "1h",  None),
]


def send(app_id, rest_key, subscription_id, heading, body, link):
    payload = {
        "app_id": app_id,
        # include_player_ids is the legacy-but-universally-supported field;
        # subscription IDs in the v16 SDK are the same UUIDs as player IDs.
        "include_player_ids": [subscription_id],
        "headings": {"en": heading},
        "contents": {"en": body},
    }
    if link:
        payload["web_url"] = link
    r = requests.post(
        ONESIGNAL_API,
        json=payload,
        headers={
            "Authorization": f"Key {rest_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        timeout=30,
    )
    print(f"  HTTP {r.status_code} → {r.text}")
    if not r.ok:
        r.raise_for_status()
    try:
        data = r.json()
    except ValueError:
        data = {}
    if data.get("recipients") == 0 or data.get("errors"):
        print(
            "  WARNING: OneSignal queued the push but matched 0 recipients or "
            "returned errors — check the response above. Common causes: REST "
            "API key belongs to a different app than app_id; subscription "
            "id is invalid for this app; subscription is opted out.",
            file=sys.stderr,
        )


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--app-id", default=os.environ.get("ONESIGNAL_APP_ID") or DEFAULT_APP_ID)
    p.add_argument("--api-key", default=os.environ.get("ONESIGNAL_REST_API_KEY"))
    p.add_argument("--subscription-id", default=DEFAULT_SUBSCRIPTION)
    p.add_argument("--case", help="run only cases whose label contains this substring")
    p.add_argument("--delay", type=float, default=4.0, help="seconds between sends")
    args = p.parse_args()

    if not args.api_key:
        sys.exit("set ONESIGNAL_REST_API_KEY in env (or pass --api-key)")

    selected = CASES
    if args.case:
        needle = args.case.lower()
        selected = [c for c in CASES if needle in c[0].lower()]
        if not selected:
            sys.exit(f"no case matched: {args.case!r}")

    print(f"sending {len(selected)} test push(es) to subscription {args.subscription_id}")
    print(f"app id: {args.app_id}")
    for i, (label, items, bucket, now_phrase) in enumerate(selected, start=1):
        heading, body, link = build_message(items, bucket, now_phrase)
        print(f"[{i}/{len(selected)}] {label}")
        print(f"  heading: {heading}")
        print(f"  body:    {body}")
        send(args.app_id, args.api_key, args.subscription_id, heading, body, link)
        if i < len(selected):
            time.sleep(args.delay)


if __name__ == "__main__":
    main()
