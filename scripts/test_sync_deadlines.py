#!/usr/bin/env python3
"""Unit tests for the exclusion filters in sync_deadlines.

No network, no pytest, plain asserts.

Run:  python scripts/test_sync_deadlines.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import sync_deadlines as sd  # noqa: E402


def test_is_retest():
    assert sd.is_retest("course-v1:IIMBx+EP41x_RE+BBA_DBE_B1_Aug_Sep_2026", "Entrepreneurial Hypothesis Testing")
    assert sd.is_retest("course-v1:IIMBx+EP41x+Run1", "Entrepreneurial Hypothesis Testing - Retest")
    assert sd.is_retest("course-v1:IIMBx+EP41x+Run1", "Something Re-take")
    assert not sd.is_retest("course-v1:IIMBx+EP41x+Run1", "Entrepreneurial Hypothesis Testing")
    assert not sd.is_retest("course-v1:IIMBx_DBE+DBE_001+2024", "Welcome to DBE: 2024")


def test_is_reading_material():
    assert sd.is_reading_material("Programme Manual", "Programme Manual")
    assert sd.is_reading_material("Learner Manual", "Learner Manual")
    assert sd.is_reading_material("Social Media Manual", "Social Media Guidelines")
    assert sd.is_reading_material("", "Student Handbook")
    # Real assessments must survive, even ones with "project" or "CLA" in them.
    assert not sd.is_reading_material("Continuous Learning Assessment", "CLA 1")
    assert not sd.is_reading_material("Project Submission", "Phase 2 Submission")
    assert not sd.is_reading_material("Final Project", "Final Project")
    assert not sd.is_reading_material("Live Session", "SME Live Session")
    # "manual" only counts as a whole word.
    assert not sd.is_reading_material("Project", "Manually graded quiz")


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for t in tests:
        t()
        print(f"ok  {t.__name__}")
    print(f"{len(tests)} tests passed")
