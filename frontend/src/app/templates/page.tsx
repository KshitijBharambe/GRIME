"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import apiClient from "@/lib/api";
import { useAuthenticatedApi } from "@/lib/hooks/useAuthenticatedApi";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UnderTestingState } from "@/components/under-testing-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle, Play, Plus, Eye, Filter, Sparkles } from "lucide-react";

interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  kind: string;
  usage_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  template_params: Record<string, unknown>;
}

interface RuleSuggestion {
  id: string;
  template_id: string | null;
  suggested_rule_name: string;
  suggested_params: Record<string, unknown>;
  confidence_score: number;
  suggestion_type: string;
  reasoning: string;
  is_applied: boolean;
  created_at: string;
}

interface Dataset {
  id: string;
  name: string;
  status: string;
}

function getHttpStatus(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { status?: unknown } }).response === "object"
  ) {
    const status = (error as { response?: { status?: unknown } }).response
      ?.status;
    return typeof status === "number" ? status : undefined;
  }

  return undefined;
}

export default function TemplatesPage() {
  const isUnderTesting = true;
  const { hasToken } = useAuthenticatedApi();
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [suggestions, setSuggestions] = useState<RuleSuggestion[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedKind, setSelectedKind] = useState<string>("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<RuleTemplate | null>(
    null,
  );
  const [selectedDataset, setSelectedDataset] = useState<string>("");

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (selectedCategory && selectedCategory !== "all")
        params.category = selectedCategory;
      if (selectedKind && selectedKind !== "all") params.kind = selectedKind;

      const response = await apiClient.get("/advanced/templates", { params });
      const data = response.data as { templates: RuleTemplate[] };
      setTemplates(data.templates || []);
    } catch (error) {
      if (getHttpStatus(error) === 404) {
        setTemplates([]);
        return;
      }
      console.error("Error fetching templates:", error);
      toast.error("Failed to fetch templates");
    }
  }, [selectedCategory, selectedKind]);

  // Fetch datasets
  const fetchDatasets = async () => {
    try {
      const response = await apiClient.getDatasets();
      setDatasets(response.items || []);
    } catch (error) {
      console.error("Error fetching datasets:", error);
    }
  };

  // Fetch suggestions for a dataset
  const fetchSuggestions = async (datasetId: string) => {
    try {
      const response = await apiClient.get(
        `/advanced/datasets/${datasetId}/suggestions`,
      );
      const data = response.data as { suggestions: RuleSuggestion[] };
      setSuggestions(data.suggestions || []);
    } catch (error) {
      if (getHttpStatus(error) === 404) {
        setSuggestions([]);
        toast.info("Suggestions are unavailable in this environment");
        return;
      }
      console.error("Error fetching suggestions:", error);
      toast.error("Failed to fetch suggestions");
    }
  };

  // Apply template
  const applyTemplate = async (
    templateId: string,
    customizations: Record<string, unknown>,
  ) => {
    try {
      const response = await apiClient.post(
        `/advanced/templates/${templateId}/apply`,
        {
          dataset_id: selectedDataset,
          customizations,
          rule_name: `${selectedTemplate?.name ?? templateId} - ${selectedDataset}`,
        },
      );
      const data = response.data as { rule_name: string };
      toast.success(`Rule "${data.rule_name}" created successfully`);

      setIsApplyDialogOpen(false);
      fetchSuggestions(selectedDataset);
    } catch (error) {
      console.error("Error applying template:", error);
      toast.error("Failed to apply template");
    }
  };

  // Mark suggestion as applied
  const markSuggestionApplied = async (suggestionId: string) => {
    try {
      await apiClient.post(`/advanced/suggestions/${suggestionId}/apply`);
      toast.success("Suggestion marked as applied");
      fetchSuggestions(selectedDataset);
    } catch (error) {
      console.error("Error marking suggestion applied:", error);
      toast.error("Failed to mark suggestion as applied");
    }
  };

  useEffect(() => {
    if (!hasToken) return;
    const loadData = async () => {
      setLoading(true);
      await fetchTemplates();
      await fetchDatasets();
      setLoading(false);
    };
    loadData();
  }, [hasToken, selectedCategory, selectedKind, fetchTemplates]);

  useEffect(() => {
    if (selectedDataset) {
      fetchSuggestions(selectedDataset);
    }
  }, [selectedDataset]);

  const getConfidenceColor = (score: number) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 70) return "bg-yellow-500";
    return "bg-red-500";
  };

  const categories = Array.from(new Set(templates.map((t) => t.category)));
  const kinds = Array.from(new Set(templates.map((t) => t.kind)));

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Rule Templates & Suggestions</h1>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            disabled={isUnderTesting}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        </div>

        <UnderTestingState featureName="Rule templates and AI suggestions" />

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="flex items-center space-x-2">
            <Label htmlFor="category-filter">Category:</Label>
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Label htmlFor="kind-filter">Type:</Label>
            <Select value={selectedKind} onValueChange={setSelectedKind}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {kinds.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {kind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Label htmlFor="dataset-filter">Dataset:</Label>
            <Select value={selectedDataset} onValueChange={setSelectedDataset}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select dataset" />
              </SelectTrigger>
              <SelectContent>
                {datasets.map((dataset) => (
                  <SelectItem key={dataset.id} value={dataset.id}>
                    {dataset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="templates" className="w-full">
          <TabsList>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="suggestions">AI Suggestions</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {loading ? (
                <div className="col-span-full text-center py-8">
                  Loading templates...
                </div>
              ) : templates.length === 0 ? (
                <div className="col-span-full text-center py-8">
                  <Sparkles className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-500">No templates found</p>
                  <Button
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="mt-4"
                    disabled={isUnderTesting}
                  >
                    Create your first template
                  </Button>
                </div>
              ) : (
                templates.map((template) => (
                  <Card
                    key={template.id}
                    className="hover:shadow-lg transition-shadow"
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          {template.name}
                        </CardTitle>
                        <Badge variant="outline">{template.category}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="mb-4">
                        {template.description}
                      </CardDescription>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Type:</span>
                          <span>{template.kind}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Usage:</span>
                          <span>{template.usage_count}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedTemplate(template)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedTemplate(template);
                            setIsApplyDialogOpen(true);
                          }}
                          disabled={!selectedDataset || isUnderTesting}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Apply
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="suggestions" className="space-y-4">
            {!selectedDataset ? (
              <div className="text-center py-8">
                <Filter className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">
                  Select a dataset to see AI-powered suggestions
                </p>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-8">
                <Sparkles className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">
                  No suggestions available for this dataset
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  Found {suggestions.length} suggestions for the selected
                  dataset
                </div>

                <div className="space-y-3">
                  {suggestions.map((suggestion) => (
                    <Card
                      key={suggestion.id}
                      className="hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold">
                            {suggestion.suggested_rule_name}
                          </h3>
                          <div
                            className={`px-2 py-1 rounded text-white text-xs ${getConfidenceColor(
                              suggestion.confidence_score,
                            )}`}
                          >
                            {suggestion.confidence_score}% confidence
                          </div>
                        </div>

                        <p className="text-sm text-gray-600 mb-3">
                          {suggestion.reasoning}
                        </p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Badge
                              variant={
                                suggestion.is_applied ? "default" : "secondary"
                              }
                            >
                              {suggestion.is_applied
                                ? "Applied"
                                : "Not Applied"}
                            </Badge>
                            <Badge variant="outline">
                              {suggestion.suggestion_type}
                            </Badge>
                          </div>

                          <div className="flex gap-2">
                            {!suggestion.is_applied && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  markSuggestionApplied(suggestion.id)
                                }
                                disabled={isUnderTesting}
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Apply
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* View Template Dialog */}
        <Dialog
          open={!!selectedTemplate && !isCreateDialogOpen && !isApplyDialogOpen}
          onOpenChange={() => setSelectedTemplate(null)}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Template Details</DialogTitle>
            </DialogHeader>

            {selectedTemplate && (
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input value={selectedTemplate.name} readOnly />
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={selectedTemplate.description}
                    readOnly
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Category</Label>
                    <Input value={selectedTemplate.category} readOnly />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Input value={selectedTemplate.kind} readOnly />
                  </div>
                </div>

                <div>
                  <Label>Parameters</Label>
                  <pre className="p-3 bg-gray-50 rounded text-xs overflow-auto max-h-64">
                    {JSON.stringify(selectedTemplate.template_params, null, 2)}
                  </pre>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Usage Count</Label>
                    <Input
                      value={selectedTemplate.usage_count.toString()}
                      readOnly
                    />
                  </div>
                  <div>
                    <Label>Created By</Label>
                    <Input value={selectedTemplate.created_by} readOnly />
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Apply Template Dialog */}
        <Dialog open={isApplyDialogOpen} onOpenChange={setIsApplyDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Apply Template</DialogTitle>
              <DialogDescription>
                Customize the template before applying it to create a new rule.
              </DialogDescription>
            </DialogHeader>

            {selectedTemplate && (
              <div className="space-y-4">
                <div>
                  <Label>Rule Name</Label>
                  <Input
                    defaultValue={`${selectedTemplate.name} - ${selectedDataset}`}
                    placeholder="Enter rule name"
                  />
                </div>

                <div>
                  <Label>Customizations (JSON)</Label>
                  <Textarea
                    placeholder='{"target_columns": ["column1", "column2"]}'
                    rows={4}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsApplyDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (isUnderTesting) {
                        toast.info(
                          "Template application is under testing and will be available soon.",
                        );
                        return;
                      }
                      const textareaElement = document.querySelector(
                        'textarea[placeholder*="JSON"]',
                      ) as HTMLTextAreaElement;
                      const customizationsText = textareaElement?.value;
                      const customizations = customizationsText
                        ? JSON.parse(customizationsText)
                        : {};
                      applyTemplate(selectedTemplate.id, customizations);
                    }}
                    disabled={isUnderTesting}
                  >
                    Apply Template
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
