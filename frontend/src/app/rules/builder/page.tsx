"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Layers,
  Plus,
  Trash2,
  Play,
  Save,
  AlertTriangle,
  CheckCircle,
  GripVertical,
  Zap,
  X,
  Copy,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Search,
  Edit3,
  Sparkles,
  Tag,
  Hash,
  Settings,
  Type,
  GitMerge,
  BarChart2,
  Code,
  FolderPlus,
  Folder,
  ChevronsUpDown,
} from "lucide-react";
import Link from "next/link";
import {
  BLOCK_TYPES,
  BLOCK_COLORS,
  PALETTE_CATEGORIES,
  CUSTOM_COLOR_OPTIONS,
  CustomBlockDef,
  loadCustomBlocks,
  saveCustomBlocks,
  registerCustomBlocksIntoRegistry,
} from "@/lib/rules/blockPaletteConfig";
import type { PaletteCategoryDef } from "@/lib/rules/blockPaletteConfig";
import dynamic from "next/dynamic";
import type { CanvasRule } from "@/components/rules/builder/types";

const FlowCanvas = dynamic(
  () => import("@/components/rules/builder/FlowCanvas"),
  { ssr: false },
);

// ─── Icon map for palette categories ─────────────────────────────────────────

const CATEGORY_ICONS: Record<
  string,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  CheckCircle,
  Hash,
  Tag,
  Zap,
  Layers,
  Type,
  GitMerge,
  BarChart2,
  Settings,
  Sparkles,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubCondition {
  id: string;
  type: string;
  column: string;
  operator: string;
  value: string;
  valueMin: string;
  valueMax: string;
  logic: "AND" | "OR";
  enabled: boolean;
  advancedMode: boolean;
  advancedExpression: string;
}

export interface Block {
  id: string;
  type: string;
  column: string;
  operator: string;
  value: string;
  valueMin: string;
  valueMax: string;
  logic: "AND" | "OR";
  enabled: boolean;
  collapsed: boolean;
  advancedMode: boolean;
  advancedExpression: string;
  subConditions: SubCondition[];
}

