"""Analyzer package.

These names must match the functions the modules actually define. The previous
version imported `generate_analysis` and `score_donor_influence`, neither of
which exists, so every import through this package raised ImportError -
including data-pipeline/src/orchestrator.py.
"""

from .llm_client import query_llm
from .policy_alignment import analyze_policy_alignment
from .donor_influence import flag_donor_influence
from .media_tracer import detect_media_echo

__all__ = [
    "query_llm",
    "analyze_policy_alignment",
    "flag_donor_influence",
    "detect_media_echo",
]
