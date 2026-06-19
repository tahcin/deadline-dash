#!/usr/bin/env python3
"""Fetch IIMBx deadlines and write public/deadlines.json."""
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

LMS = "https://iimbx.edu.in"
UA = "deadline-dash-sync/1.0"


def login(session: requests.Session, email: str, password: str) -> None:
    r = session.get(f"{LMS}/login", headers={"User-Agent": UA})
    r.raise_for_status()
    csrf = session.cookies.get("csrftoken")
    if not csrf:
        raise SystemExit("no csrftoken cookie set by /login")
    r = session.post(
        f"{LMS}/api/user/v1/account/login_session/",
        data={"email": email, "password": password, "remember": "true"},
        headers={
            "X-CSRFToken": csrf,
            "Referer": f"{LMS}/login",
            "User-Agent": UA,
        },
    )
    r.raise_for_status()
    body = r.json()
    if not body.get("success"):
        raise SystemExit(f"login failed: {body}")


def fetch_courses(session: requests.Session) -> list[dict]:
    r = session.get(f"{LMS}/api/learner_home/init/", headers={"User-Agent": UA})
    r.raise_for_status()
    out = []
    for c in r.json().get("courses", []) or []:
        run = c.get("courseRun") or {}
        course_id = run.get("courseId")
        name = (c.get("course") or {}).get("courseName")
        if not course_id or not name:
            continue
        out.append({
            "courseId": course_id,
            "name": name,
            "isArchived": bool(run.get("isArchived")),
        })
    return out


def fetch_dates(session: requests.Session, course_id: str) -> list[dict]:
    r = session.get(
        f"{LMS}/api/course_home/v1/dates/{course_id}",
        headers={"User-Agent": UA},
    )
    if not r.ok:
        print(f"  WARN: dates fetch for {course_id} returned {r.status_code}", file=sys.stderr)
        return []
    return r.json().get("course_date_blocks", []) or []


def categorize(assignment_type: str) -> str:
    t = assignment_type.lower()
    # Continuous Learning Assessments arrive either spelled out or abbreviated
    # ("CLA"/"CLAs") depending on the course's grading config in the LMS.
    if "continuous learning assessment" in t or re.search(r"\bclas?\b", t):
        return "cla"
    if "mid-term" in t or "midterm" in t:
        return "midterm"
    if "project" in t:
        return "assignment"
    if "live" in t or "webinar" in t or "session" in t:
        return "liveSession"
    return "other"


GRACE_SECONDS = 24 * 3600


def is_relevant(d: dict, now_ts: float) -> bool:
    if not d["learnerHasAccess"]: return False
    if d["courseArchived"]: return False
    try:
        from datetime import datetime as _dt
        due = _dt.fromisoformat(d["dueAt"]).timestamp()
    except Exception:
        return False
    if now_ts > due + GRACE_SECONDS:
        return False
    return True


def main() -> None:
    email = os.environ["IIMBX_EMAIL"]
    password = os.environ["IIMBX_PASSWORD"]

    s = requests.Session()
    login(s, email, password)
    courses = fetch_courses(s)
    print(f"found {len(courses)} enrolled courses")

    deadlines = []
    for course in courses:
        for b in fetch_dates(s, course["courseId"]):
            if b.get("date_type") != "assignment-due-date":
                continue
            assignment_type = (b.get("assignment_type") or "").strip()
            deadlines.append({
                "courseId": course["courseId"],
                "courseName": course["name"],
                "courseArchived": course["isArchived"],
                "title": b.get("title") or "",
                "assignmentType": assignment_type,
                "category": categorize(assignment_type),
                "dueAt": b.get("date"),
                "complete": bool(b.get("complete")),
                "learnerHasAccess": bool(b.get("learner_has_access")),
                "link": b.get("link") or "",
                "blockId": b.get("first_component_block_id") or "",
            })

    now_ts = datetime.now(timezone.utc).timestamp()
    total = len(deadlines)
    deadlines = [d for d in deadlines if is_relevant(d, now_ts)]
    relevant_course_ids = {d["courseId"] for d in deadlines}
    courses = [c for c in courses if c["courseId"] in relevant_course_ids]
    deadlines.sort(key=lambda d: d["dueAt"] or "")

    out = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "courses": courses,
        "deadlines": deadlines,
    }
    target = Path(__file__).resolve().parent.parent / "public" / "deadlines.json"
    target.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(deadlines)}/{total} relevant deadlines across {len(courses)} courses to {target}")


if __name__ == "__main__":
    main()
