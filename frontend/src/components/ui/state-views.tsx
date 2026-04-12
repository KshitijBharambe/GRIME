"use client";

import { AlertTriangle, Inbox, RefreshCw, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/* ═══════════════════════════════════════════════════════════════
   Reusable loading / empty / error state components
   Styled to match the project's neumorphic (card-te) design.
   ═══════════════════════════════════════════════════════════════ */

// ── Loading State ──────────────────────────────────────────────

interface LoadingStateProps {
  /** Number of skeleton rows to render (default 4) */
  rows?: number;
  /** Optional message shown below the skeletons */
  message?: string;
  /** Additional className on the outer wrapper */
  className?: string;
}

export function LoadingState({
  rows = 4,
  message,
  className,
}: Readonly<LoadingStateProps>) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={`loading-skeleton-row-${i}`}
          className="card-te p-4 space-y-3"
        >
          <div className="h-0.5 bg-border animate-pulse" />
          <div className="flex justify-between items-center">
            <div className="h-2.5 w-20 bg-muted animate-pulse rounded-sm" />
            <div className="h-7 w-7 bg-muted animate-pulse rounded-sm" />
          </div>
          <div className="h-4 w-16 bg-muted animate-pulse rounded-sm" />
          <div className="h-0.5 bg-border" />
        </div>
      ))}
      {message && <p className="label-te text-center pt-1">{message}</p>}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title = "Nothing here yet",
  description,
  action,
  className,
}: Readonly<EmptyStateProps>) {
  return (
    <div
      className={cn(
        "card-te flex flex-col items-center justify-center py-10 px-6 text-center",
        className,
      )}
    >
      <div
        className="h-10 w-10 rounded-sm flex items-center justify-center mb-3"
        style={{
          boxShadow: "var(--shadow-pressed)",
          background: "var(--background)",
        }}
      >
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <span className="label-te mb-1">{title}</span>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          size="sm"
          className="mt-4 text-xs"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

// ── Error State ────────────────────────────────────────────────

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  message = "Something went wrong",
  onRetry,
  className,
}: Readonly<ErrorStateProps>) {
  return (
    <div
      className={cn(
        "card-te flex flex-col items-center justify-center py-10 px-6 text-center",
        className,
      )}
    >
      <div
        className="h-10 w-10 rounded-sm flex items-center justify-center mb-3"
        style={{
          boxShadow: "var(--shadow-pressed)",
          background: "var(--background)",
        }}
      >
        <AlertTriangle className="h-5 w-5 text-destructive" />
      </div>
      <span className="label-te text-destructive mb-1">{message}</span>
      {onRetry && (
        <Button
          onClick={onRetry}
          size="sm"
          className="mt-4 text-xs gap-1.5"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      )}
    </div>
  );
}
