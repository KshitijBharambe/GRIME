"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCreateRule } from "@/lib/hooks/useRules";
import { RuleKind, Criticality } from "@/types/api";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { StepRuleKind } from "./wizard/StepRuleKind";
import { StepColumns } from "./wizard/StepColumns";
import { StepParameters } from "./wizard/StepParameters";
import { StepTest } from "./wizard/StepTest";
import { StepReview } from "./wizard/StepReview";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "kind", label: "Rule Kind" },
  { id: "columns", label: "Target Columns" },
  { id: "params", label: "Parameters" },
  { id: "test", label: "Test" },
  { id: "review", label: "Review & Create" },
] as const;

interface WizardState {
  name: string;
  description: string;
  kind: RuleKind | "";
  criticality: Criticality | "";
  target_columns: string[];
  datasetId: string;
  params: Record<string, unknown>;
  rawJson: string;
  useJsonMode: boolean;
}

const initialState: WizardState = {
  name: "",
  description: "",
  kind: "",
  criticality: "",
  target_columns: [],
  datasetId: "",
  params: {},
  rawJson: "",
  useJsonMode: false,
};

export function RuleCreationWizard() {
  const router = useRouter();
  const createRule = useCreateRule();
  const [currentStep, setCurrentStep] = useState(0);
  const [state, setState] = useState<WizardState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = useCallback((field: string, value: unknown) => {
    setState((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 0: // Rule Kind
        if (!state.name.trim()) newErrors.name = "Name is required";
        if (state.name.length > 255)
          newErrors.name = "Name must be 255 characters or less";
        if (!state.kind) newErrors.kind = "Select a rule type";
        if (!state.criticality)
          newErrors.criticality = "Select a criticality level";
        break;
      case 1: // Columns
        if (state.target_columns.length === 0)
          newErrors.target_columns = "At least one target column is required";
        break;
      case 2: // Parameters
        if (state.useJsonMode && state.rawJson.trim()) {
          try {
            JSON.parse(state.rawJson);
          } catch {
            newErrors.rawJson = "Invalid JSON format";
          }
        }
        break;
      // Steps 3 (test) and 4 (review) have no required validation
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  };

  const goBack = () => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const buildParams = (): Record<string, unknown> => {
    if (state.useJsonMode && state.rawJson.trim()) {
      try {
        return JSON.parse(state.rawJson);
      } catch {
        return {};
      }
    }

    // Transform guided params based on kind
    const params = { ...state.params };

    // For value_list, split textarea into array
    if (
      state.kind === "value_list" &&
      typeof params.allowed_values === "string"
    ) {
      params.allowed_values = (params.allowed_values as string)
        .split("\n")
        .map((v: string) => v.trim())
        .filter(Boolean);
    }

    // For regex, wrap pattern into patterns array
    if (state.kind === "regex" && params.pattern) {
      params.patterns = [
        {
          pattern: params.pattern,
          name: params.pattern_name || "pattern",
          must_match: params.must_match ?? true,
        },
      ];
      delete params.pattern;
      delete params.pattern_name;
      delete params.must_match;
    }

    // For cross_field, wrap into rules array
    if (state.kind === "cross_field" && params.type) {
      params.rules = [
        {
          type: params.type,
          dependent_field: params.dependent_field,
          required_field: params.required_field,
        },
      ];
      delete params.type;
      delete params.dependent_field;
      delete params.required_field;
    }

    // Add columns to params where the API expects them
    if (
      [
        "missing_data",
        "standardization",
        "value_list",
        "length_range",
        "char_restriction",
      ].includes(state.kind)
    ) {
      params.columns = state.target_columns;
    }

    return params;
  };

  const handleSubmit = async () => {
    if (!state.kind || !state.criticality) return;

    try {
      await createRule.mutateAsync({
        name: state.name,
        description: state.description || undefined,
        kind: state.kind,
        criticality: state.criticality,
        target_columns: state.target_columns,
        params: buildParams(),
      });
      router.push("/rules");
    } catch (error) {
      console.error("Failed to create rule:", error);
    }
  };

  const wizardDataForTest = {
    name: state.name,
    kind: state.kind as RuleKind,
    criticality: state.criticality as Criticality,
    target_columns: state.target_columns,
    params: buildParams(),
  };

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <nav aria-label="Progress">
        <ol className="flex items-center">
          {STEPS.map((step, index) => (
            <li
              key={step.id}
              className={cn(
                "relative flex-1",
                index !== STEPS.length - 1 && "pr-4",
              )}
            >
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (index < currentStep) setCurrentStep(index);
                  }}
                  disabled={index > currentStep}
                  className={cn(
                    "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-medium transition-colors",
                    index < currentStep &&
                      "border-primary bg-primary text-primary-foreground cursor-pointer",
                    index === currentStep &&
                      "border-primary bg-background text-primary",
                    index > currentStep &&
                      "border-muted bg-background text-muted-foreground cursor-not-allowed",
                  )}
                >
                  {index < currentStep ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </button>
                {index !== STEPS.length - 1 && (
                  <div
                    className={cn(
                      "ml-2 h-0.5 flex-1",
                      index < currentStep ? "bg-primary" : "bg-muted",
                    )}
                  />
                )}
              </div>
              <span
                className={cn(
                  "absolute -bottom-6 left-0 text-xs whitespace-nowrap",
                  index <= currentStep
                    ? "text-foreground font-medium"
                    : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      {/* Step Content */}
      <Card className="mt-10">
        <CardContent className="pt-6">
          {currentStep === 0 && (
            <StepRuleKind
              name={state.name}
              description={state.description}
              kind={state.kind}
              criticality={state.criticality}
              onChange={handleChange}
              errors={errors}
            />
          )}
          {currentStep === 1 && (
            <StepColumns
              selectedColumns={state.target_columns}
              datasetId={state.datasetId}
              onChange={handleChange}
              errors={errors}
            />
          )}
          {currentStep === 2 && state.kind && (
            <StepParameters
              kind={state.kind as RuleKind}
              params={state.params}
              rawJson={state.rawJson}
              useJsonMode={state.useJsonMode}
              onChange={handleChange}
              errors={errors}
            />
          )}
          {currentStep === 3 && state.kind && (
            <StepTest wizardData={wizardDataForTest} />
          )}
          {currentStep === 4 && state.kind && state.criticality && (
            <StepReview
              wizardData={{
                name: state.name,
                description: state.description,
                kind: state.kind as RuleKind,
                criticality: state.criticality as Criticality,
                target_columns: state.target_columns,
                params: buildParams(),
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={currentStep === 0 ? () => router.push("/rules") : goBack}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {currentStep === 0 ? "Cancel" : "Back"}
        </Button>

        {currentStep < STEPS.length - 1 ? (
          <Button type="button" onClick={goNext} className="gap-2">
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={createRule.isPending}
            className="gap-2"
          >
            {createRule.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {createRule.isPending ? "Creating..." : "Create Rule"}
          </Button>
        )}
      </div>
    </div>
  );
}
