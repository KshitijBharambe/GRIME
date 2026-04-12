/**
 * Block Palette Configuration
 * Defines all block types, their categories, operators, and metadata.
 * Rule kinds map to the backend API: missing_data | standardization | value_list |
 * length_range | cross_field | char_restriction | regex | custom
 */

export type ValueInputKind =
  | "none"           // No value input (e.g. not_null)
  | "single"         // Single text input
  | "range"          // Two inputs: min + max
  | "list"           // Comma-separated list
  | "select"         // Dropdown of predefined options
  | "expression";    // Multi-line expression textarea

export interface SelectOption {
  value: string;
  label: string;
}

export interface BlockTypeDef {
  label: string;
  operators: string[];
  description: string;
  valueKind: ValueInputKind;
  valuePlaceholder?: string;
  valueMinPlaceholder?: string;  // For range kind
  valueMaxPlaceholder?: string;  // For range kind
  selectOptions?: SelectOption[]; // For select kind
  example?: string;
  /** API rule kind this block maps to, used when generating rule payload */
  apiKind?: string;
}

export const BLOCK_TYPES: Record<string, BlockTypeDef> = {
  // ── Presence (→ missing_data) ─────────────────────────────────────────────
  not_null: {
    label: "Not Null",
    operators: ["is not null"],
    description: "Column must have a value",
    valueKind: "none",
    example: "email IS NOT NULL → ✓ if email has any value",
    apiKind: "missing_data",
  },
  not_empty: {
    label: "Not Empty",
    operators: ["is not empty"],
    description: "String column must not be blank",
    valueKind: "none",
    example: 'name IS NOT EMPTY → ✗ if name is ""',
    apiKind: "missing_data",
  },

  // ── Length (→ length_range) ───────────────────────────────────────────────
  min_length: {
    label: "Min Length",
    operators: [">="],
    description: "String length at least N",
    valueKind: "single",
    valuePlaceholder: "e.g. 3",
    example: "LENGTH(name) >= 3",
    apiKind: "length_range",
  },
  max_length: {
    label: "Max Length",
    operators: ["<="],
    description: "String length at most N",
    valueKind: "single",
    valuePlaceholder: "e.g. 255",
    example: "LENGTH(description) <= 255",
    apiKind: "length_range",
  },
  length_range: {
    label: "Length Range",
    operators: ["between"],
    description: "String length within min–max bounds",
    valueKind: "range",
    valueMinPlaceholder: "min e.g. 2",
    valueMaxPlaceholder: "max e.g. 50",
    example: "LENGTH(name) BETWEEN 2 AND 50",
    apiKind: "length_range",
  },

  // ── Pattern / Format (→ regex | standardization) ──────────────────────────
  regex_match: {
    label: "Regex Match",
    operators: ["matches"],
    description: "Value matches a regex pattern",
    valueKind: "single",
    valuePlaceholder: "e.g. ^[A-Z]{2}\\d{4}$",
    example: "code MATCHES ^[A-Z]{2}\\d{4}$ → AB1234 ✓",
    apiKind: "regex",
  },
  email_format: {
    label: "Email Format",
    operators: ["matches email"],
    description: "Value must be a valid email address",
    valueKind: "none",
    example: "user@example.com → ✓, not-an-email → ✗",
    apiKind: "standardization",
  },
  url_format: {
    label: "URL Format",
    operators: ["matches url"],
    description: "Value must be a valid URL",
    valueKind: "none",
    example: "https://example.com → ✓, not-a-url → ✗",
    apiKind: "standardization",
  },
  phone_format: {
    label: "Phone Format",
    operators: ["matches phone"],
    description: "Value must be a valid phone number",
    valueKind: "none",
    example: "+1-555-0123 → ✓, abc → ✗",
    apiKind: "standardization",
  },
  date_format: {
    label: "Date Format",
    operators: ["matches date"],
    description: "Value must match a date format",
    valueKind: "single",
    valuePlaceholder: "e.g. %Y-%m-%d",
    example: "2024-01-15 matches %Y-%m-%d → ✓",
    apiKind: "standardization",
  },

  // ── Range / Comparison ────────────────────────────────────────────────────
  numeric_range: {
    label: "Numeric Range",
    operators: ["between"],
    description: "Number within min–max range",
    valueKind: "range",
    valueMinPlaceholder: "min e.g. 0",
    valueMaxPlaceholder: "max e.g. 100",
    example: "price BETWEEN 0, 100 → 50 ✓",
    apiKind: "custom",
  },
  greater_than: {
    label: "Greater Than",
    operators: [">"],
    description: "Value must be greater than threshold",
    valueKind: "single",
    valuePlaceholder: "e.g. 0",
    example: "price > 0 → 5.99 ✓, 0 ✗",
    apiKind: "custom",
  },
  less_than: {
    label: "Less Than",
    operators: ["<"],
    description: "Value must be less than threshold",
    valueKind: "single",
    valuePlaceholder: "e.g. 1000",
    example: "amount < 1000 → 500 ✓, 1500 ✗",
    apiKind: "custom",
  },
  equals: {
    label: "Equals",
    operators: ["=="],
    description: "Value must equal a specific value",
    valueKind: "single",
    valuePlaceholder: "e.g. active",
    example: 'status == "active"',
    apiKind: "custom",
  },
  not_equals: {
    label: "Not Equals",
    operators: ["!="],
    description: "Value must not equal a specific value",
    valueKind: "single",
    valuePlaceholder: "e.g. deleted",
    example: 'status != "deleted"',
    apiKind: "custom",
  },

  // ── Set / Values (→ value_list) ───────────────────────────────────────────
  allowed_values: {
    label: "Allowed Values",
    operators: ["in"],
    description: "Value must be in a defined set",
    valueKind: "list",
    valuePlaceholder: "e.g. active, inactive, pending",
    example: "status IN (active, inactive, pending)",
    apiKind: "value_list",
  },
  forbidden_values: {
    label: "Forbidden Values",
    operators: ["not in"],
    description: "Value must not be in a defined set",
    valueKind: "list",
    valuePlaceholder: "e.g. null, N/A, unknown",
    example: "col NOT IN (null, N/A, unknown)",
    apiKind: "value_list",
  },
  unique: {
    label: "Unique Values",
    operators: ["is unique"],
    description: "Column values must be unique",
    valueKind: "none",
    example: "id IS UNIQUE → no duplicate values",
    apiKind: "custom",
  },

  // ── Character Restriction (→ char_restriction) ────────────────────────────
  char_alphabetic: {
    label: "Alphabetic Only",
    operators: ["chars"],
    description: "Value must contain only letters",
    valueKind: "none",
    example: "name contains only [A-Za-z ]",
    apiKind: "char_restriction",
  },
  char_numeric: {
    label: "Numeric Only",
    operators: ["chars"],
    description: "Value must contain only digits",
    valueKind: "none",
    example: "zip_code contains only [0-9]",
    apiKind: "char_restriction",
  },
  char_alphanumeric: {
    label: "Alphanumeric Only",
    operators: ["chars"],
    description: "Value must contain only letters and digits",
    valueKind: "none",
    example: "code contains only [A-Za-z0-9]",
    apiKind: "char_restriction",
  },

  // ── Cross-Field (→ cross_field) ───────────────────────────────────────────
  cross_dependency: {
    label: "Field Dependency",
    operators: ["depends on"],
    description: "Field A required when Field B has a value",
    valueKind: "single",
    valuePlaceholder: "dependent_field",
    example: "email required when account_type = 'user'",
    apiKind: "cross_field",
  },
  cross_mutual_exclusion: {
    label: "Mutual Exclusion",
    operators: ["mutually exclusive"],
    description: "Only one of the listed fields can have a value",
    valueKind: "list",
    valuePlaceholder: "e.g. field_a, field_b",
    example: "card_number, bank_account are mutually exclusive",
    apiKind: "cross_field",
  },
  cross_conditional: {
    label: "Conditional Check",
    operators: ["if-then"],
    description: "If condition field has value X then target must have Y",
    valueKind: "expression",
    valuePlaceholder: 'e.g. IF status == "active" THEN email IS NOT NULL',
    example: 'IF status == "active" THEN email IS NOT NULL',
    apiKind: "cross_field",
  },
  cross_sum_check: {
    label: "Sum Check",
    operators: ["sum equals"],
    description: "Sum of fields must equal a total field or value",
    valueKind: "list",
    valuePlaceholder: "e.g. line_item_1, line_item_2, → total_amount",
    example: "SUM(items) == total_amount",
    apiKind: "cross_field",
  },

  // ── Statistical (→ custom with statistical params) ────────────────────────
  stat_outlier_iqr: {
    label: "IQR Outlier",
    operators: ["no outliers (IQR)"],
    description: "Flag values outside IQR bounds",
    valueKind: "single",
    valuePlaceholder: "IQR multiplier e.g. 1.5",
    example: "price: Q1 - 1.5×IQR < value < Q3 + 1.5×IQR",
    apiKind: "custom",
  },
  stat_outlier_zscore: {
    label: "Z-Score Outlier",
    operators: ["no outliers (Z-score)"],
    description: "Flag values beyond N standard deviations",
    valueKind: "single",
    valuePlaceholder: "threshold e.g. 3",
    example: "price: |z-score| < 3",
    apiKind: "custom",
  },
  stat_distribution: {
    label: "Distribution Check",
    operators: ["distribution"],
    description: "Values must follow expected statistical distribution",
    valueKind: "select",
    selectOptions: [
      { value: "normal", label: "Normal" },
      { value: "uniform", label: "Uniform" },
      { value: "exponential", label: "Exponential" },
    ],
    valuePlaceholder: "Select distribution…",
    example: "revenue follows normal distribution",
    apiKind: "custom",
  },
  stat_correlation: {
    label: "Correlation Check",
    operators: ["correlates with"],
    description: "Two columns must have expected correlation",
    valueKind: "single",
    valuePlaceholder: "other_column_name",
    example: "height correlates with weight (r > 0.5)",
    apiKind: "custom",
  },

  // ── Advanced / Custom (→ custom) ──────────────────────────────────────────
  custom_expression: {
    label: "Custom Expression",
    operators: ["expr"],
    description: "Write a custom SQL-like or Python expression",
    valueKind: "expression",
    valuePlaceholder: "e.g. LENGTH(col) > 0 AND col != 'N/A'",
    example: "LENGTH(col) > 0 AND col != 'N/A'",
    apiKind: "custom",
  },
  custom_python: {
    label: "Python Expression",
    operators: ["python"],
    description: "Evaluate a Python expression row-by-row",
    valueKind: "expression",
    valuePlaceholder: "e.g. len(str(value)) > 0 and value != 'N/A'",
    example: "isinstance(value, str) and value.strip() != ''",
    apiKind: "custom",
  },
};

