"use client";

import { useState } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import apiClient from "@/lib/api";
import { toast } from "sonner";

interface RuleSuggestion {
  rule_kind: string;
  target_columns: string[];
  confidence: number;
  reasoning: string;
  source: string;
}

interface IssueAnalysis {
  summary: string;
  top_patterns: string[];
  recommended_fixes: { description: string; priority: string }[];
  source: string;
}

interface AIAssistantProps {
  mode: "rules" | "issues";
  datasetId?: string;
  issueIds?: string[];
  onApplySuggestion?: (suggestion: RuleSuggestion) => void;
}

export function AIAssistant({
  mode,
  datasetId,
  issueIds = [],
  onApplySuggestion,
}: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ruleSuggestions, setRuleSuggestions] = useState<RuleSuggestion[]>([]);
  const [issueAnalysis, setIssueAnalysis] = useState<IssueAnalysis | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      if (mode === "rules" && datasetId) {
        const response = await apiClient.post("/ai/rule-suggestions", {
          dataset_id: datasetId,
        });
        const data = response.data as { suggestions: RuleSuggestion[] };
        setRuleSuggestions(data.suggestions ?? []);
        setIsOpen(true);
      } else if (mode === "issues") {
        const response = await apiClient.post("/ai/analyze-issues", {
          issue_ids: issueIds,
          dataset_id: datasetId,
        });
        setIssueAnalysis(response.data as IssueAnalysis);
        setIsOpen(true);
      }
    } catch {
      toast.error("AI analysis unavailable. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  const confidenceBadgeVariant = (confidence: number) => {
    if (confidence >= 0.85) return "default";
    if (confidence >= 0.6) return "secondary";
    return "outline";
  };

  return (
    <div className="rounded-lg border border-dashed border-purple-300 bg-purple-50/40 dark:border-purple-800 dark:bg-purple-950/20">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
            AI Assistant
          </span>
          <Badge variant="outline" className="text-xs border-purple-300 text-purple-600">
            Preview
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-purple-600 hover:text-purple-700 hover:bg-purple-100"
            onClick={handleAnalyze}
            disabled={loading || (mode === "rules" && !datasetId)}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            {mode === "rules" ? "Suggest Rules" : "Analyze Issues"}
          </Button>
          {(ruleSuggestions.length > 0 || issueAnalysis) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsOpen((v) => !v)}
            >
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-purple-200 dark:border-purple-800 p-3 space-y-3">
          {mode === "rules" && ruleSuggestions.length > 0 && (
            <div className="space-y-2">
              {ruleSuggestions.map((s, i) => (
                <Card key={i} className="border-purple-200">
                  <CardHeader className="pb-2 pt-3 px-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{s.rule_kind.replace(/_/g, " ")}</CardTitle>
                      <Badge variant={confidenceBadgeVariant(s.confidence)}>
                        {Math.round(s.confidence * 100)}% confidence
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">{s.reasoning}</CardDescription>
                  </CardHeader>
                  {s.target_columns.length > 0 && (
                    <CardContent className="pt-0 px-3 pb-3">
                      <div className="flex flex-wrap gap-1 mb-2">
                        {s.target_columns.map((col) => (
                          <Badge key={col} variant="outline" className="text-xs">
                            {col}
                          </Badge>
                        ))}
                      </div>
                      {onApplySuggestion && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-purple-300 text-purple-600 hover:bg-purple-50"
                          onClick={() => onApplySuggestion(s)}
                        >
                          Apply Suggestion
                        </Button>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}

          {mode === "issues" && issueAnalysis && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{issueAnalysis.summary}</p>
              {issueAnalysis.recommended_fixes.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-purple-700">Recommended fixes</p>
                  {issueAnalysis.recommended_fixes.map((fix, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="text-xs">
                        {fix.priority}
                      </Badge>
                      <span>{fix.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
