/**
 * Application-wide frontend constants.
 * Import from here instead of repeating magic numbers across hook/component files.
 */

// ---------------------------------------------------------------------------
// React Query cache timings (milliseconds)
// ---------------------------------------------------------------------------

/** Real-time data: poll every 10 s, treat as stale after 5 s */
export const REALTIME_REFETCH_INTERVAL = 10_000;
export const REALTIME_STALE_TIME = 5_000;

/** Standard list queries: stale after 30 s */
export const LIST_STALE_TIME = 30_000;

/** Single-entity queries: stale after 60 s */
export const ENTITY_STALE_TIME = 60_000;

/** Rarely-changing reference data (e.g. rule kinds): stale after 5 min */
export const STATIC_STALE_TIME = 300_000;

/** Search results: keep in React Query cache for 5 min */
export const SEARCH_GC_TIME = 300_000;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_ISSUES_LIMIT = 50;

// ---------------------------------------------------------------------------
// Retry policy
// ---------------------------------------------------------------------------
export const MAX_QUERY_RETRIES = 3;
