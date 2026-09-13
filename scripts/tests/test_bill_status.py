"""Tests for bill status derivation.

Every "trap" case below is real action text taken from GovInfo BILLSTATUS for
H.R. 5376 (Inflation Reduction Act) — each one defeats the naive substring
matching the original importer used.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from bill_status import (  # noqa: E402
    FAILED,
    IN_COMMITTEE,
    INTRODUCED,
    PASSED_BOTH,
    PASSED_HOUSE,
    PASSED_SENATE,
    REPORTED,
    SIGNED,
    derive_status,
    latest_action,
    most_recent_actions,
)


def a(text, date="2023-01-01", type="", code=""):
    return {"text": text, "date": date, "type": type, "action_code": code}


# --- the ladder ---------------------------------------------------------

def test_no_actions_is_introduced():
    assert derive_status([]) == INTRODUCED
    assert derive_status(None) == INTRODUCED


def test_referral_is_in_committee():
    assert derive_status([a("Referred to the Committee on Finance.")]) == IN_COMMITTEE


def test_reported_outranks_committee():
    assert derive_status([
        a("Referred to the Committee on Finance."),
        a("Reported by the Committee on Finance.", code="5000"),
    ]) == REPORTED


def test_single_chamber_passage():
    assert derive_status([a("Passed/agreed to in House: On passage Passed.", code="8000")]) == PASSED_HOUSE
    assert derive_status([a("Passed/agreed to in Senate: Passed Senate.", code="17000")]) == PASSED_SENATE


def test_both_chambers():
    assert derive_status([
        a("Passed/agreed to in House: On passage Passed.", code="8000"),
        a("Passed/agreed to in Senate: Passed Senate.", code="17000"),
    ]) == PASSED_BOTH


def test_became_law_wins_over_everything():
    assert derive_status([
        a("Referred to the Committee on Finance."),
        a("Passed/agreed to in House: On passage Passed.", code="8000"),
        a("Became Public Law No: 117-169.", type="BecameLaw", code="36000"),
    ]) == SIGNED


def test_status_is_order_independent():
    """The original bug: an older action could overwrite a newer one."""
    actions = [
        a("Became Public Law No: 117-169.", date="2022-08-16", type="BecameLaw"),
        a("Passed/agreed to in Senate: Passed Senate.", date="2022-08-07", code="17000"),
        a("Referred to the Committee on Finance.", date="2021-09-27"),
    ]
    assert derive_status(actions) == SIGNED
    assert derive_status(list(reversed(actions))) == SIGNED


# --- the traps ----------------------------------------------------------

def test_amendment_agreed_to_in_senate_is_not_passage():
    """Real text. 'agreed to in Senate' here describes an amendment, not the bill."""
    assert derive_status([
        a("Amendment SA 5488 agreed to in Senate by Yea-Nay Vote. 51 - 50."),
    ]) == INTRODUCED


def test_rule_passed_house_is_not_bill_passage():
    """A House resolution providing for consideration is not the bill passing."""
    assert derive_status([a("Rule H. Res. 774 passed House.")]) == INTRODUCED


def test_motion_to_recommit_failed_is_not_bill_failure():
    """The original classifier matched a bare 'failed' and terminated here."""
    assert derive_status([
        a("On motion to recommit Failed by the Yeas and Nays: 208 - 220 (Roll no. 384)."),
        a("Passed/agreed to in House: On passage Passed.", code="8000"),
    ]) == PASSED_HOUSE


def test_genuine_failure_is_recorded():
    assert derive_status([a("Failed of passage in Senate by Yea-Nay Vote.", code="18000")]) == FAILED


def test_veto_is_failure_even_after_both_chambers():
    assert derive_status([
        a("Passed/agreed to in House: On passage Passed.", code="8000"),
        a("Passed/agreed to in Senate: Passed Senate.", code="17000"),
        a("Vetoed by President.", code="29000"),
    ]) == FAILED


def test_became_law_detected_from_text_without_codes():
    """Older/other sources may not carry actionCode."""
    assert derive_status([a("Signed by President.")]) == SIGNED


# --- ordering helpers ---------------------------------------------------

def test_latest_action_is_newest_not_last():
    """BILLSTATUS arrives newest-first, so actions[-1] is the OLDEST action."""
    actions = [
        a("Became Public Law No: 117-169.", date="2022-08-16"),
        a("Passed Senate.", date="2022-08-07"),
        a("Introduced in House.", date="2021-09-27"),
    ]
    assert latest_action(actions)["text"] == "Became Public Law No: 117-169."


def test_latest_action_of_empty_is_none():
    assert latest_action([]) is None


def test_most_recent_actions_keeps_the_newest_n():
    actions = [a(f"action {i}", date=f"2023-01-{i:02d}") for i in range(1, 11)]
    got = most_recent_actions(actions, 3)
    assert [g["text"] for g in got] == ["action 10", "action 9", "action 8"]


@pytest.mark.parametrize("n", [0, 1, 5, 100])
def test_most_recent_actions_respects_n(n):
    actions = [a(f"x{i}", date=f"2023-01-{i:02d}") for i in range(1, 6)]
    assert len(most_recent_actions(actions, n)) == min(n, 5)
