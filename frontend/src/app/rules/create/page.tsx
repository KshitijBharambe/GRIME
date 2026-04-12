"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { RuleCreationWizard } from "@/components/rules/RuleCreationWizard";
import { Wand2 } from "lucide-react";

export default function CreateRulePage() {
  return (
    <MainLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wand2 className="h-8 w-8" />
            Create Quality Rule
          </h1>
          <p className="text-muted-foreground mt-2">
            Follow the steps below to define a new data quality validation rule
          </p>
        </div>

        <RuleCreationWizard />
      </div>
    </MainLayout>
  );
}
