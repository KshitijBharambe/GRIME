import type { FlowNode, FlowEdge, CanvasRule, ConditionNodeData, GroupNodeData } from "./types";
import { BLOCK_TYPES } from "@/lib/rules/blockPaletteConfig";

export function serializeToRule(
  nodes: FlowNode[],
  edges: FlowEdge[],
  ruleName: string,
): CanvasRule {
  const conditionNodes = nodes.filter((n) => n.type === "condition") as import("@xyflow/react").Node<ConditionNodeData, "condition">[];
  const groupNodes = nodes.filter((n) => n.type === "group") as import("@xyflow/react").Node<GroupNodeData, "group">[];

  // Single condition, no groups → use the native apiKind directly
  if (conditionNodes.length === 1 && groupNodes.length === 0) {
    const node = conditionNodes[0];
    const d = node.data;
    const def = BLOCK_TYPES[d.blockType];
    const params = buildSingleConditionParams(d);
    return {
      kind: d.apiKind || "custom",
      name: ruleName,
      params,
      canvas_graph: { nodes, edges },
    };
  }

  // Multi-condition → custom boolean_group
  const conditions = conditionNodes.map((n) => {
    const d = n.data;
    // Find which group this condition connects to
    const outEdge = edges.find((e) => e.source === n.id);
    const groupId = outEdge?.target ?? null;
    const group = groupNodes.find((g) => g.id === groupId);
    return {
      nodeId: n.id,
      groupId,
      blockType: d.blockType,
      column: d.column,
      operator: d.operator,
      value: d.value,
      valueMin: d.valueMin,
      valueMax: d.valueMax,
      apiKind: d.apiKind,
    };
  });

  const groups = groupNodes.map((g) => ({
    nodeId: g.id,
    combinator: g.data.combinator,
    label: g.data.label,
    conditionIds: edges
      .filter((e) => e.target === g.id)
      .map((e) => e.source),
  }));

  const allColumns = [...new Set(conditionNodes.map((n) => n.data.column).filter(Boolean))];

  return {
    kind: "custom",
    name: ruleName,
    params: {
      type: "boolean_group",
      conditions,
      groups,
      columns: allColumns,
    },
    canvas_graph: { nodes, edges },
  };
}

function buildSingleConditionParams(d: ConditionNodeData): Record<string, unknown> {
  const base: Record<string, unknown> = { columns: [d.column].filter(Boolean) };

  switch (d.apiKind) {
    case "missing_data":
      return { ...base, type: d.blockType === "not_empty" ? "not_empty" : "not_null" };
    case "regex":
      return { ...base, patterns: [d.value].filter(Boolean) };
    case "value_list":
      return {
        ...base,
        allowed_values: d.operator === "in"
          ? d.value.split(",").map((v) => v.trim()).filter(Boolean)
          : undefined,
        forbidden_values: d.operator === "not in"
          ? d.value.split(",").map((v) => v.trim()).filter(Boolean)
          : undefined,
      };
    case "length_range":
      return {
        ...base,
        min_length: d.valueMin ? Number(d.valueMin) : undefined,
        max_length: d.valueMax ? Number(d.valueMax) : undefined,
      };
    case "char_restriction":
      return {
        ...base,
        type: d.blockType.replace("char_", "") as string,
      };
    case "standardization":
      return { ...base, type: d.blockType.replace("_format", "") };
    default:
      return {
        ...base,
        type: "python_expression",
        expression: d.value || "",
      };
  }
}

export function deserializeFromRule(rule: CanvasRule): { nodes: FlowNode[]; edges: FlowEdge[] } {
  if (rule.canvas_graph) {
    return rule.canvas_graph;
  }
  return { nodes: [], edges: [] };
}
