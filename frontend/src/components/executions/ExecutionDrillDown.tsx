"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Criticality, type Issue } from "@/types/api";
import { X, Search } from "lucide-react";

interface ExecutionDrillDownProps {
  column: string;
  ruleName: string;
  issues: Issue[];
  onClose: () => void;
}

const severityColors: Record<Criticality, string> = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export function ExecutionDrillDown({
  column,
  ruleName,
  issues,
  onClose,
}: ExecutionDrillDownProps) {
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const matchColumn = issue.column_name === column;
      // Match by rule name (from issue or parsed snapshot)
      let issueRuleName = issue.rule_name || "";
      if (issue.rule_snapshot) {
        try {
          const snap = JSON.parse(issue.rule_snapshot) as { name?: string };
          issueRuleName = snap.name || issueRuleName;
        } catch {
          /* skip */
        }
      }
      const matchRule = issueRuleName === ruleName;
      return matchColumn && matchRule;
    });
  }, [issues, column, ruleName]);

  return (
    <Card className="border-primary/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4" />
              Drill-Down: {column} × {ruleName}
            </CardTitle>
            <CardDescription>
              {filteredIssues.length} issue
              {filteredIssues.length !== 1 ? "s" : ""} found
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {filteredIssues.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No issues for this column+rule combination. All checks passed.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Row</TableHead>
                  <TableHead>Current Value</TableHead>
                  <TableHead>Suggested Value</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIssues.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell className="font-mono text-sm">
                      {issue.row_index + 1}
                    </TableCell>
                    <TableCell className="max-w-[150px]">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded break-all">
                        {issue.current_value || "null"}
                      </code>
                    </TableCell>
                    <TableCell className="max-w-[150px]">
                      {issue.suggested_value ? (
                        <code className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded break-all">
                          {issue.suggested_value}
                        </code>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          severityColors[issue.severity as Criticality]
                        }
                      >
                        {issue.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] text-sm truncate">
                      {issue.message || "No message"}
                    </TableCell>
                    <TableCell>
                      {issue.resolved ? (
                        <Badge
                          variant="outline"
                          className="text-green-600 text-xs"
                        >
                          Resolved
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-orange-600 text-xs"
                        >
                          Open
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
