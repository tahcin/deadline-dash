#!/usr/bin/env python3
"""Fetch IIMBx deadlines and write public/deadlines.json."""
import json
import os
import re
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import unquote

import certifi
import requests

LMS = "https://iimbx.edu.in"
UA = "deadline-dash-sync/1.0"

# iimbx.edu.in serves an incomplete/mismatched certificate chain: its leaf
# (*.iimbx.edu.in) is issued by DigiCert "RapidSSL TLS RSA CA G1", but the
# server bundles unrelated Sectigo intermediates, so clients can't build a
# trust path ("unable to get local issuer certificate"). We supply the correct
# intermediate ourselves and let it chain to the DigiCert root in certifi —
# this keeps TLS verification fully enabled rather than disabling it.
_INTERMEDIATE = Path(__file__).resolve().parent / "certs" / "RapidSSLTLSRSACAG1.pem"


def make_ca_bundle() -> str:
    """Return a CA bundle path: certifi roots plus the missing intermediate."""
    bundle = certifi.contents() + "\n" + _INTERMEDIATE.read_text(encoding="utf-8")
    fd, path = tempfile.mkstemp(prefix="iimbx-ca-", suffix=".pem")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(bundle)
    return path


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


# Retest/retake runs (e.g. "EP41x_RE" / "... - Retest") are enrollments
# specific to the synced account, not batch-wide deadlines, so they are
# excluded from the public feed.
RETEST_NAME_RE = re.compile(r"\bre-?tests?\b|\bre-?takes?\b", re.I)


def is_retest(course_id: str, name: str) -> bool:
    parts = course_id.split("+")
    code = parts[1] if len(parts) >= 3 else ""
    return bool(RETEST_NAME_RE.search(name)) or code.upper().endswith("_RE")


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
        if is_retest(course_id, name):
            print(f"skipping retest course: {name} ({course_id})")
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


# --- Outlook calendar live sessions --------------------------------------
#
# IIMBx never stores upcoming live session times in the LMS (see
# IIMBX_API_FINDINGS.md §4.5); they arrive as Teams invites in the learner's
# Outlook calendar. OUTLOOK_ICS_URL points at that calendar's published ICS
# feed. The feed contains the person's ENTIRE calendar, so extraction is
# deliberately strict: an event is kept only if its subject names a live
# session AND it carries Teams-meeting evidence, and only whitelisted fields
# (course, session type, start time, join link) are ever written out.

WINDOWS_TZ = {
    "India Standard Time": timezone(timedelta(hours=5, minutes=30)),
    "UTC": timezone.utc,
}
LIVE_SUMMARY_RE = re.compile(r"live\s+session", re.I)
# "<Course> Course: SME Live Session" / "<Course> - Faculty Live Session"
LIVE_SPLIT_RE = re.compile(
    r"^(?P<course>.+?)\s*(?:Course\s*:|[-–:])\s*"
    r"(?P<title>(?:[\w/]+\s+)*Live\s+Session(?:\s*\d+)?)\s*$",
    re.I,
)
BATCH_PREFIX_RE = re.compile(r"^B\d+\s*T\d+\s*:\s*", re.I)
TEAMS_LINK_RE = re.compile(r"https://teams\.microsoft\.com/l/meetup-join/[^\s<>\"'\\]+", re.I)
SAFELINKS_TEAMS_RE = re.compile(r"url=(https%3A%2F%2Fteams\.microsoft\.com[^&\s\"'<>]+)", re.I)


def ics_unescape(value: str) -> str:
    return (value.replace("\\n", "\n").replace("\\N", "\n")
            .replace("\\,", ",").replace("\\;", ";").replace("\\\\", "\\"))


def ics_unfold(text: str) -> list[str]:
    lines: list[str] = []
    for raw in text.replace("\r\n", "\n").split("\n"):
        if raw[:1] in (" ", "\t") and lines:
            lines[-1] += raw[1:]
        else:
            lines.append(raw)
    return lines


