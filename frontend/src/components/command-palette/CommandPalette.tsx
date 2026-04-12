"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  Upload,
  FileSpreadsheet,
  BarChart3,
  CheckSquare,
  Settings,
  Play,
  Activity,
  AlertTriangle,
  Download,
  Brain,
  Lightbulb,
  Bug,
  Search,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  label: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  keywords?: string[];
}

const commands: CommandItem[] = [
  // Navigation
  {
    id: "dashboard",
    label: "Dashboard",
    group: "Navigation",
    icon: Home,
    href: "/dashboard",
  },
  {
    id: "upload",
    label: "Upload Data",
    group: "Navigation",
    icon: Upload,
    href: "/data/upload",
  },
  {
    id: "datasets",
    label: "Datasets",
    group: "Navigation",
    icon: FileSpreadsheet,
    href: "/data/datasets",
  },
  {
    id: "data-profile",
    label: "Data Profile",
    group: "Navigation",
    icon: BarChart3,
    href: "/data/profile",
  },
  {
    id: "rules",
    label: "All Rules",
    group: "Rules",
    icon: CheckSquare,
    href: "/rules",
  },
  {
    id: "create-rule",
    label: "Create Rule",
    group: "Rules",
    icon: Settings,
    href: "/rules/create",
    keywords: ["new", "add"],
  },
  {
    id: "run-rules",
    label: "Run Rules",
    group: "Actions",
    icon: Play,
    href: "/executions/create",
    keywords: ["execute", "start"],
  },
  {
    id: "executions",
    label: "All Executions",
    group: "Actions",
    icon: Activity,
    href: "/executions",
  },
  {
    id: "issues",
    label: "Issues",
    group: "Navigation",
    icon: AlertTriangle,
    href: "/issues",
  },
  {
    id: "quality-reports",
    label: "Quality Reports",
    group: "Navigation",
    icon: BarChart3,
    href: "/reports/quality",
  },
  {
    id: "export",
    label: "Export Data",
    group: "Actions",
    icon: Download,
    href: "/reports/export",
  },
  {
    id: "ml-models",
    label: "ML Models",
    group: "Navigation",
    icon: Brain,
    href: "/ml-models",
  },
  {
    id: "templates",
    label: "Rule Templates",
    group: "Navigation",
    icon: Lightbulb,
    href: "/templates",
  },
  {
    id: "debug",
    label: "Debug Tools",
    group: "Navigation",
    icon: Bug,
    href: "/debug",
  },
  {
    id: "search",
    label: "Search",
    group: "Actions",
    icon: Search,
    href: "/search",
    keywords: ["find", "query"],
  },
];

const groups = ["Navigation", "Rules", "Actions"];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Cmd+K / Ctrl+K handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filtered = query.trim()
    ? commands.filter((cmd) => {
        const q = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(q) ||
          cmd.group.toLowerCase().includes(q) ||
          cmd.keywords?.some((kw) => kw.includes(q))
        );
      })
    : commands;

  const groupedFiltered = groups
    .map((group) => ({
      group,
      items: filtered.filter((cmd) => cmd.group === group),
    }))
    .filter((g) => g.items.length > 0);

  const flatFiltered = groupedFiltered.flatMap((g) => g.items);

  const handleSelect = useCallback(
    (item: CommandItem) => {
      setOpen(false);
      setQuery("");
      setSelectedIndex(0);
      router.push(item.href);
    },
    [router],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, flatFiltered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && flatFiltered[selectedIndex]) {
        e.preventDefault();
        handleSelect(flatFiltered[selectedIndex]);
      }
    },
    [flatFiltered, selectedIndex, handleSelect],
  );

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && flatFiltered[selectedIndex]) {
      const el = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`,
      );
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, flatFiltered]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  let flatIndex = -1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="p-0 gap-0 max-w-lg overflow-hidden"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="border-0 focus-visible:ring-0 shadow-none h-11"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div
          ref={listRef}
          className="max-h-[300px] overflow-y-auto p-2"
          role="listbox"
        >
          {groupedFiltered.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </div>
          ) : (
            groupedFiltered.map(({ group, items }) => (
              <div key={group} role="group" aria-label={group}>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  {group}
                </div>
                {items.map((item) => {
                  flatIndex++;
                  const idx = flatIndex;
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      role="option"
                      aria-selected={selectedIndex === idx}
                      onClick={() => handleSelect(item)}
                      className={cn(
                        "flex items-center gap-3 w-full px-2 py-2 rounded-md text-sm transition-colors",
                        selectedIndex === idx
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/50",
                      )}
                    >
                      <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="border-t px-3 py-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1">↑↓</kbd> Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1">↵</kbd> Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1">Esc</kbd> Close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
