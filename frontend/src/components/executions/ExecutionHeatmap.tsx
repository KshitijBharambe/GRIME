"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Criticality, type Issue } from "@/types/api";
import { Grid3X3, ZoomIn } from "lucide-react";

interface RuleSnapshotData {
  name?: string;
  version?: number;
  criticality?: string;
  kind?: string;
  target_columns?: string | string[];
}

interface RulePerformance {
  rule_id: string;
  rule_snapshot?: string;
  error_count: number;
  rows_flagged: number;
  cols_flagged: number;
  note?: string;
}

interface ExecutionHeatmapProps {
  rulePerformance: RulePerformance[];
  issues: Issue[];
  onCellClick?: (column: string, ruleName: string) => void;
}

type CellStatus = "pass" | "fail" | "warning" | "no-data";

interface HeatmapCell {
  column: string;
  ruleName: string;
  ruleId: string;
  status: CellStatus;
  issueCount: number;
  severity: Criticality | null;
}

const statusColors: Record<CellStatus, string> = {
  pass: "bg-green-100 hover:bg-green-200 border-green-300",
  fail: "bg-red-100 hover:bg-red-200 border-red-300",
  warning: "bg-yellow-100 hover:bg-yellow-200 border-yellow-300",
  "no-data": "bg-gray-50 hover:bg-gray-100 border-gray-200",
};

const statusDotColors: Record<CellStatus, string> = {
  pass: "bg-green-500",
  fail: "bg-red-500",
  warning: "bg-yellow-500",
  "no-data": "bg-gray-300",
};

