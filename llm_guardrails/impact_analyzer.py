from __future__ import annotations

from collections.abc import Iterable, Sequence
from fnmatch import fnmatch
from pathlib import Path

from .models import (
    DOMAIN_ORDER,
    SEVERITY_ORDER,
    GuardrailManifest,
    GuardrailRule,
    ImpactReport,
    SeverityLevel,
)


REPO_ROOT = Path(__file__).resolve().parents[1]


def _dedupe(items: Iterable[str]) -> list[str]:
    return list(dict.fromkeys(items))


def _normalize_path(path: str) -> str:
    candidate = Path(path)
    if candidate.is_absolute():
        candidate_paths = [candidate.resolve(strict=False)]
    else:
        repo_candidate = (REPO_ROOT / candidate).resolve(strict=False)
        cwd_candidate = (Path.cwd() / candidate).resolve(strict=False)
        if path.startswith("../") or path.startswith("./"):
            candidate_paths = [cwd_candidate, repo_candidate]
        else:
            candidate_paths = [repo_candidate, cwd_candidate]

    for require_existing in (True, False):
        for resolved in candidate_paths:
            if require_existing and not resolved.exists():
                continue
            try:
                return resolved.relative_to(REPO_ROOT).as_posix()
            except ValueError:
                continue

    return path.replace("\\", "/")


def _matches_rule(changed_paths: Sequence[str], rule: GuardrailRule) -> bool:
    normalized_patterns = [_normalize_path(pattern) for pattern in rule.changed_paths]
    for changed_path in changed_paths:
        normalized_changed_path = _normalize_path(changed_path)
        if any(
            fnmatch(normalized_changed_path, pattern) for pattern in normalized_patterns
        ):
            return True
    return False


def _max_severity(rules: Sequence[GuardrailRule]) -> SeverityLevel | None:
    if not rules:
        return None

    severity_rank = {severity: index for index, severity in enumerate(SEVERITY_ORDER)}
    return max(rules, key=lambda rule: severity_rank[rule.severity]).severity


class ChangeImpactAnalyzer:
    def __init__(self, manifests: Sequence[GuardrailManifest]):
        self._manifests = list(manifests)

    def analyze(self, changed_paths: Sequence[str]) -> ImpactReport:
        normalized_paths = [_normalize_path(path) for path in changed_paths]
        matched_rules: list[GuardrailRule] = []

        for manifest in self._manifests:
            for rule in manifest.rules:
                if _matches_rule(normalized_paths, rule):
                    matched_rules.append(rule)

        impacted_domains = [
            domain
            for domain in DOMAIN_ORDER
            if any(domain in rule.domains for rule in matched_rules)
        ]
        severity = _max_severity(matched_rules)
        triggered_rule_ids = [rule.id for rule in matched_rules]
        related_paths = _dedupe(
            path for rule in matched_rules for path in rule.related_paths
        )
        required_reads = _dedupe(
            path for rule in matched_rules for path in rule.required_reads
        )
        required_checks = _dedupe(
            check for rule in matched_rules for check in rule.required_checks
        )

        if matched_rules:
            summary = f"{len(matched_rules)} guardrail rule(s) triggered"
        else:
            summary = "No guardrail rules triggered"

        return ImpactReport(
            changed_paths=normalized_paths,
            triggered_rule_ids=triggered_rule_ids,
            impacted_domains=impacted_domains,
            related_paths=related_paths,
            required_reads=required_reads,
            required_checks=required_checks,
            severity=severity,
            summary=summary,
        )
