"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  MessageSquare,
  Calendar,
  Database,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
} from "lucide-react";
import { formatDate } from "@/lib/utils/date";
import {
  getSeverityColor,
  getPageNumbers,
} from "@/app/issues/helpers";
import type { Issue } from "@/types/api";
import React from "react";

interface IssueListPanelProps {
  isLoading: boolean;
  summaryLoading: boolean;
  totalIssues: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  currentPage: number;
  paginatedIssues: Issue[];
  selectedIssues: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectIssue: (id: string, checked: boolean) => void;
  onViewIssue: (issue: Issue) => void;
  onOpenFixDialog: (issue: Issue) => void;
  onUnresolveIssue: (issue: Issue) => void;
  onBulkFix: () => void;
  onBulkResolve: () => void;
  onBulkIgnore: () => void;
  onClearSelection: () => void;
  onPageChange: (page: number) => void;
  isFixing: string | null;
  isUnresolving: string | null;
  searchTerm: string;
  severityFilter: string;
  statusFilter: string;
  datasetFilter: string;
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

export function IssueListPanel({
  isLoading,
  summaryLoading,
  totalIssues,
  totalPages,
  startIndex,
  endIndex,
  currentPage,
  paginatedIssues,
  selectedIssues,
  onSelectAll,
  onSelectIssue,
  onViewIssue,
  onOpenFixDialog,
  onUnresolveIssue,
  onBulkFix,
  onBulkResolve,
  onBulkIgnore,
  onClearSelection,
  onPageChange,
  isFixing,
  isUnresolving,
  searchTerm,
  severityFilter,
  statusFilter,
  datasetFilter,
}: IssueListPanelProps) {
  if (isLoading || summaryLoading) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center gap-2">
          <Clock className="h-4 w-4 animate-spin" />
          Loading issues...
        </div>
      </div>
    );
  }

  if (totalIssues === 0) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No issues found</h3>
        <p className="text-muted-foreground">
          {searchTerm ||
          severityFilter !== "all" ||
          statusFilter !== "all" ||
          datasetFilter !== "all"
            ? "No issues match your current filters. Try adjusting your search criteria."
            : "No data quality issues have been detected in your datasets."}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Pagination Info and Bulk Actions */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300"
              checked={
                selectedIssues.size > 0 &&
                selectedIssues.size === paginatedIssues.length
              }
              onChange={(e) => onSelectAll(e.target.checked)}
            />
            <span className="text-muted-foreground">
              {selectedIssues.size > 0
                ? `${selectedIssues.size} selected`
                : "Select all"}
            </span>
          </label>
          {selectedIssues.size > 0 && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="default" onClick={onBulkFix}>
                <CheckSquare className="h-4 w-4 mr-1" />
                Fix Selected ({selectedIssues.size})
              </Button>
              <Button size="sm" variant="secondary" onClick={onBulkResolve}>
                <CheckCircle className="h-4 w-4 mr-1" />
                Resolve Selected
              </Button>
              <Button size="sm" variant="ghost" onClick={onBulkIgnore}>
                <XCircle className="h-4 w-4 mr-1" />
                Ignore Selected
              </Button>
              <Button size="sm" variant="outline" onClick={onClearSelection}>
                Clear Selection
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            Showing {startIndex + 1}-{Math.min(endIndex, totalIssues)} of{" "}
            {totalIssues} issues
          </span>
          {totalPages > 1 && (
            <span>
              Page {currentPage} of {totalPages}
            </span>
          )}
        </div>
      </div>

      {paginatedIssues?.map((issue) => (
        <div
          key={issue.id}
          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-4 flex-1">
            {/* Checkbox for bulk selection */}
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 flex-shrink-0"
              checked={selectedIssues.has(issue.id)}
              onChange={(e) => onSelectIssue(issue.id, e.target.checked)}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex items-center gap-2">
              <Badge
                variant={getSeverityColor(issue.severity)}
                className="flex items-center gap-1"
              >
                {getSeverityIcon(issue.severity)}
                {issue.severity}
              </Badge>
              {issue.resolved ? (
                <Badge variant="outline" className="text-green-600">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Resolved
                </Badge>
              ) : (
                <Badge variant="outline" className="text-orange-600">
                  <Clock className="mr-1 h-3 w-3" />
                  Open
                </Badge>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium">{issue.rule_name}</h4>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  {issue.dataset_name}
                </span>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">
                  Row {issue.row_index}, Column: {issue.column_name}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{issue.message}</p>
              {issue.current_value && (
                <div className="mt-2 text-xs">
                  <span className="text-muted-foreground">Current: </span>
                  <code className="bg-muted px-1 py-0.5 rounded">
                    {issue.current_value || "null"}
                  </code>
                  {issue.suggested_value && (
                    <>
                      <span className="text-muted-foreground">
                        {" "}
                        → Suggested:{" "}
                      </span>
                      <code className="bg-green-50 text-green-700 px-1 py-0.5 rounded">
                        {issue.suggested_value}
                      </code>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(issue.created_at)}
              </div>
              {issue.fix_count > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <MessageSquare className="h-3 w-3" />
                  {issue.fix_count} fix{issue.fix_count !== 1 ? "es" : ""}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewIssue(issue)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            {!issue.resolved ? (
              <Button
                size="sm"
                onClick={() => onOpenFixDialog(issue)}
                disabled={isFixing === issue.id}
              >
                {isFixing === issue.id ? "Fixing..." : "Fix Issue"}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onUnresolveIssue(issue)}
                disabled={isUnresolving === issue.id}
              >
                {isUnresolving === issue.id ? "Unresolving..." : "Unresolve"}
              </Button>
            )}
          </div>
        </div>
      ))}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <div className="flex items-center gap-1">
            {getPageNumbers(currentPage, totalPages).map((pageNum) => (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className="w-8 h-8 p-0"
              >
                {pageNum}
              </Button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </>
  );
}
