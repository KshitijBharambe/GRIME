"use client";

import { useCallback, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import ConditionNode from "./ConditionNode";
import GroupNode from "./GroupNode";
import ConditionEdge from "./ConditionEdge";
import { serializeToRule } from "./canvasSerializer";
import type { FlowNode, FlowEdge, CanvasRule, ConditionNodeData, GroupNodeData } from "./types";
import { PALETTE_CATEGORIES, BLOCK_TYPES } from "@/lib/rules/blockPaletteConfig";
import { cn } from "@/lib/utils";
import { Plus, GitMerge } from "lucide-react";

const NODE_TYPES: NodeTypes = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  condition: ConditionNode as unknown as React.ComponentType<any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  group: GroupNode as unknown as React.ComponentType<any>,
};

const EDGE_TYPES: EdgeTypes = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  condition: ConditionEdge as unknown as React.ComponentType<any>,
};

const CATEGORY_ICON_MAP: Record<string, string> = {
  presence: "✓",
  length: "#",
  pattern: "~",
  range: "↕",
  set: "∈",
  char: "Aa",
  cross: "⇌",
  statistical: "σ",
  advanced: "{}",
};

function generateId(prefix = "node") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function PalettePanel({ onAddNode }: { onAddNode: (blockType: string) => void }) {
  const [openCat, setOpenCat] = useState<string | null>("presence");

  return (
    <div className="flex flex-col h-full w-52 shrink-0 border-r border-border bg-background overflow-y-auto">
      <div className="px-3 py-2.5 border-b border-border">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Blocks
        </p>
      </div>
      <div className="flex flex-col gap-0.5 p-2">
        {PALETTE_CATEGORIES.map((cat) => (
          <div key={cat.key}>
            <button
              onClick={() => setOpenCat(openCat === cat.key ? null : cat.key)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
            >
              <span
                className="inline-flex w-4 h-4 items-center justify-center rounded text-[9px] font-bold"
                style={{ backgroundColor: cat.color + "22", color: cat.color }}
              >
                {CATEGORY_ICON_MAP[cat.key] ?? "•"}
              </span>
              <span className="flex-1">{cat.label}</span>
              <span className="text-muted-foreground text-[9px]">
                {openCat === cat.key ? "▲" : "▼"}
              </span>
            </button>
            {openCat === cat.key && (
              <div className="mt-0.5 ml-2 flex flex-col gap-0.5">
                {cat.blocks.map((blockType) => {
                  const def = BLOCK_TYPES[blockType];
                  return (
                    <button
                      key={blockType}
                      onClick={() => onAddNode(blockType)}
                      className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-left hover:bg-muted hover:border-[var(--te-orange)] transition-colors group"
                      title={def?.description}
                    >
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-[11px] text-foreground truncate flex-1">
                        {def?.label ?? blockType}
                      </span>
                      <Plus className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {/* Group node */}
        <div className="mt-2 border-t border-border pt-2">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground px-2 mb-1">
            Combinators
          </p>
          <button
            onClick={() => onAddNode("__group__")}
            className="flex w-full items-center gap-2 rounded-md border border-dashed border-border px-2 py-1.5 text-left hover:bg-muted hover:border-[var(--te-orange)] transition-colors group"
          >
            <GitMerge className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] text-foreground">AND / OR Group</span>
            <Plus className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface FlowCanvasInnerProps {
  ruleName: string;
  initialNodes?: FlowNode[];
  initialEdges?: FlowEdge[];
  onSave: (rule: CanvasRule) => void;
}

function FlowCanvasInner({ ruleName, initialNodes = [], initialEdges = [], onSave }: FlowCanvasInnerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(initialEdges);
  const viewportRef = useRef<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          { ...connection, type: "condition", data: { logic: "AND" } },
          eds,
        ),
      );
    },
    [setEdges],
  );

  const addNode = useCallback(
    (blockType: string) => {
      const vp = viewportRef.current;
      const x = (-vp.x + 300) / vp.zoom + Math.random() * 60 - 30;
      const y = (-vp.y + 200) / vp.zoom + Math.random() * 60 - 30;

      if (blockType === "__group__") {
        const newNode: FlowNode = {
          id: generateId("group"),
          type: "group",
          position: { x, y },
          data: { combinator: "AND", label: "group" } satisfies GroupNodeData,
        };
        setNodes((nds) => [...nds, newNode]);
        return;
      }

      const def = BLOCK_TYPES[blockType];
      const cat = PALETTE_CATEGORIES.find((c) => c.blocks.includes(blockType));
      const newNode: FlowNode = {
        id: generateId("cond"),
        type: "condition",
        position: { x, y },
        data: {
          blockType,
          label: def?.label ?? blockType,
          column: "",
          operator: def?.operators[0] ?? "",
          value: "",
          valueMin: "",
          valueMax: "",
          apiKind: def?.apiKind ?? "custom",
          categoryColor: cat?.color ?? "#6b7280",
        } satisfies ConditionNodeData,
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes],
  );

  const handleSave = useCallback(() => {
    const rule = serializeToRule(nodes, edges, ruleName);
    onSave(rule);
  }, [nodes, edges, ruleName, onSave]);

  const isEmpty = nodes.length === 0;

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      <PalettePanel onAddNode={addNode} />

      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          defaultEdgeOptions={{ type: "condition" }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          onViewportChange={(vp) => { viewportRef.current = vp; }}
          proOptions={{ hideAttribution: true }}
          className="bg-muted/20"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
          <Controls
            className="!border-border !bg-background [&_button]:!border-border [&_button]:!bg-background [&_button]:!text-foreground"
            showInteractive={false}
          />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === "group") return "var(--te-orange)";
              const d = n.data as ConditionNodeData;
              return d.categoryColor ?? "#6b7280";
            }}
            className="!border-border !bg-background"
          />
        </ReactFlow>

        {/* Empty state */}
        {isEmpty && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="rounded-xl border border-dashed border-border bg-background/80 px-8 py-6 text-center backdrop-blur-sm">
              <p className="text-sm font-medium text-foreground">Drop blocks to start</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Click any block in the palette → it appears on the canvas.
                <br />
                Connect blocks to AND / OR groups to combine conditions.
              </p>
            </div>
          </div>
        )}

        {/* Save bar */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          {!isEmpty && (
            <span className="text-[11px] text-muted-foreground">
              {nodes.filter((n) => n.type === "condition").length} condition{nodes.filter((n) => n.type === "condition").length !== 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isEmpty}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors shadow",
              isEmpty
                ? "border-border bg-muted text-muted-foreground cursor-not-allowed"
                : "border-[var(--te-orange)] bg-[var(--te-orange)] text-white hover:opacity-90",
            )}
          >
            Save rule
          </button>
        </div>
      </div>
    </div>
  );
}

interface FlowCanvasProps extends FlowCanvasInnerProps {}

export default function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
