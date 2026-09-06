"""Derive a bill's legislative status from its BILLSTATUS action list.

Two facts about GovInfo BILLSTATUS XML drive everything in this module:

1. Actions are listed **newest first**. Code that treats ``actions[-1]`` as the
   latest action is reading the *oldest* one.
2. Action text alone is not a reliable signal. Real bills contain lines like
   "Amendment SA 5488 agreed to in Senate", "Rule H. Res. 774 passed House" and
   "On motion to recommit Failed by the Yeas and Nays" — all of which look like
   chamber passage or failure to a naive substring match, and none of which are.

So status is derived from the structured ``type`` and ``actionCode`` fields
where they exist, falling back to the canonical "Passed/agreed to in <chamber>:"
text forms only when they don't. Status is the *highest rung any action
reaches*, computed over the whole list, which makes it independent of ordering.
"""

from __future__ import annotations

import re
from typing import Iterable, Mapping, Sequence

# Status vocabulary. These exact strings are what the web app matches on, so
# changing one is a breaking change for web/app/analysis/page.tsx.
INTRODUCED = "Introduced"
IN_COMMITTEE = "In Committee"
REPORTED = "Reported by Committee"
PASSED_HOUSE = "Passed House"
PASSED_SENATE = "Passed Senate"
PASSED_BOTH = "Passed Both Chambers"
SIGNED = "Signed into Law"
FAILED = "Failed"

# Library of Congress action codes (sourceSystem "Library of Congress").
CODE_BECAME_LAW = {"36000"}
CODE_VETOED = {"29000"}
CODE_PASSED_HOUSE = {"8000"}
CODE_PASSED_SENATE = {"17000"}
CODE_FAILED_HOUSE = {"9000"}
CODE_FAILED_SENATE = {"18000"}
CODE_REPORTED = {"5000", "5500"}

# Chamber-specific codes: House "H" / Senate "S" prefixes plus an executive "E"
# series. E40000 is "Became Public Law", E30000 "Signed by President".
CODE_BECAME_LAW_EXEC = {"E40000", "E30000"}

_CANONICAL_PASSED_HOUSE = re.compile(r"passed\s*/\s*agreed to in house\s*:", re.I)
_CANONICAL_PASSED_SENATE = re.compile(r"passed\s*/\s*agreed to in senate\s*:", re.I)
_BECAME_LAW_TEXT = re.compile(r"became (public|private) law|signed by president", re.I)
_VETO_TEXT = re.compile(r"\bvetoed by president\b|\bpocket vetoed\b", re.I)
# Only genuine failures of the measure itself — not "motion to recommit Failed".
_FAILED_TEXT = re.compile(
    r"failed of passage|failed to pass|failed of adoption|"
    r"motion to proceed .* rejected|measure (failed|rejected)",
    re.I,
)
_REPORTED_TEXT = re.compile(r"\breported (by|to|original)\b|\breported \(amended\)", re.I)
_COMMITTEE_TEXT = re.compile(r"referred to (the )?(committee|subcommittee)|committee on", re.I)


def _get(action: Mapping, *names: str) -> str:
    for n in names:
        v = action.get(n)
        if v:
            return str(v)
    return ""


def derive_status(actions: Iterable[Mapping]) -> str:
    """Return the highest status any action in ``actions`` reaches.

    Each action is a mapping with a ``text`` key and, optionally, ``type`` and
    ``action_code`` (or ``actionCode``). Order does not matter.
    """
    became_law = vetoed = failed = False
    passed_house = passed_senate = reported = in_committee = False

    for action in actions or ():
        text = _get(action, "text")
        atype = _get(action, "type")
        code = _get(action, "action_code", "actionCode")
        low = text.lower()

        if atype == "BecameLaw" or code in CODE_BECAME_LAW or code in CODE_BECAME_LAW_EXEC:
            became_law = True
        elif _BECAME_LAW_TEXT.search(low):
            became_law = True

        if code in CODE_VETOED or _VETO_TEXT.search(low):
            vetoed = True

        if code in CODE_FAILED_HOUSE or code in CODE_FAILED_SENATE or _FAILED_TEXT.search(low):
            failed = True

        if code in CODE_PASSED_HOUSE or _CANONICAL_PASSED_HOUSE.search(low):
            passed_house = True
        if code in CODE_PASSED_SENATE or _CANONICAL_PASSED_SENATE.search(low):
            passed_senate = True

        if code in CODE_REPORTED or _REPORTED_TEXT.search(low):
            reported = True
        if _COMMITTEE_TEXT.search(low):
            in_committee = True

    if became_law:
        return SIGNED
    if vetoed or failed:
        return FAILED
    if passed_house and passed_senate:
        return PASSED_BOTH
    if passed_house:
        return PASSED_HOUSE
    if passed_senate:
        return PASSED_SENATE
    if reported:
        return REPORTED
    if in_committee:
        return IN_COMMITTEE
    return INTRODUCED


def sort_newest_first(actions: Iterable[Mapping]) -> list:
    """Sort actions newest-first by ``date``, preserving input order on ties.

    BILLSTATUS already arrives newest-first, so a stable sort keeps document
    order among same-day actions.
    """
    return sorted(actions or (), key=lambda a: _get(a, "date", "actionDate"), reverse=True)


def latest_action(actions: Sequence[Mapping]) -> dict | None:
    """The most recent action, or None. Never ``actions[-1]``."""
    ordered = sort_newest_first(actions)
    return dict(ordered[0]) if ordered else None


def most_recent_actions(actions: Sequence[Mapping], n: int = 5) -> list:
    """The ``n`` most recent actions, newest first."""
    return [dict(a) for a in sort_newest_first(actions)[:n]]
