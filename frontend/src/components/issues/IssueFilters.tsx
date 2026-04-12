"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

interface Dataset {
  id: string;
  name: string;
}

interface IssueFiltersProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  datasetFilter: string;
  onDatasetFilterChange: (value: string) => void;
  availableDatasets: Dataset[];
  datasetsLoading: boolean;
  severityFilter: string;
  onSeverityFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  columnFilter: string;
  onColumnFilterChange: (value: string) => void;
  availableColumns: string[];
  dateRangeFilter: string;
  onDateRangeFilterChange: (value: string) => void;
}

export function IssueFilters({
  searchTerm,
  onSearchTermChange,
  datasetFilter,
  onDatasetFilterChange,
  availableDatasets,
  datasetsLoading,
  severityFilter,
  onSeverityFilterChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortByChange,
  columnFilter,
  onColumnFilterChange,
  availableColumns,
  dateRangeFilter,
  onDateRangeFilterChange,
}: IssueFiltersProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7 mb-6 pb-6 border-b">
      <div className="space-y-2">
        <label htmlFor="filter-search" className="text-sm font-medium">
          Search
        </label>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="filter-search"
            placeholder="Search issues..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="filter-dataset-select" className="text-sm font-medium">
          Dataset
        </label>
        <Select
          value={datasetFilter}
          onValueChange={onDatasetFilterChange}
          disabled={datasetsLoading}
        >
          <SelectTrigger id="filter-dataset-select">
            <SelectValue
              placeholder={
                datasetsLoading ? "Loading datasets..." : "All Datasets"
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Datasets</SelectItem>
            {datasetsLoading ? (
              <SelectItem value="loading" disabled>
                Loading datasets...
              </SelectItem>
            ) : (
              availableDatasets.map((dataset) => (
                <SelectItem key={dataset.id} value={dataset.name}>
                  {dataset.name}
                </SelectItem>
              ))
            )}
            {!datasetsLoading && availableDatasets.length === 0 && (
              <SelectItem value="no-data" disabled>
                No datasets found
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label htmlFor="filter-severity" className="text-sm font-medium">
          Severity
        </label>
        <Select value={severityFilter} onValueChange={onSeverityFilterChange}>
          <SelectTrigger id="filter-severity">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label htmlFor="filter-status" className="text-sm font-medium">
          Status
        </label>
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger id="filter-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Issues</SelectItem>
            <SelectItem value="unresolved">Unresolved</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label htmlFor="filter-sortby" className="text-sm font-medium">
          Sort By
        </label>
        <Select value={sortBy} onValueChange={onSortByChange}>
          <SelectTrigger id="filter-sortby">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at_newest">
              Date: Newest First
            </SelectItem>
            <SelectItem value="created_at_oldest">
              Date: Oldest First
            </SelectItem>
            <SelectItem value="severity_high_to_low">
              Severity: High to Low
            </SelectItem>
            <SelectItem value="severity_low_to_high">
              Severity: Low to High
            </SelectItem>
            <SelectItem value="dataset_a_to_z">Dataset: A to Z</SelectItem>
            <SelectItem value="dataset_z_to_a">Dataset: Z to A</SelectItem>
            <SelectItem value="rule_a_to_z">Rule: A to Z</SelectItem>
            <SelectItem value="rule_z_to_a">Rule: Z to A</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label htmlFor="filter-column" className="text-sm font-medium">
          Column
        </label>
        <Select value={columnFilter} onValueChange={onColumnFilterChange}>
          <SelectTrigger id="filter-column">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Columns</SelectItem>
            {availableColumns.map((col) => (
              <SelectItem key={col} value={col}>
                {col}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label htmlFor="filter-daterange" className="text-sm font-medium">
          Date Range
        </label>
        <Select value={dateRangeFilter} onValueChange={onDateRangeFilterChange}>
          <SelectTrigger id="filter-daterange">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7days">Last 7 Days</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
            <SelectItem value="90days">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
