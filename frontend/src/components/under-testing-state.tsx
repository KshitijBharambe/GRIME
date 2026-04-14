import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnderTestingStateProps {
  featureName: string;
  className?: string;
}

export function UnderTestingState({
  featureName,
  className,
}: Readonly<UnderTestingStateProps>) {
  return (
    <section
      className={cn(
        "rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900 shadow-sm",
        "dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-300 bg-amber-100/70 dark:border-amber-800 dark:bg-amber-900/50">
          <FlaskConical className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">
            {featureName} is under testing
          </p>
          <p className="mt-1 text-sm leading-6">
            This functionality is currently under testing and will be available
            soon. You can preview the interface now, while non-functional
            actions are temporarily disabled.
          </p>
        </div>
      </div>
    </section>
  );
}
