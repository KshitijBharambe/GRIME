"use client";

import { useState } from "react";
import { RuleKind, Criticality, RuleCreate } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle, Loader2, Play } from "lucide-react";
import apiClient from "@/lib/api";

interface StepTestProps {
  wizardData: {
    name: string;
    kind: RuleKind;
    criticality: Criticality;
    target_columns: string[];
    params: Record<string, unknown>;
  };
}

export function StepTest({ wizardData }: StepTestProps) {
  const [sampleData, setSampleData] = useState("");
  const [testResult, setTestResult] = useState<unknown>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const generateSampleTemplate = () => {
    const columns = wizardData.target_columns;
    const row: Record<string, string> = {};
    columns.forEach((col) => {
      row[col] = "";
    });
    setSampleData(JSON.stringify([row, row], null, 2));
  };

  const runTest = async () => {
    setTesting(true);
    setTestError(null);
    setTestResult(null);

    let parsed: Record<string, unknown>[];
    try {
      parsed = JSON.parse(sampleData);
      if (!Array.isArray(parsed)) {
        setTestError("Sample data must be a JSON array of objects");
        setTesting(false);
        return;
      }
    } catch {
      setTestError("Invalid JSON format");
      setTesting(false);
      return;
    }

    try {
      // Create a temporary rule to test against
      const tempRule: RuleCreate = {
        name: `__test_${Date.now()}`,
        kind: wizardData.kind,
        criticality: wizardData.criticality,
        target_columns: wizardData.target_columns,
        params: wizardData.params,
      };

      const created = await apiClient.createRule(tempRule);
      try {
        const result = await apiClient.testRule(created.id, {
          sample_data: parsed,
        });
        setTestResult(result);
      } finally {
        // Clean up temporary rule
        await apiClient.deleteRule(created.id).catch(() => {});
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Test failed";
      setTestError(message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-medium">
          Test Rule Against Sample Data
        </Label>
        <p className="text-sm text-muted-foreground mt-1">
          Provide sample data to preview how this rule will behave. This step is
          optional.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="sample-data">Sample Data (JSON array)</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={generateSampleTemplate}
          >
            Generate Template
          </Button>
        </div>
        <Textarea
          id="sample-data"
          className="min-h-[200px] font-mono text-sm"
          placeholder='[{"column1": "value1"}, {"column1": "value2"}]'
          value={sampleData}
          onChange={(e) => setSampleData(e.target.value)}
        />
      </div>

      <Button
        type="button"
        onClick={runTest}
        disabled={testing || !sampleData.trim()}
        className="gap-2"
      >
        {testing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        {testing ? "Testing..." : "Run Test"}
      </Button>

      {testError && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  Test Failed
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {testError}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {testResult !== null && (
        <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Test Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto max-h-[300px]">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {!sampleData && testResult === null && (
        <Card className="border-dashed">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground text-center py-4">
              You can skip this step and test the rule later from the rule
              detail page.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
