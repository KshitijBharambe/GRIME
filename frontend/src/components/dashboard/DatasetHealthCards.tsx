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
import { useDatasets } from "@/lib/hooks/useDatasets";
import { useDashboardOverview } from "@/lib/hooks/useDashboard";
import { Database, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { Dataset } from "@/types/api";

function getStatusColor(status: string) {
  switch (status) {
    case "ready":
      return "default";
    case "processing":
      return "secondary";
    case "error":
      return "destructive";
    default:
      return "outline";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "ready":
      return <CheckCircle className="h-3 w-3 text-green-500" />;
    case "processing":
      return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
    case "error":
      return <XCircle className="h-3 w-3 text-red-500" />;
    default:
      return <Database className="h-3 w-3" />;
  }
}

function getQualityLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Excellent", color: "text-green-600" };
  if (score >= 70) return { label: "Good", color: "text-blue-600" };
  if (score >= 50) return { label: "Fair", color: "text-yellow-600" };
  return { label: "Poor", color: "text-red-600" };
}

export function DatasetHealthCards() {
  const { data: datasetsResponse, isLoading: datasetsLoading } = useDatasets(
    1,
    100,
  );
  const { data: dashboardOverview, isLoading: overviewLoading } =
    useDashboardOverview();

  const isLoading = datasetsLoading || overviewLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Dataset Health
          </CardTitle>
          <CardDescription>Quality summary per dataset</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="h-32 bg-muted animate-pulse rounded-lg"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const datasets: Dataset[] = datasetsResponse?.items || [];
  const qualityDist = dashboardOverview?.statistics?.quality_score_distribution;
  const avgDqi = dashboardOverview?.overview?.avg_dqi ?? 0;
  const avgCleanRows = dashboardOverview?.overview?.avg_clean_rows_pct ?? 0;

  if (datasets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Dataset Health
          </CardTitle>
          <CardDescription>Quality summary per dataset</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-sm text-muted-foreground">
            No datasets found. Upload a dataset to see health metrics.
          </div>
        </CardContent>
      </Card>
    );
  }

  const qualityInfo = getQualityLabel(avgDqi * 100);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Dataset Health
            </CardTitle>
            <CardDescription>
              {datasets.length} dataset{datasets.length !== 1 ? "s" : ""} — avg
              quality{" "}
              <span className={qualityInfo.color}>
                {(avgDqi * 100).toFixed(1)}% ({qualityInfo.label})
              </span>
            </CardDescription>
          </div>
          {qualityDist && (
            <div className="flex items-center gap-2 text-xs">
              <Badge
                variant="outline"
                className="text-green-600 border-green-200"
              >
                {qualityDist.excellent} excellent
              </Badge>
              <Badge
                variant="outline"
                className="text-blue-600 border-blue-200"
              >
                {qualityDist.good} good
              </Badge>
              <Badge
                variant="outline"
                className="text-yellow-600 border-yellow-200"
              >
                {qualityDist.fair} fair
              </Badge>
              <Badge variant="outline" className="text-red-600 border-red-200">
                {qualityDist.poor} poor
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {datasets.slice(0, 9).map((dataset) => (
            <div
              key={dataset.id}
              className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm truncate flex-1 mr-2">
                  {dataset.name}
                </h4>
                <Badge
                  variant={getStatusColor(dataset.status)}
                  className="flex items-center gap-1 text-xs"
                >
                  {getStatusIcon(dataset.status)}
                  {dataset.status}
                </Badge>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Rows</span>
                  <span className="font-medium text-foreground">
                    {dataset.row_count?.toLocaleString() ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Columns</span>
                  <span className="font-medium text-foreground">
                    {dataset.column_count ?? "—"}
                  </span>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Clean rows</span>
                    <span className="font-medium text-foreground">
                      {(avgCleanRows * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Progress value={avgCleanRows * 100} className="h-1.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
        {datasets.length > 9 && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            Showing 9 of {datasets.length} datasets
          </p>
        )}
      </CardContent>
    </Card>
  );
}
