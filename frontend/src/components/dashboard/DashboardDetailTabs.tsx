"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QualityTrendsChart } from "./QualityTrendsChart";
import { ExecutionTimelineChart } from "./ExecutionTimelineChart";
import { TopIssuesTable } from "./TopIssuesTable";
import { DatasetHealthCards } from "./DatasetHealthCards";
import { RecentActivity } from "./recent-activity";
import { TrendingUp, Bug, Activity } from "lucide-react";

export function DashboardDetailTabs() {
  return (
    <Tabs defaultValue="trends" className="w-full">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="gap-4 border-b border-border/70 pb-4">
          <div className="space-y-1">
            <CardTitle>Operational details</CardTitle>
            <CardDescription>
              Review trend lines, issue hotspots, and recent platform activity.
            </CardDescription>
          </div>

          <TabsList className="grid h-auto w-full grid-cols-3 rounded-lg bg-muted p-1 sm:max-w-md">
            <TabsTrigger
              value="trends"
              className="gap-1.5 rounded-md px-3 py-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm sm:text-sm"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Trends
            </TabsTrigger>
            <TabsTrigger
              value="issues"
              className="gap-1.5 rounded-md px-3 py-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm sm:text-sm"
            >
              <Bug className="h-3.5 w-3.5" />
              Issues &amp; Health
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="gap-1.5 rounded-md px-3 py-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm sm:text-sm"
            >
              <Activity className="h-3.5 w-3.5" />
              Activity
            </TabsTrigger>
          </TabsList>
        </CardHeader>

        <CardContent className="p-0">
          <TabsContent value="trends" className="m-0 p-5">
            <div className="grid gap-6 md:grid-cols-2">
              <QualityTrendsChart />
              <ExecutionTimelineChart />
            </div>
          </TabsContent>

          <TabsContent value="issues" className="m-0 space-y-6 p-5">
            <TopIssuesTable />
            <DatasetHealthCards />
          </TabsContent>

          <TabsContent value="activity" className="m-0 p-5">
            <RecentActivity />
          </TabsContent>
        </CardContent>
      </Card>
    </Tabs>
  );
}
