"use client";

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
} from "recharts";
import { useExecutions } from "@/lib/hooks/useExecutions";
import { Execution, ExecutionStatus } from "@/types/api";
import { BarChart3 } from "lucide-react";
import { useMemo } from "react";

const statusColors: Record<ExecutionStatus, string> = {
  succeeded: "#22c55e",
  failed: "#ef4444",
  partially_succeeded: "#eab308",
  running: "#3b82f6",
  queued: "#94a3b8",
};

interface DayBucket {
  date: string;
  succeeded: number;
  failed: number;
  partially_succeeded: number;
  running: number;
  queued: number;
  total: number;
}

export function ExecutionTimelineChart() {
  // Fetch recent executions (up to 100)
  const { data: executionsData, isLoading } = useExecutions(1, 100);

  const chartData = useMemo(() => {
    if (!executionsData?.items) return [];

    // Group executions by day
    const dayMap = new Map<string, DayBucket>();

    // Pre-fill last 14 days
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      dayMap.set(key, {
        date: label,
        succeeded: 0,
        failed: 0,
        partially_succeeded: 0,
        running: 0,
        queued: 0,
        total: 0,
      });
    }

    for (const exec of executionsData.items) {
      const dateKey = exec.started_at
        ? new Date(exec.started_at).toISOString().split("T")[0]
        : null;
      if (!dateKey) continue;

      let bucket = dayMap.get(dateKey);
      if (!bucket) {
        const d = new Date(dateKey);
        bucket = {
          date: d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          succeeded: 0,
          failed: 0,
          partially_succeeded: 0,
          running: 0,
          queued: 0,
          total: 0,
        };
        dayMap.set(dateKey, bucket);
      }

      const status = exec.status as ExecutionStatus;
      if (status in bucket) {
        bucket[status] += 1;
      }
      bucket.total += 1;
    }

    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [executionsData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Execution Timeline
          </CardTitle>
          <CardDescription>
            Executions per day over the last 2 weeks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  const totalExecutions = chartData.reduce((sum, d) => sum + d.total, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Execution Timeline
            </CardTitle>
            <CardDescription>Executions per day (last 2 weeks)</CardDescription>
          </div>
          <Badge variant="outline" className="font-mono">
            {totalExecutions} total
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload as DayBucket;
                  return (
                    <div className="bg-background border rounded-lg p-3 shadow-lg text-sm">
                      <p className="font-medium mb-1">{label}</p>
                      <div className="space-y-0.5 text-xs">
                        <p>
                          Total: <span className="font-bold">{d.total}</span>
                        </p>
                        {d.succeeded > 0 && (
                          <p className="text-green-600">
                            Succeeded: {d.succeeded}
                          </p>
                        )}
                        {d.failed > 0 && (
                          <p className="text-red-600">Failed: {d.failed}</p>
                        )}
                        {d.partially_succeeded > 0 && (
                          <p className="text-yellow-600">
                            Partial: {d.partially_succeeded}
                          </p>
                        )}
                        {d.running > 0 && (
                          <p className="text-blue-600">Running: {d.running}</p>
                        )}
                        {d.queued > 0 && (
                          <p className="text-gray-600">Queued: {d.queued}</p>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="succeeded"
                stackId="a"
                fill={statusColors.succeeded}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="partially_succeeded"
                stackId="a"
                fill={statusColors.partially_succeeded}
              />
              <Bar dataKey="failed" stackId="a" fill={statusColors.failed} />
              <Bar dataKey="running" stackId="a" fill={statusColors.running} />
              <Bar
                dataKey="queued"
                stackId="a"
                fill={statusColors.queued}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-4 mt-3">
          {(
            [
              "succeeded",
              "failed",
              "partially_succeeded",
              "running",
              "queued",
            ] as ExecutionStatus[]
          ).map((status) => (
            <div key={status} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: statusColors[status] }}
              />
              <span className="capitalize">{status.replace("_", " ")}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
