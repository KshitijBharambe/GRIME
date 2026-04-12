"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Download,
  FileText,
  Database,
  Loader2,
} from "lucide-react";
import { useDatasets } from "@/lib/hooks/useDatasets";
import {
  useQualitySummary,
  useIssuePatterns,
  useGenerateQualityReport,
  useDownloadExport,
  useAllDatasetsQualityScores,
} from "@/lib/hooks/useReports";
import { useExecutions, useExecutionQualityMetrics } from "@/lib/hooks/useExecutions";
import { QualityMetricsCard } from "@/components/QualityMetrics";
import { toast } from "sonner";

type QualitySummaryResponse =
  | {
      dataset_id: string;
      dataset_name: string;
      current_version: number;
      total_rows: number;
      total_columns: number;
      missing_data_percentage: number;
      duplicate_rows: number;
      total_issues_found: number;
      total_fixes_applied: number;
      data_quality_score: number;
      column_quality: Record<string, unknown>;
      execution_summary: {
        total_executions: number;
        last_execution: string | null;
        success_rate: number;
      };
    }
  | undefined;

type IssuePatternsResponse =
  | {
      total_issues_analyzed: number;
      patterns: {
        by_severity: Record<string, number>;
        by_column: Record<string, number>;
        by_rule_type: Record<string, number>;
        most_common_issues: { description: string; count: number }[];
        fix_rates: Record<string, number>;
      };
      insights: {
        most_problematic_columns: [string, number][];
        most_common_rule_violations: [string, number][];
      };
    }
  | undefined;

