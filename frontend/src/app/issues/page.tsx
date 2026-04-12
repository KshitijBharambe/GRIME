"use client";

import { MainLayout } from "@/components/layout/main-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Filter } from "lucide-react";
import { toast } from "sonner";
import { useRealTimeUpdates } from "@/lib/hooks/useRealTimeUpdates";
import { useDatasets } from "@/lib/hooks/useDatasets";
import { useState } from "react";
import type { DetailedIssue, Issue } from "@/types/api";
import {
  createFix,
  resolveIssue,
  unresolveIssue,
  useIssue,
  useIssues,
  useIssuesSummary,
} from "@/lib/hooks/useIssues";
import React from "react";
import { FixDialog } from "@/components/issues/fix-dialog";
import { BulkFixDialog } from "@/components/issues/bulk-fix-dialog";
import { IssueSummaryCards } from "@/components/issues/IssueSummaryCards";
import { IssueFilters } from "@/components/issues/IssueFilters";
import { IssueListPanel } from "@/components/issues/IssueListPanel";
import { IssueAnalysis } from "@/components/issues/IssueAnalysis";
import { IssueDetailsDialog } from "@/components/issues/IssueDetailsDialog";
import {
  ITEMS_PER_PAGE,
  computeSummaryData,
  extractAvailableColumns,
  getFilteredAndSortedIssues,
  paginateIssues,
  extractErrorMessage,
} from "./helpers";