// ── Category Definitions ──────────────────────────────────────────────────────

export interface PaletteCategoryDef {
  key: string;
  label: string;
  color: string;
  iconName: string;
  blocks: string[];
}

export const PALETTE_CATEGORIES: PaletteCategoryDef[] = [
  {
    key: "presence",
    label: "Presence",
    color: "var(--te-orange)",
    iconName: "CheckCircle",
    blocks: ["not_null", "not_empty"],
  },
  {
    key: "length",
    label: "Length",
    color: "#3B82F6",
    iconName: "Hash",
    blocks: ["min_length", "max_length", "length_range"],
  },
  {
    key: "pattern",
    label: "Pattern / Format",
    color: "#A855F7",
    iconName: "Tag",
    blocks: [
      "regex_match",
      "email_format",
      "url_format",
      "phone_format",
      "date_format",
    ],
  },
  {
    key: "range",
    label: "Range / Comparison",
    color: "#10B981",
    iconName: "Zap",
    blocks: ["numeric_range", "greater_than", "less_than", "equals", "not_equals"],
  },
  {
    key: "set",
    label: "Set / Values",
    color: "#F43F5E",
    iconName: "Layers",
    blocks: ["allowed_values", "forbidden_values", "unique"],
  },
  {
    key: "char",
    label: "Character Restriction",
    color: "#06B6D4",
    iconName: "Type",
    blocks: ["char_alphabetic", "char_numeric", "char_alphanumeric"],
  },
  {
    key: "cross",
    label: "Cross-Field",
    color: "#F59E0B",
    iconName: "GitMerge",
    blocks: ["cross_dependency", "cross_mutual_exclusion", "cross_conditional", "cross_sum_check"],
  },
  {
    key: "statistical",
    label: "Statistical",
    color: "#8B5CF6",
    iconName: "BarChart2",
    blocks: ["stat_outlier_iqr", "stat_outlier_zscore", "stat_distribution", "stat_correlation"],
  },
  {
    key: "advanced",
    label: "Advanced / Custom",
    color: "var(--te-concrete)",
    iconName: "Settings",
    blocks: ["custom_expression", "custom_python"],
  },
];

