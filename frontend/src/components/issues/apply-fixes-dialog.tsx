"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Check,
  X,
  AlertCircle,
  FileText,
  Database,
  Loader2,
} from "lucide-react";
import type { UnappliedFix } from "@/types/api";
import {
  useUnappliedFixes,
  useApplyFixesMutation,
} from "@/lib/hooks/useIssues";

interface ApplyFixesDialogProps {
  readonly open: boolean;
  onOpenChange: (open: boolean) => void;
  readonly datasetId: string;
  readonly datasetName: string;
  readonly versionId: string;
  readonly versionNumber: number;
}

export function ApplyFixesDialog({
  open,
  onOpenChange,
  datasetId,
  datasetName,
  versionId,
  versionNumber,
}: ApplyFixesDialogProps) {
  const [selectedFixIds, setSelectedFixIds] = useState<Set<string>>(new Set());
  const [versionNotes, setVersionNotes] = useState("");
  const [reRunRules, setReRunRules] = useState(false);

  // Fetch unapplied fixes for this version
  const { data: unappliedFixes, isLoading: fixesLoading } =
    useUnappliedFixes(versionId);
  const applyFixesMutation = useApplyFixesMutation();

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setSelectedFixIds(new Set());
      setVersionNotes("");
      setReRunRules(false);
    }
  }, [open]);

  // Group fixes by severity
  const groupedFixes = useMemo(() => {
    if (!unappliedFixes) return { critical: [], high: [], medium: [], low: [] };

    return unappliedFixes.reduce(
      (acc, fix) => {
        const severity = fix.severity.toLowerCase();
        if (severity === "critical") acc.critical.push(fix);
        else if (severity === "high") acc.high.push(fix);
        else if (severity === "medium") acc.medium.push(fix);
        else acc.low.push(fix);
        return acc;
      },
      {
        critical: [] as UnappliedFix[],
        high: [] as UnappliedFix[],
        medium: [] as UnappliedFix[],
        low: [] as UnappliedFix[],
      },
    );
  }, [unappliedFixes]);

  const handleToggleFix = (fixId: string) => {
    const newSelected = new Set(selectedFixIds);
    if (newSelected.has(fixId)) {
      newSelected.delete(fixId);
    } else {
      newSelected.add(fixId);
    }
    setSelectedFixIds(newSelected);
  };

  const handleSelectAll = () => {
    if (unappliedFixes) {
      setSelectedFixIds(new Set(unappliedFixes.map((f) => f.fix_id)));
    }
  };

  const handleDeselectAll = () => {
    setSelectedFixIds(new Set());
  };

  const handleApplyFixes = async () => {
    if (selectedFixIds.size === 0) {
      toast.error("Please select at least one fix to apply");
      return;
    }

    try {
      const result = await applyFixesMutation.mutateAsync({
        datasetId,
        requestData: {
          source_version_id: versionId,
          fix_ids: Array.from(selectedFixIds),
          version_notes: versionNotes || undefined,
          re_run_rules: reRunRules,
        },
      });

      toast.success(
        `Successfully created version ${result.new_version.version_no} with ${result.fixes_applied} fixes applied`,
      );
      onOpenChange(false);
    } catch (error: unknown) {
      console.error("Apply fixes error:", error);
      const errorMessage =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { detail?: string } } }).response
              ?.data?.detail
          : "Failed to apply fixes";
      toast.error(errorMessage || "Failed to apply fixes");
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

  const renderFixGroup = (title: string, fixes: UnappliedFix[]) => {
    if (fixes.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">{title}</h4>
          <Badge
            variant={getSeverityColor(title.toLowerCase())}
            className="text-xs"
          >
            {fixes.length}
          </Badge>
        </div>
        <div className="space-y-1">
          {fixes.map((fix) => (
            <div
              key={fix.fix_id}
              className="flex items-start gap-2 p-2 rounded border hover:bg-muted/50 cursor-pointer"
              onClick={() => handleToggleFix(fix.fix_id)}
            >
              <Checkbox
                checked={selectedFixIds.has(fix.fix_id)}
                onCheckedChange={() => handleToggleFix(fix.fix_id)}
                className="mt-0.5"
              />
              <div className="flex-1 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">Row {fix.row_index}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">
                    {fix.column_name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {fix.current_value && (
                    <>
                      <code className="bg-muted px-1 py-0.5 rounded">
                        {fix.current_value}
                      </code>
                      <span>→</span>
                    </>
                  )}
                  {fix.new_value && (
                    <code className="bg-green-50 text-green-700 px-1 py-0.5 rounded">
                      {fix.new_value}
                    </code>
                  )}
                </div>
                {fix.comment && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {fix.comment}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Apply Fixes & Create New Version
          </DialogTitle>
          <DialogDescription>
            Select fixes to apply to {datasetName} (v{versionNumber}) and create
            a new version
          </DialogDescription>
        </DialogHeader>

        {fixesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2">Loading fixes...</span>
          </div>
        ) : !unappliedFixes || unappliedFixes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Unapplied Fixes</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              There are no unapplied fixes for this dataset version. Create
              fixes for issues first, then return here to apply them.
            </p>
          </div>
        ) : (
          <>
            {/* Selection controls */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {selectedFixIds.size} of {unappliedFixes.length} fixes
                  selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={selectedFixIds.size === unappliedFixes.length}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeselectAll}
                  disabled={selectedFixIds.size === 0}
                >
                  <X className="h-4 w-4 mr-1" />
                  Deselect All
                </Button>
              </div>
            </div>

            {/* Fixes list */}
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-4">
                {renderFixGroup("Critical", groupedFixes.critical)}
                {renderFixGroup("High", groupedFixes.high)}
                {renderFixGroup("Medium", groupedFixes.medium)}
                {renderFixGroup("Low", groupedFixes.low)}
              </div>
            </ScrollArea>

            {/* Version notes */}
            <div className="space-y-2">
              <Label
                htmlFor="version-notes"
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Version Notes (Optional)
              </Label>
              <Textarea
                id="version-notes"
                placeholder="Describe the changes in this version..."
                value={versionNotes}
                onChange={(e) => setVersionNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Re-run rules option */}
            <div className="flex items-center space-x-2 border rounded-md p-3 bg-muted/50">
              <Checkbox
                id="re-run-rules"
                checked={reRunRules}
                onCheckedChange={(checked) => setReRunRules(checked as boolean)}
              />
              <div className="flex-1">
                <label
                  htmlFor="re-run-rules"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Re-run data quality rules after applying fixes
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  Automatically validate the new version against all active
                  rules
                </p>
              </div>
            </div>

            {/* Summary */}
            {selectedFixIds.size > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-900">
                  <strong>Preview:</strong> A new version (v{versionNumber + 1})
                  will be created with {selectedFixIds.size} fix
                  {selectedFixIds.size !== 1 ? "es" : ""} applied.
                  {reRunRules &&
                    " Data quality rules will be automatically re-run."}
                </p>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleApplyFixes}
            disabled={
              fixesLoading ||
              !unappliedFixes ||
              unappliedFixes.length === 0 ||
              selectedFixIds.size === 0 ||
              applyFixesMutation.isPending
            }
          >
            {applyFixesMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Applying Fixes...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Apply {selectedFixIds.size} Fix
                {selectedFixIds.size !== 1 ? "es" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
