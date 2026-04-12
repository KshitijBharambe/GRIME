"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const labelMap: Record<string, string> = {
  dashboard: "Dashboard",
  data: "Data Management",
  upload: "Upload",
  datasets: "Datasets",
  profile: "Data Profile",
  rules: "Rules",
  create: "Create",
  executions: "Executions",
  issues: "Issues",
  reports: "Reports",
  quality: "Quality",
  export: "Export",
  search: "Search",
  settings: "Settings",
  team: "Team",
  requests: "Requests",
  compartments: "Compartments",
  admin: "Administration",
  users: "Users",
  debug: "Debug",
  templates: "Templates",
  "ml-models": "ML Models",
};

function formatSegment(segment: string): string {
  return (
    labelMap[segment] ||
    segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ")
  );
}

export function Breadcrumbs() {
  const pathname = usePathname();

  if (!pathname || pathname === "/dashboard") return null;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const isLast = index === segments.length - 1;
    return { label: formatSegment(segment), href, isLast };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 text-sm text-muted-foreground mb-4"
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Home</span>
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5" />
          {crumb.isLast ? (
            <span
              className={cn(
                "font-medium text-foreground truncate max-w-[200px]",
              )}
            >
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="hover:text-foreground transition-colors truncate max-w-[200px]"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