// ── Color map ─────────────────────────────────────────────────────────────────

export const BLOCK_COLORS: Record<string, string> = {
  // Presence
  not_null: "border-l-[var(--te-orange)]",
  not_empty: "border-l-[var(--te-orange)]",
  // Length
  min_length: "border-l-[#3B82F6]",
  max_length: "border-l-[#3B82F6]",
  length_range: "border-l-[#3B82F6]",
  // Pattern
  regex_match: "border-l-[#A855F7]",
  email_format: "border-l-[#A855F7]",
  url_format: "border-l-[#A855F7]",
  phone_format: "border-l-[#A855F7]",
  date_format: "border-l-[#A855F7]",
  // Range
  numeric_range: "border-l-[#10B981]",
  greater_than: "border-l-[#10B981]",
  less_than: "border-l-[#10B981]",
  equals: "border-l-[#10B981]",
  not_equals: "border-l-[#10B981]",
  // Set
  unique: "border-l-[var(--te-yellow)]",
  allowed_values: "border-l-[#F43F5E]",
  forbidden_values: "border-l-[#F43F5E]",
  // Char restriction
  char_alphabetic: "border-l-[#06B6D4]",
  char_numeric: "border-l-[#06B6D4]",
  char_alphanumeric: "border-l-[#06B6D4]",
  // Cross-field
  cross_dependency: "border-l-[#F59E0B]",
  cross_mutual_exclusion: "border-l-[#F59E0B]",
  cross_conditional: "border-l-[#F59E0B]",
  cross_sum_check: "border-l-[#F59E0B]",
  // Statistical
  stat_outlier_iqr: "border-l-[#8B5CF6]",
  stat_outlier_zscore: "border-l-[#8B5CF6]",
  stat_distribution: "border-l-[#8B5CF6]",
  stat_correlation: "border-l-[#8B5CF6]",
  // Advanced
  custom_expression: "border-l-[var(--te-concrete)]",
  custom_python: "border-l-[var(--te-concrete)]",
};

