"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database } from "lucide-react";
import {
  getTopProblematicDatasets,
  getDatasetBadgeClass,
} from "@/app/issues/helpers";
import type { SummaryData } from "@/app/issues/helpers";
import type { Issue } from "@/types/api";

interface IssueAnalysisProps {
  summaryData: SummaryData;
  issues: Issue[] | undefined;
}

export function IssueAnalysis({ summaryData, issues }: IssueAnalysisProps) {
  const topDatasets = getTopProblematicDatasets(issues);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Issues by Severity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge
                  variant="destructive"
                  className="w-3 h-3 p-0 rounded-full"
                />
                <span className="text-sm">Critical</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {summaryData.critical}
                </span>
                <div className="w-16 h-2 bg-muted rounded-full">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{
                      width: `${
                        summaryData.total > 0
                          ? (summaryData.critical / summaryData.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="w-3 h-3 p-0 rounded-full bg-orange-500" />
                <span className="text-sm">High</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{summaryData.high}</span>
                <div className="w-16 h-2 bg-muted rounded-full">
                  <div
                    className="h-full bg-orange-500 rounded-full"
                    style={{
                      width: `${
                        summaryData.total > 0
                          ? (summaryData.high / summaryData.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="w-3 h-3 p-0 rounded-full bg-yellow-500" />
                <span className="text-sm">Medium</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {summaryData.medium}
                </span>
                <div className="w-16 h-2 bg-muted rounded-full">
                  <div
                    className="h-full bg-yellow-500 rounded-full"
                    style={{
                      width: `${
                        summaryData.total > 0
                          ? (summaryData.medium / summaryData.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="w-3 h-3 p-0 rounded-full"
                />
                <span className="text-sm">Low</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{summaryData.low}</span>
                <div className="w-16 h-2 bg-muted rounded-full">
                  <div
                    className="h-full bg-gray-400 rounded-full"
                    style={{
                      width: `${
                        summaryData.total > 0
                          ? (summaryData.low / summaryData.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Problematic Datasets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topDatasets.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  No dataset issues to display
                </p>
              </div>
            ) : (
              topDatasets.map(([dataset, count]) => (
                <div
                  key={dataset}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span
                      className="text-sm truncate max-w-[200px]"
                      title={dataset}
                    >
                      {dataset}
                    </span>
                  </div>
                  <Badge
                    variant={count > 0 ? "destructive" : "outline"}
                    className={getDatasetBadgeClass(count)}
                  >
                    {count} issue{count !== 1 ? "s" : ""}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
