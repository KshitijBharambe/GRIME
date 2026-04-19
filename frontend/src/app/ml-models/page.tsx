"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Eye,
  Trash2,
  Brain,
  Activity,
  BarChart3,
  TrendingUp,
  RefreshCw,
  Loader2,
  AlertCircle,
  Download,
  Play,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Dataset, DatasetVersion } from "@/types/api";

interface MLModel {
  id: string;
  name: string;
  model_type: string;
  version: string;
  is_active: boolean;
  training_dataset_id: string;
  training_metrics: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
  model_metadata: Record<string, unknown>;
}

interface AnomalyScore {
  id: string;
  row_index: number;
  anomaly_score: number;
  features_used: string;
  feature_values: string;
  threshold_used: number;
  created_at: string;
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

export default function MLModelsPage() {
  const { data: session } = useSession();
  const isGuest = session?.user?.accountType === "guest";
  const { hasToken } = useAuthenticatedApi();
  const [models, setModels] = useState<MLModel[]>([]);
  const [anomalyScores] = useState<AnomalyScore[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetVersions, setDatasetVersions] = useState<DatasetVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<MLModel | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [trainingInProgress, setTrainingInProgress] = useState(false);

  // Fetch models
  const fetchModels = async () => {
    try {
      const response = await apiClient.get("/advanced/ml-models");
      const data = response.data as { models: MLModel[] };
      setModels(data.models || []);
    } catch (error) {
      if (getHttpStatus(error) === 404) {
        setModels([]);
        return;
      }
      console.error("Error fetching ML models:", error);
      toast.error("Failed to fetch ML models");
    }
  };

  // Fetch datasets
  const fetchDatasets = async () => {
    try {
      const response = await apiClient.getDatasets();
      setDatasets(response.items || []);
    } catch (error) {
      console.error("Error fetching datasets:", error);
    }
  };

  // Fetch dataset versions
  const fetchDatasetVersions = async (datasetId: string) => {
    try {
      const response = await apiClient.getDatasetVersions(datasetId);
      setDatasetVersions(response || []);
    } catch (error) {
      if (getHttpStatus(error) === 404) {
        setDatasetVersions([]);
        toast.info("Dataset versions are unavailable in this environment");
        return;
      }
      console.error("Error fetching dataset versions:", error);
    }
  };

  // Train new model
  const trainModel = async (trainingData: {
    model_name: string;
    model_type: string;
    dataset_version_id: string;
    feature_columns: string[];
    model_params?: Record<string, unknown>;
  }) => {
    try {
      setTrainingInProgress(true);
      const response = await apiClient.post(
        "/advanced/ml-models/train",
        trainingData,
      );
      const data = response.data as { task_id: string };
      toast.success(`Model training started: ${data.task_id}`);
      setIsCreateDialogOpen(false);
      await fetchModels();
    } catch (error) {
      console.error("Error training model:", error);
      toast.error("Failed to start model training");
    } finally {
      setTrainingInProgress(false);
    }
  };

  // Delete model
  const deleteModel = async (modelId: string) => {
    if (!confirm("Are you sure you want to delete this model?")) return;
    try {
      await apiClient.delete(`/advanced/ml-models/${modelId}`);
      toast.success("Model deleted successfully");
      await fetchModels();
    } catch (error) {
      console.error("Error deleting model:", error);
      toast.error("Failed to delete model");
    }
  };

  // Toggle model active status
  const toggleModelStatus = async (modelId: string, currentStatus: boolean) => {
    try {
      await apiClient.patch(`/advanced/ml-models/${modelId}/status`, {
        is_active: !currentStatus,
      });
      toast.success(`Model ${!currentStatus ? "activated" : "deactivated"}`);
      await fetchModels();
    } catch (error) {
      console.error("Error updating model status:", error);
      toast.error("Failed to update model status");
    }
  };

  useEffect(() => {
    if (!hasToken) return;
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchModels(), fetchDatasets()]);
      setLoading(false);
    };
    loadData();
  }, [hasToken]);

  useEffect(() => {
    if (selectedDataset) {
      fetchDatasetVersions(selectedDataset);
    } else {
      setDatasetVersions([]);
      setSelectedVersion("");
    }
  }, [selectedDataset]);

  const getModelTypeIcon = (type: string): React.ReactNode => {
    switch (type) {
      case "isolation_forest":
        return <Brain className="h-4 w-4" />;
      case "one_class_svm":
        return <Activity className="h-4 w-4" />;
      case "local_outlier_factor":
        return <BarChart3 className="h-4 w-4" />;
      default:
        return <TrendingUp className="h-4 w-4" />;
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? "bg-green-500" : "bg-gray-500";
  };

  const getScoreColor = (score: number, threshold: number) => {
    if (score > threshold) return "bg-red-500";
    return "bg-green-500";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              ML Models & Anomaly Detection
            </h1>
            <p className="text-muted-foreground mt-2">
              Train and manage machine learning models for anomaly detection
            </p>
          </div>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            disabled={datasets.length === 0 || isGuest}
          >
            <Plus className="mr-2 h-4 w-4" />
            Train New Model
          </Button>
        </div>

        {datasets.length === 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No datasets available. Please upload a dataset first to train ML
              models.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="models" className="w-full">
          <TabsList>
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="anomaly-scores">Anomaly Scores</TabsTrigger>
          </TabsList>

          <TabsContent value="models" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {models.length} model{models.length !== 1 ? "s" : ""} available
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchModels}
                disabled={loading}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {loading ? (
                <div className="col-span-full flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">Loading models...</p>
                </div>
              ) : models.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-12">
                  <Brain className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">
                    No ML models found
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Train your first model to start detecting anomalies
                  </p>
                  <Button
                    onClick={() => setIsCreateDialogOpen(true)}
                    disabled={datasets.length === 0 || isGuest}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Train Model
                  </Button>
                </div>
              ) : (
                models.map((model) => (
                  <Card
                    key={model.id}
                    className="hover:shadow-lg transition-shadow"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getModelTypeIcon(model.model_type)}
                          <CardTitle className="text-lg">
                            {model.name}
                          </CardTitle>
                        </div>
                        <Badge
                          className={`${getStatusColor(
                            model.is_active,
                          )} text-white`}
                          variant="outline"
                        >
                          {model.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="mb-4">
                        Anomaly detection model using{" "}
                        {model.model_type.replace(/_/g, " ")}
                      </CardDescription>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Version:
                          </span>
                          <span>{model.version}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Created:
                          </span>
                          <span>{formatDate(model.created_at)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Created By:
                          </span>
                          <span>{model.created_by}</span>
                        </div>
                      </div>

                      {model.training_metrics &&
                        Object.keys(model.training_metrics).length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <div className="text-sm font-medium mb-2">
                              Training Metrics
                            </div>
                            <div className="space-y-1 text-xs">
                              {typeof model.training_metrics.total_samples ===
                                "number" && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Samples:
                                  </span>
                                  <span>
                                    {String(
                                      model.training_metrics.total_samples,
                                    )}
                                  </span>
                                </div>
                              )}
                              {typeof model.training_metrics.feature_count ===
                                "number" && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Features:
                                  </span>
                                  <span>
                                    {String(
                                      model.training_metrics.feature_count,
                                    )}
                                  </span>
                                </div>
                              )}
                              {model.training_metrics.anomaly_rate !==
                                undefined && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Anomaly Rate:
                                  </span>
                                  <span>
                                    {(
                                      100 *
                                      (model.training_metrics
                                        .anomaly_rate as number)
                                    ).toFixed(2)}
                                    %
                                  </span>
                                </div>
                              )}
                              {model.training_metrics.training_score_mean !==
                                undefined && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Avg Score:
                                  </span>
                                  <span>
                                    {(
                                      model.training_metrics
                                        .training_score_mean as number
                                    )?.toFixed(3)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                      <div className="flex gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedModel(model)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                        <Button
                          variant={model.is_active ? "secondary" : "default"}
                          size="sm"
                          onClick={() =>
                            toggleModelStatus(model.id, model.is_active)
                          }
                          disabled={isGuest}
                        >
                          {model.is_active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteModel(model.id)}
                          disabled={isGuest}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="anomaly-scores" className="space-y-4">
            <div className="flex gap-4 items-center">
              <div className="flex items-center space-x-2">
                <Label htmlFor="model-filter">Model:</Label>
                <Select
                  value={selectedModel?.id || ""}
                  onValueChange={(value) =>
                    setSelectedModel(models.find((m) => m.id === value) || null)
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!selectedModel ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Brain className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">
                  Select a model to view anomaly scores
                </p>
                <p className="text-sm text-muted-foreground">
                  Anomaly scores show how unusual each data point is according
                  to the model
                </p>
              </div>
            ) : anomalyScores.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Activity className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">
                  No anomaly scores found for this model
                </p>
                <p className="text-sm text-muted-foreground">
                  Run an execution with this model to generate anomaly scores
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Found {anomalyScores.length} anomaly score
                    {anomalyScores.length !== 1 ? "s" : ""} for{" "}
                    {selectedModel.name}
                  </p>
                  <Button variant="outline" size="sm" disabled={isGuest}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>

                <div className="space-y-3">
                  {anomalyScores.slice(0, 50).map((score) => (
                    <Card
                      key={score.id}
                      className="hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-medium">Row {score.row_index}</h3>
                          <Badge
                            className={`${getScoreColor(
                              score.anomaly_score,
                              score.threshold_used,
                            )} text-white`}
                          >
                            {score.anomaly_score.toFixed(2)}% anomaly
                          </Badge>
                        </div>

                        <div className="space-y-2 text-sm mb-3">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Threshold:
                            </span>
                            <span>{score.threshold_used}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Features Used:
                            </span>
                            <span>
                              {JSON.parse(score.features_used).length}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Detected:
                            </span>
                            <span>{formatDate(score.created_at)}</span>
                          </div>
                        </div>

                        <Progress
                          value={score.anomaly_score}
                          max={100}
                          className="h-2"
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {anomalyScores.length > 50 && (
                  <div className="text-center py-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Showing first 50 of {anomalyScores.length} scores
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      disabled={isGuest}
                    >
                      Load More
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* View Model Dialog */}
        <Dialog
          open={!!selectedModel && !isCreateDialogOpen}
          onOpenChange={() => setSelectedModel(null)}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Model Details</DialogTitle>
              <DialogDescription>
                Complete information about this ML model
              </DialogDescription>
            </DialogHeader>

            {selectedModel && (
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input value={selectedModel.name} readOnly className="mt-1" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Type</Label>
                    <Input
                      value={selectedModel.model_type.replace(/_/g, " ")}
                      readOnly
                      className="mt-1 capitalize"
                    />
                  </div>
                  <div>
                    <Label>Version</Label>
                    <Input
                      value={selectedModel.version}
                      readOnly
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Status</Label>
                    <div
                      className={`mt-1 px-3 py-2 rounded-md text-center text-white font-medium ${getStatusColor(
                        selectedModel.is_active,
                      )}`}
                    >
                      {selectedModel.is_active ? "Active" : "Inactive"}
                    </div>
                  </div>
                  <div>
                    <Label>Created By</Label>
                    <Input
                      value={selectedModel.created_by}
                      readOnly
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label>Training Dataset ID</Label>
                  <Input
                    value={selectedModel.training_dataset_id}
                    readOnly
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Created At</Label>
                    <Input
                      value={formatDate(selectedModel.created_at)}
                      readOnly
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Last Updated</Label>
                    <Input
                      value={formatDate(selectedModel.updated_at)}
                      readOnly
                      className="mt-1"
                    />
                  </div>
                </div>

                {selectedModel.training_metrics &&
                  Object.keys(selectedModel.training_metrics).length > 0 && (
                    <div>
                      <Label>Training Metrics</Label>
                      <div className="mt-1 p-4 bg-muted rounded-md">
                        <pre className="text-xs overflow-auto max-h-64 font-mono">
                          {JSON.stringify(
                            selectedModel.training_metrics,
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    </div>
                  )}

                {selectedModel.model_metadata &&
                  Object.keys(selectedModel.model_metadata).length > 0 && (
                    <div>
                      <Label>Model Metadata</Label>
                      <div className="mt-1 p-4 bg-muted rounded-md">
                        <pre className="text-xs overflow-auto max-h-64 font-mono">
                          {JSON.stringify(
                            selectedModel.model_metadata,
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    </div>
                  )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Train Model Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Train ML Model</DialogTitle>
              <DialogDescription>
                Train a new anomaly detection model on your dataset. This
                process may take several minutes depending on the dataset size.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const trainingData = {
                  model_name: formData.get("model_name") as string,
                  model_type: formData.get("model_type") as string,
                  dataset_version_id: selectedVersion,
                  feature_columns: (formData.get("feature_columns") as string)
                    ?.split(",")
                    .map((s: string) => s.trim())
                    .filter((s: string) => s.length > 0),
                };

                if (
                  !trainingData.feature_columns ||
                  trainingData.feature_columns.length === 0
                ) {
                  toast.error("Please enter at least one feature column");
                  return;
                }

                trainModel(trainingData);
              }}
            >
              <div className="space-y-4">
                <div>
                  <Label htmlFor="model_name">Model Name *</Label>
                  <Input
                    id="model_name"
                    name="model_name"
                    placeholder="e.g., My Anomaly Detector"
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="model_type">Model Type *</Label>
                  <Select
                    name="model_type"
                    required
                    defaultValue="isolation_forest"
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select model type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="isolation_forest">
                        Isolation Forest (Recommended)
                      </SelectItem>
                      <SelectItem value="one_class_svm">
                        One-Class SVM
                      </SelectItem>
                      <SelectItem value="local_outlier_factor">
                        Local Outlier Factor
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Isolation Forest works well for most datasets
                  </p>
                </div>

                <div>
                  <Label htmlFor="dataset_id">Dataset *</Label>
                  <Select
                    name="dataset_id"
                    value={selectedDataset}
                    onValueChange={(value) => {
                      setSelectedDataset(value);
                      setSelectedVersion("");
                    }}
                    required
                  >
                    <SelectTrigger className="mt-1">
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

                <div>
                  <Label htmlFor="dataset_version">Dataset Version *</Label>
                  <Select
                    name="dataset_version"
                    value={selectedVersion}
                    onValueChange={setSelectedVersion}
                    required
                    disabled={!selectedDataset || datasetVersions.length === 0}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue
                        placeholder={
                          !selectedDataset
                            ? "Select dataset first"
                            : datasetVersions.length === 0
                              ? "No versions available"
                              : "Select version"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {datasetVersions.map((version) => (
                        <SelectItem key={version.id} value={version.id}>
                          Version {version.version_no} (
                          {formatDate(version.created_at)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="feature_columns">Feature Columns *</Label>
                  <Textarea
                    id="feature_columns"
                    name="feature_columns"
                    placeholder="column1, column2, column3"
                    required
                    rows={3}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter the column names you want to use for training,
                    separated by commas
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      setSelectedDataset("");
                      setSelectedVersion("");
                    }}
                    disabled={trainingInProgress}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={trainingInProgress || isGuest}
                    className="flex-1"
                  >
                    {trainingInProgress ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Training...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Start Training
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
