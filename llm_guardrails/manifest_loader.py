from __future__ import annotations

from pathlib import Path

from .models import GuardrailManifest


def default_manifest_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "docs" / "llm" / "manifests"


def load_manifests(manifest_dir: str | Path | None = None) -> list[GuardrailManifest]:
    directory = (
        Path(manifest_dir) if manifest_dir is not None else default_manifest_dir()
    )
    if not directory.exists():
        raise FileNotFoundError(f"Manifest directory not found: {directory}")

    manifests: list[GuardrailManifest] = []
    for manifest_path in sorted(directory.glob("*.json")):
        manifests.append(
            GuardrailManifest.model_validate_json(
                manifest_path.read_text(encoding="utf-8")
            )
        )

    if not manifests:
        raise ValueError(f"No manifest files found in: {directory}")

    return manifests
