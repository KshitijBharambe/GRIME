"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useDashboardOverview } from "@/lib/hooks/useDashboard";
import { useIssuesSummary } from "@/lib/hooks/useIssues";
import type { IssuesSummary } from "@/types/api";
import {
  getQualityStatus,
  getQualityTier,
  getScoreVariant,
} from "@/lib/thresholds";
import { SEVERITY_TEXT_COLORS, SEVERITY_CHART_COLORS } from "@/lib/ui-tokens";
import { LoadingState, EmptyState } from "@/components/ui/state-views";

export function QualityOverview() {
  const { data: dashboardData, isLoading } = useDashboardOverview();
  const { data: issuesSummary, isLoading: issuesLoading } =
    useIssuesSummary() as {
      data: IssuesSummary | undefined;
      isLoading: boolean;
    };

  if (isLoading || issuesLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <LoadingState rows={3} message="Loading quality metrics..." />
        <LoadingState rows={2} message="Loading issue distribution..." />
      </div>
    );
  }

  if (!dashboardData && !issuesSummary) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <EmptyState
          title="No quality data available"
          description="Upload datasets and run quality checks to see metrics here."
        />
        <EmptyState
          title="No issue data available"
          description="Issue distribution will appear after running quality checks."
        />
      </div>
    );
  }

  // Use dashboard data if available, fallback to issues summary
  const avgDQI = dashboardData?.overview.avg_dqi || 0;
  const avgCleanRowsPct = dashboardData?.overview.avg_clean_rows_pct || 0;
  const avgHybrid = dashboardData?.overview.avg_hybrid || 0;
  const qualityDistribution =
    dashboardData?.statistics.quality_score_distribution;

  // Calculate active issues count
  const activeIssuesCount =
    issuesSummary?.summary.unresolved_issues ||
    (dashboardData
      ? dashboardData.overview.total_issues - dashboardData.overview.total_fixes
      : 0);

  const qualityMetrics = [
    {
      name: "DQI",
      score: Math.round(avgDQI),
      description: "Weighted constraint satisfaction",
    },
    {
      name: "Clean rows",
      score: Math.round(avgCleanRowsPct),
      description: "Rows without any issues",
    },
    {
      name: "Hybrid Score",
      score: Math.round(avgHybrid),
      status: getQualityStatus(avgHybrid),
      issues: activeIssuesCount,
      description: "Harmonic mean of DQI and Clean Rows",
    },
  ];

  // Create issue distribution from severity data if available
  let issueDistribution: Array<{ name: string; value: number; color: string }> =
    [];

  if (issuesSummary?.severity_distribution) {
    const severityData = issuesSummary.severity_distribution;
    const totalIssues =
      severityData.critical +
      severityData.high +
      severityData.medium +
      severityData.low;

    if (totalIssues > 0) {
      issueDistribution = [
        {
          name: "Critical Issues",
          value: Math.round((severityData.critical / totalIssues) * 100),
          color: SEVERITY_CHART_COLORS.critical,
        },
        {
          name: "High Priority",
          value: Math.round((severityData.high / totalIssues) * 100),
          color: SEVERITY_CHART_COLORS.high,
        },
        {
          name: "Medium Priority",
          value: Math.round((severityData.medium / totalIssues) * 100),
          color: SEVERITY_CHART_COLORS.medium,
        },
        {
          name: "Low Priority",
          value: Math.round((severityData.low / totalIssues) * 100),
          color: SEVERITY_CHART_COLORS.low,
        },
      ].filter((item) => item.value > 0);
    }
  } else if (qualityDistribution) {
    // Fallback to quality score distribution
    const { excellent, good, fair, poor } = qualityDistribution;
    const totalDatasets = excellent + good + fair + poor;

    if (totalDatasets > 0) {
      issueDistribution = [
        {
          name: "Excellent Quality",
          value: Math.round((excellent / totalDatasets) * 100),
          color: "#22c55e",
        },
        {
          name: "Good Quality",
          value: Math.round((good / totalDatasets) * 100),
          color: "#3b82f6",
        },
        {
          name: "Fair Quality",
          value: Math.round((fair / totalDatasets) * 100),
          color: "#eab308",
        },
        {
          name: "Poor Quality",
          value: Math.round((poor / totalDatasets) * 100),
          color: "#ef4444",
        },
      ].filter((item) => item.value > 0);
    }
  }

  const overallTier = getQualityTier(avgHybrid);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="h-full border-border/70 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle>Quality score</CardTitle>
          <CardDescription>
            Average health across datasets and recent validation runs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Overall hybrid score
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <span className="text-4xl font-semibold tracking-tight">
                  {Math.round(avgHybrid)}%
                </span>
                <Badge variant={getScoreVariant(avgHybrid)}>
                  {overallTier.label}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {activeIssuesCount} active issue
                {activeIssuesCount === 1 ? "" : "s"} currently open across
                monitored datasets.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Datasets
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                  {dashboardData?.overview.total_datasets ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Executions
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                  {dashboardData?.overview.total_executions ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Clean rows
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                  {Math.round(avgCleanRowsPct)}%
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {qualityMetrics.map((metric) => (
              <div key={metric.name} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium">{metric.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {metric.description}
                    </span>
                  </div>
                  <span className="font-medium">{metric.score}%</span>
                </div>
                <Progress value={metric.score} className="h-2" />
              </div>
            ))}
          </div>

          <div className="space-y-3 border-t pt-4">
            {issuesSummary?.severity_distribution ? (
              <>
                <div className="text-sm font-medium">Issues by severity</div>
                <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2">
                    <span>Critical</span>
                    <span
                      className={`font-medium ${SEVERITY_TEXT_COLORS.critical}`}
                    >
                      {issuesSummary.severity_distribution.critical}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2">
                    <span>High</span>
                    <span
                      className={`font-medium ${SEVERITY_TEXT_COLORS.high}`}
                    >
                      {issuesSummary.severity_distribution.high}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2">
                    <span>Medium</span>
                    <span
                      className={`font-medium ${SEVERITY_TEXT_COLORS.medium}`}
                    >
                      {issuesSummary.severity_distribution.medium}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2">
                    <span>Low</span>
                    <span className={`font-medium ${SEVERITY_TEXT_COLORS.low}`}>
                      {issuesSummary.severity_distribution.low}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              qualityDistribution && (
                <>
                  <div className="text-sm font-medium">
                    Dataset quality distribution
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2">
                      <span>Excellent (90%+)</span>
                      <span className="font-medium">
                        {qualityDistribution.excellent}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2">
                      <span>Good (75-89%)</span>
                      <span className="font-medium">
                        {qualityDistribution.good}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2">
                      <span>Fair (50-74%)</span>
                      <span className="font-medium">
                        {qualityDistribution.fair}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2">
                      <span>Poor (&lt;50%)</span>
                      <span className="font-medium">
                        {qualityDistribution.poor}
                      </span>
                    </div>
                  </div>
                </>
              )
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="h-full border-border/70 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle>
            {issuesSummary?.severity_distribution
              ? "Issue distribution"
              : "Quality distribution"}
          </CardTitle>
          <CardDescription>
            {issuesSummary?.severity_distribution
              ? "Share of issues by severity level."
              : "Share of datasets by quality score band."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-[280px] flex-col justify-center gap-5">
          {issueDistribution.length > 0 ? (
            <>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={issueDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {issueDistribution.map((entry) => (
                        <Cell key={`cell-${entry.name}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {issueDistribution.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-3 rounded-lg border border-border/70 bg-background px-3 py-2"
                  >
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm">{item.name}</span>
                    <span className="ml-auto text-sm font-medium text-muted-foreground">
                      {item.value}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="No data available"
              description="No datasets available for quality analysis."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
