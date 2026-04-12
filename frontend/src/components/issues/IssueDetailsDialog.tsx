"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Database,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils/date";
import { getSeverityColor } from "@/app/issues/helpers";
import type { DetailedIssue, Issue } from "@/types/api";

interface IssueDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detailedIssue: DetailedIssue | undefined;
  detailedIssueLoading: boolean;
  detailedIssueError: Error | null;
  filteredIssues: Issue[];
  isFixing: string | null;
  isUnresolving: string | null;
  onOpenFixDialog: (issue: Issue) => void;
  onUnresolveIssue: (issue: Issue) => void;
}

function getSeverityIcon(severity: string) {
  switch (severity?.toLowerCase()) {
    case "critical":
      return <XCircle className="h-3 w-3" />;
    case "high":
      return <AlertTriangle className="h-3 w-3" />;
    case "medium":
      return <Clock className="h-3 w-3" />;
    case "low":
      return <CheckCircle className="h-3 w-3" />;
    default:
      return <AlertTriangle className="h-3 w-3" />;
  }
}

export function IssueDetailsDialog({
  open,
  onOpenChange,
  detailedIssue,
  detailedIssueLoading,
  detailedIssueError,
  filteredIssues,
  isFixing,
  isUnresolving,
  onOpenFixDialog,
  onUnresolveIssue,
}: IssueDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge
              variant={getSeverityColor(
                (detailedIssue as DetailedIssue)?.severity || "",
              )}
              className="flex items-center gap-1"
            >
              {getSeverityIcon(
                (detailedIssue as DetailedIssue)?.severity || "",
              )}
              {(detailedIssue as DetailedIssue)?.severity}
            </Badge>
            Issue Details
          </DialogTitle>
          <DialogDescription>
            Detailed information about the data quality issue
          </DialogDescription>
        </DialogHeader>

        {detailedIssueLoading ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-2">
              <Clock className="h-4 w-4 animate-spin" />
              Loading issue details...
            </div>
          </div>
        ) : detailedIssueError ? (
          <div className="text-center py-8">
            <div className="text-red-600">
              Failed to load issue details. Please try again.
            </div>
          </div>
        ) : detailedIssue ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Rule
                </div>
                {detailedIssue.rule ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {detailedIssue.rule.name}
                    </p>
                    {detailedIssue.rule.description && (
                      <p className="text-xs text-muted-foreground">
                        {detailedIssue.rule.description}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs">
                        {detailedIssue.rule.kind.replace("_", " ")}
                      </Badge>
                      <Badge
                        variant={(() => {
                          const criticality = detailedIssue.rule!.criticality;
                          if (criticality === "critical") return "destructive";
                          if (criticality === "high") return "default";
                          if (criticality === "medium") return "secondary";
                          return "outline";
                        })()}
                        className="text-xs"
                      >
                        {detailedIssue.rule.criticality}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No rule information available
                  </p>
                )}
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Dataset
                </div>
                {detailedIssue.dataset ? (
                  <p className="text-sm flex items-center gap-1">
                    <Database className="h-3 w-3" />
                    {detailedIssue.dataset.name}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No dataset information available
                  </p>
                )}
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Column
                </div>
                <p className="text-sm">{detailedIssue.column_name}</p>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Row Index
                </div>
                <p className="text-sm">{detailedIssue.row_index}</p>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Status
                </div>
                <Badge
                  variant={detailedIssue.resolved ? "outline" : "destructive"}
                  className="w-fit"
                >
                  {detailedIssue.resolved ? (
                    <>
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Resolved
                    </>
                  ) : (
                    <>
                      <Clock className="mr-1 h-3 w-3" />
                      Open
                    </>
                  )}
                </Badge>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Created
                </div>
                <p className="text-sm">
                  {formatDateTime(detailedIssue.created_at)}
                </p>
              </div>
            </div>

            {detailedIssue.message && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Message
                </div>
                <p className="text-sm bg-muted p-3 rounded-md">
                  {detailedIssue.message}
                </p>
              </div>
            )}

            {detailedIssue.current_value && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Current Value
                </div>
                <code className="block text-sm bg-muted p-3 rounded-md">
                  {detailedIssue.current_value || "null"}
                </code>
              </div>
            )}

            {detailedIssue.suggested_value && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Suggested Value
                </div>
                <code className="block text-sm bg-green-50 text-green-700 p-3 rounded-md">
                  {detailedIssue.suggested_value}
                </code>
              </div>
            )}

            {detailedIssue.fixes && detailedIssue.fixes.length > 0 && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Applied Fixes
                </div>
                <div className="space-y-2 mt-2">
                  {detailedIssue.fixes.map((fix) => (
                    <div
                      key={fix.id}
                      className="bg-muted p-3 rounded-md text-sm"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium">Fix applied</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(fix.fixed_at)}
                        </span>
                      </div>
                      {fix.new_value && (
                        <div className="mb-1">
                          <span className="text-muted-foreground">
                            New value:{" "}
                          </span>
                          <code className="bg-green-50 text-green-700 px-1 py-0.5 rounded">
                            {fix.new_value}
                          </code>
                        </div>
                      )}
                      {fix.comment && (
                        <div className="mb-1">
                          <span className="text-muted-foreground">
                            Comment:{" "}
                          </span>
                          <span>{fix.comment}</span>
                        </div>
                      )}
                      {fix.fixer && (
                        <div>
                          <span className="text-muted-foreground">
                            Fixed by:{" "}
                          </span>
                          <span>{fix.fixer.name}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t">
              {!detailedIssue.resolved ? (
                <Button
                  onClick={() => {
                    const issue = filteredIssues?.find(
                      (i) => i.id === detailedIssue.id,
                    );
                    if (issue) {
                      onOpenFixDialog(issue);
                      onOpenChange(false);
                    }
                  }}
                  disabled={isFixing === detailedIssue.id}
                  className="flex-1"
                >
                  {isFixing === detailedIssue.id
                    ? "Applying Fix..."
                    : detailedIssue.suggested_value
                      ? "Apply Suggested Fix"
                      : "Mark as Resolved"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    const issue = filteredIssues?.find(
                      (i) => i.id === detailedIssue.id,
                    );
                    if (issue) onUnresolveIssue(issue);
                  }}
                  disabled={isUnresolving === detailedIssue.id}
                  className="flex-1"
                >
                  {isUnresolving === detailedIssue.id
                    ? "Unresolving..."
                    : "Unresolve Issue"}
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
