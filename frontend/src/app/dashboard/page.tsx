"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/main-layout";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { QualityOverview } from "@/components/dashboard/quality-overview";
import { DashboardDetailTabs } from "@/components/dashboard/DashboardDetailTabs";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/auth/login");
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Dashboard
              </p>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Welcome back
                  {session?.user?.name ? `, ${session.user.name}` : ""}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                  Monitor dataset quality, review open issues, and move from
                  upload to execution from one place.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
              <Button asChild size="sm">
                <Link href="/data/upload">Upload data</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/executions/create">Run checks</Link>
              </Button>
            </div>
          </div>
        </div>

        <OnboardingWizard />

        <StatsCards />

        <QualityOverview />
        <DashboardDetailTabs />
      </div>
    </MainLayout>
  );
}
