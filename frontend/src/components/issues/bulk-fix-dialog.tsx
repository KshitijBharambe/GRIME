"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRight, AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { Issue } from "@/types/api";

interface BulkFixDialogProps {
  readonly issues: readonly Issue[];
  readonly open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (fixData: {
    new_value?: string;
    comment?: string;
  }) => Promise<void>;
  readonly isSubmitting?: boolean;
}

export function BulkFixDialog({
  issues,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
}: BulkFixDialogProps) {
  const [newValue, setNewValue] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  // Analyze the selected issues for validation
  const issueAnalysis = useMemo(() => {
    const ruleIds = new Set<string>();
    const ruleNames = new Set<string>();
    const columnNames = new Set<string>();
    const datasetNames = new Set<string>();
    const severities = new Set<string>();

    for (const issue of issues) {
      ruleIds.add(issue.rule_id);
      if (issue.rule_name) ruleNames.add(issue.rule_name);
      columnNames.add(issue.column_name);
      if (issue.dataset_name) datasetNames.add(issue.dataset_name);
      severities.add(issue.severity);
    }

    return {
      ruleIds,
      ruleNames,
      columnNames,
      datasetNames,
      severities,
      hasMultipleRules: ruleIds.size > 1,
      hasMultipleColumns: columnNames.size > 1,
      hasMultipleDatasets: datasetNames.size > 1,
      isSameRuleAndColumn: ruleIds.size === 1 && columnNames.size === 1,
    };
  }, [issues]);

  // Determine warning level and message
  const warningInfo = useMemo(() => {
    if (issueAnalysis.isSameRuleAndColumn) {
      return {
        level: "safe" as const,
        message: `All ${issues.length} issues are from the same rule (${Array.from(issueAnalysis.ruleNames)[0]}) and column (${Array.from(issueAnalysis.columnNames)[0]}). Safe to apply the same fix value.`,
      };
    }

    const warnings: string[] = [];

    if (issueAnalysis.hasMultipleRules) {
      warnings.push(`${issueAnalysis.ruleNames.size} different rules`);
    }

    if (issueAnalysis.hasMultipleColumns) {
      warnings.push(`${issueAnalysis.columnNames.size} different columns`);
    }

    if (issueAnalysis.hasMultipleDatasets) {
      warnings.push(`${issueAnalysis.datasetNames.size} different datasets`);
    }

    if (warnings.length > 0) {
      return {
        level: "warning" as const,
        message: `You're fixing issues across ${warnings.join(", ")}. Applying the same value to all may not be appropriate. Consider using 'null' or review each issue individually.`,
      };
    }

    return {
      level: "info" as const,
      message: `Fixing ${issues.length} issues from the same rule but different columns or rows.`,
    };
  }, [issueAnalysis, issues.length]);

  // Reset state when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setNewValue("");
      setComment("");
      setError("");
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async () => {
    // Validation
    if (!newValue.trim() && !comment.trim()) {
      setError("Please provide either a new value or a comment");
      return;
    }

    setError("");

    try {
      await onSubmit({
        new_value: newValue.trim() || undefined,
        comment: comment.trim() || undefined,
      });
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply bulk fix");
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case "critical":
        return "destructive";
      case "high":
        return "default";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Fix Selected Issues
            <Badge variant="outline" className="ml-auto">
              {issues.length} {issues.length === 1 ? "issue" : "issues"}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Apply the same fix to all selected issues
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning Banner */}
          {warningInfo.level === "warning" && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 text-yellow-900 rounded-md text-sm">
              <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold mb-1">
                  Warning: Mixed Selection
                </div>
                <p>{warningInfo.message}</p>
              </div>
            </div>
          )}

          {warningInfo.level === "safe" && (
            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 text-green-900 rounded-md text-sm">
              <Info className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div>
                <p>{warningInfo.message}</p>
              </div>
            </div>
          )}

          {/* Issue Analysis Summary */}
          <div className="bg-muted p-4 rounded-md space-y-2 text-sm">
            <div className="font-semibold mb-2">Selection Summary:</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Rules:</span>
                <span className="font-medium">
                  {issueAnalysis.ruleNames.size === 1
                    ? Array.from(issueAnalysis.ruleNames)[0]
                    : `${issueAnalysis.ruleNames.size} different rules`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Columns:</span>
                <span className="font-medium">
                  {issueAnalysis.columnNames.size === 1
                    ? Array.from(issueAnalysis.columnNames)[0]
                    : `${issueAnalysis.columnNames.size} different columns`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Datasets:</span>
                <span className="font-medium">
                  {issueAnalysis.datasetNames.size === 1
                    ? Array.from(issueAnalysis.datasetNames)[0]
                    : `${issueAnalysis.datasetNames.size} different datasets`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Issues:</span>
                <span className="font-medium">{issues.length}</span>
              </div>
            </div>
          </div>

          {/* New Value Input */}
          <div className="space-y-2">
            <Label htmlFor="bulk-new-value">
              New Value
              <span className="text-xs text-muted-foreground ml-2">
                (will be applied to all selected issues)
              </span>
            </Label>
            <Input
              id="bulk-new-value"
              placeholder="Enter the value to apply (e.g., 'null', '0', 'N/A')..."
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Common values: null, 0, N/A, Unknown, or leave empty to just mark
              as resolved
            </p>
          </div>

          {/* Comment Input */}
          <div className="space-y-2">
            <Label htmlFor="bulk-comment">Comment (Optional)</Label>
            <Textarea
              id="bulk-comment"
              placeholder="Add notes about this bulk fix..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Preview of Selected Issues */}
          <div className="space-y-2">
            <Label>Selected Issues Preview (first 10):</Label>
            <ScrollArea className="h-[200px] border rounded-md p-2">
              <div className="space-y-2">
                {issues.slice(0, 10).map((issue) => (
                  <div
                    key={issue.id}
                    className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm"
                  >
                    <Badge
                      variant={getSeverityColor(issue.severity)}
                      className="text-xs"
                    >
                      {issue.severity}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {issue.rule_name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {issue.dataset_name} • Row {issue.row_index} •{" "}
                        {issue.column_name}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <code className="bg-background px-1 py-0.5 rounded">
                        {issue.current_value || "null"}
                      </code>
                      <ArrowRight className="h-3 w-3" />
                      <code className="bg-green-50 text-green-700 px-1 py-0.5 rounded">
                        {newValue || "(empty)"}
                      </code>
                    </div>
                  </div>
                ))}
                {issues.length > 10 && (
                  <div className="text-center text-xs text-muted-foreground py-2">
                    ... and {issues.length - 10} more issues
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 text-red-800 rounded-md text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? `Fixing ${issues.length} issues...`
              : `Apply Fix to ${issues.length} Issue${issues.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