export function ExecutionHeatmap({
  rulePerformance,
  issues,
  onCellClick,
}: ExecutionHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const { columns, rules, cells } = useMemo(() => {
    // Extract unique columns from issues
    const columnSet = new Set<string>();
    issues.forEach((issue) => {
      if (issue.column_name) columnSet.add(issue.column_name);
    });

    // Also extract columns from rule snapshots
    rulePerformance.forEach((rp) => {
      if (rp.rule_snapshot) {
        try {
          const data = JSON.parse(rp.rule_snapshot) as RuleSnapshotData;
          if (data.target_columns) {
            const cols =
              typeof data.target_columns === "string"
                ? data.target_columns.split(",").map((c) => c.trim())
                : Array.isArray(data.target_columns)
                  ? data.target_columns
                  : [];
            cols.forEach((c) => {
              if (c) columnSet.add(c);
            });
          }
        } catch {
          /* skip */
        }
      }
    });

    const columns = Array.from(columnSet).sort();

    // Extract rule names
    const ruleMap = new Map<
      string,
      { name: string; id: string; criticality?: string }
    >();
    rulePerformance.forEach((rp) => {
      let name = "Unknown Rule";
      let criticality: string | undefined;
      if (rp.rule_snapshot) {
        try {
          const data = JSON.parse(rp.rule_snapshot) as RuleSnapshotData;
          name = data.name || "Unknown Rule";
          criticality = data.criticality;
        } catch {
          /* skip */
        }
      }
      ruleMap.set(rp.rule_id, { name, id: rp.rule_id, criticality });
    });
    const rules = Array.from(ruleMap.values());

    // Build issue index: column+ruleId -> issues
    const issueIndex = new Map<string, Issue[]>();
    issues.forEach((issue) => {
      const key = `${issue.column_name}|${issue.rule_id}`;
      if (!issueIndex.has(key)) issueIndex.set(key, []);
      issueIndex.get(key)!.push(issue);
    });

    // Build cells
    const cells: HeatmapCell[] = [];
    for (const col of columns) {
      for (const rule of rules) {
        const key = `${col}|${rule.id}`;
        const cellIssues = issueIndex.get(key) || [];
        let status: CellStatus = "pass";
        let severity: Criticality | null = null;

        if (cellIssues.length > 0) {
          const severitySet = new Set(cellIssues.map((i) => i.severity));
          if (severitySet.has("critical") || severitySet.has("high")) {
            status = "fail";
            severity = severitySet.has("critical") ? "critical" : "high";
          } else {
            status = "warning";
            severity = severitySet.has("medium") ? "medium" : "low";
          }
        } else {
          // Check if rule targets this column
          const rp = rulePerformance.find((r) => r.rule_id === rule.id);
          if (rp?.rule_snapshot) {
            try {
              const data = JSON.parse(rp.rule_snapshot) as RuleSnapshotData;
              const targetCols =
                typeof data.target_columns === "string"
                  ? data.target_columns.split(",").map((c) => c.trim())
                  : Array.isArray(data.target_columns)
                    ? data.target_columns
                    : [];
              if (targetCols.length > 0 && !targetCols.includes(col)) {
                status = "no-data";
              }
            } catch {
              /* skip */
            }
          }
        }

        cells.push({
          column: col,
          ruleName: rule.name,
          ruleId: rule.id,
          status,
          issueCount: cellIssues.length,
          severity,
        });
      }
    }

    return { columns, rules, cells };
  }, [rulePerformance, issues]);

  if (columns.length === 0 || rules.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5" />
            Result Heatmap
          </CardTitle>
          <CardDescription>
            Column × Rule grid showing pass/fail status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No data available for heatmap visualization.
          </div>
        </CardContent>
      </Card>
    );
  }

  const getCell = (column: string, ruleName: string): HeatmapCell | undefined =>
    cells.find((c) => c.column === column && c.ruleName === ruleName);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Grid3X3 className="h-5 w-5" />
          Result Heatmap
        </CardTitle>
        <CardDescription>
          Column × Rule grid — click a cell to drill down into details
        </CardDescription>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5 text-xs">
            <div className={cn("w-3 h-3 rounded-sm", statusDotColors.pass)} />
            <span>Pass</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div
              className={cn("w-3 h-3 rounded-sm", statusDotColors.warning)}
            />
            <span>Warning</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className={cn("w-3 h-3 rounded-sm", statusDotColors.fail)} />
            <span>Fail</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div
              className={cn("w-3 h-3 rounded-sm", statusDotColors["no-data"])}
            />
            <span>N/A</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <TooltipProvider delayDuration={200}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium text-muted-foreground p-2 sticky left-0 bg-background min-w-[140px]">
                    Rule / Column →
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="text-center text-xs font-medium text-muted-foreground p-1 min-w-[60px]"
                    >
                      <span className="block truncate max-w-[80px]" title={col}>
                        {col}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="text-xs font-medium p-2 sticky left-0 bg-background border-r">
                      <span
                        className="block truncate max-w-[140px]"
                        title={rule.name}
                      >
                        {rule.name}
                      </span>
                    </td>
                    {columns.map((col) => {
                      const cell = getCell(col, rule.name);
                      const cellKey = `${col}|${rule.name}`;
                      const isHovered = hoveredCell === cellKey;

                      return (
                        <td key={col} className="p-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className={cn(
                                  "w-full aspect-square min-w-[40px] min-h-[40px] rounded-sm border transition-all flex items-center justify-center",
                                  cell
                                    ? statusColors[cell.status]
                                    : statusColors["no-data"],
                                  isHovered && "ring-2 ring-primary",
                                  onCellClick && "cursor-pointer",
                                )}
                                onMouseEnter={() => setHoveredCell(cellKey)}
                                onMouseLeave={() => setHoveredCell(null)}
                                onClick={() => onCellClick?.(col, rule.name)}
                              >
                                {cell && cell.issueCount > 0 && (
                                  <span className="text-xs font-bold">
                                    {cell.issueCount}
                                  </span>
                                )}
                                {cell && cell.status === "pass" && (
                                  <span className="text-green-600 text-xs">
                                    ✓
                                  </span>
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-[200px]"
                            >
                              <div className="space-y-1">
                                <p className="font-medium text-xs">
                                  {rule.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Column: {col}
                                </p>
                                {cell && cell.issueCount > 0 ? (
                                  <>
                                    <p className="text-xs">
                                      {cell.issueCount} issue
                                      {cell.issueCount !== 1 ? "s" : ""}
                                    </p>
                                    {cell.severity && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {cell.severity}
                                      </Badge>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-xs text-green-600">
                                    No issues
                                  </p>
                                )}
                                {onCellClick && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <ZoomIn className="h-3 w-3" /> Click to
                                    drill down
                                  </p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
