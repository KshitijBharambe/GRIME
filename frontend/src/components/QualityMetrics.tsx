"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { QualityMetrics } from "@/types/api";
import { AlertTriangle, CheckCircle, TrendingUp, Info, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/date";
import { getScoreColor, getScoreBgColor, getScoreBadgeVariant, getScoreLabel } from "@/lib/thresholds";

interface QualityMetricsCardProps {
  readonly metrics: QualityMetrics | undefined;
  readonly isLoading?: boolean;
  readonly className?: string;
  readonly compact?: boolean;
}

interface ScoreCardProps {
  readonly label: string;
  readonly value: number;
  readonly description: string;
  readonly icon: React.ReactNode;
  readonly compact?: boolean;
}


function ScoreCard({ label, value, description, icon, compact = false }: ScoreCardProps) {
  const scoreColor = getScoreColor(value);
  const scoreBgColor = getScoreBgColor(value);

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg", scoreBgColor)}>
              {icon}
            </div>
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          <Badge variant={getScoreBadgeVariant(value)} className="text-lg px-3 py-1">
            {value.toFixed(1)}%
          </Badge>
        </div>
        <Progress value={value} className="h-2" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg", scoreBgColor)}>
            {icon}
          </div>
          <div className="space-y-1">
            <p className="font-semibold">{label}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className={cn("text-3xl font-bold", scoreColor)}>
          {value.toFixed(1)}%
        </div>
      </div>
      <Progress value={value} className="h-2.5" />
    </div>
  );
}

export function QualityMetricsCard({
  metrics,
  isLoading = false,
  className,
  compact = false
}: QualityMetricsCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Data Quality Metrics
          </CardTitle>
          <CardDescription>
            Quantitative assessment of data quality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {[...Array(3)].map((_, index) => (
            <div key={`skeleton-quality-metric-${index}`} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              </div>
              <div className="h-2 w-full bg-muted animate-pulse rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Data Quality Metrics
          </CardTitle>
          <CardDescription>
            Quantitative assessment of data quality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Info className="h-6 w-6 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No quality metrics available
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (metrics.status === "not_available") {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Data Quality Metrics
          </CardTitle>
          <CardDescription>
            Quantitative assessment of data quality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center border border-yellow-200 bg-yellow-50 rounded-lg">
            <AlertTriangle className="h-6 w-6 text-yellow-600 mb-4" />
            <p className="font-semibold text-yellow-800 mb-2">Metrics Not Available</p>
            <p className="text-sm text-yellow-700">
              {metrics.message || "Quality metrics could not be computed for this execution."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const avgScore = (metrics.dqi + metrics.clean_rows_pct + metrics.hybrid) / 3;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              Data Quality Metrics
            </CardTitle>
            <CardDescription>
              Quantitative assessment of data quality
            </CardDescription>
          </div>
          <Badge variant={getScoreBadgeVariant(avgScore)} className="text-lg px-3 py-1.5">
            Avg: {avgScore.toFixed(1)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* DQI Score */}
        <ScoreCard
          label="Data Quality Index (DQI)"
          value={metrics.dqi}
          description="Measures constraint satisfaction across all rules"
          icon={<CheckCircle className="h-5 w-5 text-green-700" />}
          compact={compact}
        />

        {/* Clean Rows Percentage */}
        <ScoreCard
          label="Clean Rows Percentage"
          value={metrics.clean_rows_pct}
          description="Portion of rows without any data quality issues"
          icon={<TrendingUp className="h-5 w-5 text-blue-700" />}
          compact={compact}
        />

        {/* Hybrid Score */}
        <ScoreCard
          label="Overall Quality Score (Hybrid)"
          value={metrics.hybrid}
          description="Harmonic mean of DQI and Clean Rows metrics"
          icon={<Gauge className="h-5 w-5 text-purple-700" />}
          compact={compact}
        />

        {/* Computed timestamp */}
        <div className="pt-4 border-t text-xs text-muted-foreground flex items-center justify-between">
          <span>Computed: {formatDate(metrics.computed_at, "MMM d, yyyy HH:mm:ss", "Unknown")}</span>
          <Badge variant="outline" className="text-xs">
            {metrics.status === "ok" ? "Available" : "N/A"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function QualityMetricsCompact({
  metrics,
  isLoading = false,
  className
}: Omit<QualityMetricsCardProps, "compact">) {
  if (isLoading) {
    return (
      <div className={cn("grid gap-4 md:grid-cols-3", className)}>
        {[...Array(3)].map((_, index) => (
          <Card key={`skeleton-compact-${index}`}>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics || metrics.status === "not_available") {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Info className="h-4 w-4" />
            <span className="text-sm">Quality metrics not available</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const metricCards = [
    {
      label: "DQI",
      value: metrics.dqi,
      icon: <CheckCircle className="h-4 w-4" />,
      description: "Data Quality Index",
    },
    {
      label: "Clean Rows",
      value: metrics.clean_rows_pct,
      icon: <TrendingUp className="h-4 w-4" />,
      description: "Clean Rows %",
    },
    {
      label: "Hybrid",
      value: metrics.hybrid,
      icon: <Gauge className="h-4 w-4" />,
      description: "Overall Score",
    },
  ];

  return (
    <div className={cn("grid gap-4 md:grid-cols-3", className)}>
      {metricCards.map((metric) => (
        <Card key={metric.description}>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("p-1.5 rounded-lg", getScoreBgColor(metric.value))}>
                    {metric.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{metric.label}</p>
                    <p className="text-xs text-muted-foreground">{metric.description}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className={cn("text-3xl font-bold", getScoreColor(metric.value))}>
                  {metric.value.toFixed(1)}%
                </span>
                <Badge variant={getScoreBadgeVariant(metric.value)} className="text-xs">
                  {getScoreLabel(metric.value)}
                </Badge>
              </div>
              <Progress value={metric.value} className="h-1.5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
