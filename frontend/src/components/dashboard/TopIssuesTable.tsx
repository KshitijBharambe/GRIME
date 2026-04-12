"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIssuesSummary } from "@/lib/hooks/useIssues";
import type { IssuesSummary } from "@/types/api";
import { Bug, CheckCircle } from "lucide-react";
import { LoadingState, EmptyState } from "@/components/ui/state-views";

export function TopIssuesTable() {
  const { data: issuesSummary, isLoading } = useIssuesSummary(30) as {
    data: IssuesSummary | undefined;
    isLoading: boolean;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Top Problematic Rules
          </CardTitle>
          <CardDescription>Rules generating the most issues</CardDescription>
        </CardHeader>
        <CardContent>
          <LoadingState rows={5} className="space-y-3" />
        </CardContent>
      </Card>
    );
  }

  const topRules = issuesSummary?.top_problematic_rules || [];

  if (topRules.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Top Problematic Rules
          </CardTitle>
          <CardDescription>Rules generating the most issues</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={CheckCircle}
            title="No problematic rules"
            description="No problematic rules found. Your data quality looks great!"
          />
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...topRules.map((r) => r.issue_count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          Top Problematic Rules
        </CardTitle>
        <CardDescription>
          Rules generating the most issues (last 30 days)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead className="text-right">Issues</TableHead>
              <TableHead className="w-[120px]">Distribution</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topRules.slice(0, 10).map((rule, index) => (
              <TableRow key={`${rule.rule_name}-${index}`}>
                <TableCell>
                  <span className="font-medium text-sm">{rule.rule_name}</span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {rule.rule_kind}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-bold">{rule.issue_count}</span>
                </TableCell>
                <TableCell>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all"
                      style={{
                        width: `${(rule.issue_count / maxCount) * 100}%`,
                      }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
