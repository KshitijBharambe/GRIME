"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Database,
  Shield,
  Play,
  AlertTriangle,
  FileText,
  Settings,
  Users,
  ChevronDown,
  ChevronRight,
  Home,
  Upload,
  FileSpreadsheet,
  CheckSquare,
  Activity,
  Download,
  X,
  Brain,
  Lightbulb,
  Bug,
  Zap,
  FolderTree,
  UserPlus,
  Cable,
  Layers,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { useDashboardOverview } from "@/lib/hooks/useDashboard";
import { usePendingRequestsCount } from "@/lib/hooks/usePendingRequests";
import { DashboardOverview } from "@/types/api";

interface SidebarProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

interface NavItem {
  readonly section?: string;
  readonly title: string;
  readonly href?: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly badge?: string | number;
  readonly children?: readonly NavItem[];
  readonly roles?: readonly string[];
  readonly guestRestricted?: boolean;
  readonly underTesting?: boolean;
}

// Helper function to check if a menu item has an active child or grandchild
function hasActiveChild(item: NavItem, pathname: string): boolean {
  if (!item.children) return false;

  return item.children.some((child) => {
    if (child.href === pathname) return true;
    if (child.children) {
      return child.children.some((grandchild) => grandchild.href === pathname);
    }
    return false;
  });
}

function getNavigationItems(
  dashboardData: DashboardOverview | undefined,
  pendingRequestsCount: number = 0,
): NavItem[] {
  return [
    {
      section: "Workspace",
      title: "Dashboard",
      href: "/dashboard",
      icon: Home,
    },
    {
      title: "Data",
      icon: Database,
      children: [
        {
          title: "Upload Data",
          href: "/data/upload",
          icon: Upload,
        },
        {
          title: "Datasets",
          href: "/data/datasets",
          icon: FileSpreadsheet,
          badge: dashboardData?.overview.total_datasets?.toString(),
        },
        {
          title: "Data Profile",
          href: "/data/profile",
          icon: BarChart3,
        },
        {
          title: "Data Sources",
          href: "/data-sources",
          icon: Database,
        },
        {
          title: "Webhooks",
          href: "/connectors/webhooks",
          icon: Zap,
        },
      ],
    },
    {
      title: "Rules",
      icon: Shield,
      children: [
        {
          title: "All Rules",
          href: "/rules",
          icon: CheckSquare,
        },
        {
          title: "Create Rule",
          href: "/rules/create",
          icon: Settings,
        },
        {
          title: "Block Builder",
          href: "/rules/builder",
          icon: Layers,
        },
      ],
    },
    {
      title: "Runs",
      icon: Activity,
      children: [
        {
          title: "Run Rules",
          href: "/executions/create",
          icon: Play,
        },
        {
          title: "All Executions",
          href: "/executions",
          icon: Activity,
          badge: dashboardData?.overview.total_executions?.toString(),
        },
      ],
    },
    {
      title: "Issues",
      href: "/issues",
      icon: AlertTriangle,
      badge: dashboardData
        ? (
            dashboardData.overview.total_issues -
            dashboardData.overview.total_fixes
          )?.toString()
        : undefined,
    },
    {
      section: "Insights",
      title: "Reports",
      icon: FileText,
      children: [
        {
          title: "Quality Reports",
          href: "/reports/quality",
          icon: BarChart3,
        },
        {
          title: "Export Data",
          href: "/reports/export",
          icon: Download,
        },
      ],
    },
    {
      title: "Platform",
      icon: Cable,
      children: [
        {
          title: "ML Models",
          href: "/ml-models",
          icon: Brain,
        },
        {
          title: "Rule Templates",
          href: "/templates",
          icon: Lightbulb,
        },
        {
          title: "Debug Tools",
          href: "/debug",
          icon: Bug,
        },
      ],
    },
    {
      section: "Administration",
      title: "Organization",
      icon: Users,
      roles: ["owner", "admin"],
      guestRestricted: true,
      children: [
        {
          title: "Team Management",
          href: "/dashboard/team",
          icon: Users,
          roles: ["owner", "admin"],
        },
        {
          title: "Requests",
          href: "/dashboard/requests",
          icon: FileText,
          badge:
            pendingRequestsCount > 0
              ? pendingRequestsCount.toString()
              : undefined,
        },
        {
          title: "Compartments",
          href: "/dashboard/compartments",
          icon: FolderTree,
          roles: ["owner", "admin"],
        },
        {
          title: "Settings",
          href: "/dashboard/settings",
          icon: Settings,
          roles: ["owner", "admin"],
        },
      ],
    },
    {
      title: "Administration",
      icon: Settings,
      roles: ["admin"],
      guestRestricted: true,
      children: [
        {
          title: "Users",
          href: "/admin/users",
          icon: Users,
          roles: ["admin"],
        },
        {
          title: "System Settings",
          href: "/admin/settings",
          icon: Settings,
          roles: ["admin"],
        },
      ],
    },
  ];
}

