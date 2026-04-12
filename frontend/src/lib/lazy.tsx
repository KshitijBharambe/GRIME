import dynamic from "next/dynamic";

// Lazy-loaded heavy components — use these instead of direct imports
// on pages where these components are below the fold or conditionally rendered.

export const LazyDataProfilingView = dynamic(
  () =>
    import("@/components/data-profiling/DataProfilingView").then((m) => ({
      default: m.DataProfilingView,
    })),
  {
    ssr: false,
    loading: () => null,
  },
);

export const LazyExecutionHeatmap = dynamic(
  () =>
    import("@/components/executions/ExecutionHeatmap").then((m) => ({
      default: m.ExecutionHeatmap,
    })),
  {
    ssr: false,
    loading: () => null,
  },
);

export const LazyRuleCreationWizard = dynamic(
  () =>
    import("@/components/rules/RuleCreationWizard").then((m) => ({
      default: m.RuleCreationWizard,
    })),
  {
    ssr: false,
    loading: () => null,
  },
);
