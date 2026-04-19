"use client";

import { memo, useCallback } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import type { GroupNodeData } from "./types";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

function GroupNode({ id, data, selected }: { id: string; data: GroupNodeData; selected?: boolean }) {
  const { setNodes } = useReactFlow();

  const toggleCombinator = useCallback(() => {
    setNodes((nodes) =>
      nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, combinator: n.data.combinator === "AND" ? "OR" : "AND" } }
          : n,
      ),
    );
  }, [id, setNodes]);

  const remove = useCallback(() => {
    setNodes((nodes) => nodes.filter((n) => n.id !== id));
  }, [id, setNodes]);

  const isAnd = data.combinator === "AND";

  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-1 rounded-xl border-2 bg-background px-5 py-3 shadow-sm transition-shadow",
        selected ? "border-[var(--te-orange)] shadow-md" : "border-border",
        isAnd ? "border-dashed" : "border-dotted",
      )}
    >
      <button
        onClick={remove}
        className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-destructive transition-colors"
      >
        <X className="w-3 h-3" />
      </button>

      {/* Combinator toggle */}
      <button
        onClick={toggleCombinator}
        className={cn(
          "inline-flex items-center rounded-md border px-3 py-0.5 text-[11px] font-semibold tracking-widest transition-colors",
          isAnd
            ? "border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            : "border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
        )}
        title="Click to toggle AND / OR"
      >
        {data.combinator}
      </button>

      <span className="text-[9px] text-muted-foreground tracking-wide">
        {data.label || "group"}
      </span>

      {/* Multiple target handles (top) — conditions connect here */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !border-2 !border-border !bg-muted"
      />
      {/* Single source handle (bottom) — feeds into parent group */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !border-2 !border-[var(--te-orange)] !bg-background"
      />
    </div>
  );
}

export default memo(GroupNode);
