"""Import smoke tests.

The analyzers package shipped with `from .llm_client import generate_analysis`
and `from .donor_influence import score_donor_influence` — neither function
exists. Because importing any submodule runs the package __init__ first, every
import path through analyzers/ raised ImportError, including orchestrator.py.
The whole layer was dead and nothing caught it. These tests catch it.
"""

import importlib
import os
import sys

import pytest

SRC = os.path.join(os.path.dirname(__file__), "..", "src")
sys.path.insert(0, os.path.abspath(SRC))


@pytest.mark.parametrize(
    "module",
    [
        "config",
        "db",
        "models",
        "utils",
        "analyzers",
        "analyzers.llm_client",
        "analyzers.donor_influence",
        "analyzers.media_echo",
        "analyzers.media_tracer",
        "analyzers.policy_alignment",
    ],
)
def test_module_imports(module):
    importlib.import_module(module)


def test_analyzers_exports_resolve():
    """Every name in __all__ must actually exist on the package."""
    analyzers = importlib.import_module("analyzers")
    missing = [n for n in analyzers.__all__ if not hasattr(analyzers, n)]
    assert not missing, f"__all__ names that don't exist: {missing}"


def test_llm_client_refuses_to_fabricate_without_a_key(monkeypatch):
    """A missing API key must fail loudly, not return a canned verdict.

    The old stub returned confidence 0.85, which cleared the > 0.75 gate in
    policy_alignment, so an unconfigured run wrote fabricated findings.
    """
    import asyncio

    import analyzers.llm_client as llm

    monkeypatch.setattr(llm, "OPENROUTER_API_KEY", "", raising=False)
    with pytest.raises(RuntimeError, match="OPENROUTER_API_KEY"):
        asyncio.run(llm.query_llm.__wrapped__("sys", "user"))
