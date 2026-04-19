from __future__ import annotations

import argparse
import sys

from .findings_writer import write_finding
from .impact_analyzer import ChangeImpactAnalyzer
from .manifest_loader import load_manifests
from .models import ImpactReport


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Analyze LLM guardrail impact for changed paths."
    )
    parser.add_argument(
        "changed_paths", nargs="+", help="Changed repository paths to analyze."
    )
    parser.add_argument(
        "--manifest-dir", help="Directory containing JSON guardrail manifests."
    )
    parser.add_argument("--findings-dir", help="Directory to write JSON findings into.")
    parser.add_argument(
        "--write-finding",
        action="store_true",
        help="Write the report to a JSON finding file.",
    )
    parser.add_argument(
        "--format",
        choices=("text", "json"),
        default="text",
        help="Output format.",
    )
    return parser


def _render_text(report: ImpactReport) -> str:
    lines = [
        f"summary: {report.summary}",
        f"severity: {report.severity or 'none'}",
        f"triggered_rule_ids: {', '.join(report.triggered_rule_ids) or 'none'}",
        f"impacted_domains: {', '.join(report.impacted_domains) or 'none'}",
        f"related_paths: {', '.join(report.related_paths) or 'none'}",
        f"required_reads: {', '.join(report.required_reads) or 'none'}",
        f"required_checks: {', '.join(report.required_checks) or 'none'}",
    ]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        manifests = load_manifests(args.manifest_dir)
    except (FileNotFoundError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 1

    report = ChangeImpactAnalyzer(manifests).analyze(args.changed_paths)

    if args.write_finding:
        write_finding(report, findings_dir=args.findings_dir)

    if args.format == "json":
        print(report.model_dump_json(indent=2))
    else:
        print(_render_text(report))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