function NavItemComponent({
  item,
  level = 0,
  isExpanded = false,
  onToggleExpanded,
  navigatingTo,
  onNavigate,
}: Readonly<{
  item: NavItem;
  level?: number;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  navigatingTo?: string | null;
  onNavigate?: (href: string) => void;
}>) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isActive = item.href === pathname;
  const hasActiveChild = item.children?.some(
    (child) =>
      child.href === pathname ||
      child.children?.some((grandchild) => grandchild.href === pathname),
  );

  const isGuestUser = session?.user?.accountType === "guest";

  // Check if user has permission to see this item - after hooks
  if (item.roles && !item.roles.includes(session?.user?.role || "")) {
    return null;
  }

  // Hide guest-restricted items for guest users
  if (item.guestRestricted && isGuestUser) {
    return null;
  }

  // Hide under-testing items for guest users; non-guests see a "Beta" badge
  if (item.underTesting && isGuestUser) {
    return null;
  }

  // For items with children, use the expanded state from parent
  // For items without children, expand if they have active children
  const shouldBeExpanded = item.children ? isExpanded || hasActiveChild : false;

  const handleClick = () => {
    if (item.href && onNavigate) {
      onNavigate(item.href);
    }

    if (item.children && onToggleExpanded) {
      onToggleExpanded();
    }
  };

  const isNavigatingToItem = Boolean(item.href && navigatingTo === item.href);

  const itemContent = (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-150",
        level > 0 && "rounded-lg py-2 text-[0.9375rem]",
        isActive
          ? "border-[var(--sidebar-border)] bg-[var(--sidebar-accent)] text-[var(--sidebar-foreground)] shadow-sm"
          : "border-transparent text-[var(--sidebar-foreground)] hover:border-[var(--sidebar-border)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]",
        hasActiveChild &&
          !isActive &&
          "border-[var(--sidebar-border)] bg-[var(--sidebar-accent)]",
      )}
    >
      <item.icon
        className={cn(
          "h-4 w-4 shrink-0",
          isActive
            ? "text-[var(--sidebar-primary)]"
            : "text-[var(--muted-foreground)] group-hover:text-[var(--sidebar-foreground)]",
        )}
      />
      <span className="flex-1 text-sm font-medium truncate">{item.title}</span>
      <div className="ml-auto flex items-center gap-2">
        {isNavigatingToItem && (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        )}
        {item.badge && (
          <span
            className={cn(
              "rounded-full border px-1.5 py-0.5 text-[0.6rem] font-mono font-bold uppercase tracking-wider",
              isActive
                ? "border-[var(--sidebar-border)] bg-background text-[var(--sidebar-primary)]"
                : "border-[var(--sidebar-border)] bg-background text-[var(--muted-foreground)]",
            )}
          >
            {item.badge}
          </span>
        )}
        {item.underTesting && (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[0.6rem] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Beta
          </span>
        )}
        {item.children && (
          <div className="opacity-60">
            {shouldBeExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-1">
      {level === 0 && item.section && (
        <div className="px-3 pb-2 pt-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)] first:pt-0">
          {item.section}
        </div>
      )}
      {item.href ? (
        <Link
          href={item.href}
          onClick={handleClick}
          aria-current={isActive ? "page" : undefined}
        >
          {itemContent}
        </Link>
      ) : (
        <button
          onClick={handleClick}
          className="w-full text-left"
          aria-expanded={shouldBeExpanded}
          aria-label={`${item.title} menu`}
        >
          {itemContent}
        </button>
      )}

      {item.children && shouldBeExpanded && (
        <div className="mt-2 space-y-1 border-l border-[var(--sidebar-border)] pl-3 ml-4">
          {item.children.map((child) => (
            <NavItemComponent
              key={child.title}
              item={child}
              level={level + 1}
              isExpanded={false}
              onToggleExpanded={undefined}
              navigatingTo={navigatingTo}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ isOpen, onClose }: Readonly<SidebarProps>) {
  const { data: dashboardData } = useDashboardOverview();
  const { data: session } = useSession();
  const pendingRequestsCount = usePendingRequestsCount();
  const navigationItems = getNavigationItems(
    dashboardData,
    pendingRequestsCount,
  );
  const isGuest = session?.user?.accountType === "guest";
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(
    {},
  );
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // Initialize expanded states from localStorage
  useEffect(() => {
    const savedStates = localStorage.getItem("sidebar-expanded-items");
    if (savedStates) {
      setExpandedItems(JSON.parse(savedStates));
    }
    setMounted(true);
  }, []);

  // Auto-expand items with active children
  useEffect(() => {
    setNavigatingTo(null);

    if (mounted && navigationItems) {
      setExpandedItems((prev) => {
        const newExpandedItems = { ...prev };
        let hasChanges = false;

        for (const item of navigationItems) {
          if (item.children) {
            const isActiveItem = hasActiveChild(item, pathname);

            if (isActiveItem && !newExpandedItems[item.title]) {
              newExpandedItems[item.title] = true;
              hasChanges = true;
            }
          }
        }

        return hasChanges ? newExpandedItems : prev;
      });
    }
  }, [pathname, mounted, navigationItems]);

  // Persist expanded states to localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(
        "sidebar-expanded-items",
        JSON.stringify(expandedItems),
      );
    }
  }, [expandedItems, mounted]);

  const toggleExpanded = (itemTitle: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemTitle]: !prev[itemTitle],
    }));
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-slate-950/30 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-label="Close navigation overlay"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-16 z-30 h-[calc(100vh-4rem)] w-64",
          mounted && "transition-transform duration-200 ease-in-out",
          "bg-[var(--sidebar)] text-[var(--sidebar-foreground)] border-r border-[var(--sidebar-border)]",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ boxShadow: "var(--shadow-panel)" }}
      >
        <div className="flex h-full flex-col">
          {/* Mobile close button */}
          <div className="flex items-center justify-between border-b border-[var(--sidebar-border)] px-4 py-4 md:hidden">
            <span className="text-sm font-semibold">Navigation</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close navigation"
              className="text-[var(--muted-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <nav className="space-y-2">
              {!mounted ? (
                navigationItems.map((item) => (
                  <div key={item.title} className="space-y-1">
                    {item.section && (
                      <div className="px-3 pb-2 pt-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)] first:pt-0">
                        {item.section}
                      </div>
                    )}
                    <div className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-[var(--sidebar-foreground)]">
                      <item.icon className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                      <span className="flex-1 text-sm font-medium truncate">{item.title}</span>
                      {item.children && (
                        <div className="opacity-60">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                navigationItems.map((item) => (
                  <NavItemComponent
                    key={item.title}
                    item={item}
                    isExpanded={expandedItems[item.title] || false}
                    onToggleExpanded={() => toggleExpanded(item.title)}
                    navigatingTo={navigatingTo}
                    onNavigate={setNavigatingTo}
                  />
                ))
              )}
            </nav>
          </div>

          {/* Guest sign-up CTA */}
          {isGuest && (
            <div className="border-t border-[var(--sidebar-border)] p-4">
              <Link href="/auth/register">
                <Button className="w-full" size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Sign Up Free
                </Button>
              </Link>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
