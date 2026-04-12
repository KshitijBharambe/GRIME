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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useIssuesSummary } from "@/lib/hooks/useIssues";
import type { IssuesSummary } from "@/types/api";
import { TrendingUp } from "lucide-react";

interface TrendDataPoint {
  date: string;
  issues: number;
}

export function QualityTrendsChart() {
  const { data: issuesSummary, isLoading } = useIssuesSummary(30) as {
    data: IssuesSummary | undefined;
    isLoading: boolean;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Quality Trends
          </CardTitle>
          <CardDescription>Issues over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  // Build trend data from issues_by_day
  const trendData: TrendDataPoint[] = [];
  if (issuesSummary?.trends?.issues_by_day) {
    const entries = Object.entries(issuesSummary.trends.issues_by_day).sort(
      ([a], [b]) => a.localeCompare(b),
    );
    for (const [date, count] of entries) {
      // Format date for display: "2025-01-15" -> "Jan 15"
      const d = new Date(date);
      const label = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      trendData.push({ date: label, issues: count as number });
    }
  }

  // If no trend data, fill in last 30 days with zeros
  if (trendData.length === 0) {
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      trendData.push({
        date: d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        issues: 0,
      });
    }
  }

  const totalIssues = trendData.reduce((sum, d) => sum + d.issues, 0);
  const avgPerDay =
    trendData.length > 0 ? (totalIssues / trendData.length).toFixed(1) : "0";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Quality Trends
            </CardTitle>
            <CardDescription>New issues over the last 30 days</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {totalIssues} total
            </Badge>
            <Badge variant="secondary" className="font-mono">
              ~{avgPerDay}/day
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={trendData}
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
                  return (
                    <div className="bg-background border rounded-lg p-2 shadow-lg text-sm">
                      <p className="font-medium">{label}</p>
                      <p className="text-muted-foreground">
                        Issues:{" "}
                        <span className="font-bold text-foreground">
                          {payload[0].value}
                        </span>
                      </p>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="issues"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
