"use client";
import { use } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  useRule,
  useUpdateRule,
  useDeleteRule,
  useActivateRule,
  useDeactivateRule,
} from "@/lib/hooks/useRules";
import { RuleKind, Criticality } from "@/types/api";
import {
  ArrowLeft,
  Shield,
  Play,
  Pause,
  Trash2,
  Save,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils/date";

const updateRuleSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be 255 characters or less"),
  description: z.string().optional(),
  kind: z.enum([
    "missing_data",
    "standardization",
    "value_list",
    "length_range",
    "cross_field",
    "char_restriction",
    "regex",
    "custom",
  ]),
  criticality: z.enum(["low", "medium", "high", "critical"]),
  target_columns: z.string().min(1, "At least one target column is required"),
  params: z.string().optional(),
});

type UpdateRuleFormData = z.infer<typeof updateRuleSchema>;

const criticalityColors: Record<Criticality, string> = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

const ruleKindLabels: Record<RuleKind, string> = {
  missing_data: "Missing Data",
  standardization: "Standardization",
  value_list: "Value List",
  length_range: "Length Range",
  cross_field: "Cross Field",
  char_restriction: "Character Restriction",
  regex: "Regex Pattern",
  custom: "Custom Rule",
};

const criticalityOptions: { value: Criticality; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const ruleKindOptions: { value: RuleKind; label: string }[] = [
  { value: "missing_data", label: "Missing Data" },
  { value: "standardization", label: "Standardization" },
  { value: "value_list", label: "Value List" },
  { value: "length_range", label: "Length Range" },
  { value: "char_restriction", label: "Character Restriction" },
  { value: "cross_field", label: "Cross Field" },
  { value: "regex", label: "Regex Pattern" },
  { value: "custom", label: "Custom Rule" },
];

export default function RuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const { data: rule, isLoading, error } = useRule(id);
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();
  const activateRule = useActivateRule();
  const deactivateRule = useDeactivateRule();

  const form = useForm<UpdateRuleFormData>({
    resolver: zodResolver(updateRuleSchema),
    values: rule
      ? {
          name: rule.name,
          description: rule.description || "",
          kind: rule.kind,
          criticality: rule.criticality,
          target_columns: Array.isArray(rule.target_columns)
            ? rule.target_columns.join(", ")
            : rule.target_columns || "",
          params: (() => {
            // Handle params - it might be a string or object
            if (!rule.params) return "";
            if (typeof rule.params === 'string') {
              try {
                // If it's already valid JSON string, parse and re-stringify for formatting
                const parsed = JSON.parse(rule.params);
                return JSON.stringify(parsed, null, 2);
              } catch {
                // If parsing fails, return as-is
                return rule.params;
              }
            }
            // If it's already an object, stringify it
            return JSON.stringify(rule.params, null, 2);
          })(),
        }
      : undefined,
  });

  const onSubmit = async (data: UpdateRuleFormData) => {
    if (!rule) return;

    try {
      // Parse target columns and params
      const targetColumns = data.target_columns
        .split(",")
        .map((col) => col.trim())
        .filter(Boolean);
      
      // Build the payload object
      const payload: Record<string, unknown> = {
        name: data.name,
        kind: data.kind,
        criticality: data.criticality,
        target_columns: targetColumns,
      };

      // Only add description if it has a value
      if (data.description && data.description.trim()) {
        payload.description = data.description;
      }

      // Only add params if it's valid JSON
      if (data.params && data.params.trim()) {
        try {
          const parsedParams = JSON.parse(data.params);
          payload.params = parsedParams;
        } catch {
          form.setError("params", {
            message: "Invalid JSON format in parameters",
          });
          return;
        }
      }

      await updateRule.mutateAsync({
        id: rule.id,
        data: payload,
      });

      setIsEditing(false);
    } catch (error: unknown) {
      // Log detailed error information
      const axiosError = error as { response?: { data?: { detail?: unknown }; status?: number; headers?: unknown } };
      
      // Show user-friendly error message
      if (axiosError.response?.status === 422) {
        const detail = axiosError.response.data?.detail;
        if (Array.isArray(detail)) {
          // Pydantic validation errors
          const errors = detail.map((err: { loc: string[]; msg: string }) => 
            `${err.loc.join('.')}: ${err.msg}`
          ).join(', ');
          alert(`Validation error: ${errors}`);
        } else {
          alert(`Validation error: ${detail || 'Invalid data format'}`);
        }
      }
    }
  };

  const handleActivateToggle = () => {
    if (!rule) return;

    if (rule.is_active) {
      deactivateRule.mutate(rule.id);
    } else {
      activateRule.mutate(rule.id);
    }
  };

  const handleDelete = () => {
    if (!rule) return;

    if (
      confirm(
        "Are you sure you want to delete this rule? This action cannot be undone."
      )
    ) {
      deleteRule.mutate(rule.id, {
        onSuccess: () => {
          router.push("/rules");
        },
      });
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading rule...</div>
        </div>
      </MainLayout>
    );
  }

  if (error || !rule) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-red-600">
            {error
              ? `Error loading rule: ${(error as Error).message}`
              : "Rule not found"}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/rules">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Shield className="h-8 w-8" />
                {rule.name}
              </h1>
              <p className="text-muted-foreground mt-2">
                {rule.description || "No description provided"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <>
                <Button
                  variant="outline"
                  onClick={handleActivateToggle}
                  disabled={activateRule.isPending || deactivateRule.isPending}
                >
                  {rule.is_active ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Activate
                    </>
                  )}
                </Button>
                <Button onClick={() => setIsEditing(true)}>Edit Rule</Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteRule.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {isEditing ? (
              <Card>
                <CardHeader>
                  <CardTitle>Edit Rule</CardTitle>
                  <CardDescription>
                    Update the configuration for this quality rule
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(onSubmit)}
                      className="space-y-6"
                    >
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rule Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="kind"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rule Type</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {ruleKindOptions.map((option) => (
                                    <SelectItem
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="criticality"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Criticality</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {criticalityOptions.map((option) => (
                                    <SelectItem
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="target_columns"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Target Columns</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormDescription>
                              Comma-separated list of column names
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="params"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Parameters (JSON)</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                className="min-h-[150px] font-mono text-sm"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex gap-4">
                        <Button type="submit" disabled={updateRule.isPending}>
                          <Save className="h-4 w-4 mr-2" />
                          {updateRule.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsEditing(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Rule Configuration</CardTitle>
                  <CardDescription>
                    Current configuration for this quality rule
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Type
                      </div>
                      <div className="mt-1">
                        <Badge variant="outline">
                          {ruleKindLabels[rule.kind] || rule.kind}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Criticality
                      </div>
                      <div className="mt-1">
                        <Badge className={criticalityColors[rule.criticality]}>
                          {rule.criticality}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Target Columns
                    </div>
                    <div className="mt-1">
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {Array.isArray(rule.target_columns)
                          ? rule.target_columns.join(", ")
                          : rule.target_columns}
                      </code>
                    </div>
                  </div>

                  {rule.params && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Parameters
                      </div>
                      <div className="mt-1">
                        <pre className="text-sm bg-muted p-3 rounded overflow-x-auto">
                          {JSON.stringify(rule.params, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Rule Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={rule.is_active ? "default" : "secondary"}>
                    {rule.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Created</span>
                  <span className="text-sm">
                    {formatDate(rule.created_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Updated</span>
                  <span className="text-sm">
                    {formatDate(rule.updated_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Created by
                  </span>
                  <span className="text-sm">{rule.created_by}</span>
                </div>
              </CardContent>
            </Card>

            {!rule.is_active && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2 text-yellow-800">
                    <AlertTriangle className="h-4 w-4" />
                    Inactive Rule
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-yellow-700">
                    This rule is currently inactive and will not be executed
                    during quality checks.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