def parse_vevents(text: str) -> list[dict]:
    """Each event maps property name -> list of (full key with params, value)."""
    events: list[dict] = []
    cur: dict | None = None
    for line in ics_unfold(text):
        if line == "BEGIN:VEVENT":
            cur = {}
        elif line == "END:VEVENT":
            if cur is not None:
                events.append(cur)
            cur = None
        elif cur is not None and ":" in line:
            key, val = line.split(":", 1)
            cur.setdefault(key.split(";")[0].upper(), []).append((key, val))
    return events


def ics_first(ev: dict, name: str) -> str:
    vals = ev.get(name)
    return vals[0][1] if vals else ""


def parse_ics_dt(key: str, value: str) -> datetime | None:
    """DTSTART with a Windows TZID or UTC 'Z' -> aware datetime; else None."""
    try:
        if value.endswith("Z"):
            return datetime.strptime(value, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
        m = re.search(r"TZID=([^;:]+)", key)
        tz = WINDOWS_TZ.get(m.group(1).strip()) if m else None
        if tz is None:
            return None
        return datetime.strptime(value, "%Y%m%dT%H%M%S").replace(tzinfo=tz)
    except ValueError:
        return None  # all-day events (VALUE=DATE) and malformed stamps


def teams_link(text: str) -> str:
    m = SAFELINKS_TEAMS_RE.search(text)
    if m:
        return unquote(m.group(1))
    m = TEAMS_LINK_RE.search(text)
    return m.group(0) if m else ""


def norm_course_name(name: str) -> str:
    n = re.sub(r"\s+", " ", name).strip().casefold().replace("'", "")
    n = re.sub(r"\s*-\s*\d+$", "", n)     # "Name - 1" -> "Name"
    return re.sub(r"\s+course$", "", n)   # "Name Course" -> "Name"


def split_live_summary(summary: str) -> tuple[str, str]:
    s = BATCH_PREFIX_RE.sub("", summary).strip()
    m = LIVE_SPLIT_RE.match(s)
    if m:
        return m.group("course").strip(), m.group("title").strip()
    return s, "Live Session"


def live_sessions_from_ics(text: str, courses: list[dict]) -> list[dict]:
    by_name = {norm_course_name(c["name"]): c for c in courses}
    out: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for ev in parse_vevents(text):
        summary = ics_unescape(ics_first(ev, "SUMMARY")).strip()
        if not LIVE_SUMMARY_RE.search(summary):
            continue
        if summary.lower().startswith("cancel"):
            continue
        status = ics_first(ev, "STATUS").strip().upper()
        if status and status != "CONFIRMED":
            continue
        location = ics_unescape(ics_first(ev, "LOCATION"))
        link = teams_link(ics_first(ev, "DESCRIPTION")) or teams_link(location)
        if not link and "teams" not in location.lower():
            continue  # no Teams-meeting evidence: keep non-course events out
        dt_entries = ev.get("DTSTART")
        if not dt_entries:
            continue
        start = parse_ics_dt(*dt_entries[0])
        if start is None:
            print(f"  WARN: skipping live session with unparseable start: {summary!r}",
                  file=sys.stderr)
            continue
        uid = ics_first(ev, "UID") or summary
        dedupe_key = (uid, dt_entries[0][1])
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        course_name, title = split_live_summary(summary)
        matched = by_name.get(norm_course_name(course_name))
        out.append({
            "courseId": matched["courseId"] if matched else "",
            "courseName": matched["name"].strip() if matched else course_name,
            "courseArchived": bool(matched["isArchived"]) if matched else False,
            "title": title,
            "assignmentType": "Live Session",
            "category": "liveSession",
            "dueAt": start.isoformat(),
            "complete": False,
            "learnerHasAccess": True,
            "link": link,
            "blockId": f"ics:{uid}",
        })
    return out


def fetch_live_sessions(courses: list[dict]) -> list[dict]:
    url = os.environ.get("OUTLOOK_ICS_URL", "").strip()
    if not url:
        return []
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=60)
        r.raise_for_status()
    except requests.RequestException as exc:
        print(f"  WARN: calendar feed fetch failed: {exc}", file=sys.stderr)
        return []
    sessions = live_sessions_from_ics(r.text, courses)
    print(f"found {len(sessions)} live sessions in calendar feed")
    return sessions


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
    s.verify = make_ca_bundle()
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

    deadlines.extend(fetch_live_sessions(courses))

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
