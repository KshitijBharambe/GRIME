"""AI assistance service scaffold for rule building and issue analysis."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Placeholder — swap with real LLM client when ready (e.g. Anthropic SDK)
_AI_ENABLED = False


class AIService:
    """Scaffold for AI-assisted rule generation and issue analysis.

    All methods return stub responses when AI is disabled (default).
    Wire in a real model by setting _AI_ENABLED=True and implementing
    the _call_llm helper.
    """

    def suggest_rules_for_dataset(
        self,
        dataset_id: str,
        column_profiles: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Return AI-generated rule suggestions based on column profiles."""
        if not _AI_ENABLED:
            return [
                {
                    "rule_kind": "missing_data",
                    "target_columns": [c["name"] for c in column_profiles if c.get("null_pct", 0) > 0],
                    "confidence": 0.9,
                    "reasoning": "Columns with null values detected.",
                    "source": "heuristic",
                }
            ]
        return self._call_llm_rule_suggestions(dataset_id, column_profiles)

    def analyze_issues(
        self,
        issues: list[dict[str, Any]],
        dataset_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Return AI analysis and fix recommendations for a set of issues."""
        if not _AI_ENABLED:
            return {
                "summary": f"{len(issues)} issues detected. Enable AI for detailed analysis.",
                "top_patterns": [],
                "recommended_fixes": [],
                "source": "heuristic",
            }
        return self._call_llm_issue_analysis(issues, dataset_context)

    def explain_rule(self, rule_definition: dict[str, Any]) -> str:
        """Return a plain-English explanation of a rule definition."""
        if not _AI_ENABLED:
            kind = rule_definition.get("kind", "unknown")
            return f"This rule checks for {kind.replace('_', ' ')} violations."
        return self._call_llm_explain_rule(rule_definition)

    # ------------------------------------------------------------------
    # Private LLM helpers (implement when enabling AI)
    # ------------------------------------------------------------------

    def _call_llm_rule_suggestions(
        self, dataset_id: str, column_profiles: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        raise NotImplementedError("LLM integration not yet configured")

    def _call_llm_issue_analysis(
        self,
        issues: list[dict[str, Any]],
        dataset_context: dict[str, Any] | None,
    ) -> dict[str, Any]:
        raise NotImplementedError("LLM integration not yet configured")

    def _call_llm_explain_rule(self, rule_definition: dict[str, Any]) -> str:
        raise NotImplementedError("LLM integration not yet configured")
