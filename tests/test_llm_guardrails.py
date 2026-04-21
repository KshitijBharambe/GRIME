"""Tests for LLM guardrails runtime support."""

from __future__ import annotations

import importlib
import json
from pathlib import Path

import pytest


def _load_module(module_name: str):
    try:
        return importlib.import_module(module_name)
    except ModuleNotFoundError:
        return None


@pytest.fixture()
def manifest_dir(tmp_path: Path) -> Path:
    backend_manifest = {
        "version": 1,
        "manifest": "backend-coupling",
        "rules": [
            {
                "id": "backend-model-field",
                "description": "Model field change",
                "domains": ["backend", "database"],
                "changed_paths": ["api/app/models.py"],
                "related_paths": ["api/app/schemas.py"],
                "required_reads": ["docs/llm/playbooks/change-model-field.md"],
                "required_checks": ["cd api && pytest tests/test_services.py -q"],
                "severity": "critical",
                "breakage_conditions": ["schema drift"],
            }
        ],
    }
    frontend_manifest = {
        "version": 1,
        "manifest": "frontend-coupling",
        "rules": [
            {
                "id": "frontend-api-contract",
                "description": "API contract change",
                "domains": ["backend", "frontend"],
                "changed_paths": ["frontend/src/lib/api.ts"],
                "related_paths": ["frontend/src/types/api.ts"],
                "required_reads": ["docs/llm/playbooks/change-api-contract.md"],
                "required_checks": ["cd frontend && npm run build"],
                "severity": "high",
                "breakage_conditions": ["type drift"],
            }
        ],
    }
    (tmp_path / "backend-coupling.json").write_text(
        json.dumps(backend_manifest), encoding="utf-8"
    )
    (tmp_path / "frontend-coupling.json").write_text(
        json.dumps(frontend_manifest), encoding="utf-8"
    )
    return tmp_path


def test_load_manifests_returns_rules(manifest_dir: Path):
    module = _load_module("llm_guardrails.manifest_loader")
    assert module is not None

    manifests = module.load_manifests(manifest_dir)

    assert len(manifests) == 2
    assert manifests[0].rules[0].id == "backend-model-field"


def test_analyzer_reports_related_paths_and_ordered_domains(manifest_dir: Path):
    loader_module = _load_module("llm_guardrails.manifest_loader")
    analyzer_module = _load_module("llm_guardrails.impact_analyzer")
    assert loader_module is not None
    assert analyzer_module is not None

    manifests = loader_module.load_manifests(manifest_dir)
    analyzer = analyzer_module.ChangeImpactAnalyzer(manifests)

    report = analyzer.analyze(["api/app/models.py", "frontend/src/lib/api.ts"])

    assert report.triggered_rule_ids == ["backend-model-field", "frontend-api-contract"]
    assert report.impacted_domains == ["backend", "frontend", "database"]
    assert report.related_paths == ["api/app/schemas.py", "frontend/src/types/api.ts"]
    assert report.required_reads == [
        "docs/llm/playbooks/change-model-field.md",
        "docs/llm/playbooks/change-api-contract.md",
    ]
    assert report.severity == "critical"


def test_write_finding_creates_json_file(manifest_dir: Path, tmp_path: Path):
    loader_module = _load_module("llm_guardrails.manifest_loader")
    analyzer_module = _load_module("llm_guardrails.impact_analyzer")
    writer_module = _load_module("llm_guardrails.findings_writer")
    assert loader_module is not None
    assert analyzer_module is not None
    assert writer_module is not None

    manifests = loader_module.load_manifests(manifest_dir)
    analyzer = analyzer_module.ChangeImpactAnalyzer(manifests)
    report = analyzer.analyze(["api/app/models.py"])

    output_path = writer_module.write_finding(
        report, findings_dir=tmp_path, slug="model-change"
    )

    assert output_path.exists()
    payload = json.loads(output_path.read_text(encoding="utf-8"))
    assert payload["summary"] == report.summary
    assert payload["triggered_rule_ids"] == ["backend-model-field"]


def test_cli_outputs_text_and_writes_finding(
    manifest_dir: Path, tmp_path: Path, capsys
):
    cli_module = _load_module("llm_guardrails.cli")
    assert cli_module is not None

    findings_dir = tmp_path / "findings"

    exit_code = cli_module.main(
        [
            "--manifest-dir",
            str(manifest_dir),
            "--findings-dir",
            str(findings_dir),
            "--write-finding",
            "api/app/models.py",
        ]
    )

    captured = capsys.readouterr()

    assert exit_code == 0
    assert "backend-model-field" in captured.out
    assert len(list(findings_dir.glob("*.json"))) == 1


def test_cli_normalizes_repo_relative_paths(manifest_dir: Path, capsys):
    cli_module = _load_module("llm_guardrails.cli")
    assert cli_module is not None

    exit_code = cli_module.main(
        ["--manifest-dir", str(manifest_dir), "./api/app/models.py"]
    )

    captured = capsys.readouterr()

    assert exit_code == 0
    assert "backend-model-field" in captured.out


def test_real_manifests_match_direct_route_and_hook_files():
    loader_module = _load_module("llm_guardrails.manifest_loader")
    analyzer_module = _load_module("llm_guardrails.impact_analyzer")
    assert loader_module is not None
    assert analyzer_module is not None

    manifests = loader_module.load_manifests()
    analyzer = analyzer_module.ChangeImpactAnalyzer(manifests)

    route_report = analyzer.analyze(["api/app/routes/rules.py"])
    hook_report = analyzer.analyze(["frontend/src/lib/hooks/useRules.ts"])
    model_report = analyzer.analyze(["api/app/models.py"])

    assert "frontend-api-contract" in route_report.triggered_rule_ids
    assert "frontend-query-cache" in hook_report.triggered_rule_ids
    assert "backend-model-field" in model_report.triggered_rule_ids
    assert "backend-rule-versioning" not in model_report.triggered_rule_ids


def test_cli_fails_closed_when_manifest_dir_is_missing(tmp_path: Path, capsys):
    cli_module = _load_module("llm_guardrails.cli")
    assert cli_module is not None

    exit_code = cli_module.main(
        ["--manifest-dir", str(tmp_path / "missing-manifests"), "api/app/models.py"]
    )

    captured = capsys.readouterr()

    assert exit_code == 1
    assert "manifest" in captured.err.lower()