export interface BlockGroup {
  id: string;
  label: string;
  combinator: "AND" | "OR";
  blocks: Block[];
  collapsed: boolean;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function isBlockValid(block: Block | SubCondition): boolean {
  const def = BLOCK_TYPES[block.type];
  if (!def) return false;
  if ("advancedMode" in block && block.advancedMode) {
    return block.advancedExpression.trim().length > 0;
  }
  if (!block.column.trim()) return false;
  if (def.valueKind === "range") {
    return block.valueMin.trim().length > 0 && block.valueMax.trim().length > 0;
  }
  if (def.valueKind !== "none" && !block.value.trim()) return false;
  return true;
}

function isBlockTouched(block: Block | SubCondition): boolean {
  const def = BLOCK_TYPES[block.type];
  if (!def) return false;
  if ("advancedMode" in block && block.advancedMode) {
    return block.advancedExpression.trim().length > 0;
  }
  if (block.column.trim() !== "") return true;
  if (def.valueKind === "range")
    return block.valueMin.trim() !== "" || block.valueMax.trim() !== "";
  if (def.valueKind !== "none") return block.value.trim() !== "";
  return false;
}

function generateId(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function segmentButtonClass(active: boolean): string {
  return cn(
    "inline-flex items-center justify-center rounded-md border px-3 text-[11px] font-medium tracking-wide transition-colors",
    active
      ? "border-foreground bg-foreground text-background shadow-sm"
      : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

function makeBlock(type: string, logic: "AND" | "OR" = "AND"): Block {
  const def = BLOCK_TYPES[type];
  return {
    id: generateId("block"),
    type,
    column: "",
    operator: def?.operators[0] ?? "expr",
    value: "",
    valueMin: "",
    valueMax: "",
    logic,
    enabled: true,
    collapsed: false,
    advancedMode: false,
    advancedExpression: "",
    subConditions: [],
  };
}

function makeSubCondition(
  type: string,
  logic: "AND" | "OR" = "AND",
): SubCondition {
  const def = BLOCK_TYPES[type];
  return {
    id: generateId("sub"),
    type,
    column: "",
    operator: def?.operators[0] ?? "expr",
    value: "",
    valueMin: "",
    valueMax: "",
    logic,
    enabled: true,
    advancedMode: false,
    advancedExpression: "",
  };
}

function makeGroup(): BlockGroup {
  return {
    id: generateId("group"),
    label: "Group",
    combinator: "AND",
    blocks: [],
    collapsed: false,
  };
}

// ─── Palette Item Content ─────────────────────────────────────────────────────

function PaletteItemContent({
  typeKey,
  onAdd,
  usageCount,
  onEdit,
  onDelete,
  isCustom,
}: {
  typeKey: string;
  onAdd: (type: string) => void;
  usageCount?: number;
  onEdit?: () => void;
  onDelete?: () => void;
  isCustom?: boolean;
}) {
  const def = BLOCK_TYPES[typeKey];
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  if (!def) return null;

  return (
    <div
      className={cn(
        "group relative flex items-center justify-between gap-3 rounded-md border border-transparent px-2.5 py-2",
        "hover:border-border hover:bg-muted/60 transition-colors duration-100",
      )}
      onMouseEnter={() => {
        tooltipTimeout.current = setTimeout(() => setShowTooltip(true), 400);
      }}
      onMouseLeave={() => {
        clearTimeout(tooltipTimeout.current);
        setShowTooltip(false);
      }}
    >
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {def.label}
          </span>
          {isCustom && (
            <Sparkles className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          {(usageCount ?? 0) > 0 && (
            <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded bg-muted px-1 text-[10px] font-medium text-muted-foreground">
              {usageCount}
            </span>
          )}
        </div>
        <span className="truncate text-[11px] text-muted-foreground">
          {def.description}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {isCustom && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.();
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-muted-foreground opacity-0 transition-all duration-100 group-hover:opacity-100 hover:border-border hover:bg-background hover:text-foreground"
              title="Edit custom block"
            >
              <Edit3 className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.();
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-muted-foreground opacity-0 transition-all duration-100 group-hover:opacity-100 hover:border-border hover:bg-background hover:text-destructive"
              title="Delete custom block"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd(typeKey);
          }}
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-background",
            "text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground",
          )}
          title={`Add ${def.label} block`}
          aria-label={`Add ${def.label} block`}
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {showTooltip && (
        <div className="absolute left-full top-0 ml-2 z-50 w-56 pointer-events-none">
          <div className="rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-lg">
            <span className="mb-1 block text-xs font-medium text-foreground">
              {def.label}
            </span>
            <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
              {def.description}
            </p>
            {def.example && (
              <div className="rounded border border-border bg-muted px-2 py-1">
                <span className="text-[11px] font-mono leading-relaxed text-muted-foreground">
                  {def.example}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Draggable Palette Item ───────────────────────────────────────────────────

function DraggablePaletteItem({
  typeKey,
  onAdd,
  usageCount,
  onEdit,
  onDelete,
  isCustom,
}: {
  typeKey: string;
  onAdd: (type: string) => void;
  usageCount?: number;
  onEdit?: () => void;
  onDelete?: () => void;
  isCustom?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${typeKey}`,
    data: { type: "palette", blockType: typeKey },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab active:cursor-grabbing touch-none",
        isDragging && "opacity-30",
      )}
    >
      <PaletteItemContent
        typeKey={typeKey}
        onAdd={onAdd}
        usageCount={usageCount}
        onEdit={onEdit}
        onDelete={onDelete}
        isCustom={isCustom}
      />
    </div>
  );
}

// ─── Palette Drag Preview ─────────────────────────────────────────────────────

function PaletteDragPreview({ typeKey }: { typeKey: string }) {
  const def = BLOCK_TYPES[typeKey];
  const colorClass = BLOCK_COLORS[typeKey] ?? "border-l-[var(--te-orange)]";
  if (!def) return null;
  return (
    <div
      className={cn(
        "w-52 rounded-md border border-border bg-background px-3 py-2 shadow-lg",
        colorClass,
      )}
    >
      <div className="flex items-center gap-2">
        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{def.label}</span>
      </div>
      <span className="mt-1 block text-[11px] text-muted-foreground">
        {def.description}
      </span>
    </div>
  );
}

// ─── Category Section ─────────────────────────────────────────────────────────

function CategorySection({
  cat,
  isOpen,
  onToggle,
  children,
  blockCount,
}: {
  cat: PaletteCategoryDef;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  blockCount: number;
}) {
  const Icon = CATEGORY_ICONS[cat.iconName] ?? Settings;
  return (
    <div className="flex flex-col">
      <button
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-100",
          "hover:bg-muted/70",
        )}
      >
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <Icon
          className="h-3.5 w-3.5 shrink-0"
          style={{ color: cat.color, opacity: 0.85 }}
        />
        <span className="flex-1 text-xs font-medium text-foreground">
          {cat.label}
        </span>
        <span className="text-[11px] text-muted-foreground">{blockCount}</span>
      </button>
      {isOpen && (
        <div className="flex flex-col gap-1 pl-4 pt-1">{children}</div>
      )}
    </div>
  );
}

// ─── Custom Block Dialog ──────────────────────────────────────────────────────

function CustomBlockDialog({
  open,
  onOpenChange,
  onSave,
  editingBlock,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (def: CustomBlockDef) => void;
  editingBlock?: CustomBlockDef | null;
}) {
  const [label, setLabel] = useState("");
  const [operator, setOperator] = useState("");
  const [description, setDescription] = useState("");
  const [needsValue, setNeedsValue] = useState(true);
  const [valuePlaceholder, setValuePlaceholder] = useState("");
  const [colorClass, setColorClass] = useState(CUSTOM_COLOR_OPTIONS[0].value);

  useEffect(() => {
    if (editingBlock) {
      setLabel(editingBlock.label);
      setOperator(editingBlock.operator);
      setDescription(editingBlock.description);
      setNeedsValue(editingBlock.needsValue);
      setValuePlaceholder(editingBlock.valuePlaceholder);
      setColorClass(editingBlock.colorClass);
    } else {
      setLabel("");
      setOperator("");
      setDescription("");
      setNeedsValue(true);
      setValuePlaceholder("");
      setColorClass(CUSTOM_COLOR_OPTIONS[0].value);
    }
  }, [editingBlock, open]);

  const handleSubmit = () => {
    if (!label.trim() || !operator.trim()) return;
    onSave({
      id:
        editingBlock?.id ??
        `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: label.trim(),
      operator: operator.trim(),
      description: description.trim() || `Custom: ${label.trim()}`,
      needsValue,
      valuePlaceholder: valuePlaceholder.trim(),
      colorClass,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--card)] border-[var(--border)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground">
            {editingBlock ? "Edit Custom Block" : "Create Custom Block"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Define a reusable validation block for your rules.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <Label className="label-te text-[0.65rem]">Block Name *</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Currency Code"
              className="h-8 text-xs font-mono bg-[var(--input)] border-[var(--border)] rounded-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="label-te text-[0.65rem]">Operator Label *</Label>
            <Input
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              placeholder="e.g. matches currency"
              className="h-8 text-xs font-mono bg-[var(--input)] border-[var(--border)] rounded-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="label-te text-[0.65rem]">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Value must be a valid ISO 4217 currency code"
              className="h-8 text-xs font-mono bg-[var(--input)] border-[var(--border)] rounded-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={needsValue}
                onChange={(e) => setNeedsValue(e.target.checked)}
                className="rounded border-[var(--border)] accent-[var(--te-orange)]"
              />
              <span className="label-te text-[0.65rem] normal-case">
                Requires value input
              </span>
            </label>
          </div>
          {needsValue && (
            <div className="flex flex-col gap-1.5">
              <Label className="label-te text-[0.65rem]">
                Value Placeholder
              </Label>
              <Input
                value={valuePlaceholder}
                onChange={(e) => setValuePlaceholder(e.target.value)}
                placeholder="e.g. USD, EUR, GBP"
                className="h-8 text-xs font-mono bg-[var(--input)] border-[var(--border)] rounded-sm"
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label className="label-te text-[0.65rem]">Color Theme</Label>
            <div className="flex flex-wrap gap-1.5">
              {CUSTOM_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setColorClass(opt.value)}
                  className={cn(
                    "w-7 h-7 rounded-sm flex items-center justify-center border transition-all duration-100",
                    colorClass === opt.value
                      ? "border-[var(--te-orange)] scale-110"
                      : "border-[var(--border)] hover:border-[var(--te-concrete)]",
                  )}
                  title={opt.label}
                >
                  <div className={cn("w-3 h-3 rounded-full", opt.dot)} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 px-4"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!label.trim() || !operator.trim()}
            className="h-8 px-4 disabled:opacity-40"
          >
            {editingBlock ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Combinator Pill ──────────────────────────────────────────────────────────

function CombinatorPill({
  value,
  onClick,
}: {
  value: "AND" | "OR";
  onClick: () => void;
}) {
  return (
    <div className="my-2 flex items-center gap-3 px-1">
      <div className="h-px flex-1 bg-border" />
      <button
        onClick={onClick}
        className={cn(
          "inline-flex h-6 items-center rounded-md border px-2.5 text-[11px] font-medium tracking-wide transition-colors",
          "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        title={`Click to switch to ${value === "AND" ? "OR" : "AND"}`}
      >
        {value}
      </button>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ─── Group Combinator Badge ───────────────────────────────────────────────────

function GroupCombinatorBadge({
  value,
  onClick,
}: {
  value: "AND" | "OR";
  onClick: () => void;
}) {
  return (
    <div className="my-3 flex items-center gap-3 px-1">
      <div className="h-px flex-1 bg-border" />
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5">
        <button
          onClick={onClick}
          className="text-xs font-medium text-foreground"
          title={`Groups connected via ${value} — click to toggle`}
        >
          {value}
        </button>
        <span className="text-[11px] text-muted-foreground">
          between groups
        </span>
      </div>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ─── Value Input Fields ───────────────────────────────────────────────────────

function ValueInputFields({
  blockOrSub,
  showInvalid,
  onUpdate,
}: {
  blockOrSub: Block | SubCondition;
  showInvalid: boolean;
  onUpdate: (field: string, value: string) => void;
}) {
  const def = BLOCK_TYPES[blockOrSub.type];
  if (!def) return null;

  if (def.valueKind === "none") return null;

  if (def.valueKind === "range") {
    return (
      <div className="flex gap-2 min-w-0 flex-[2]">
        <div className="flex flex-col gap-1 flex-1">
          <label className="label-te">Min</label>
          <Input
            value={blockOrSub.valueMin}
            onChange={(e) => onUpdate("valueMin", e.target.value)}
            placeholder={def.valueMinPlaceholder ?? "min"}
            className={cn(
              "h-7 text-xs font-mono bg-[var(--input)] border-[var(--border)]",
              "focus-visible:ring-1 focus-visible:ring-[var(--te-orange)] focus-visible:ring-offset-0 rounded-sm",
              showInvalid && !blockOrSub.valueMin.trim() && "border-red-500/50",
            )}
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label className="label-te">Max</label>
          <Input
            value={blockOrSub.valueMax}
            onChange={(e) => onUpdate("valueMax", e.target.value)}
            placeholder={def.valueMaxPlaceholder ?? "max"}
            className={cn(
              "h-7 text-xs font-mono bg-[var(--input)] border-[var(--border)]",
              "focus-visible:ring-1 focus-visible:ring-[var(--te-orange)] focus-visible:ring-offset-0 rounded-sm",
              showInvalid && !blockOrSub.valueMax.trim() && "border-red-500/50",
            )}
          />
        </div>
      </div>
    );
  }

  if (def.valueKind === "expression") {
    return (
      <div className="flex flex-col gap-1 flex-[2] min-w-[200px]">
        <label className="label-te">Expression</label>
        <textarea
          value={blockOrSub.value}
          onChange={(e) => onUpdate("value", e.target.value)}
          placeholder={def.valuePlaceholder ?? "expression"}
          rows={2}
          className={cn(
            "text-xs font-mono bg-[var(--input)] border border-[var(--border)] rounded-sm px-2 py-1",
            "focus:outline-none focus:ring-1 focus:ring-[var(--te-orange)] resize-none",
            showInvalid && !blockOrSub.value.trim() && "border-red-500/50",
          )}
        />
      </div>
    );
  }

  if (def.valueKind === "select" && def.selectOptions) {
    return (
      <div className="flex flex-col gap-1 min-w-[140px] flex-1">
        <label className="label-te">Value</label>
        <Select
          value={blockOrSub.value}
          onValueChange={(v) => onUpdate("value", v)}
        >
          <SelectTrigger
            className={cn(
              "h-7 text-xs font-mono bg-[var(--input)] border-[var(--border)]",
              "focus:ring-1 focus:ring-[var(--te-orange)] focus:ring-offset-0 rounded-sm",
              showInvalid && !blockOrSub.value && "border-red-500/50",
            )}
          >
            <SelectValue placeholder={def.valuePlaceholder ?? "Select…"} />
          </SelectTrigger>
          <SelectContent>
            {def.selectOptions.map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                className="text-xs font-mono"
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // single or list
  return (
    <div className="flex flex-col gap-1 min-w-[160px] flex-[2]">
      <label className="label-te">
        {def.valueKind === "list" ? "Values (comma-separated)" : "Value"}
      </label>
      <Input
        value={blockOrSub.value}
        onChange={(e) => onUpdate("value", e.target.value)}
        placeholder={def.valuePlaceholder ?? "value"}
        className={cn(
          "h-7 text-xs font-mono bg-[var(--input)] border-[var(--border)]",
          "focus-visible:ring-1 focus-visible:ring-[var(--te-orange)] focus-visible:ring-offset-0 rounded-sm",
          showInvalid && !blockOrSub.value.trim() && "border-red-500/50",
        )}
      />
    </div>
  );
}

// ─── Sub-Condition Card ───────────────────────────────────────────────────────

function SubConditionCard({
  sub,
  index,
  onUpdate,
  onRemove,
}: {
  sub: SubCondition;
  index: number;
  onUpdate: (id: string, field: string, value: string) => void;
  onRemove: (id: string) => void;
}) {
  const def = BLOCK_TYPES[sub.type];
  const colorClass = BLOCK_COLORS[sub.type] ?? "border-l-[var(--te-orange)]";
  if (!def) return null;

  const valid = isBlockValid(sub);
  const touched = isBlockTouched(sub);
  const showInvalid = touched && !valid;

  const handleUpdate = (field: string, value: string) =>
    onUpdate(sub.id, field, value);

  return (
    <div
      className={cn(
        "flex-1 rounded-md border border-border border-l-2 bg-muted/30 p-2.5",
        colorClass.replace("border-l-4", "border-l-2"),
        !sub.enabled && "opacity-40",
        showInvalid && "ring-1 ring-red-500/40",
      )}
    >
      <div className="flex items-center gap-1 mb-1.5">
        <span className="text-[11px] font-medium text-foreground">
          {def.label}
        </span>
        <span className="text-[10px] text-muted-foreground">
          #{String(index + 1).padStart(2, "0")}
        </span>
        {showInvalid && <AlertTriangle className="w-2.5 h-2.5 text-red-500" />}
        <button
          onClick={() => onRemove(sub.id)}
          className="ml-auto flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
          title="Remove sub-condition"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {sub.advancedMode ? (
        <div className="flex flex-col gap-1">
          <label className="label-te text-[0.5rem]">Expression</label>
          <textarea
            value={sub.advancedExpression}
            onChange={(e) => handleUpdate("advancedExpression", e.target.value)}
            placeholder="Custom expression…"
            rows={2}
            className="text-xs font-mono bg-[var(--input)] border border-[var(--border)] rounded-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--te-orange)] resize-none"
          />
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <div className="flex flex-col gap-0.5 min-w-[90px] flex-1">
            <label className="label-te text-[0.5rem]">Column</label>
            <Input
              value={sub.column}
              onChange={(e) => handleUpdate("column", e.target.value)}
              placeholder="col"
              className="h-6 text-[0.65rem] font-mono bg-[var(--input)] border-[var(--border)] rounded-sm"
            />
          </div>
          <div className="flex flex-col gap-0.5 min-w-[80px]">
            <label className="label-te text-[0.5rem]">Operator</label>
            <div className="flex h-6 items-center rounded-sm border border-border bg-background px-2 text-[0.65rem] font-mono text-muted-foreground">
              {sub.operator}
            </div>
          </div>
          {def.valueKind !== "none" && (
            <div className="flex flex-col gap-0.5 min-w-[100px] flex-[2]">
              <label className="label-te text-[0.5rem]">Value</label>
              {def.valueKind === "range" ? (
                <div className="flex gap-1">
                  <Input
                    value={sub.valueMin}
                    onChange={(e) => handleUpdate("valueMin", e.target.value)}
                    placeholder="min"
                    className="h-6 text-[0.65rem] font-mono bg-[var(--input)] border-[var(--border)] rounded-sm flex-1"
                  />
                  <Input
                    value={sub.valueMax}
                    onChange={(e) => handleUpdate("valueMax", e.target.value)}
                    placeholder="max"
                    className="h-6 text-[0.65rem] font-mono bg-[var(--input)] border-[var(--border)] rounded-sm flex-1"
                  />
                </div>
              ) : (
                <Input
                  value={sub.value}
                  onChange={(e) => handleUpdate("value", e.target.value)}
                  placeholder={def.valuePlaceholder ?? "value"}
                  className="h-6 text-[0.65rem] font-mono bg-[var(--input)] border-[var(--border)] rounded-sm"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Block Card ───────────────────────────────────────────────────────────────

function BlockCard({
  block,
  index,
  onUpdate,
  onRemove,
  onDuplicate,
  onToggleEnabled,
  onToggleCollapsed,
  onToggleAdvanced,
  onAddSubCondition,
  onUpdateSubCondition,
  onRemoveSubCondition,
  onToggleSubLogic,
  dragHandleListeners,
  dragHandleAttributes,
}: {
  block: Block;
  index: number;
  onUpdate: (id: string, field: string, value: string) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleEnabled: (id: string) => void;
  onToggleCollapsed: (id: string) => void;
  onToggleAdvanced: (id: string) => void;
  onAddSubCondition: (blockId: string, type: string) => void;
  onUpdateSubCondition: (
    blockId: string,
    subId: string,
    field: string,
    value: string,
  ) => void;
  onRemoveSubCondition: (blockId: string, subId: string) => void;
  onToggleSubLogic: (blockId: string, subId: string) => void;
  dragHandleListeners?: DraggableSyntheticListeners;
  dragHandleAttributes?: DraggableAttributes;
}) {
  const def = BLOCK_TYPES[block.type];
  const colorClass = BLOCK_COLORS[block.type] ?? "border-l-[var(--te-orange)]";
  if (!def) return null;

  const valid = isBlockValid(block);
  const touched = isBlockTouched(block);
  const showInvalid = touched && !valid;

  const handleUpdate = (field: string, value: string) =>
    onUpdate(block.id, field, value);

  return (
    <div
      className={cn(
        "group relative rounded-md border border-border bg-card shadow-sm transition-colors duration-150",
        colorClass,
        !block.enabled && "opacity-40",
        showInvalid && "ring-1 ring-red-500/50",
      )}
    >
      {/* ── Header row ── */}
      <div className="flex items-start gap-2 p-3 pb-0">
        {/* Drag handle */}
        <div
          className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing touch-none"
          {...dragHandleListeners}
          {...dragHandleAttributes}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Collapse toggle + info */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onToggleCollapsed(block.id)}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              title={block.collapsed ? "Expand" : "Collapse"}
            >
              {block.collapsed ? (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="text-sm font-medium text-foreground">
                {def.label}
              </span>
            </button>
            <span className="text-[11px] text-muted-foreground">
              #{String(index + 1).padStart(2, "0")}
            </span>
            {block.collapsed && block.column && (
              <span className="max-w-[120px] truncate text-xs font-mono text-muted-foreground">
                {block.column}
              </span>
            )}
            {showInvalid && <AlertTriangle className="w-3 h-3 text-red-500" />}
            {touched && valid && (
              <CheckCircle className="w-3 h-3 text-[#10B981]" />
            )}
            {block.subConditions.length > 0 && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                +{block.subConditions.length} sub
              </span>
            )}
          </div>
          {!block.collapsed && (
            <span className="mt-1 text-[11px] text-muted-foreground">
              {def.description}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Advanced mode toggle */}
          <button
            onClick={() => onToggleAdvanced(block.id)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md border transition-colors duration-100",
              block.advancedMode
                ? "border-foreground bg-muted text-foreground"
                : "border-transparent text-muted-foreground opacity-0 group-hover:opacity-100 hover:border-border hover:bg-background hover:text-foreground",
            )}
            title={
              block.advancedMode
                ? "Exit advanced mode"
                : "Advanced mode: custom expression"
            }
          >
            <Code className="w-3 h-3" />
          </button>

          {/* Enable/disable */}
          <button
            onClick={() => onToggleEnabled(block.id)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md border transition-colors duration-100",
              block.enabled
                ? "border-transparent text-muted-foreground opacity-0 group-hover:opacity-100 hover:border-border hover:bg-background hover:text-foreground"
                : "border-border bg-muted text-foreground opacity-100",
            )}
            title={block.enabled ? "Disable block" : "Enable block"}
          >
            {block.enabled ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Duplicate */}
          <button
            onClick={() => onDuplicate(block.id)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground opacity-0 transition-colors duration-100 group-hover:opacity-100",
              "hover:border-border hover:bg-background hover:text-foreground",
            )}
            title="Duplicate block"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {/* Remove */}
          <button
            onClick={() => onRemove(block.id)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground opacity-0 transition-colors duration-100 group-hover:opacity-100",
              "hover:border-border hover:bg-background hover:text-destructive",
            )}
            title="Remove block"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Body (collapses) ── */}
      {!block.collapsed && (
        <div
          className={cn(
            "px-3 pb-3 pt-2.5",
            !block.enabled && "pointer-events-none",
          )}
        >
          {block.advancedMode ? (
            /* Advanced mode: free-form expression */
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Code className="h-3.5 w-3.5 text-muted-foreground" />
                <label className="text-xs font-medium text-foreground">
                  Advanced Expression
                </label>
              </div>
              <textarea
                value={block.advancedExpression}
                onChange={(e) =>
                  handleUpdate("advancedExpression", e.target.value)
                }
                placeholder="e.g. LENGTH(col) > 0 AND col NOT IN ('N/A', 'null', '')"
                rows={3}
                className={cn(
                  "w-full text-xs font-mono bg-[var(--input)] border border-[var(--border)] rounded-sm px-2 py-1.5",
                  "focus:outline-none focus:ring-1 focus:ring-[#8B5CF6] resize-none",
                  showInvalid &&
                    !block.advancedExpression.trim() &&
                    "border-red-500/50",
                )}
              />
              <p className="text-[11px] text-muted-foreground">
                SQL-like or Python expression. Column names are referenced
                directly.
              </p>
            </div>
          ) : (
            /* Normal mode */
            <div className="flex flex-wrap gap-2">
              {/* Column */}
              <div className="flex flex-col gap-1 min-w-[120px] flex-1">
                <label className="label-te">Column</label>
                <Input
                  value={block.column}
                  onChange={(e) => handleUpdate("column", e.target.value)}
                  placeholder="column_name"
                  className={cn(
                    "h-7 text-xs font-mono bg-[var(--input)] border-[var(--border)]",
                    "focus-visible:ring-1 focus-visible:ring-[var(--te-orange)] focus-visible:ring-offset-0 rounded-sm",
                    showInvalid && !block.column.trim() && "border-red-500/50",
                  )}
                />
              </div>

              {/* Operator */}
              <div className="flex flex-col gap-1 min-w-[110px]">
                <label className="label-te">Operator</label>
                {def.operators.length > 1 ? (
                  <Select
                    value={block.operator}
                    onValueChange={(val) => handleUpdate("operator", val)}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-7 text-xs font-mono bg-[var(--input)] border-[var(--border)]",
                        "focus:ring-1 focus:ring-[var(--te-orange)] focus:ring-offset-0 rounded-sm",
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {def.operators.map((op) => (
                        <SelectItem
                          key={op}
                          value={op}
                          className="text-xs font-mono"
                        >
                          {op}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex h-7 items-center rounded-sm border border-border bg-muted/40 px-2 text-xs font-mono text-muted-foreground">
                    {block.operator}
                  </div>
                )}
              </div>

              {/* Value inputs */}
              <ValueInputFields
                blockOrSub={block}
                showInvalid={showInvalid}
                onUpdate={handleUpdate}
              />
            </div>
          )}

          {/* ── Sub-conditions ── */}
          {block.subConditions.length > 0 && (
            <div className="mt-3 flex flex-col gap-0 border-l border-border pl-3">
              <div className="flex items-center gap-2 mb-1.5">
                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">
                  Sub-conditions ({block.subConditions.length})
                </span>
              </div>
              {block.subConditions.map((sub, si) => (
                <div key={sub.id}>
                  <SubConditionCard
                    sub={sub}
                    index={si}
                    onUpdate={(subId, field, value) =>
                      onUpdateSubCondition(block.id, subId, field, value)
                    }
                    onRemove={(subId) => onRemoveSubCondition(block.id, subId)}
                  />
                  {si < block.subConditions.length - 1 && (
                    <CombinatorPill
                      value={block.subConditions[si + 1].logic}
                      onClick={() =>
                        onToggleSubLogic(
                          block.id,
                          block.subConditions[si + 1].id,
                        )
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Add sub-condition button ── */}
          <button
            onClick={() => onAddSubCondition(block.id, "not_null")}
            className={cn(
              "mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border",
              "flex items-center justify-center gap-1.5",
              "text-xs text-muted-foreground transition-colors duration-150 hover:border-foreground/30 hover:bg-muted/40 hover:text-foreground",
            )}
            title="Add a nested sub-condition to this block"
          >
            <Plus className="w-3 h-3" />
            Add sub-condition
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sortable Block Card ──────────────────────────────────────────────────────

function SortableBlockCard(props: {
  block: Block;
  index: number;
  onUpdate: (id: string, field: string, value: string) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleEnabled: (id: string) => void;
  onToggleCollapsed: (id: string) => void;
  onToggleAdvanced: (id: string) => void;
  onAddSubCondition: (blockId: string, type: string) => void;
  onUpdateSubCondition: (
    blockId: string,
    subId: string,
    field: string,
    value: string,
  ) => void;
  onRemoveSubCondition: (blockId: string, subId: string) => void;
  onToggleSubLogic: (blockId: string, subId: string) => void;
}) {
  const { block } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.id,
    data: { type: "block", block },
  });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-30 z-50")}
    >
      <BlockCard
        {...props}
        dragHandleListeners={listeners}
        dragHandleAttributes={attributes}
      />
    </div>
  );
}

// ─── Block Drag Preview ───────────────────────────────────────────────────────

function BlockDragPreview({ block, index }: { block: Block; index: number }) {
  const def = BLOCK_TYPES[block.type];
  const colorClass = BLOCK_COLORS[block.type] ?? "border-l-[var(--te-orange)]";
  if (!def) return null;
  return (
    <div
      className={cn(
        "w-[480px] rounded-md border border-border bg-background p-3 shadow-lg",
        colorClass,
      )}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{def.label}</span>
        <span className="text-[11px] text-muted-foreground">
          #{String(index + 1).padStart(2, "0")}
        </span>
        {block.column && (
          <span className="truncate text-xs font-mono text-muted-foreground">
            {block.column}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Group Drag Preview ───────────────────────────────────────────────────────

function GroupDragPreview({ group }: { group: BlockGroup }) {
  return (
    <div className="w-[480px] rounded-md border border-border bg-background p-3 shadow-lg">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <Folder className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          {group.label}
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {group.combinator}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {group.blocks.length} blocks
        </span>
      </div>
    </div>
  );
}

// ─── Group Drop Zone ──────────────────────────────────────────────────────────

function GroupDropZone({
  groupId,
  isEmpty,
}: {
  groupId: string;
  isEmpty: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `group-drop-${groupId}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[40px] rounded-md border border-dashed border-transparent transition-all duration-150",
        isOver && "border-border bg-muted/50",
        isEmpty && "min-h-[60px] flex items-center justify-center",
      )}
    >
      {isEmpty && (
        <p className="text-xs text-muted-foreground">
          Drag blocks here or click + to add
        </p>
      )}
    </div>
  );
}

// ─── Group Card ───────────────────────────────────────────────────────────────

function GroupCard({
  group,
  onUpdateGroup,
  onRemoveGroup,
  onDuplicateGroup,
  onToggleGroupCollapsed,
  onBlockAction,
  dragHandleListeners,
  dragHandleAttributes,
}: {
  group: BlockGroup;
  onUpdateGroup: (groupId: string, field: string, value: unknown) => void;
  onRemoveGroup: (groupId: string) => void;
  onDuplicateGroup: (groupId: string) => void;
  onToggleGroupCollapsed: (groupId: string) => void;
  onBlockAction: BlockActionHandlers;
  dragHandleListeners?: DraggableSyntheticListeners;
  dragHandleAttributes?: DraggableAttributes;
}) {
  const blockIds = useMemo(() => group.blocks.map((b) => b.id), [group.blocks]);

  const toggleGroupCombinator = () => {
    onUpdateGroup(
      group.id,
      "combinator",
      group.combinator === "AND" ? "OR" : "AND",
    );
  };

  return (
    <div className="group/grp overflow-hidden rounded-md border border-border bg-card shadow-sm">
      {/* Group header */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2.5">
        <div
          className="shrink-0 cursor-grab active:cursor-grabbing touch-none"
          {...dragHandleListeners}
          {...dragHandleAttributes}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </div>

        <button
          onClick={() => onToggleGroupCollapsed(group.id)}
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          title={group.collapsed ? "Expand group" : "Collapse group"}
        >
          {group.collapsed ? (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <Folder className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        {/* Group label */}
        <input
          value={group.label}
          onChange={(e) => onUpdateGroup(group.id, "label", e.target.value)}
          className="min-w-0 flex-1 border-b border-transparent bg-transparent text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-border focus:border-foreground"
          placeholder="Group label…"
        />

        {/* Group combinator toggle */}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleGroupCombinator}
            className={segmentButtonClass(group.combinator === "AND")}
            title="Switch to AND"
          >
            AND
          </button>
          <button
            onClick={toggleGroupCombinator}
            className={segmentButtonClass(group.combinator === "OR")}
            title="Switch to OR"
          >
            OR
          </button>
        </div>

        <span className="shrink-0 text-[11px] text-muted-foreground">
          {group.blocks.length} block{group.blocks.length !== 1 ? "s" : ""}
        </span>

        {/* Group actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => onDuplicateGroup(group.id)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground opacity-0 transition-colors duration-100 group-hover/grp:opacity-100 hover:border-border hover:bg-background hover:text-foreground"
            title="Duplicate group"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={() => onRemoveGroup(group.id)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground opacity-0 transition-colors duration-100 group-hover/grp:opacity-100 hover:border-border hover:bg-background hover:text-destructive"
            title="Remove group"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Group body */}
      {!group.collapsed && (
        <div className="flex flex-col gap-0 p-3">
          <SortableContext
            items={blockIds}
            strategy={verticalListSortingStrategy}
          >
            <GroupDropZone
              groupId={group.id}
              isEmpty={group.blocks.length === 0}
            />
            {group.blocks.map((block, bi) => (
              <div key={block.id}>
                <SortableBlockCard
                  block={block}
                  index={bi}
                  onUpdate={(id, field, val) =>
                    onBlockAction.update(group.id, id, field, val)
                  }
                  onRemove={(id) => onBlockAction.remove(group.id, id)}
                  onDuplicate={(id) => onBlockAction.duplicate(group.id, id)}
                  onToggleEnabled={(id) =>
                    onBlockAction.toggleEnabled(group.id, id)
                  }
                  onToggleCollapsed={(id) =>
                    onBlockAction.toggleCollapsed(group.id, id)
                  }
                  onToggleAdvanced={(id) =>
                    onBlockAction.toggleAdvanced(group.id, id)
                  }
                  onAddSubCondition={(bid, type) =>
                    onBlockAction.addSubCondition(group.id, bid, type)
                  }
                  onUpdateSubCondition={(bid, sid, field, val) =>
                    onBlockAction.updateSubCondition(
                      group.id,
                      bid,
                      sid,
                      field,
                      val,
                    )
                  }
                  onRemoveSubCondition={(bid, sid) =>
                    onBlockAction.removeSubCondition(group.id, bid, sid)
                  }
                  onToggleSubLogic={(bid, sid) =>
                    onBlockAction.toggleSubLogic(group.id, bid, sid)
                  }
                />
                {bi < group.blocks.length - 1 && (
                  <CombinatorPill
                    value={group.blocks[bi + 1].logic}
                    onClick={() =>
                      onBlockAction.toggleBlockLogic(
                        group.id,
                        group.blocks[bi + 1].id,
                      )
                    }
                  />
                )}
              </div>
            ))}
          </SortableContext>

          {/* Add block to group */}
          <button
            onClick={() => onBlockAction.addToGroup(group.id, "not_null")}
            className={cn(
              "mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border",
              "text-xs text-muted-foreground transition-colors duration-150 hover:border-foreground/30 hover:bg-muted/40 hover:text-foreground",
            )}
          >
            <Plus className="w-3 h-3" />
            Add Block to Group
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sortable Group Card ──────────────────────────────────────────────────────

function SortableGroupCard(props: {
  group: BlockGroup;
  onUpdateGroup: (groupId: string, field: string, value: unknown) => void;
  onRemoveGroup: (groupId: string) => void;
  onDuplicateGroup: (groupId: string) => void;
  onToggleGroupCollapsed: (groupId: string) => void;
  onBlockAction: BlockActionHandlers;
}) {
  const { group } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: group.id,
    data: { type: "group", group },
  });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-30 z-50")}
    >
      <GroupCard
        {...props}
        dragHandleListeners={listeners}
        dragHandleAttributes={attributes}
      />
    </div>
  );
}

// ─── Canvas Drop Zone ─────────────────────────────────────────────────────────

function CanvasDropZone({
  children,
  isEmpty,
}: {
  children: React.ReactNode;
  isEmpty: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-droppable" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 overflow-y-auto bg-background px-6 py-5",
        isOver && isEmpty && "bg-muted/30",
      )}
    >
      {children}
    </div>
  );
}

// ─── Block action handlers type ───────────────────────────────────────────────

interface DragActiveData {
  type: string;
  blockType?: string;
  block?: Block;
  group?: BlockGroup;
}

interface BlockActionHandlers {
  update: (
    groupId: string,
    blockId: string,
    field: string,
    value: string,
  ) => void;
  remove: (groupId: string, blockId: string) => void;
  duplicate: (groupId: string, blockId: string) => void;
  toggleEnabled: (groupId: string, blockId: string) => void;
  toggleCollapsed: (groupId: string, blockId: string) => void;
  toggleAdvanced: (groupId: string, blockId: string) => void;
  toggleBlockLogic: (groupId: string, blockId: string) => void;
  addToGroup: (groupId: string, type: string) => void;
  addSubCondition: (groupId: string, blockId: string, type: string) => void;
  updateSubCondition: (
    groupId: string,
    blockId: string,
    subId: string,
    field: string,
    value: string,
  ) => void;
  removeSubCondition: (groupId: string, blockId: string, subId: string) => void;
  toggleSubLogic: (groupId: string, blockId: string, subId: string) => void;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RuleBuilderPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<BlockGroup[]>([makeGroup()]);
  const [groupCombinator, setGroupCombinator] = useState<"AND" | "OR">("AND");
  const [ruleName, setRuleName] = useState("New Rule");
  const [testResult, setTestResult] = useState<{
    passed: number;
    failed: number;
    total: number;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [savedAlert, setSavedAlert] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<DragActiveData | null>(
    null,
  );
  const [mode, setMode] = useState<"simple" | "flow">("simple");

  // Palette state
  const [customBlockDefs, setCustomBlockDefs] = useState<CustomBlockDef[]>([]);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<
    Record<string, boolean>
  >({});
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [editingCustomBlock, setEditingCustomBlock] =
    useState<CustomBlockDef | null>(null);

  // Load custom blocks on mount
  useEffect(() => {
    const loaded = loadCustomBlocks();
    if (loaded.length > 0) {
      registerCustomBlocksIntoRegistry(loaded);
      setCustomBlockDefs(loaded);
    }
  }, []);

  const blockUsageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    groups.forEach((g) =>
      g.blocks.forEach((b) => {
        counts[b.type] = (counts[b.type] || 0) + 1;
      }),
    );
    return counts;
  }, [groups]);

  const totalBlockCount = useMemo(
    () => groups.reduce((s, g) => s + g.blocks.length, 0),
    [groups],
  );

  const getFilteredBlocks = useCallback(
    (blockKeys: string[]) => {
      if (!paletteSearch.trim()) return blockKeys;
      const q = paletteSearch.toLowerCase();
      return blockKeys.filter((key) => {
        const def = BLOCK_TYPES[key];
        if (!def) return false;
        return (
          def.label.toLowerCase().includes(q) ||
          def.description.toLowerCase().includes(q) ||
          def.operators.some((op) => op.toLowerCase().includes(q))
        );
      });
    },
    [paletteSearch],
  );

  const toggleCategory = useCallback((key: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ── Custom block CRUD ──────────────────────────────────────────────────────
  const handleSaveCustomBlock = useCallback((def: CustomBlockDef) => {
    setCustomBlockDefs((prev) => {
      const existing = prev.findIndex((d) => d.id === def.id);
      let next: CustomBlockDef[];
      if (existing >= 0) {
        next = [...prev];
        next[existing] = def;
      } else {
        next = [...prev, def];
      }
      registerCustomBlocksIntoRegistry(next);
      saveCustomBlocks(next);
      return next;
    });
    setEditingCustomBlock(null);
  }, []);

  const handleDeleteCustomBlock = useCallback((defId: string) => {
    setCustomBlockDefs((prev) => {
      const key = `user_${defId}`;
      delete BLOCK_TYPES[key];
      delete BLOCK_COLORS[key];
      const next = prev.filter((d) => d.id !== defId);
      saveCustomBlocks(next);
      return next;
    });
  }, []);

  // ── Group actions ──────────────────────────────────────────────────────────

  const addGroup = useCallback(() => {
    setGroups((prev) => [...prev, makeGroup()]);
  }, []);

  const removeGroup = useCallback((groupId: string) => {
    setGroups((prev) => {
      if (prev.length <= 1)
        return prev.map((g) => (g.id === groupId ? { ...g, blocks: [] } : g));
      return prev.filter((g) => g.id !== groupId);
    });
  }, []);

  const duplicateGroup = useCallback((groupId: string) => {
    setGroups((prev) => {
      const idx = prev.findIndex((g) => g.id === groupId);
      if (idx === -1) return prev;
      const copy: BlockGroup = {
        ...prev[idx],
        id: generateId("group"),
        label: prev[idx].label + " (copy)",
        blocks: prev[idx].blocks.map((b) => ({
          ...b,
          id: generateId("block"),
        })),
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }, []);

  const updateGroup = useCallback(
    (groupId: string, field: string, value: unknown) => {
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, [field]: value } : g)),
      );
    },
    [],
  );

  const toggleGroupCollapsed = useCallback((groupId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, collapsed: !g.collapsed } : g,
      ),
    );
  }, []);

  // ── Block actions ──────────────────────────────────────────────────────────

  const addBlockToGroup = useCallback((groupId: string, type: string) => {
    const def = BLOCK_TYPES[type];
    if (!def) return;
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, blocks: [...g.blocks, makeBlock(type)] } : g,
      ),
    );
  }, []);

  const removeBlock = useCallback((groupId: string, blockId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, blocks: g.blocks.filter((b) => b.id !== blockId) }
          : g,
      ),
    );
  }, []);

  const updateBlock = useCallback(
    (groupId: string, blockId: string, field: string, value: string) => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                blocks: g.blocks.map((b) =>
                  b.id === blockId ? { ...b, [field]: value } : b,
                ),
              }
            : g,
        ),
      );
    },
    [],
  );

  const duplicateBlock = useCallback((groupId: string, blockId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const idx = g.blocks.findIndex((b) => b.id === blockId);
        if (idx === -1) return g;
        const copy: Block = {
          ...g.blocks[idx],
          id: generateId("block"),
          subConditions: g.blocks[idx].subConditions.map((s) => ({
            ...s,
            id: generateId("sub"),
          })),
        };
        const next = [...g.blocks];
        next.splice(idx + 1, 0, copy);
        return { ...g, blocks: next };
      }),
    );
  }, []);

  const toggleBlockEnabled = useCallback((groupId: string, blockId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              blocks: g.blocks.map((b) =>
                b.id === blockId ? { ...b, enabled: !b.enabled } : b,
              ),
            }
          : g,
      ),
    );
  }, []);

  const toggleBlockCollapsed = useCallback(
    (groupId: string, blockId: string) => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                blocks: g.blocks.map((b) =>
                  b.id === blockId ? { ...b, collapsed: !b.collapsed } : b,
                ),
              }
            : g,
        ),
      );
    },
    [],
  );

  const toggleBlockAdvanced = useCallback(
    (groupId: string, blockId: string) => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                blocks: g.blocks.map((b) =>
                  b.id === blockId
                    ? { ...b, advancedMode: !b.advancedMode }
                    : b,
                ),
              }
            : g,
        ),
      );
    },
    [],
  );

  const toggleBlockLogic = useCallback((groupId: string, blockId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              blocks: g.blocks.map((b) =>
                b.id === blockId
                  ? { ...b, logic: b.logic === "AND" ? "OR" : "AND" }
                  : b,
              ),
            }
          : g,
      ),
    );
  }, []);

  // ── Sub-condition actions ──────────────────────────────────────────────────

  const addSubCondition = useCallback(
    (groupId: string, blockId: string, type: string) => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                blocks: g.blocks.map((b) =>
                  b.id === blockId
                    ? {
                        ...b,
                        subConditions: [
                          ...b.subConditions,
                          makeSubCondition(type),
                        ],
                      }
                    : b,
                ),
              }
            : g,
        ),
      );
    },
    [],
  );

  const updateSubCondition = useCallback(
    (
      groupId: string,
      blockId: string,
      subId: string,
      field: string,
      value: string,
    ) => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                blocks: g.blocks.map((b) =>
                  b.id === blockId
                    ? {
                        ...b,
                        subConditions: b.subConditions.map((s) =>
                          s.id === subId ? { ...s, [field]: value } : s,
                        ),
                      }
                    : b,
                ),
              }
            : g,
        ),
      );
    },
    [],
  );

  const removeSubCondition = useCallback(
    (groupId: string, blockId: string, subId: string) => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                blocks: g.blocks.map((b) =>
                  b.id === blockId
                    ? {
                        ...b,
                        subConditions: b.subConditions.filter(
                          (s) => s.id !== subId,
                        ),
                      }
                    : b,
                ),
              }
            : g,
        ),
      );
    },
    [],
  );

  const toggleSubLogic = useCallback(
    (groupId: string, blockId: string, subId: string) => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                blocks: g.blocks.map((b) =>
                  b.id === blockId
                    ? {
                        ...b,
                        subConditions: b.subConditions.map((s) =>
                          s.id === subId
                            ? { ...s, logic: s.logic === "AND" ? "OR" : "AND" }
                            : s,
                        ),
                      }
                    : b,
                ),
              }
            : g,
        ),
      );
    },
    [],
  );

  const blockActions: BlockActionHandlers = useMemo(
    () => ({
      update: updateBlock,
      remove: removeBlock,
      duplicate: duplicateBlock,
      toggleEnabled: toggleBlockEnabled,
      toggleCollapsed: toggleBlockCollapsed,
      toggleAdvanced: toggleBlockAdvanced,
      toggleBlockLogic,
      addToGroup: addBlockToGroup,
      addSubCondition,
      updateSubCondition,
      removeSubCondition,
      toggleSubLogic,
    }),
    [
      updateBlock,
      removeBlock,
      duplicateBlock,
      toggleBlockEnabled,
      toggleBlockCollapsed,
      toggleBlockAdvanced,
      toggleBlockLogic,
      addBlockToGroup,
      addSubCondition,
      updateSubCondition,
      removeSubCondition,
      toggleSubLogic,
    ],
  );

  // ── DnD ────────────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const groupIds = useMemo(() => groups.map((g) => g.id), [groups]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveDragId(id);
    setActiveDragData(event.active.data.current as DragActiveData);
  }, []);

  const handleDragOver = useCallback(() => {
    // GroupDropZone components handle their own isOver highlighting via useDroppable
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragId(null);
      setActiveDragData(null);
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;
      const activeData = active.data.current as {
        type: string;
        blockType?: string;
        block?: Block;
        group?: BlockGroup;
      };

      // ── Palette → Canvas ──
      if (activeId.startsWith("palette-")) {
        const blockType = activeId.replace("palette-", "");
        const def = BLOCK_TYPES[blockType];
        if (!def) return;

        // Determine target group
        let targetGroupId: string | null = null;
        if (overId.startsWith("group-drop-")) {
          targetGroupId = overId.replace("group-drop-", "");
        } else if (overId === "canvas-droppable") {
          targetGroupId = groups[groups.length - 1]?.id ?? null;
        } else {
          // Dropped over a block — find its group
          const foundGroup = groups.find((g) =>
            g.blocks.some((b) => b.id === overId),
          );
          targetGroupId = foundGroup?.id ?? null;
        }

        if (!targetGroupId) {
          // fallback: add to last group or create one
          if (groups.length === 0) {
            const newGroup = makeGroup();
            newGroup.blocks.push(makeBlock(blockType));
            setGroups([newGroup]);
          } else {
            addBlockToGroup(groups[groups.length - 1].id, blockType);
          }
          return;
        }

        if (
          overId.startsWith("group-drop-") ||
          !groups.find((g) => g.blocks.some((b) => b.id === overId))
        ) {
          addBlockToGroup(targetGroupId, blockType);
        } else {
          // Insert after the block it was dropped on
          setGroups((prev) =>
            prev.map((g) => {
              if (g.id !== targetGroupId) return g;
              const overIndex = g.blocks.findIndex((b) => b.id === overId);
              if (overIndex === -1)
                return { ...g, blocks: [...g.blocks, makeBlock(blockType)] };
              const next = [...g.blocks];
              next.splice(overIndex + 1, 0, makeBlock(blockType));
              return { ...g, blocks: next };
            }),
          );
        }
        return;
      }

      // ── Group reorder ──
      if (activeData?.type === "group") {
        if (activeId !== overId && groupIds.includes(overId)) {
          setGroups((prev) => {
            const oldIdx = prev.findIndex((g) => g.id === activeId);
            const newIdx = prev.findIndex((g) => g.id === overId);
            if (oldIdx === -1 || newIdx === -1) return prev;
            return arrayMove(prev, oldIdx, newIdx);
          });
        }
        return;
      }

      // ── Block reorder within same group ──
      if (
        activeData?.type === "block" ||
        (!activeId.startsWith("palette-") && !activeId.startsWith("group-"))
      ) {
        if (activeId === overId || overId === "canvas-droppable") return;

        const activeGroup = groups.find((g) =>
          g.blocks.some((b) => b.id === activeId),
        );
        const overGroup = groups.find((g) =>
          g.blocks.some((b) => b.id === overId),
        );

        if (!activeGroup) return;

        if (!overGroup || activeGroup.id === overGroup.id) {
          // Same group reorder
          setGroups((prev) =>
            prev.map((g) => {
              if (g.id !== activeGroup.id) return g;
              const oldIdx = g.blocks.findIndex((b) => b.id === activeId);
              const newIdx = g.blocks.findIndex((b) => b.id === overId);
              if (oldIdx === -1 || newIdx === -1) return g;
              return { ...g, blocks: arrayMove(g.blocks, oldIdx, newIdx) };
            }),
          );
        } else {
          // Cross-group move
          const blockToMove = activeGroup.blocks.find((b) => b.id === activeId);
          if (!blockToMove) return;
          setGroups((prev) =>
            prev.map((g) => {
              if (g.id === activeGroup.id)
                return {
                  ...g,
                  blocks: g.blocks.filter((b) => b.id !== activeId),
                };
              if (g.id === overGroup.id) {
                const idx = g.blocks.findIndex((b) => b.id === overId);
                const next = [...g.blocks];
                next.splice(idx + 1, 0, { ...blockToMove });
                return { ...g, blocks: next };
              }
              return g;
            }),
          );
        }
      }
    },
    [groups, groupIds, addBlockToGroup],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
    setActiveDragData(null);
  }, []);

  // ── Drag overlay ───────────────────────────────────────────────────────────

  const dragOverlayContent = useMemo(() => {
    if (!activeDragId || !activeDragData) return null;
    if (activeDragId.startsWith("palette-")) {
      return (
        <PaletteDragPreview typeKey={activeDragId.replace("palette-", "")} />
      );
    }
    if (activeDragData?.type === "group" && activeDragData.group) {
      return <GroupDragPreview group={activeDragData.group} />;
    }
    if (activeDragData?.type === "block" && activeDragData.block) {
      const allBlocks = groups.flatMap((g) => g.blocks);
      const block =
        allBlocks.find((b) => b.id === activeDragId) ?? activeDragData.block;
      const index = allBlocks.indexOf(block);
      return <BlockDragPreview block={block} index={index >= 0 ? index : 0} />;
    }
    return null;
  }, [activeDragId, activeDragData, groups]);

  // ── Test / Save ────────────────────────────────────────────────────────────

  const handleTest = () => {
    if (totalBlockCount === 0) return;
    setIsTesting(true);
    setTestResult(null);
    setTimeout(() => {
      const failed = Math.floor(Math.random() * 500);
      const passed = Math.floor(Math.random() * 9000) + 500;
      setTestResult({ passed, failed, total: passed + failed });
      setIsTesting(false);
    }, 1500);
  };

  const handleSave = () => {
    console.log("Saving rule:", { name: ruleName, groupCombinator, groups });
    setSavedAlert(true);
    setTimeout(() => setSavedAlert(false), 3000);
  };

  const handleFlowSave = (rule: CanvasRule) => {
    console.log("Flow rule payload:", rule);
    setSavedAlert(true);
    setTimeout(() => setSavedAlert(false), 3000);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
          {/* ── Saved alert ── */}
          {savedAlert && (
            <div
              className={cn(
                "fixed right-4 top-4 z-50 flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 shadow-lg",
                "animate-in slide-in-from-right duration-200",
              )}
            >
              <CheckCircle className="w-4 h-4 text-[#10B981]" />
              <span className="text-sm text-foreground">
                Rule saved — view in{" "}
                <Link href="/rules" className="underline underline-offset-2">
                  Rules
                </Link>
              </span>
              <button
                onClick={() => setSavedAlert(false)}
                className="ml-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* ── Header strip ── */}
          <div
            className={cn(
              "shrink-0 border-b border-border bg-background px-5 py-4",
            )}
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <h1 className="text-base font-semibold text-foreground">
                      Flow Builder
                    </h1>
                    {/* Mode toggle */}
                    <div className="ml-2 flex items-center rounded-md border border-border bg-muted p-0.5">
                      <button
                        onClick={() => setMode("simple")}
                        className={cn(
                          "inline-flex h-6 items-center rounded px-2.5 text-[11px] font-medium transition-colors",
                          mode === "simple"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Simple
                      </button>
                      <button
                        onClick={() => setMode("flow")}
                        className={cn(
                          "inline-flex h-6 items-center rounded px-2.5 text-[11px] font-medium transition-colors",
                          mode === "flow"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Flow
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {mode === "flow"
                      ? "Canvas editor — connect condition nodes to AND / OR groups."
                      : "Build rule groups with drag and drop, then validate before saving."}
                  </p>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Rule
                  </label>
                  <Input
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    className="h-8 max-w-[260px] text-sm"
                  />
                </div>
              </div>

              {mode === "simple" && (
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTest}
                    disabled={isTesting || totalBlockCount === 0}
                    className={cn(
                      "h-8 gap-1.5 px-3",
                      isTesting && "cursor-not-allowed opacity-50",
                    )}
                  >
                    {isTesting ? (
                      <>
                        <Zap className="h-3.5 w-3.5 animate-pulse" />
                        <span>Testing…</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        <span>Run Test</span>
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={totalBlockCount === 0}
                    className="h-8 gap-1.5 px-3 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Save</span>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* ── Main content ── */}
          {mode === "flow" ? (
            <div className="flex flex-1 overflow-hidden">
              <FlowCanvas ruleName={ruleName} onSave={handleFlowSave} />
            </div>
          ) : (
          <div className="flex flex-1 overflow-hidden bg-muted/20">
            {/* ── Left palette ── */}
            <div
              className={cn(
                "w-[280px] shrink-0 overflow-hidden border-r border-border bg-background",
                "flex flex-col",
              )}
            >
              <div className="shrink-0 border-b border-border px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    Block Palette
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {Object.keys(BLOCK_TYPES).length} blocks
                  </span>
                </div>
              </div>

              {/* Search */}
              <div className="shrink-0 border-b border-border px-3 py-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={paletteSearch}
                    onChange={(e) => setPaletteSearch(e.target.value)}
                    placeholder="Search blocks…"
                    className="h-8 pl-8 pr-8 text-sm"
                  />
                  {paletteSearch && (
                    <button
                      onClick={() => setPaletteSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category sections */}
              <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col gap-2 p-3">
                  {PALETTE_CATEGORIES.map((cat) => {
                    const filtered = getFilteredBlocks(cat.blocks);
                    if (filtered.length === 0 && paletteSearch.trim())
                      return null;
                    return (
                      <CategorySection
                        key={cat.key}
                        cat={cat}
                        blockCount={filtered.length}
                        isOpen={!collapsedCategories[cat.key]}
                        onToggle={() => toggleCategory(cat.key)}
                      >
                        {filtered.map((typeKey) => (
                          <DraggablePaletteItem
                            key={typeKey}
                            typeKey={typeKey}
                            onAdd={(t) =>
                              addBlockToGroup(
                                groups[groups.length - 1]?.id ?? "",
                                t,
                              )
                            }
                            usageCount={blockUsageCounts[typeKey]}
                          />
                        ))}
                      </CategorySection>
                    );
                  })}

                  {/* Custom blocks */}
                  {(() => {
                    const customKeys = customBlockDefs.map(
                      (d) => `user_${d.id}`,
                    );
                    const filteredCustom = getFilteredBlocks(customKeys);
                    if (customBlockDefs.length === 0 && paletteSearch.trim())
                      return null;
                    if (customBlockDefs.length > 0 || !paletteSearch.trim()) {
                      return (
                        <CategorySection
                          key="custom"
                          cat={{
                            key: "custom",
                            label: "Custom",
                            color: "var(--te-yellow)",
                            iconName: "Sparkles",
                            blocks: customKeys,
                          }}
                          blockCount={filteredCustom.length}
                          isOpen={!collapsedCategories["custom"]}
                          onToggle={() => toggleCategory("custom")}
                        >
                          {filteredCustom.map((typeKey) => {
                            const defId = typeKey.replace("user_", "");
                            const customDef = customBlockDefs.find(
                              (d) => d.id === defId,
                            );
                            return (
                              <DraggablePaletteItem
                                key={typeKey}
                                typeKey={typeKey}
                                onAdd={(t) =>
                                  addBlockToGroup(
                                    groups[groups.length - 1]?.id ?? "",
                                    t,
                                  )
                                }
                                usageCount={blockUsageCounts[typeKey]}
                                isCustom
                                onEdit={() => {
                                  if (customDef) {
                                    setEditingCustomBlock(customDef);
                                    setCustomDialogOpen(true);
                                  }
                                }}
                                onDelete={() => handleDeleteCustomBlock(defId)}
                              />
                            );
                          })}
                          {!paletteSearch.trim() &&
                            customBlockDefs.length === 0 && (
                              <p className="label-te text-[0.55rem] opacity-40 normal-case tracking-wide px-2 py-1">
                                No custom blocks yet
                              </p>
                            )}
                        </CategorySection>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* Create custom block */}
              <div className="shrink-0 border-t border-border px-3 py-3">
                <button
                  onClick={() => {
                    setEditingCustomBlock(null);
                    setCustomDialogOpen(true);
                  }}
                  className={cn(
                    "flex h-9 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border",
                    "text-sm text-muted-foreground transition-colors duration-150 hover:border-foreground/30 hover:bg-muted/40 hover:text-foreground",
                  )}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Create Custom Block</span>
                </button>
              </div>

              <div className="mx-3 mb-3 shrink-0 rounded-md border border-border bg-muted/40 p-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Drag a block into any group or use the add actions. Group
                  logic is local, and the toolbar logic connects groups.
                </p>
              </div>
            </div>

            {/* Custom Block Dialog */}
            <CustomBlockDialog
              open={customDialogOpen}
              onOpenChange={setCustomDialogOpen}
              onSave={handleSaveCustomBlock}
              editingBlock={editingCustomBlock}
            />

            {/* ── Canvas ── */}
            <div className="flex-1 flex flex-col overflow-hidden bg-background">
              {/* Canvas toolbar */}
              <div className="flex items-center gap-3 border-b border-border bg-background px-5 py-3 shrink-0">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Group Logic
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setGroupCombinator("AND")}
                    className={segmentButtonClass(groupCombinator === "AND")}
                  >
                    AND
                  </button>
                  <button
                    onClick={() => setGroupCombinator("OR")}
                    className={segmentButtonClass(groupCombinator === "OR")}
                  >
                    OR
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">
                  connects groups
                </span>

                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {groups.length} group{groups.length !== 1 ? "s" : ""} ·{" "}
                    {totalBlockCount} block{totalBlockCount !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={addGroup}
                    className={cn(
                      "flex h-8 items-center gap-1 rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors",
                      "hover:bg-muted hover:text-foreground",
                    )}
                    title="Add new condition group"
                  >
                    <FolderPlus className="w-3 h-3" />
                    Add Group
                  </button>
                  {totalBlockCount > 0 && (
                    <button
                      onClick={() => setGroups([makeGroup()])}
                      className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                      title="Clear all groups"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              {/* Groups list */}
              <CanvasDropZone isEmpty={totalBlockCount === 0}>
                <SortableContext
                  items={groupIds}
                  strategy={verticalListSortingStrategy}
                >
                  {totalBlockCount === 0 &&
                  groups.every((g) => g.blocks.length === 0) ? (
                    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                      <div
                        className={cn(
                          "flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-border bg-muted/40",
                        )}
                      >
                        <Layers className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="mb-1 text-sm font-medium text-foreground">
                          Canvas empty
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Drag blocks from the palette into a group, or click +
                          in any group
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex max-w-3xl flex-col gap-0">
                      {groups.map((group, gi) => (
                        <div key={group.id}>
                          <SortableGroupCard
                            group={group}
                            onUpdateGroup={updateGroup}
                            onRemoveGroup={removeGroup}
                            onDuplicateGroup={duplicateGroup}
                            onToggleGroupCollapsed={toggleGroupCollapsed}
                            onBlockAction={blockActions}
                          />
                          {gi < groups.length - 1 && (
                            <GroupCombinatorBadge
                              value={groupCombinator}
                              onClick={() =>
                                setGroupCombinator((v) =>
                                  v === "AND" ? "OR" : "AND",
                                )
                              }
                            />
                          )}
                        </div>
                      ))}

                      {/* Add group CTA */}
                      <div className="mt-3">
                        <button
                          onClick={addGroup}
                          className={cn(
                            "flex h-10 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border",
                            "text-sm text-muted-foreground transition-colors duration-150 hover:border-foreground/30 hover:bg-muted/40 hover:text-foreground",
                          )}
                        >
                          <FolderPlus className="w-3.5 h-3.5" />
                          <span>Add Group</span>
                        </button>
                      </div>
                    </div>
                  )}
                </SortableContext>
              </CanvasDropZone>

              {/* ── Test Results ── */}
              {(testResult || isTesting) && (
                <div className="shrink-0 border-t border-border bg-background">
                  {isTesting ? (
                    <div className="flex items-center gap-3 px-5 py-3">
                      <Zap className="h-4 w-4 animate-pulse text-muted-foreground" />
                      <span className="text-sm text-foreground">
                        Running validation test…
                      </span>
                      <div className="flex gap-1 ml-auto">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-foreground/70 animate-pulse"
                            style={{ animationDelay: `${i * 150}ms` }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : testResult ? (
                    <div className="flex flex-wrap items-center gap-4 px-5 py-3">
                      <span className="shrink-0 text-sm font-medium text-foreground">
                        Test Results
                      </span>

                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-[#10B981]" />
                        <span className="text-sm text-[#10B981]">
                          {testResult.passed.toLocaleString()} passed
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                        <span className="text-sm text-red-500">
                          {testResult.failed.toLocaleString()} failed
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-muted-foreground">
                          of {testResult.total.toLocaleString()} rows
                        </span>
                      </div>

                      <div className="flex-1 min-w-[120px] flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-[#10B981] rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.round((testResult.passed / testResult.total) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {Math.round(
                            (testResult.passed / testResult.total) * 100,
                          )}
                          %
                        </span>
                      </div>

                      {testResult.failed > 0 && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span className="text-xs">Review failing rows</span>
                        </div>
                      )}

                      <button
                        onClick={() => setTestResult(null)}
                        className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
                        title="Dismiss results"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          )}
        </div>

        <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
          {dragOverlayContent}
        </DragOverlay>
      </DndContext>
    </MainLayout>
  );
}
