"use client";

import { memo, useState, useCallback } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { BLOCK_TYPES, PALETTE_CATEGORIES } from "@/lib/rules/blockPaletteConfig";
import type { ConditionNodeData } from "./types";
import { cn } from "@/lib/utils";
import { X, ChevronDown } from "lucide-react";

const CATEGORY_COLOR_MAP: Record<string, string> = {};
PALETTE_CATEGORIES.forEach((cat) => {
  cat.blocks.forEach((b) => {
    CATEGORY_COLOR_MAP[b] = cat.color;
  });
});

function ConditionNode({ id, data, selected }: { id: string; data: ConditionNodeData; selected?: boolean }) {
  const { setNodes } = useReactFlow();
  const [expanded, setExpanded] = useState(true);
  const def = BLOCK_TYPES[data.blockType];
  const color = data.categoryColor || CATEGORY_COLOR_MAP[data.blockType] || "#6b7280";

  const update = useCallback(
    (field: keyof ConditionNodeData, value: string) => {
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n,
        ),
      );
    },
    [id, setNodes],
  );

  const remove = useCallback(() => {
    setNodes((nodes) => nodes.filter((n) => n.id !== id));
  }, [id, setNodes]);

  return (
    <div
      className={cn(
        "relative min-w-[200px] max-w-[260px] rounded-lg border bg-background shadow-sm transition-shadow",
        selected ? "border-[var(--te-orange)] shadow-md" : "border-border",
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center gap-1.5 min-w-0"
        >
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-[11px] font-semibold text-foreground truncate">
            {def?.label ?? data.blockType}
          </span>
          <ChevronDown
            className={cn(
              "w-3 h-3 text-muted-foreground ml-auto transition-transform",
              !expanded && "-rotate-90",
            )}
          />
        </button>
        <button
          onClick={remove}
          className="text-muted-foreground hover:text-destructive transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {expanded && (
        <div className="px-2.5 pb-2.5 flex flex-col gap-1.5">
          {/* Column */}
          <input
            value={data.column}
            onChange={(e) => update("column", e.target.value)}
            placeholder="column name"
            className="nodrag w-full h-6 rounded-sm border border-border bg-muted px-2 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--te-orange)]"
          />

          {/* Operator pill */}
          <div className="text-[10px] text-muted-foreground px-0.5">
            {def?.operators[0] ?? data.operator}
          </div>

          {/* Value input(s) */}
          {def?.valueKind === "range" ? (
            <div className="flex gap-1">
              <input
                value={data.valueMin}
                onChange={(e) => update("valueMin", e.target.value)}
                placeholder={def.valueMinPlaceholder ?? "min"}
                className="nodrag flex-1 h-6 rounded-sm border border-border bg-muted px-2 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--te-orange)]"
              />
              <input
                value={data.valueMax}
                onChange={(e) => update("valueMax", e.target.value)}
                placeholder={def.valueMaxPlaceholder ?? "max"}
                className="nodrag flex-1 h-6 rounded-sm border border-border bg-muted px-2 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--te-orange)]"
              />
            </div>
          ) : def?.valueKind === "expression" ? (
            <textarea
              value={data.value}
              onChange={(e) => update("value", e.target.value)}
              placeholder={def.valuePlaceholder ?? "expression"}
              rows={2}
              className="nodrag w-full rounded-sm border border-border bg-muted px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--te-orange)] resize-none"
            />
          ) : def?.valueKind !== "none" ? (
            <input
              value={data.value}
              onChange={(e) => update("value", e.target.value)}
              placeholder={def?.valuePlaceholder ?? "value"}
              className="nodrag w-full h-6 rounded-sm border border-border bg-muted px-2 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--te-orange)]"
            />
          ) : null}
        </div>
      )}

      {/* Handles */}
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !border-2 !border-border !bg-background" />
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !border-2 !border-[var(--te-orange)] !bg-background" />
    </div>
  );
}

export default memo(ConditionNode);
