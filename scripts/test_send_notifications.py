#!/usr/bin/env python3
"""Unit tests for the scheduling logic in send_notifications.reconcile().

No network, no pytest — plain asserts so it runs anywhere with stdlib + the
module under test. The OneSignal HTTP layer is injected (send_fn / cancel_fn)
so we assert on *what would be sent* without touching the API.

Run:  python scripts/test_send_notifications.py
"""
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# The module reads ONESIGNAL_* at import time; supply dummies before importing.
os.environ.setdefault("ONESIGNAL_APP_ID", "test-app")
os.environ.setdefault("ONESIGNAL_REST_API_KEY", "test-key")
sys.path.insert(0, str(Path(__file__).resolve().parent))

import send_notifications as sn  # noqa: E402

UTC = timezone.utc


def deadline(course, block, due_iso, title="1.1 CLA #1", category="cla",
             course_name="Test Course", link=""):
    return {
        "courseId": course,
        "blockId": block,
        "dueAt": due_iso,
        "title": title,
        "category": category,
        "courseName": course_name,
        "link": link,
        "learnerHasAccess": True,
        "courseArchived": False,
    }


class Recorder:
    """Captures send/cancel calls and hands back deterministic notification ids."""

    def __init__(self):
        self.sends = []      # list of dict(heading, body, link, send_after)
        self.cancels = []    # list of notification ids
        self._n = 0

    def send(self, heading, body, link, send_after):
        self._n += 1
        nid = f"nid-{self._n}"
        self.sends.append({"heading": heading, "body": body, "link": link,
                           "send_after": send_after, "id": nid})
        return nid

    def cancel(self, notif_id):
        self.cancels.append(notif_id)


# --- tiny test harness ---------------------------------------------------
_failures = []


def check(cond, msg):
    if not cond:
        _failures.append(msg)
        print(f"  FAIL: {msg}")
    else:
        print(f"  ok:   {msg}")


def run(name, fn):
    print(f"\n== {name} ==")
    fn()


# --- tests ---------------------------------------------------------------

def test_schedules_both_buckets_at_exact_lead_times():
    """The core regression: reminders are scheduled for due-12h and due-1h,
    decoupled from when reconcile() runs. This is what makes delivery land ~1h
    before instead of whenever the cron happens to fire."""
    now = datetime(2026, 7, 23, 12, 0, tzinfo=UTC)
    due = "2026-08-12T22:30:00+05:30"
    r = Recorder()
    state = sn.reconcile([deadline("C1", "B1", due)], {}, now, r.send, r.cancel)

    check(len(r.sends) == 2, f"exactly 2 pushes scheduled (got {len(r.sends)})")
    due_dt = datetime.fromisoformat(due)
    by_after = {s["send_after"] for s in r.sends}
    want_12h = (due_dt - timedelta(hours=12)).isoformat()
    want_1h = (due_dt - timedelta(hours=1)).isoformat()
    check(want_12h in by_after, f"12h reminder scheduled for {want_12h}")
    check(want_1h in by_after, f"1h reminder scheduled for {want_1h}")

    # The 1h push must deliver exactly one hour before the deadline, NOT at run time.
    one_h = next(s for s in r.sends if s["send_after"] == want_1h)
    delivered = datetime.fromisoformat(one_h["send_after"])
    lead_min = (due_dt - delivered).total_seconds() / 60
    check(lead_min == 60, f"1h push lead time is 60 min (got {lead_min})")
    check(r.cancels == [], "nothing cancelled on a fresh schedule")

    buckets = state[due]["buckets"]
    check(buckets.get("12h", {}).get("status") == "scheduled", "12h tracked as scheduled")
    check(buckets.get("1h", {}).get("status") == "scheduled", "1h tracked as scheduled")


def test_idempotent_no_double_schedule():
    now = datetime(2026, 7, 23, 12, 0, tzinfo=UTC)
    due = "2026-08-12T22:30:00+05:30"
    r1 = Recorder()
    state = sn.reconcile([deadline("C1", "B1", due)], {}, now, r1.send, r1.cancel)
    r2 = Recorder()
    sn.reconcile([deadline("C1", "B1", due)], state, now + timedelta(hours=1),
                 r2.send, r2.cancel)
    check(len(r2.sends) == 0, f"second run schedules nothing (got {len(r2.sends)})")
    check(len(r2.cancels) == 0, "second run cancels nothing")


def test_concurrent_deadlines_collapse_into_one_push():
    now = datetime(2026, 7, 23, 12, 0, tzinfo=UTC)
    due = "2026-08-12T22:30:00+05:30"
    r = Recorder()
    sn.reconcile(
        [deadline("C1", "B1", due, title="1.1 CLA #1"),
         deadline("C2", "B2", due, title="2.2 Project", category="assignment")],
        {}, now, r.send, r.cancel)
    check(len(r.sends) == 2, f"2 deadlines at same time => 2 pushes total, not 4 (got {len(r.sends)})")
    check(all("2 deadlines" in s["body"] for s in r.sends),
          "combined push body mentions '2 deadlines'")


