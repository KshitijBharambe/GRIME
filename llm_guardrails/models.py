from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

DomainName = Literal["backend", "frontend", "database", "infra"]
SeverityLevel = Literal["low", "medium", "high", "critical"]

DOMAIN_ORDER: tuple[DomainName, ...] = ("backend", "frontend", "database", "infra")
SEVERITY_ORDER: tuple[SeverityLevel, ...] = ("low", "medium", "high", "critical")


class GuardrailRule(BaseModel):
    id: str
    description: str
    domains: list[DomainName] = Field(default_factory=list)
    changed_paths: list[str] = Field(default_factory=list)
    related_paths: list[str] = Field(default_factory=list)
    required_reads: list[str] = Field(default_factory=list)
    required_checks: list[str] = Field(default_factory=list)
    severity: SeverityLevel
    breakage_conditions: list[str] = Field(default_factory=list)


class GuardrailManifest(BaseModel):
    version: int
    manifest: str
    rules: list[GuardrailRule] = Field(default_factory=list)


class ImpactReport(BaseModel):
    changed_paths: list[str] = Field(default_factory=list)
    triggered_rule_ids: list[str] = Field(default_factory=list)
    impacted_domains: list[DomainName] = Field(default_factory=list)
    related_paths: list[str] = Field(default_factory=list)
    required_reads: list[str] = Field(default_factory=list)
    required_checks: list[str] = Field(default_factory=list)
    severity: SeverityLevel | None = None
    summary: str
