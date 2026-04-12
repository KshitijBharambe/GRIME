"use client";


import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDashboardOverview } from "@/lib/hooks/useDashboard";
import { useRules } from "@/lib/hooks/useRules";

const ONBOARDING_KEY = "onboarding-v2-completed";
const ONBOARDING_COLLAPSED_KEY = "onboarding-v2-collapsed";

interface StepDef {
  id: string;
  num: string;
  title: string;
  description: string;
  href: string;
}

const STEPS: StepDef[] = [
  {
    id: "upload",
    num: "01",
    title: "Upload a dataset",
    description: "Import CSV, JSON, or Parquet to start profiling your data.",
    href: "/data/upload",
  },
  {
    id: "rules",
    num: "02",
    title: "Define quality rules",
    description: "Set validation constraints on your data columns.",
    href: "/rules/create",
  },
  {
    id: "execution",
    num: "03",
    title: "Run an execution",
    description: "Apply your rules to a dataset and surface every violation.",
    href: "/executions/create",
  },
  {
    id: "results",
    num: "04",
    title: "Explore your results",
    description: "Review flagged issues and track data quality over time.",
    href: "/issues",
  },
];

export function OnboardingWizard() {
  const [dismissed, setDismissed] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { data: overview, isLoading: overviewLoading } = useDashboardOverview();
  const { data: rulesData, isLoading: rulesLoading } = useRules(1, 1);

  useEffect(() => {
    setDismissed(localStorage.getItem(ONBOARDING_KEY) === "true");
    setCollapsed(localStorage.getItem(ONBOARDING_COLLAPSED_KEY) === "true");
    setMounted(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setDismissed(true);
  };

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(ONBOARDING_COLLAPSED_KEY, next.toString());
  };

  if (!mounted || dismissed) return null;

  const isLoading = overviewLoading || rulesLoading;
  const stats = overview?.overview;

  const completedMap: Record<string, boolean> = {
    upload: !isLoading && (stats?.total_datasets ?? 0) > 0,
    rules: !isLoading && (rulesData?.total ?? 0) > 0,
    execution: !isLoading && (stats?.total_executions ?? 0) > 0,
    results:
      !isLoading &&
      ((stats?.total_executions ?? 0) > 0 || (stats?.total_issues ?? 0) > 0),
  };

  const completedCount = STEPS.filter((s) => completedMap[s.id]).length;
  const allDone = !isLoading && completedCount === STEPS.length;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Getting started
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 h-4">
            {isLoading ? (
              <span className="inline-block h-3 w-28 rounded bg-muted animate-pulse align-middle" />
            ) : (
              `${completedCount} of ${STEPS.length} steps complete`
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="h-7 w-7"
            aria-label={collapsed ? "Expand guide" : "Collapse guide"}
          >
            {collapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={dismiss}
            className="h-7 w-7"
            aria-label="Dismiss guide"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      {!collapsed && (
        <div className="h-1.5 w-full bg-muted rounded-full mt-3 mb-4 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{
              width: `${(completedCount / STEPS.length) * 100}%`,
            }}
          />
        </div>
      )}

      {/* Body */}
      {!collapsed && (
        <>
          {allDone ? (
            <div className="flex flex-col items-center text-center gap-3 py-3">
              <p className="text-sm font-medium text-foreground">
                You&apos;re all set — every step is complete.
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Your first quality workflow is up and running. Keep exploring or
                dismiss this guide.
              </p>
              <Button size="sm" variant="outline" onClick={dismiss}>
                Dismiss
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {STEPS.map((step) => {
                const done = completedMap[step.id];
                return (
                  <div
                    key={step.id}
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 transition-colors",
                      done ? "bg-muted/30" : "bg-muted/20 hover:bg-muted/40"
                    )}
                  >
                    {/* Step number + text */}
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className={cn(
                          "text-[11px] font-mono font-semibold shrink-0 mt-px leading-tight",
                          done
                            ? "text-muted-foreground/50"
                            : "text-muted-foreground"
                        )}
                      >
                        {step.num}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium leading-tight",
                            done && "line-through text-muted-foreground"
                          )}
                        >
                          {step.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>

                    {/* Badge */}
                    <div className="shrink-0 ml-2">
                      {isLoading ? (
                        <span className="inline-block h-5 w-14 rounded-full bg-muted animate-pulse" />
                      ) : done ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3 w-3" />
                          Complete
                        </span>
                      ) : (
                        <Link
                          href={step.href}
                          className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline underline-offset-2"
                        >
                          Start&nbsp;&rarr;
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
                  {current.description}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {current.detail}
                </p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col lg:items-stretch">
            <Button asChild size="sm" className="sm:min-w-36">
              <Link href={current.href}>
                {current.actionLabel}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                step < STEPS.length - 1 ? setStep(step + 1) : dismiss()
              }
              className="sm:min-w-36"
            >
              {step < STEPS.length - 1 ? "Next step" : "Finish guide"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {STEPS.map((item, index) => {
            const Icon = item.icon;
            const stateLabel =
              index === step
                ? "Current"
                : index < step
                  ? "Available"
                  : `Step ${index + 1}`;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setStep(index)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                  index === step
                    ? "border-foreground/15 bg-muted/30"
                    : "border-border/70 bg-background hover:bg-muted/20",
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                    index < step
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : index === step
                        ? "border-foreground/15 bg-background text-foreground"
                        : "border-border bg-background text-muted-foreground",
                  )}
                >
                  {index < step ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{item.title}</span>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {stateLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          Progress is saved in this browser, so you can return later without
          losing your place.
        </p>
      </div>
    </div>
  );
}
