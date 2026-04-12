"use client";

import {
  Database,
  AlertTriangle,
  CheckCircle,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { useDashboardOverview } from "@/lib/hooks/useDashboard";
import { LoadingState, ErrorState } from "@/components/ui/state-views";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCard {
  title: string;
  value: string | number;
  change?: {
    value: number;
    trend: "up" | "down" | "neutral";
    period: string;
  };
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "success" | "warning" | "destructive";
}

function getTrendIcon(trend: "up" | "down" | "neutral") {
  switch (trend) {
    case "up":
      return <TrendingUp className="h-4 w-4" />;
    case "down":
      return <TrendingDown className="h-4 w-4" />;
    default:
      return <Minus className="h-4 w-4" />;
  }
}

function getTrendColor(
  trend: "up" | "down" | "neutral",
  context: "positive" | "negative" = "positive",
) {
  if (trend === "neutral") return "text-muted-foreground";

  if (context === "positive") {
    return trend === "up" ? "text-green-600" : "text-red-600";
  } else {
    return trend === "up" ? "text-red-600" : "text-green-600";
  }
}

export function StatsCards() {
  const { data: dashboardData, isLoading, error } = useDashboardOverview();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <LoadingState
          rows={4}
          className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        />
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <ErrorState
        message={error ? "Unable to load dashboard data" : "No data available"}
        className="col-span-full"
      />
    );
  }

  const stats: StatCard[] = [
    {
      title: "Total Datasets",
      value: dashboardData.overview.total_datasets,
      icon: Database,
      variant: "default",
    },
    {
      title: "Active Issues",
      value:
        dashboardData.overview.total_issues -
        dashboardData.overview.total_fixes,
      icon: AlertTriangle,
      variant: "warning",
    },
    {
      title: "Resolved Issues",
      value: dashboardData.overview.total_fixes,
      icon: CheckCircle,
      variant: "success",
    },
    {
      title: "Total Executions",
      value: dashboardData.overview.total_executions,
      icon: Activity,
      variant: "default",
    },
  ];

  const descriptions: Record<string, string> = {
    "Total Datasets":
      "Datasets currently available for profiling and validation.",
    "Active Issues": "Open issues that still need review or remediation.",
    "Resolved Issues": "Issues closed through fixes or successful reruns.",
    "Total Executions":
      "Completed validation and monitoring runs across the workspace.",
  };

  const toneClasses: Record<string, string> = {
    default: "border-border bg-muted/40 text-foreground",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
    warning:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
    destructive:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const variant = stat.variant ?? "default";
        const isNegativeContext =
          stat.title.includes("Issues") && stat.title.includes("Active");

        return (
          <Card key={stat.title} className="border-border/70 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <div className="text-3xl font-semibold tracking-tight">
                    {stat.value}
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {descriptions[stat.title]}
                  </p>
                </div>

                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                    toneClasses[variant],
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              {stat.change ? (
                <div className="mt-4 flex items-center gap-1 text-xs">
                  <span
                    className={getTrendColor(
                      stat.change.trend,
                      isNegativeContext ? "negative" : "positive",
                    )}
                  >
                    {getTrendIcon(stat.change.trend)}
                  </span>
                  <span
                    className={getTrendColor(
                      stat.change.trend,
                      isNegativeContext ? "negative" : "positive",
                    )}
                  >
                    {stat.change.value}%
                  </span>
                  <span className="text-muted-foreground">
                    {stat.change.period}
                  </span>
                </div>
              ) : (
                <div className="mt-4 h-px bg-border" />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
