"use client";

import { useState, useEffect } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { Breadcrumbs } from "./Breadcrumbs";
import { cn } from "@/lib/utils";
import { useAuthenticatedApi } from "@/lib/hooks/useAuthenticatedApi";

interface MainLayoutProps {
  readonly children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  // Ensure token is always synced for every protected page
  useAuthenticatedApi();

  const [sidebarOpen, setSidebarOpen] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);

  // Initialize sidebar state from localStorage after mount
  useEffect(() => {
    const savedState = localStorage.getItem("sidebar-open");
    let initialState: boolean;

    if (savedState === null) {
      // Default to open on desktop, closed on mobile
      initialState = window.innerWidth >= 768;
    } else {
      initialState = JSON.parse(savedState);
    }

    setSidebarOpen(initialState);
    setMounted(true);
  }, []);

  // Persist sidebar state to localStorage whenever it changes (but not on initial mount)
  useEffect(() => {
    if (mounted && sidebarOpen !== null) {
      localStorage.setItem("sidebar-open", JSON.stringify(sidebarOpen));
    }
  }, [sidebarOpen, mounted]);

  // Don't render until state is initialized to prevent flicker
  if (sidebarOpen === null) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header onMenuClick={() => {}} />
        <div className="flex">
          <main className="flex-1 min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    );
  }

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onMenuClick={toggleSidebar} />
      <div className="flex">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main
          className={cn(
            "flex-1 min-h-[calc(100vh-4rem)] transition-[margin] duration-200",
            sidebarOpen ? "ml-0 md:ml-64" : "ml-0",
          )}
        >
          <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
            <Breadcrumbs />
            <div className="flex-1">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