def test_new_member_at_scheduled_time_reschedules():
    now = datetime(2026, 7, 23, 12, 0, tzinfo=UTC)
    due = "2026-08-12T22:30:00+05:30"
    r1 = Recorder()
    state = sn.reconcile([deadline("C1", "B1", due)], {}, now, r1.send, r1.cancel)
    old_ids = {b["id"] for b in state[due]["buckets"].values()}

    r2 = Recorder()
    state = sn.reconcile(
        [deadline("C1", "B1", due), deadline("C2", "B2", due, title="2.2 Project")],
        state, now + timedelta(minutes=5), r2.send, r2.cancel)
    check(set(r2.cancels) == old_ids, "stale single-deadline pushes cancelled")
    check(len(r2.sends) == 2, f"rescheduled 2 combined pushes (got {len(r2.sends)})")
    check(all("2 deadlines" in s["body"] for s in r2.sends), "new pushes cover both deadlines")


def test_removed_deadline_is_cancelled():
    now = datetime(2026, 7, 23, 12, 0, tzinfo=UTC)
    due = "2026-08-12T22:30:00+05:30"
    other_due = "2026-08-20T22:30:00+05:30"
    r1 = Recorder()
    state = sn.reconcile([deadline("C1", "B1", due)], {}, now, r1.send, r1.cancel)
    ids = {b["id"] for b in state[due]["buckets"].values()}

    # C1 is gone but the feed is still healthy (another deadline present).
    r2 = Recorder()
    state = sn.reconcile([deadline("C9", "B9", other_due)], state,
                         now + timedelta(hours=1), r2.send, r2.cancel)
    check(set(r2.cancels) == ids, "pending pushes for the removed deadline are cancelled")
    check(due not in state, "removed deadline dropped from state")


def test_empty_feed_does_not_cancel_anything():
    """A failed/empty sync must never nuke already-scheduled reminders."""
    now = datetime(2026, 7, 23, 12, 0, tzinfo=UTC)
    due = "2026-08-12T22:30:00+05:30"
    r1 = Recorder()
    state = sn.reconcile([deadline("C1", "B1", due)], {}, now, r1.send, r1.cancel)
    r2 = Recorder()
    state = sn.reconcile([], state, now + timedelta(hours=1), r2.send, r2.cancel)
    check(r2.cancels == [], "empty feed cancels nothing")
    check(due in state, "scheduled reminders survive an empty feed")


def test_too_far_out_defers_scheduling():
    now = datetime(2026, 7, 23, 12, 0, tzinfo=UTC)
    due = "2026-08-25T22:30:00+05:30"  # ~33 days out, beyond OneSignal's 30d cap
    r = Recorder()
    state = sn.reconcile([deadline("C1", "B1", due)], {}, now, r.send, r.cancel)
    check(len(r.sends) == 0, f"nothing scheduled when >29d out (got {len(r.sends)})")
    check(not state.get(due, {}).get("buckets"), "no buckets committed yet")


def test_late_deadline_sends_final_reminder_immediately():
    now = datetime(2026, 7, 23, 12, 0, tzinfo=UTC)
    due = "2026-07-23T18:00:00+05:30"  # 12:30 UTC -> 30 min from now
    r = Recorder()
    state = sn.reconcile([deadline("C1", "B1", due)], {}, now, r.send, r.cancel)
    check(len(r.sends) == 1, f"only the final reminder goes out (got {len(r.sends)})")
    check(r.sends[0]["send_after"] is None, "final reminder sent immediately (no send_after)")
    check("30 minutes" in r.sends[0]["body"], f"body shows real remaining time: {r.sends[0]['body']!r}")
    check(state[due]["buckets"]["12h"]["status"] == "sent", "missed 12h bucket marked done, not resent")


def test_migrates_legacy_state():
    """Old state used key 'course|block|due' with a 'sent' list. Migrated state
    must not resend the 12h reminder, but should still schedule the 1h."""
    now = datetime(2026, 7, 23, 12, 0, tzinfo=UTC)
    due = "2026-08-12T22:30:00+05:30"
    legacy = {f"C1|B1|{due}": {"dueAt": due, "sent": ["12h"]}}
    r = Recorder()
    state = sn.reconcile([deadline("C1", "B1", due)], sn.migrate_state(legacy),
                         now, r.send, r.cancel)
    check(len(r.sends) == 1, f"only the 1h reminder is scheduled (got {len(r.sends)})")
    check(r.sends[0]["send_after"] == (datetime.fromisoformat(due) - timedelta(hours=1)).isoformat(),
          "the newly scheduled push is the 1h reminder")
    check(state[due]["buckets"]["12h"]["status"] == "sent", "legacy 12h stays 'sent'")


if __name__ == "__main__":
    run("schedules both buckets at exact lead times", test_schedules_both_buckets_at_exact_lead_times)
    run("idempotent (no double schedule)", test_idempotent_no_double_schedule)
    run("concurrent deadlines collapse into one push", test_concurrent_deadlines_collapse_into_one_push)
    run("new member reschedules the group", test_new_member_at_scheduled_time_reschedules)
    run("removed deadline is cancelled", test_removed_deadline_is_cancelled)
    run("empty feed cancels nothing", test_empty_feed_does_not_cancel_anything)
    run("too-far-out defers scheduling", test_too_far_out_defers_scheduling)
    run("late deadline sends final reminder now", test_late_deadline_sends_final_reminder_immediately)
    run("migrates legacy state", test_migrates_legacy_state)

    print("\n" + "=" * 60)
    if _failures:
        print(f"{len(_failures)} check(s) FAILED")
        for f in _failures:
            print(f"  - {f}")
        sys.exit(1)
    print("all checks passed")