export default function QualityReportsPage() {
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [selectedExecutionId, setSelectedExecutionId] = useState<string>("");
  const [timeRange, setTimeRange] = useState<string>("30");
  const { data: datasetsData } = useDatasets();
  const datasets = datasetsData?.items || [];
  const { data: executionsData } = useExecutions(1, 10);

  // Fetch data based on selected dataset and time range
  // Only fetch quality summary for specific datasets, not "all"
  const { data: qualitySummary, isLoading: isLoadingQuality } =
    useQualitySummary(
      selectedDataset && selectedDataset !== "all" ? selectedDataset : ""
    );
  const summaryData = qualitySummary as QualitySummaryResponse;
  const { data: issuePatterns, isLoading: isLoadingPatterns } =
    useIssuePatterns();
  const patternsData = issuePatterns as IssuePatternsResponse;
  const generateReport = useGenerateQualityReport();
  const downloadExport = useDownloadExport();
  const { data: allDatasetsQuality, isLoading: isLoadingAllDatasets } =
    useAllDatasetsQualityScores();
  const allDatasetsData = allDatasetsQuality?.datasets || [];

  // Get quality metrics for selected execution or latest execution
  const { data: qualityMetrics, isLoading: metricsLoading } =
    useExecutionQualityMetrics(selectedExecutionId);

  // Auto-select latest execution when dataset changes or on initial load
  useEffect(() => {
    if (executionsData?.items && executionsData.items.length > 0) {
      const latestExecution = executionsData.items[0];
      if (!selectedExecutionId || selectedDataset) {
        setSelectedExecutionId(latestExecution.id);
      }
    }
  }, [executionsData, selectedDataset, selectedExecutionId]);

  const handleGenerateReport = async () => {
    if (!selectedDataset) {
      toast.error("Please select a dataset");
      return;
    }

    try {
      const result = await generateReport.mutateAsync({
        datasetId: selectedDataset,
        includeCharts: false,
      });

      toast.success("Quality report generated successfully");

      // Automatically download the report
      const blob = await downloadExport.mutateAsync(result.export_id);
      const url = window.URL.createObjectURL(blob.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${result.dataset_name}_quality_report.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || "Failed to generate report");
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quality Reports</h1>
          <p className="text-muted-foreground">
            Comprehensive data quality analysis and reporting
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Report Filters</CardTitle>
            <CardDescription>
              Configure your quality report parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label htmlFor="filter-dataset" className="text-sm font-medium">Dataset</label>
                <Select
                  value={selectedDataset}
                  onValueChange={setSelectedDataset}
                >
                  <SelectTrigger id="filter-dataset">
                    <SelectValue placeholder="Select dataset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Datasets</SelectItem>
                    {datasets?.map((dataset) => (
                      <SelectItem key={dataset.id} value={dataset.id}>
                        {dataset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label htmlFor="filter-timerange" className="text-sm font-medium">Time Range</label>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger id="filter-timerange">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                    <SelectItem value="365">Last year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  onClick={handleGenerateReport}
                  disabled={
                    !selectedDataset ||
                    generateReport.isPending ||
                    downloadExport.isPending
                  }
                >
                  {generateReport.isPending || downloadExport.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Generate Report
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="issues">Issue Analysis</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Quality Metrics Section */}
            {selectedExecutionId && (
              <QualityMetricsCard
                metrics={qualityMetrics}
                isLoading={metricsLoading}
              />
            )}

            {/* Quality Score Overview */}
            {selectedDataset === "all" ? (
              <>
                {/* Aggregate Statistics for All Datasets */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total Datasets
                      </CardTitle>
                      <Database className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {allDatasetsData.length}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Across all datasets
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Average Quality Score
                      </CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {allDatasetsData.length > 0
                          ? (
                              allDatasetsData.reduce(
                                (sum, d) => sum + (d.quality_score || 0),
                                0
                              ) / allDatasetsData.length
                            ).toFixed(1)
                          : 0}%
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Across all datasets
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total Issues
                      </CardTitle>
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {allDatasetsData.reduce(
                          (sum, d) => sum + (d.total_issues || 0),
                          0
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Across all datasets
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total Fixes
                      </CardTitle>
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {allDatasetsData.reduce(
                          (sum, d) => sum + (d.total_fixes || 0),
                          0
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Across all datasets
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : isLoadingQuality ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : summaryData ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Overall Quality Score
                      </CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {summaryData.data_quality_score?.toFixed(1) || 0}%
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground mt-1">
                        {summaryData.execution_summary?.total_executions === 0 ? (
                          <>
                            <AlertTriangle className="mr-1 h-3 w-3 text-yellow-500" />
                            No executions yet
                          </>
                        ) : (
                          <>
                            <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                            Quality assessment
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total Issues
                      </CardTitle>
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {summaryData.total_issues_found || 0}
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground mt-1">
                        <AlertTriangle className="mr-1 h-3 w-3 text-orange-500" />
                        From {summaryData.execution_summary.total_executions}{" "}
                        executions
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Fixes Applied
                      </CardTitle>
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {summaryData.total_fixes_applied || 0}
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground mt-1">
                        <CheckCircle className="mr-1 h-3 w-3 text-green-500" />
                        {summaryData.total_issues_found > 0
                          ? (
                              (summaryData.total_fixes_applied /
                                summaryData.total_issues_found) *
                              100
                            ).toFixed(1)
                          : 0}
                        % resolved
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Data Completeness
                      </CardTitle>
                      <Database className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {(100 - summaryData.missing_data_percentage).toFixed(1)}
                        %
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground mt-1">
                        <Database className="mr-1 h-3 w-3 text-blue-500" />
                        {summaryData.missing_data_percentage.toFixed(1)}%
                        missing
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : selectedDataset ? (
              <div className="text-center p-8 text-muted-foreground">
                No quality data available for this dataset
              </div>
            ) : (
              <div className="text-center p-8 text-muted-foreground">
                Select a dataset to view quality metrics
              </div>
            )}

            {/* Quality by Dataset */}
            <Card>
              <CardHeader>
                <CardTitle>Quality Scores by Dataset</CardTitle>
                <CardDescription>
                  Data quality metrics for each dataset
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingAllDatasets ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : allDatasetsData.length > 0 ? (
                  <div className="space-y-4">
                    {allDatasetsData.map((dataset) => {
                      const qualityScore = dataset.quality_score || 0;
                      const issueCount = dataset.total_issues || 0;
                      let badgeVariant: "outline" | "secondary" | "destructive";
                      if (issueCount === 0) {
                        badgeVariant = "outline";
                      } else if (issueCount < 5) {
                        badgeVariant = "secondary";
                      } else {
                        badgeVariant = "destructive";
                      }

                      return (
                        <div
                          key={dataset.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Database className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{dataset.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {dataset.total_rows.toLocaleString()} records
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-medium">
                                {qualityScore.toFixed(1)}%
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {qualityScore === 0 ? "No executions yet" : "Quality Score"}
                              </p>
                            </div>
                            <Badge variant={badgeVariant}>
                              {issueCount}{" "}
                              {issueCount === 1 ? "issue" : "issues"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center p-8 text-muted-foreground">
                    No datasets available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Quality Trends</CardTitle>
                <CardDescription>
                  Data quality metrics over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="mx-auto h-12 w-12 mb-4" />
                    <p>Quality trends chart would be displayed here</p>
                    <p className="text-sm">
                      Shows quality scores, issue counts, and resolution rates
                      over time
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="issues" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Issue Analysis</CardTitle>
                <CardDescription>
                  Breakdown of data quality issues by type and severity
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPatterns ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : patternsData && patternsData.patterns ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-4">
                      <h4 className="font-medium">Issues by Severity</h4>
                      <div className="space-y-2">
                        {Object.entries(
                          patternsData.patterns.by_severity || {}
                        ).map(([severity, count]: [string, number]) => (
                          <div
                            key={severity}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  severity === "critical"
                                    ? "destructive"
                                    : "outline"
                                }
                                className={(() => {
                                  const baseClass = "w-2 h-2 p-0 rounded-full";
                                  if (severity === "high") return `${baseClass} bg-orange-500`;
                                  if (severity === "medium") return `${baseClass} bg-yellow-500`;
                                  return baseClass;
                                })()}
                              />
                              <span className="text-sm capitalize">
                                {severity}
                              </span>
                            </div>
                            <span className="text-sm font-medium">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Issues by Rule Type</h4>
                      <div className="space-y-2">
                        {Object.entries(
                          patternsData.patterns.by_rule_type || {}
                        ).map(([type, count]: [string, number]) => (
                          <div
                            key={type}
                            className="flex items-center justify-between"
                          >
                            <span className="text-sm capitalize">
                              {type.replace(/_/g, " ")}
                            </span>
                            <span className="text-sm font-medium">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8 text-muted-foreground">
                    No issue patterns available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
                <CardDescription>
                  AI-powered suggestions to improve data quality
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">High Priority</Badge>
                      <h4 className="font-medium">
                        Address Missing Customer Email Fields
                      </h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      89% of customer records are missing email addresses.
                      Consider implementing email validation rules and data
                      collection improvements.
                    </p>
                    <Button variant="outline" size="sm">
                      Create Rule
                    </Button>
                  </div>

                  <div className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-orange-500">Medium Priority</Badge>
                      <h4 className="font-medium">Standardize Date Formats</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Multiple date formats detected across datasets. Implement
                      standardization rules to ensure consistency.
                    </p>
                    <Button variant="outline" size="sm">
                      Create Rule
                    </Button>
                  </div>

                  <div className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Low Priority</Badge>
                      <h4 className="font-medium">
                        Optimize Phone Number Format
                      </h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Phone numbers use inconsistent formatting. Consider
                      implementing a standard format rule.
                    </p>
                    <Button variant="outline" size="sm">
                      Create Rule
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Export Report */}
        <Card>
          <CardHeader>
            <CardTitle>Export Report</CardTitle>
            <CardDescription>
              Download your quality report in various formats
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                onClick={handleGenerateReport}
                disabled={
                  !selectedDataset ||
                  generateReport.isPending ||
                  downloadExport.isPending
                }
              >
                {generateReport.isPending || downloadExport.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export as Excel (Quality Report)
                  </>
                )}
              </Button>
              <Button variant="outline" disabled title="PDF export coming soon">
                <Download className="mr-2 h-4 w-4" />
                Export as PDF (Coming Soon)
              </Button>
            </div>
            {!selectedDataset && (
              <p className="text-sm text-muted-foreground mt-2">
                Please select a dataset above to export a quality report
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
