import type { Node, Edge } from "@xyflow/react";

export type ConditionNodeData = {
  blockType: string;
  label: string;
  column: string;
  operator: string;
  value: string;
  valueMin: string;
  valueMax: string;
  apiKind: string;
  categoryColor: string;
};

export type GroupNodeData = {
  combinator: "AND" | "OR";
  label: string;
};

export type FlowNode = Node<ConditionNodeData, "condition"> | Node<GroupNodeData, "group">;
export type FlowEdge = Edge<{ logic: "AND" | "OR" }>;

export interface CanvasRule {
  kind: string;
  name: string;
  params: Record<string, unknown>;
  canvas_graph?: {
    nodes: FlowNode[];
    edges: FlowEdge[];
  };
}
