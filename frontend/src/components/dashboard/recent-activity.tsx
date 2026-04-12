"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload, Play, Clock, Database } from "lucide-react";
import { useDashboardOverview } from "@/lib/hooks/useDashboard";
import { formatRelativeTime } from "@/lib/utils/date";

interface ActivityItem {
  id: string;
  type: "upload" | "execution" | "dataset";
  title: string;
  description: string;
  timestamp: Date;
  status?: "success" | "warning" | "error" | "info";
  user?: string;
}

function getActivityIcon(type: ActivityItem["type"]) {
  switch (type) {
    case "upload":
      return <Upload className="h-4 w-4" />;
    case "execution":
      return <Play className="h-4 w-4" />;
    case "dataset":
      return <Database className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

function getStatusVariant(
  status?: ActivityItem["status"],
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "success":
      return "default";
    case "warning":
      return "secondary";
    case "error":
      return "destructive";
    default:
      return "outline";
  }
}

export function RecentActivity() {
  const { data: dashboardData, isLoading } = useDashboardOverview();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest events and changes in your data pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, index) => (
              <div
                key={`skeleton-activity-${index}`}
                className="flex items-start space-x-3 p-3 rounded-lg border"
              >
                <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-full bg-muted animate-pulse rounded" />
                  <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!dashboardData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest events and changes in your data pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No recent activity data available
          </p>
        </CardContent>
      </Card>
    );
  }

  // Transform API data into activities
  const activities: ActivityItem[] = [
    ...dashboardData.recent_activity.recent_datasets.map((dataset) => ({
      id: `dataset-${dataset.id}`,
      type: "dataset" as const,
      title: "Dataset uploaded",
      description: `${dataset.name} (${dataset.status})`,
      timestamp: new Date(dataset.uploaded_at),
      status:
        dataset.status === "validated"
          ? ("success" as const)
          : ("info" as const),
    })),
    ...dashboardData.recent_activity.recent_executions.map((execution) => ({
      id: `execution-${execution.id}`,
      type: "execution" as const,
      title: "Quality check completed",
      description: `Found ${execution.issues_found} issues (${execution.status})`,
      timestamp: new Date(execution.created_at),
      status:
        execution.status === "succeeded"
          ? ("success" as const)
          : execution.status === "failed"
            ? ("error" as const)
            : ("warning" as const),
    })),
  ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 5);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest events and changes in your data pipeline
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start space-x-3 p-3 rounded-lg border"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      {getActivityIcon(activity.type)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">
                        {activity.title}
                      </p>
                      {activity.status && (
                        <Badge
                          variant={getStatusVariant(activity.status)}
                          className="ml-2"
                        >
                          {activity.status}
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground mt-1">
                      {activity.description}
                    </p>

                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      {activity.user && <span>{activity.user}</span>}
                      <span>{formatRelativeTime(activity.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