// ── Custom block infrastructure ───────────────────────────────────────────────

export interface CustomBlockDef {
  id: string;
  label: string;
  operator: string;
  description: string;
  needsValue: boolean;
  valuePlaceholder: string;
  colorClass: string;
}

export const CUSTOM_COLOR_OPTIONS = [
  { label: "Orange", value: "border-l-[var(--te-orange)]", dot: "bg-orange-500" },
  { label: "Blue",   value: "border-l-[#3B82F6]",          dot: "bg-blue-500"   },
  { label: "Purple", value: "border-l-[#A855F7]",          dot: "bg-purple-500" },
  { label: "Green",  value: "border-l-[#10B981]",          dot: "bg-emerald-500"},
  { label: "Yellow", value: "border-l-[var(--te-yellow)]", dot: "bg-yellow-500" },
  { label: "Rose",   value: "border-l-[#F43F5E]",          dot: "bg-rose-500"   },
  { label: "Gray",   value: "border-l-[var(--te-concrete)]",dot: "bg-gray-500"  },
  { label: "Cyan",   value: "border-l-[#06B6D4]",          dot: "bg-cyan-500"   },
  { label: "Amber",  value: "border-l-[#F59E0B]",          dot: "bg-amber-500"  },
];

export const CUSTOM_BLOCKS_STORAGE_KEY = "rule_builder_custom_blocks_v2";

export function loadCustomBlocks(): CustomBlockDef[] {
  if (globalThis.window === undefined) return [];
  try {
    const stored = localStorage.getItem(CUSTOM_BLOCKS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveCustomBlocks(defs: CustomBlockDef[]) {
  if (globalThis.window === undefined) return;
  localStorage.setItem(CUSTOM_BLOCKS_STORAGE_KEY, JSON.stringify(defs));
}

export function registerCustomBlocksIntoRegistry(defs: CustomBlockDef[]) {
  defs.forEach((def) => {
    const key = `user_${def.id}`;
    BLOCK_TYPES[key] = {
      label: def.label,
      operators: [def.operator],
      description: def.description,
      valueKind: def.needsValue ? "single" : "none",
      valuePlaceholder: def.valuePlaceholder || undefined,
      example: `Custom: ${def.label}`,
    };
    BLOCK_COLORS[key] = def.colorClass;
  });
}
