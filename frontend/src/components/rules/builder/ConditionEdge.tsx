"use client";

import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow } from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";

function ConditionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const { deleteElements } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: "var(--te-orange)", strokeWidth: 1.5, opacity: 0.6 }}
        markerEnd="url(#flow-arrow)"
      />
      <EdgeLabelRenderer>
        <button
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan inline-flex h-4 items-center rounded border border-border bg-background px-1.5 text-[9px] font-medium text-muted-foreground shadow-sm hover:border-destructive hover:text-destructive transition-colors"
          onClick={() => deleteElements({ edges: [{ id }] })}
          title="Remove connection"
        >
          ×
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(ConditionEdge);
