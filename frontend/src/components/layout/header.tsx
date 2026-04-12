"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Search,
  Settings,
  User,
  LogOut,
  Menu,
  Moon,
  Sun,
  Loader2,
  Database,
  FileText,
  Play,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import { useDashboardOverview } from "@/lib/hooks/useDashboard";
import { useSearch } from "@/lib/hooks/useSearch";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { OrganizationSwitcher } from "@/components/organization-switcher";

interface HeaderProps {
  readonly onMenuClick: () => void;
}

export function Header({ onMenuClick }: Readonly<HeaderProps>) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { data: dashboardData } = useDashboardOverview();
  const searchRef = useRef<HTMLDivElement>(null);

  // Use debounced search for suggestions
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const {
    data: searchResults,
    isLoading,
    error,
  } = useSearch(debouncedQuery, debouncedQuery.length >= 2);

  // Log errors for debugging
  useEffect(() => {
    if (error) {
      console.error("Search suggestions error:", error);
    }
  }, [error]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/auth/login" });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSuggestions(false);
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setShowSuggestions(true);
  };

  const handleResultClick = () => {
    setShowSuggestions(false);
    setSearchQuery("");
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case "page":
        return <Search className="h-4 w-4" />;
      case "dataset":
        return <Database className="h-4 w-4" />;
      case "rule":
        return <FileText className="h-4 w-4" />;
      case "execution":
        return <Play className="h-4 w-4" />;
      case "issue":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const getResultLink = (
    type: string,
    id: string,
    metadata?: Record<string, unknown>,
  ) => {
    // Check if this is a static suggestion with a URL
    if (metadata?.is_static && metadata?.url) {
      return metadata.url;
    }

    switch (type) {
      case "dataset":
        return `/data/datasets?id=${id}`;
      case "rule":
        return `/rules/${id}`;
      case "execution":
        return `/executions/${id}`;
      case "issue":
        return `/issues?id=${id}`;
      default:
        return "#";
    }
  };

  const hasResults = searchResults && searchResults.total_results > 0;
  const shouldShowSuggestions = showSuggestions && searchQuery.length >= 2;
  const unresolvedIssues = dashboardData
    ? Math.max(
        dashboardData.overview.total_issues -
          dashboardData.overview.total_fixes,
        0,
      )
    : 0;
  let suggestionsContent: React.ReactNode = (
    <div className="p-4 text-center text-sm text-muted-foreground">
      No results found for &quot;{searchQuery}&quot;
    </div>
  );

  if (isLoading) {
    suggestionsContent = (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  } else if (hasResults) {
    suggestionsContent = (
      <div className="p-2">
        {/* Page/Action suggestions */}
        {searchResults.pages && searchResults.pages.length > 0 && (
          <div className="mb-2">
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
              Pages & Actions
            </div>
            {searchResults.pages.slice(0, 5).map((result) => (
              <Link
                key={result.id}
                href={getResultLink(result.type, result.id, result.metadata)}
                onClick={handleResultClick}
                className="flex items-start gap-3 rounded px-2 py-2 transition-colors hover:bg-accent"
              >
                <div className="mt-0.5">{getResultIcon(result.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {result.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {result.description}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Dataset results */}
        {searchResults.datasets && searchResults.datasets.length > 0 && (
          <div className="mb-2">
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
              Datasets
            </div>
            {searchResults.datasets.slice(0, 3).map((result) => (
              <Link
                key={result.id}
                href={getResultLink(result.type, result.id, result.metadata)}
                onClick={handleResultClick}
                className="flex items-start gap-3 rounded px-2 py-2 transition-colors hover:bg-accent"
              >
                <div className="mt-0.5">{getResultIcon(result.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {result.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {result.description}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Rule results */}
        {searchResults.rules.length > 0 && (
          <div className="mb-2">
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
              Rules
            </div>
            {searchResults.rules.slice(0, 3).map((result) => (
              <Link
                key={result.id}
                href={getResultLink(result.type, result.id)}
                onClick={handleResultClick}
                className="flex items-start gap-3 rounded px-2 py-2 transition-colors hover:bg-accent"
              >
                <div className="mt-0.5">{getResultIcon(result.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {result.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {result.description}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Execution results */}
        {searchResults.executions.length > 0 && (
          <div className="mb-2">
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
              Executions
            </div>
            {searchResults.executions.slice(0, 3).map((result) => (
              <Link
                key={result.id}
                href={getResultLink(result.type, result.id)}
                onClick={handleResultClick}
                className="flex items-start gap-3 rounded px-2 py-2 transition-colors hover:bg-accent"
              >
                <div className="mt-0.5">{getResultIcon(result.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {result.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {result.description}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Issue results */}
        {searchResults.issues.length > 0 && (
          <div className="mb-2">
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
              Issues
            </div>
            {searchResults.issues.slice(0, 3).map((result) => (
              <Link
                key={result.id}
                href={getResultLink(result.type, result.id)}
                onClick={handleResultClick}
                className="flex items-start gap-3 rounded px-2 py-2 transition-colors hover:bg-accent"
              >
                <div className="mt-0.5">{getResultIcon(result.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {result.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {result.description}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="border-t pt-2 mt-2">
          <Link
            href={`/search?q=${encodeURIComponent(searchQuery)}`}
            onClick={handleResultClick}
            className="block rounded px-2 py-2 text-center text-sm text-primary transition-colors hover:bg-accent"
          >
            View all {searchResults.total_results} results
          </Link>
        </div>
      </div>
    );
  }

  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/95 text-foreground backdrop-blur-md supports-[backdrop-filter]:bg-background/85"
      style={{ boxShadow: "var(--shadow-flat)" }}
    >
      <div className="flex h-16 w-full items-center justify-between gap-4 px-4 lg:px-6">
        {/* Left section */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            aria-label="Toggle navigation menu"
            className="text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-sm font-semibold text-primary"
              style={{ boxShadow: "var(--shadow-flat)" }}
            >
              DF
            </div>
            <div className="hidden min-w-0 md:block">
              <span className="block truncate text-sm font-semibold tracking-[0.18em] text-foreground">
                DATAFORGE
              </span>
              <span className="block text-xs text-muted-foreground">
                Control plane
              </span>
            </div>
          </div>
        </div>

        {/* Center section - Search */}
        <div className="relative flex-1 max-w-xl" ref={searchRef}>
          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search datasets, rules, executions..."
                value={searchQuery}
                onChange={handleInputChange}
                onFocus={() =>
                  searchQuery.length >= 2 && setShowSuggestions(true)
                }
                className="h-10 w-full rounded-lg border-border bg-card pl-9 text-foreground placeholder:text-muted-foreground focus-visible:border-primary"
                style={{ boxShadow: "var(--shadow-flat)" }}
              />
              {isLoading && searchQuery.length >= 2 && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
          </form>

          {/* Search Suggestions Dropdown */}
          {shouldShowSuggestions && (
            <Card className="absolute top-full z-50 mt-2 max-h-96 w-full overflow-y-auto border border-border bg-popover/95 shadow-lg backdrop-blur">
              {suggestionsContent}
            </Card>
          )}
        </div>

        {/* Right section */}
        <div className="flex flex-1 items-center justify-end gap-1 sm:gap-2">
          {/* Organization Switcher */}
          {session?.user && <OrganizationSwitcher />}

          {/* Theme toggle */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          )}

          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="relative text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unresolvedIssues > 0 && (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.55rem] font-bold text-primary-foreground"
                style={{ boxShadow: "var(--shadow-flat)" }}
              >
                {Math.min(unresolvedIssues, 99)}
              </span>
            )}
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 rounded-lg border border-transparent px-2.5 text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground"
              >
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-muted-foreground"
                  style={{ boxShadow: "var(--shadow-flat)" }}
                >
                  <User className="h-4 w-4" />
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-semibold text-foreground">
                    {session?.user?.name}
                  </div>
                  <div className="font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                    {session?.user?.role}
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <div className="font-medium">{session?.user?.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {session?.user?.email}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push("/dashboard/profile")}
              >
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push("/dashboard/settings")}
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
