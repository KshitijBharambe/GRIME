"use client";

import { RuleKind, Criticality } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const ruleKindLabels: Record<RuleKind, string> = {
  missing_data: "Missing Data",
  standardization: "Standardization",
  value_list: "Value List",
  length_range: "Length Range",
  cross_field: "Cross Field",
  char_restriction: "Character Restriction",
  regex: "Regex Pattern",
  custom: "Custom Rule",
};

const criticalityColors: Record<Criticality, string> = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

interface StepReviewProps {
  wizardData: {
    name: string;
    description: string;
    kind: RuleKind;
    criticality: Criticality;
    target_columns: string[];
    params: Record<string, unknown>;
  };
}

export function StepReview({ wizardData }: StepReviewProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Review the rule configuration below before creating it.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{wizardData.name}</CardTitle>
          {wizardData.description && (
            <p className="text-sm text-muted-foreground">
              {wizardData.description}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Rule Type
              </p>
              <p className="text-sm mt-1">{ruleKindLabels[wizardData.kind]}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Criticality
              </p>
              <Badge
                className={`mt-1 ${criticalityColors[wizardData.criticality]}`}
              >
                {wizardData.criticality.charAt(0).toUpperCase() +
                  wizardData.criticality.slice(1)}
              </Badge>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Target Columns
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {wizardData.target_columns.map((col) => (
                <Badge key={col} variant="secondary">
                  {col}
                </Badge>
              ))}
            </div>
          </div>

          {Object.keys(wizardData.params).length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Parameters
                </p>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto mt-2">
                  {JSON.stringify(wizardData.params, null, 2)}
                </pre>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