export default function IssuesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [datasetFilter, setDatasetFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("created_at_newest");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [showIssueDetails, setShowIssueDetails] = useState(false);
  const [showFixDialog, setShowFixDialog] = useState(false);
  const [issueToFix, setIssueToFix] = useState<Issue | null>(null);
  const [isUnresolving, setIsUnresolving] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set());
  const [showBulkFixDialog, setShowBulkFixDialog] = useState(false);
  const [columnFilter, setColumnFilter] = useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");

  // Fetch detailed issue data when an issue is selected
  const {
    data: detailedIssue,
    isLoading: detailedIssueLoading,
    error: detailedIssueError,
  } = useIssue(selectedIssueId || "") as {
    data: DetailedIssue | undefined;
    isLoading: boolean;
    error: Error | null;
  };
  const [isFixing, setIsFixing] = useState<string | null>(null);

  // Fetch all datasets for the filter dropdown
  const { data: datasetsResponse, isLoading: datasetsLoading } = useDatasets(
    1,
    1000,
  ); // Fetch a large number to get all datasets

  // Get all available datasets for filter dropdown
  const availableDatasets = React.useMemo(() => {
    if (!datasetsResponse?.items || datasetsResponse.items.length === 0)
      return [];

    return datasetsResponse.items
      .filter((dataset) => dataset.name && dataset.name.trim() !== "")
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [datasetsResponse]);

  // Get dataset ID from dataset name for filtering
  const selectedDatasetId = React.useMemo(() => {
    if (datasetFilter === "all") return undefined;
    const dataset = availableDatasets.find((d) => d.name === datasetFilter);
    return dataset?.id;
  }, [datasetFilter, availableDatasets]);

  // Create filters object for the useIssues hook
  const filters = {
    severity: severityFilter !== "all" ? severityFilter : undefined,
    resolved: statusFilter === "all" ? undefined : statusFilter === "resolved",
    dataset_id: selectedDatasetId,
    limit: 500, // Increase limit to get more issues for client-side filtering
  };

  const { data: issues, isLoading, refetch } = useIssues(filters);
  const { data: issuesSummary, isLoading: summaryLoading } = useIssuesSummary();
  const { invalidateIssuesData } = useRealTimeUpdates();

  const handleViewIssue = (issue: Issue) => {
    setSelectedIssueId(issue.id);
    setShowIssueDetails(true);
  };

  const handleOpenFixDialog = (issue: Issue) => {
    setIssueToFix(issue);
    setShowFixDialog(true);
  };

  const handleApplyFix = async (fixData: {
    new_value?: string;
    comment?: string;
  }) => {
    if (!issueToFix || isFixing) return;

    setIsFixing(issueToFix.id);
    try {
      if (fixData.new_value) {
        await createFix(issueToFix.id, fixData);
        toast.success("Fix applied successfully");
      } else {
        await resolveIssue(issueToFix.id);
        toast.success("Issue marked as resolved");
      }

      // Invalidate and refetch all related queries for real-time updates
      await Promise.all([invalidateIssuesData(), refetch()]);

      // Close issue details modal if it's open
      if (selectedIssueId === issueToFix.id) {
        setShowIssueDetails(false);
      }
    } catch (error: unknown) {
      console.error("Fix error:", error);
      const errorMessage = extractErrorMessage(error, "Failed to fix issue");
      toast.error(errorMessage);
      throw error; // Re-throw to let FixDialog handle it
    } finally {
      setIsFixing(null);
    }
  };

  const handleUnresolveIssue = async (issue: Issue) => {
    if (isUnresolving) return;

    setIsUnresolving(issue.id);
    try {
      await unresolveIssue(issue.id);
      toast.success("Issue marked as unresolved");

      // Invalidate and refetch all related queries for real-time updates
      await Promise.all([invalidateIssuesData(), refetch()]);

      // Close issue details modal if it's open
      if (selectedIssueId === issue.id) {
        setShowIssueDetails(false);
      }
    } catch (error: unknown) {
      console.error("Unresolve error:", error);
      const errorMessage = extractErrorMessage(
        error,
        "Failed to unresolve issue",
      );
      toast.error(errorMessage);
    } finally {
      setIsUnresolving(null);
    }
  };

  const handleBulkFix = async (fixData: {
    new_value?: string;
    comment?: string;
  }) => {
    if (selectedIssues.size === 0) return;

    const selectedIssuesList = Array.from(selectedIssues);

    try {
      toast.loading(`Fixing ${selectedIssuesList.length} issues...`, {
        id: "bulk-fix",
      });

      // Apply fix to all selected issues
      let successCount = 0;
      let errorCount = 0;

      for (const issueId of selectedIssuesList) {
        try {
          if (fixData.new_value || fixData.comment) {
            // Apply fix with value/comment
            await createFix(issueId, fixData);
          } else {
            // Just resolve without a fix
            await resolveIssue(issueId);
          }
          successCount++;
        } catch (error) {
          console.error(`Failed to fix issue ${issueId}:`, error);
          errorCount++;
        }
      }

      // Show results
      if (errorCount === 0) {
        toast.success(`Successfully fixed ${successCount} issues`, {
          id: "bulk-fix",
        });
      } else {
        toast.warning(`Fixed ${successCount} issues, ${errorCount} failed`, {
          id: "bulk-fix",
        });
      }

      // Clear selection and refresh
      setSelectedIssues(new Set());
      setShowBulkFixDialog(false);
      await Promise.all([invalidateIssuesData(), refetch()]);
    } catch (error: unknown) {
      console.error("Bulk fix error:", error);
      toast.error("Failed to process bulk fix", { id: "bulk-fix" });
    }
  };

  const handleBulkIgnore = async () => {
    if (selectedIssues.size === 0) return;

    const selectedIssuesList = Array.from(selectedIssues);

    try {
      toast.loading(`Ignoring ${selectedIssuesList.length} issues...`, {
        id: "bulk-ignore",
      });

      let successCount = 0;
      let errorCount = 0;

      for (const issueId of selectedIssuesList) {
        try {
          await createFix(issueId, { comment: "Ignored" });
          successCount++;
        } catch (error) {
          console.error(`Failed to ignore issue ${issueId}:`, error);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        toast.success(`Successfully ignored ${successCount} issues`, {
          id: "bulk-ignore",
        });
      } else {
        toast.warning(`Ignored ${successCount} issues, ${errorCount} failed`, {
          id: "bulk-ignore",
        });
      }

      setSelectedIssues(new Set());
      await Promise.all([invalidateIssuesData(), refetch()]);
    } catch (error: unknown) {
      console.error("Bulk ignore error:", error);
      toast.error("Failed to process bulk ignore", { id: "bulk-ignore" });
    }
  };

  const handleBulkResolve = async () => {
    if (selectedIssues.size === 0) return;

    const selectedIssuesList = Array.from(selectedIssues);

    try {
      toast.loading(`Resolving ${selectedIssuesList.length} issues...`, {
        id: "bulk-resolve",
      });

      let successCount = 0;
      let errorCount = 0;

      for (const issueId of selectedIssuesList) {
        try {
          await resolveIssue(issueId);
          successCount++;
        } catch (error) {
          console.error(`Failed to resolve issue ${issueId}:`, error);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        toast.success(`Successfully resolved ${successCount} issues`, {
          id: "bulk-resolve",
        });
      } else {
        toast.warning(
          `Resolved ${successCount} issues, ${errorCount} failed`,
          { id: "bulk-resolve" },
        );
      }

      setSelectedIssues(new Set());
      await Promise.all([invalidateIssuesData(), refetch()]);
    } catch (error: unknown) {
      console.error("Bulk resolve error:", error);
      toast.error("Failed to process bulk resolve", { id: "bulk-resolve" });
    }
  };

  // Use API summary data, fallback to calculated values
  const summaryData = computeSummaryData(issuesSummary, issues);

  // Extract unique column names for filter dropdown
  const availableColumns = React.useMemo(
    () => extractAvailableColumns(issues),
    [issues],
  );

  // Filter, sort, and paginate issues
  const filteredIssues = getFilteredAndSortedIssues(
    issues,
    searchTerm,
    columnFilter,
    dateRangeFilter,
    sortBy,
  );

  // Pagination calculations
  const { totalIssues, totalPages, startIndex, endIndex, paginatedIssues } =
    paginateIssues(filteredIssues, currentPage, ITEMS_PER_PAGE);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    severityFilter,
    statusFilter,
    datasetFilter,
    columnFilter,
    dateRangeFilter,
    sortBy,
  ]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Issues</h1>
          <p className="text-muted-foreground">
            Track and resolve data quality issues across your datasets
          </p>
        </div>

        {/* Summary Cards */}
        <IssueSummaryCards summaryData={summaryData} />

        {/* Data Quality Issues with Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Data Quality Issues
            </CardTitle>
            <CardDescription>
              Filter and manage data quality issues across your datasets
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <IssueFilters
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              datasetFilter={datasetFilter}
              onDatasetFilterChange={setDatasetFilter}
              availableDatasets={availableDatasets}
              datasetsLoading={datasetsLoading}
              severityFilter={severityFilter}
              onSeverityFilterChange={setSeverityFilter}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              columnFilter={columnFilter}
              onColumnFilterChange={setColumnFilter}
              availableColumns={availableColumns}
              dateRangeFilter={dateRangeFilter}
              onDateRangeFilterChange={setDateRangeFilter}
            />

            {/* Issues List */}
            <div className="space-y-4">
              <IssueListPanel
                isLoading={isLoading}
                summaryLoading={summaryLoading}
                totalIssues={totalIssues}
                totalPages={totalPages}
                startIndex={startIndex}
                endIndex={endIndex}
                currentPage={currentPage}
                paginatedIssues={paginatedIssues}
                selectedIssues={selectedIssues}
                onSelectAll={(checked) => {
                  if (checked) {
                    setSelectedIssues(
                      new Set(paginatedIssues.map((i) => i.id)),
                    );
                  } else {
                    setSelectedIssues(new Set());
                  }
                }}
                onSelectIssue={(id, checked) => {
                  const newSelected = new Set(selectedIssues);
                  if (checked) {
                    newSelected.add(id);
                  } else {
                    newSelected.delete(id);
                  }
                  setSelectedIssues(newSelected);
                }}
                onViewIssue={handleViewIssue}
                onOpenFixDialog={handleOpenFixDialog}
                onUnresolveIssue={handleUnresolveIssue}
                onBulkFix={() => setShowBulkFixDialog(true)}
                onBulkResolve={handleBulkResolve}
                onBulkIgnore={handleBulkIgnore}
                onClearSelection={() => setSelectedIssues(new Set())}
                onPageChange={setCurrentPage}
                isFixing={isFixing}
                isUnresolving={isUnresolving}
                searchTerm={searchTerm}
                severityFilter={severityFilter}
                statusFilter={statusFilter}
                datasetFilter={datasetFilter}
              />
            </div>
          </CardContent>
        </Card>

        {/* Issue Analysis */}
        <IssueAnalysis summaryData={summaryData} issues={issues} />

        {/* Issue Details Dialog */}
        <IssueDetailsDialog
          open={showIssueDetails}
          onOpenChange={setShowIssueDetails}
          detailedIssue={detailedIssue}
          detailedIssueLoading={detailedIssueLoading}
          detailedIssueError={detailedIssueError}
          filteredIssues={filteredIssues}
          isFixing={isFixing}
          isUnresolving={isUnresolving}
          onOpenFixDialog={handleOpenFixDialog}
          onUnresolveIssue={handleUnresolveIssue}
        />

        {/* Fix Dialog */}
        <FixDialog
          issue={issueToFix}
          open={showFixDialog}
          onOpenChange={setShowFixDialog}
          onSubmit={handleApplyFix}
          isSubmitting={isFixing === issueToFix?.id}
        />

        {/* Bulk Fix Dialog */}
        <BulkFixDialog
          issues={filteredIssues.filter((issue) =>
            selectedIssues.has(issue.id),
          )}
          open={showBulkFixDialog}
          onOpenChange={setShowBulkFixDialog}
          onSubmit={handleBulkFix}
          isSubmitting={false}
        />
      </div>
    </MainLayout>
  );
}
