from __future__ import annotations

import re
from pathlib import Path

from .models import ImpactReport


def default_findings_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "docs" / "llm" / "memory" / "findings"


def _slugify(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return normalized or "impact-report"


def write_finding(
    report: ImpactReport,
    findings_dir: str | Path | None = None,
    slug: str | None = None,
) -> Path:
    directory = (
        Path(findings_dir) if findings_dir is not None else default_findings_dir()
    )
    directory.mkdir(parents=True, exist_ok=True)

    file_slug = _slugify(slug or "-".join(report.triggered_rule_ids) or "impact-report")
    output_path = directory / f"{file_slug}.json"
    output_path.write_text(report.model_dump_json(indent=2), encoding="utf-8")
    return output_path
