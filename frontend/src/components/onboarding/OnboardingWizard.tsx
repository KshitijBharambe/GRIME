"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  X,
  Upload,
  Database,
  FlaskConical,
  CheckSquare,
  Play,
  ChevronRight,
  ArrowRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDashboardOverview } from "@/lib/hooks/useDashboard";
import { useRules } from "@/lib/hooks/useRules";

const ONBOARDING_KEY = "onboarding-v2-completed";

// ── Step definitions ─────────────────────────────────────────────

const WIZARD_STEPS = [
  { id: "source", label: "Data source" },
  { id: "check", label: "Quality check" },
  { id: "run", label: "Run & see results" },
] as const;

type StepId = (typeof WIZARD_STEPS)[number]["id"];

// ── Step 1 ───────────────────────────────────────────────────────

function Step1Source({ onNext }: { onNext: (href: string) => void }) {
  const options = [
    {
      icon: Upload,
      title: "Upload a file",
      description: "CSV, JSON, or Parquet — import directly.",
      href: "/data/upload",
    },
    {
      icon: Database,
      title: "Connect a database",
      description: "PostgreSQL, MySQL, Snowflake, or S3.",
      href: "/data-sources",
    },
    {
      icon: FlaskConical,
      title: "Use sample data",
      description: "Built-in dataset to explore immediately.",
      href: "/data-sources?source=local_simulator",
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Where is the data you want to validate?
      </p>
      <div className="space-y-2">
        {options.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.href}
              onClick={() => onNext(opt.href)}
              className="w-full flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 hover:border-primary/30"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted border border-border">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{opt.title}</p>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 2 ───────────────────────────────────────────────────────

function Step2Check({
  hasRules,
  isLoading,
}: {
  hasRules: boolean;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Choose or create a quality check to run on your data.
      </p>
      <div className="space-y-2">
        <Link
          href="/templates"
          className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40 hover:border-primary/30"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted border border-border">
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Browse templates</p>
            <p className="text-xs text-muted-foreground">
              Pre-built checks for null values, ranges, uniqueness, and more.
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>

        <Link
          href="/rules/create"
          className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40 hover:border-primary/30"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted border border-border">
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Create a rule</p>
            <p className="text-xs text-muted-foreground">
              Define a custom constraint for your specific data.
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>

        {!isLoading && hasRules && (
          <Link
            href="/rules"
            className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40 hover:border-primary/30"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900">
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Use existing rules</p>
              <p className="text-xs text-muted-foreground">
                You already have rules — pick one to run.
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Step 3 ───────────────────────────────────────────────────────

function Step3Run() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Apply your rules to a dataset and review every violation.
      </p>
      <Link
        href="/executions/create"
        className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-3 transition-colors hover:bg-primary/10"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
          <Play className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Run your first check</p>
          <p className="text-xs text-muted-foreground">
            Select dataset + rules, then view results.
          </p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
      </Link>
      <p className="text-xs text-muted-foreground">
        Results appear in{" "}
        <Link href="/issues" className="text-primary hover:underline underline-offset-2">
          Issues
        </Link>{" "}
        and{" "}
        <Link href="/executions" className="text-primary hover:underline underline-offset-2">
          Executions
        </Link>
        .
      </p>
    </div>
  );
}

// ── Wizard ───────────────────────────────────────────────────────

export function OnboardingWizard() {
  const [dismissed, setDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const { data: overview, isLoading: overviewLoading } = useDashboardOverview();
  const { data: rulesData, isLoading: rulesLoading } = useRules(1, 1);

  useEffect(() => {
    setDismissed(localStorage.getItem(ONBOARDING_KEY) === "true");
    setMounted(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setDismissed(true);
  };

  if (!mounted || dismissed) return null;

  const isLoading = overviewLoading || rulesLoading;
  const hasDatasets = (overview?.overview?.total_datasets ?? 0) > 0;
  const hasRules = (rulesData?.total ?? 0) > 0;
  const hasExecutions = (overview?.overview?.total_executions ?? 0) > 0;

  // Auto-advance past completed steps on first mount
  const completedSteps: Record<StepId, boolean> = {
    source: !isLoading && hasDatasets,
    check: !isLoading && hasRules,
    run: !isLoading && hasExecutions,
  };

  const allDone = !isLoading && Object.values(completedSteps).every(Boolean);

  const stepCount = WIZARD_STEPS.length;

  function handleNext(href?: string) {
    if (href) {
      window.location.href = href;
    } else if (currentStep < stepCount - 1) {
      setCurrentStep((p) => p + 1);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Getting started
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Step {currentStep + 1} of {stepCount}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={dismiss}
          className="h-7 w-7 shrink-0"
          aria-label="Dismiss guide"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1.5">
        {WIZARD_STEPS.map((step, i) => {
          const done = completedSteps[step.id];
          const active = i === currentStep;
          return (
            <button
              key={step.id}
              onClick={() => setCurrentStep(i)}
              className={cn(
                "flex-1 h-1.5 rounded-full transition-colors",
                done
                  ? "bg-emerald-500"
                  : active
                    ? "bg-primary"
                    : "bg-muted",
              )}
              aria-label={step.label}
            />
          );
        })}
      </div>

      {/* Step title */}
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {WIZARD_STEPS[currentStep].label}
      </p>

      {/* All done state */}
      {allDone ? (
        <div className="flex flex-col items-center text-center gap-3 py-3">
          <p className="text-sm font-medium text-foreground">
            You&apos;re all set — every step is complete.
          </p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Your first quality workflow is up and running.
          </p>
          <Button size="sm" variant="outline" onClick={dismiss}>
            Dismiss
          </Button>
        </div>
      ) : (
        <>
          {currentStep === 0 && <Step1Source onNext={handleNext} />}
          {currentStep === 1 && (
            <Step2Check hasRules={hasRules} isLoading={isLoading} />
          )}
          {currentStep === 2 && <Step3Run />}

          {/* Nav buttons */}
          <div className="flex items-center justify-between pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setCurrentStep((p) => Math.max(0, p - 1))}
              disabled={currentStep === 0}
            >
              Back
            </Button>
            {currentStep < stepCount - 1 && (
              <Button
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => setCurrentStep((p) => p + 1)}
              >
                Next
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
