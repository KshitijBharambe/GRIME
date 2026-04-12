"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";
import type { SummaryData } from "@/app/issues/helpers";

interface IssueSummaryCardsProps {
  summaryData: SummaryData;
}

export function IssueSummaryCards({ summaryData }: IssueSummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summaryData.total}</div>
          <p className="text-xs text-muted-foreground">
            {summaryData.unresolved} unresolved
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
          <XCircle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {summaryData.critical}
          </div>
          <p className="text-xs text-muted-foreground">
            Requires immediate attention
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {Math.round(summaryData.resolutionRate)}%
          </div>
          <p className="text-xs text-muted-foreground">
            {summaryData.resolved} of {summaryData.total} resolved
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Recent Issues</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summaryData.recentIssues}</div>
          <p className="text-xs text-muted-foreground">
            Issues in last 30 days
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
