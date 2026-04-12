// ═══════════════════════════════════════════════════════════════
// Shared UI tokens — severity maps, icon sizing, and re-exports
// of the canonical quality threshold functions from lib/thresholds.ts
// ═══════════════════════════════════════════════════════════════

// Re-export quality threshold utilities from canonical source
export {
  QUALITY_TIER_THRESHOLDS as QUALITY_THRESHOLDS,
  getQualityTier,
  getScoreVariant,
  getQualityStatus,
} from "@/lib/thresholds";
export type { QualityTierKey as QualityTier } from "@/lib/thresholds";

// Severity → badge-color mapping (light-mode palette for Badge backgrounds)
export const SEVERITY_COLORS = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
} as const;

// Severity → text-color mapping used in inline labels
export const SEVERITY_TEXT_COLORS = {
  critical: "text-red-600",
  high: "text-orange-600",
  medium: "text-yellow-600",
  low: "text-blue-600",
} as const;

// Severity → chart-hex mapping
export const SEVERITY_CHART_COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
} as const;

// Standardised icon sizes — three canonical sizes only
export const ICON_SIZES = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
} as const;
