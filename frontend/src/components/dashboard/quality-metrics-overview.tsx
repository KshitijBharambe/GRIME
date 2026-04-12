"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Gauge, TrendingUp, CheckCircle, AlertCircle } from "lucide-react";
import {
  useExecutions,
  useExecutionQualityMetrics,
} from "@/lib/hooks/useExecutions";
import { cn } from "@/lib/utils";
import {
  getScoreColor,
  getScoreBgColor,
  getScoreBadgeVariant,
} from "@/lib/utils/score";

export function QualityMetricsOverview() {
  const { data: executionsData, isLoading: executionsLoading } = useExecutions(
    1,
    5,
  );
  const latestExecution = executionsData?.items?.[0];

  const { data: qualityMetrics, isLoading: metricsLoading } =
    useExecutionQualityMetrics(latestExecution?.id || "");

  const isLoading = executionsLoading || metricsLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Latest Quality Metrics
          </CardTitle>
          <CardDescription>
            Data quality scores from most recent execution
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, index) => (
            <div key={`skeleton-quality-${index}`} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                <div className="h-6 w-16 bg-muted animate-pulse rounded" />
              </div>
              <div className="h-2 w-full bg-muted animate-pulse rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!qualityMetrics || qualityMetrics.status === "not_available") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Latest Quality Metrics
          </CardTitle>
          <CardDescription>
            Data quality scores from most recent execution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {qualityMetrics?.message || "No quality metrics available yet"}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Run an execution to see quality metrics
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const avgScore =
    (qualityMetrics.dqi +
      qualityMetrics.clean_rows_pct +
      qualityMetrics.hybrid) /
    3;

  const metrics = [
    {
      label: "DQI",
      fullLabel: "Data Quality Index",
      value: qualityMetrics.dqi,
      icon: <CheckCircle className="h-4 w-4" />,
    },
    {
      label: "Clean Rows",
      fullLabel: "Clean Rows Percentage",
      value: qualityMetrics.clean_rows_pct,
      icon: <TrendingUp className="h-4 w-4" />,
    },
    {
      label: "Hybrid",
      fullLabel: "Overall Quality Score",
      value: qualityMetrics.hybrid,
      icon: <Gauge className="h-4 w-4" />,
    },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                Latest Quality Metrics
              </CardTitle>
              <CardDescription>
                Data quality scores from most recent execution
              </CardDescription>
            </div>
            <Badge
              variant={getScoreBadgeVariant(avgScore)}
              className="text-base px-3 py-1"
            >
              {avgScore.toFixed(1)}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {metrics.map((metric) => (
            <div key={metric.fullLabel} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "p-1.5 rounded-lg",
                      getScoreBgColor(metric.value),
                    )}
                  >
                    {metric.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{metric.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {metric.fullLabel}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-2xl font-bold",
                      getScoreColor(metric.value),
                    )}
                  >
                    {metric.value.toFixed(1)}%
                  </span>
                </div>
              </div>
              <Progress value={metric.value} className="h-2" />
            </div>
          ))}

          {latestExecution && (
            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground">
                From execution: {latestExecution.id.slice(0, 8)}...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
