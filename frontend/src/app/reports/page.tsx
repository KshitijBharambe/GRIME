"use client";

import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Download,
  FileText,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Activity,
  Calendar,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useDashboardOverview } from "@/lib/hooks/useDashboard";
import { useIssuesSummary } from "@/lib/hooks/useIssues";
import { useExecutions } from "@/lib/hooks/useExecutions";
import type { DashboardOverview } from "@/types/api";

function StatCardSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-7 w-16 bg-muted rounded" />
      <div className="h-3 w-24 bg-muted rounded" />
    </div>
  );
}

function pluralize(n: number, word: string): string {
  return n === 1 ? `${n} ${word}` : `${n} ${word}s`;
}

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${pluralize(diffMins, "minute")} ago`;
  if (diffHours < 24) return `${pluralize(diffHours, "hour")} ago`;
  if (diffDays < 7) return `${pluralize(diffDays, "day")} ago`;
  return date.toLocaleDateString();
}

function RecentExecutionsList({
  executions,
  isLoading,
}: Readonly<{
  executions: DashboardOverview["recent_activity"]["recent_executions"];
  isLoading: boolean;
}>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No recent executions found. Run a quality check to see results here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {executions.map((execution) => (
        <Link
          key={execution.id}
          href={`/executions/${execution.id}`}
          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">
                Execution {execution.id.slice(0, 8)}…
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatTimeAgo(execution.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                execution.status === "succeeded" ? "default" : "secondary"
              }
            >
              {execution.status}
            </Badge>
            {execution.issues_found == null ? null : (
              <Badge variant="outline">
                {pluralize(execution.issues_found, "issue")}
              </Badge>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

function QualityScoreValue({
  score,
  cleanRowsPct,
}: Readonly<{ score: number | undefined; cleanRowsPct: number | undefined }>) {
  return (
    <>
      <div className="text-2xl font-bold">
        {score == null ? "\u2014" : `${(score * 100).toFixed(1)}%`}
      </div>
      <p className="text-xs text-muted-foreground">
        {cleanRowsPct == null
          ? "Across all datasets"
          : `${(cleanRowsPct * 100).toFixed(0)}% clean rows`}
      </p>
    </>
  );
}

export default function ReportsPage() {
  const {
    data: dashboard,
    isLoading: dashboardLoading,
    error: dashboardError,
  } = useDashboardOverview();

  const {
    data: issuesSummary,
    isLoading: issuesLoading,
    error: issuesError,
  } = useIssuesSummary(30);

  const { error: executionsError } = useExecutions(1, 5);

  const hasError = dashboardError || issuesError || executionsError;

  const qualityScore =
    dashboard?.overview?.avg_hybrid ?? dashboard?.overview?.avg_dqi;
  const totalIssues =
    issuesSummary?.summary?.total_issues ?? dashboard?.overview?.total_issues;
  const resolvedIssues = issuesSummary?.summary?.resolved_issues ?? 0;
  const resolutionRate =
    issuesSummary?.summary?.resolution_rate ??
    (dashboard?.overview?.issues_fixed_rate
      ? dashboard.overview.issues_fixed_rate * 100
      : undefined);
  const totalExecutions = dashboard?.overview?.total_executions;
  const recentExecutions = dashboard?.recent_activity?.recent_executions ?? [];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Generate and view data quality reports and analytics
          </p>
        </div>

        {hasError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              Some data failed to load. Showing available information.
            </span>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Quality Score
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {dashboardLoading ? (
                <StatCardSkeleton />
              ) : (
                <QualityScoreValue
                  score={qualityScore}
                  cleanRowsPct={dashboard?.overview?.avg_clean_rows_pct}
                />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Issues Found
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {issuesLoading && dashboardLoading ? (
                <StatCardSkeleton />
              ) : (
                <>
                  <div className="text-2xl font-bold">{totalIssues ?? "—"}</div>
                  <p className="text-xs text-muted-foreground">
                    {issuesSummary?.summary?.recent_issues == null
                      ? "Total across all datasets"
                      : `${issuesSummary.summary.recent_issues} in the last 30 days`}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Issues Resolved
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {issuesLoading ? (
                <StatCardSkeleton />
              ) : (
                <>
                  <div className="text-2xl font-bold">{resolvedIssues}</div>
                  <p className="text-xs text-muted-foreground">
                    {resolutionRate == null
                      ? "No resolution data"
                      : `${resolutionRate.toFixed(1)}% resolution rate`}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Executions
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {dashboardLoading ? (
                <StatCardSkeleton />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {totalExecutions ?? "—"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dashboard?.overview?.total_datasets == null
                      ? "All time"
                      : `Across ${pluralize(dashboard.overview.total_datasets, "dataset")}`}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Report Types */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Quality Reports
              </CardTitle>
              <CardDescription>
                Comprehensive data quality analysis and metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Generate detailed reports showing data quality scores, issue
                  patterns, and improvement recommendations.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Quality Scores</Badge>
                  <Badge variant="secondary">Issue Analysis</Badge>
                  <Badge variant="secondary">Trends</Badge>
                  <Badge variant="secondary">Recommendations</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild>
                  <Link href="/reports/quality">View Reports</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/reports/quality/new">Generate New</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Data
              </CardTitle>
              <CardDescription>
                Export cleaned datasets and analysis results
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Export your processed datasets in various formats with
                  optional metadata and issue reports.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">CSV</Badge>
                  <Badge variant="secondary">Excel</Badge>
                  <Badge variant="secondary">JSON</Badge>
                  <Badge variant="secondary">Metadata</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild>
                  <Link href="/reports/export">Export Data</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/reports/export/history">Export History</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Executions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recent Executions
            </CardTitle>
            <CardDescription>
              Your latest rule executions and their results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecentExecutionsList
              executions={recentExecutions}
              isLoading={dashboardLoading}
            />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
