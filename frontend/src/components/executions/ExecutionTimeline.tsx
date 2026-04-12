"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Timer } from "lucide-react";

interface RuleSnapshotData {
  name?: string;
  version?: number;
  criticality?: string;
  kind?: string;
}

interface RulePerformance {
  rule_id: string;
  rule_snapshot?: string;
  error_count: number;
  rows_flagged: number;
  cols_flagged: number;
  note?: string;
}

interface ExecutionTimelineProps {
  rulePerformance: RulePerformance[];
  startedAt?: string;
  finishedAt?: string;
  durationSeconds?: number;
}

interface TimelineEntry {
  name: string;
  errors: number;
  rowsFlagged: number;
  criticality: string;
  kind: string;
}

const criticalityColors: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
};

export function ExecutionTimeline({
  rulePerformance,
  durationSeconds,
}: ExecutionTimelineProps) {
  const data = useMemo(() => {
    return rulePerformance
      .map((rp) => {
        let name = "Unknown";
        let criticality = "low";
        let kind = "unknown";

        if (rp.rule_snapshot) {
          try {
            const snap = JSON.parse(rp.rule_snapshot) as RuleSnapshotData;
            name = snap.name || "Unknown";
            criticality = snap.criticality || "low";
            kind = snap.kind || "unknown";
          } catch {
            /* skip */
          }
        }

        // Truncate long names for chart display
        const displayName =
          name.length > 20 ? name.substring(0, 18) + "…" : name;

        return {
          name: displayName,
          fullName: name,
          errors: rp.error_count,
          rowsFlagged: rp.rows_flagged,
          criticality,
          kind,
        };
      })
      .sort((a, b) => b.rowsFlagged - a.rowsFlagged);
  }, [rulePerformance]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Execution Timeline
          </CardTitle>
          <CardDescription>
            Rule execution performance breakdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No timeline data available.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5" />
          Execution Timeline
        </CardTitle>
        <CardDescription>
          Rows flagged per rule — colored by criticality
          {durationSeconds != null && (
            <span className="ml-2">
              <Badge variant="outline" className="font-mono">
                Total: {durationSeconds}s
              </Badge>
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis
                dataKey="name"
                type="category"
                width={150}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as TimelineEntry & {
                    fullName: string;
                  };
                  return (
                    <div className="bg-background border rounded-lg p-3 shadow-lg">
                      <p className="font-medium text-sm">{d.fullName}</p>
                      <div className="mt-1 space-y-0.5 text-xs">
                        <p>
                          Rows flagged:{" "}
                          <span className="font-bold">{d.rowsFlagged}</span>
                        </p>
                        <p>
                          Errors: <span className="font-bold">{d.errors}</span>
                        </p>
                        <p>
                          Criticality:{" "}
                          <Badge variant="outline" className="text-xs ml-1">
                            {d.criticality}
                          </Badge>
                        </p>
                        <p>
                          Kind:{" "}
                          <Badge variant="outline" className="text-xs ml-1">
                            {d.kind}
                          </Badge>
                        </p>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="rowsFlagged" radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={criticalityColors[entry.criticality] || "#94a3b8"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-4 mt-4">
          {Object.entries(criticalityColors).map(([level, color]) => (
            <div key={level} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span className="capitalize">{level}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
