/**
 * Shared quality score threshold definitions.
 * Single source of truth for score → tier → color mappings used across
 * quality-overview, QualityMetrics, and the executions detail page.
 *
 * Thresholds (0–100 scale):
 *   ≥ 90  → Excellent (green)
 *   ≥ 70  → Good (teal)
 *   ≥ 50  → Needs Improvement (yellow)
 *    < 50  → Critical (red)
 *
 * A secondary "score utility" scale is used in QualityMetrics / ScoreCard
 * where the bands are slightly different (≥80 / ≥60 / ≥40) because it
 * deals with per-metric values rather than aggregate dataset quality.
 */

// ── Primary quality tier thresholds (dataset-level) ─────────────────────────

export const QUALITY_TIER_THRESHOLDS = {
  excellent: {
    min: 90,
    color: "text-green-400",
    bg: "bg-green-400/10",
    label: "Excellent",
  },
  good: {
    min: 70,
    color: "text-teal-400",
    bg: "bg-teal-400/10",
    label: "Good",
  },
  warning: {
    min: 50,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    label: "Needs Improvement",
  },
  critical: {
    min: 0,
    color: "text-red-400",
    bg: "bg-red-400/10",
    label: "Critical",
  },
} as const;

export type QualityTierKey = keyof typeof QUALITY_TIER_THRESHOLDS;

/** Return the tier object for a 0–100 quality score. */
export function getQualityTier(score: number) {
  if (score >= QUALITY_TIER_THRESHOLDS.excellent.min)
    return QUALITY_TIER_THRESHOLDS.excellent;
  if (score >= QUALITY_TIER_THRESHOLDS.good.min)
    return QUALITY_TIER_THRESHOLDS.good;
  if (score >= QUALITY_TIER_THRESHOLDS.warning.min)
    return QUALITY_TIER_THRESHOLDS.warning;
  return QUALITY_TIER_THRESHOLDS.critical;
}

/** Badge variant derived from a dataset quality score. */
export function getScoreVariant(
  score: number,
): "default" | "secondary" | "destructive" | "outline" {
  if (score >= 90) return "default";
  if (score >= 70) return "secondary";
  return "destructive";
}

/** Status string used by quality-overview metric objects. */
export function getQualityStatus(score: number): "good" | "warning" | "poor" {
  if (score >= 90) return "good";
  if (score >= 75) return "warning";
  return "poor";
}

// ── Per-metric score thresholds (QualityMetrics / ScoreCard) ─────────────────

export const SCORE_THRESHOLDS = {
  good: { min: 80, label: "Good" },
  fair: { min: 60, label: "Fair" },
  poor: { min: 40, label: "Poor" },
  bad: { min: 0, label: "Bad" },
} as const;

/** Tailwind text-color class for a per-metric score value. */
export function getScoreColor(score: number): string {
  if (score >= SCORE_THRESHOLDS.good.min) return "text-green-600";
  if (score >= SCORE_THRESHOLDS.fair.min) return "text-yellow-600";
  if (score >= SCORE_THRESHOLDS.poor.min) return "text-orange-600";
  return "text-red-600";
}

/** Tailwind bg-color class for a per-metric score value. */
export function getScoreBgColor(score: number): string {
  if (score >= SCORE_THRESHOLDS.good.min) return "bg-green-100";
  if (score >= SCORE_THRESHOLDS.fair.min) return "bg-yellow-100";
  if (score >= SCORE_THRESHOLDS.poor.min) return "bg-orange-100";
  return "bg-red-100";
}

/** Badge variant for a per-metric score value. */
export function getScoreBadgeVariant(
  score: number,
): "default" | "secondary" | "destructive" | "outline" {
  if (score >= SCORE_THRESHOLDS.good.min) return "default";
  if (score >= SCORE_THRESHOLDS.fair.min) return "secondary";
  return "destructive";
}

/** Human-readable label for a per-metric score (used in compact badges). */
export function getScoreLabel(score: number): string {
  if (score >= SCORE_THRESHOLDS.good.min) return SCORE_THRESHOLDS.good.label;
  if (score >= SCORE_THRESHOLDS.fair.min) return SCORE_THRESHOLDS.fair.label;
  if (score >= SCORE_THRESHOLDS.poor.min) return SCORE_THRESHOLDS.poor.label;
  return SCORE_THRESHOLDS.bad.label;
}
