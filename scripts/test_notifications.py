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


def build_message(items, minutes_until, imminent):
    time_phrase = time_until_phrase(minutes_until)
    if len(items) == 1:
        d = items[0]
        heading = "Deadline imminent" if imminent else "Deadline reminder"
        body = f"{deadline_phrase(d)} is due in {time_phrase}"
        link = d.get("link") or ""
    else:
        n = len(items)
        heading = f"{n} deadlines imminent" if imminent else f"{n} deadlines due soon"
        preview = "; ".join(deadline_phrase(d) for d in items[:3])
        if n > 3:
            preview += f"; +{n - 3} more"
        body = f"{n} deadlines due in {time_phrase}: {preview}"
        link = ""
    return heading, body, link


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
    "title": "Doubt-clearing session",
    "courseName": "Marketing Analytics",
    "category": "liveSession",
    "link": "",
}

CASES = [
    ("single CLA · T-24h",         [CLA],                           23 * 60, False),
    ("single Mid-Term · T-24h",    [MIDTERM],                       24 * 60, False),
    ("single Project · T-24h",     [PROJECT],                       22 * 60, False),
    ("single Live Session · T-24h",[LIVE],                          20 * 60, False),
    ("single CLA · T-1h imminent", [CLA],                           45,      True),
    ("single Project · T-1h",      [PROJECT],                       30,      True),
    ("2 deadlines · T-24h",        [CLA, PROJECT],                  23 * 60, False),
    ("5 deadlines · T-24h (+2)",   [CLA, MIDTERM, PROJECT, LIVE, CLA], 23 * 60, False),
    ("2 deadlines · T-1h",         [CLA, PROJECT],                  45,      True),
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
    for i, (label, items, minutes_until, imminent) in enumerate(selected, start=1):
        heading, body, link = build_message(items, minutes_until, imminent)
        print(f"[{i}/{len(selected)}] {label}")
        print(f"  heading: {heading}")
        print(f"  body:    {body}")
        send(args.app_id, args.api_key, args.subscription_id, heading, body, link)
        if i < len(selected):
            time.sleep(args.delay)


if __name__ == "__main__":
    main()
