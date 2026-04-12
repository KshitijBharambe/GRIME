"use client";

import { useState } from "react";
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
import { ArrowRight, AlertCircle } from "lucide-react";
import type { Issue } from "@/types/api";

interface FixDialogProps {
  readonly issue: Issue | null;
  readonly open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (fixData: {
    new_value?: string;
    comment?: string;
  }) => Promise<void>;
  readonly isSubmitting?: boolean;
}

export function FixDialog({
  issue,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
}: FixDialogProps) {
  const [newValue, setNewValue] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  // Reset state when dialog opens with a new issue
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && issue) {
      setNewValue(issue.suggested_value || "");
      setComment(
        issue.suggested_value ? "Applied suggested fix" : "Manually resolved",
      );
      setError("");
    } else {
      setNewValue("");
      setComment("");
      setError("");
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async () => {
    if (!issue) return;

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
      setError(err instanceof Error ? err.message : "Failed to apply fix");
    }
  };

  if (!issue) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Fix Issue
            <Badge variant="outline" className="ml-auto">
              {issue.severity}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Review and modify the fix before applying it to the issue
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Issue Context */}
          <div className="bg-muted p-4 rounded-md space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Rule:</span>
              <span className="font-medium">{issue.rule_name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Dataset:</span>
              <span className="font-medium">{issue.dataset_name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Location:</span>
              <span className="font-medium">
                Row {issue.row_index}, Column: {issue.column_name}
              </span>
            </div>
          </div>

          {/* Message */}
          {issue.message && (
            <div>
              <Label className="text-muted-foreground">Issue Message</Label>
              <p className="text-sm mt-1 p-2 bg-muted rounded-md">
                {issue.message}
              </p>
            </div>
          )}

          {/* Value Preview */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">
              Value Change Preview
            </Label>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">
                  Current Value
                </div>
                <code className="text-sm bg-background px-2 py-1 rounded">
                  {issue.current_value || "null"}
                </code>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">
                  New Value
                </div>
                <code className="text-sm bg-green-50 text-green-700 px-2 py-1 rounded">
                  {newValue || "(empty)"}
                </code>
              </div>
            </div>
          </div>

          {/* New Value Input */}
          <div className="space-y-2">
            <Label htmlFor="new-value">
              New Value
              {issue.suggested_value && (
                <span className="text-xs text-muted-foreground ml-2">
                  (pre-filled with suggestion)
                </span>
              )}
            </Label>
            <Input
              id="new-value"
              placeholder="Enter the corrected value..."
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Comment Input */}
          <div className="space-y-2">
            <Label htmlFor="comment">Comment (Optional)</Label>
            <Textarea
              id="comment"
              placeholder="Add notes about this fix..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
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
            {isSubmitting ? "Applying Fix..." : "Apply Fix"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
