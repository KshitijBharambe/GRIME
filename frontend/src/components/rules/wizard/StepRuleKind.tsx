"use client";

import { RuleKind, Criticality } from "@/types/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CheckCircle } from "lucide-react";

const ruleKindOptions: {
  value: RuleKind;
  label: string;
  description: string;
}[] = [
  {
    value: "missing_data",
    label: "Missing Data",
    description: "Detect missing or null values in required fields",
  },
  {
    value: "standardization",
    label: "Standardization",
    description: "Standardize data formats (dates, phones, emails)",
  },
  {
    value: "value_list",
    label: "Value List",
    description: "Validate values against an allowed list",
  },
  {
    value: "length_range",
    label: "Length Range",
    description: "Validate field length constraints",
  },
  {
    value: "char_restriction",
    label: "Character Restriction",
    description: "Restrict to specific character types",
  },
  {
    value: "cross_field",
    label: "Cross Field",
    description: "Validate relationships between multiple fields",
  },
  {
    value: "regex",
    label: "Regex Pattern",
    description: "Validate using regular expression patterns",
  },
  {
    value: "custom",
    label: "Custom Rule",
    description: "Custom validation using expressions or lookup tables",
  },
];

const criticalityOptions: {
  value: Criticality;
  label: string;
  description: string;
}[] = [
  {
    value: "low",
    label: "Low",
    description: "Minor issues that don't affect data usability",
  },
  {
    value: "medium",
    label: "Medium",
    description:
      "Issues that may affect data quality but don't block processing",
  },
  {
    value: "high",
    label: "High",
    description: "Significant issues that affect data reliability",
  },
  {
    value: "critical",
    label: "Critical",
    description:
      "Severe issues that block data processing or compromise integrity",
  },
];

interface StepRuleKindProps {
  name: string;
  description: string;
  kind: RuleKind | "";
  criticality: Criticality | "";
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}

export function StepRuleKind({
  name,
  description,
  kind,
  criticality,
  onChange,
  errors,
}: StepRuleKindProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Rule Name</Label>
        <Input
          id="name"
          placeholder="Enter rule name..."
          value={name}
          onChange={(e) => onChange("name", e.target.value)}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          placeholder="Describe what this rule validates..."
          className="min-h-[80px]"
          value={description}
          onChange={(e) => onChange("description", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Rule Type</Label>
        <div className="grid gap-3 md:grid-cols-2">
          {ruleKindOptions.map((option) => (
            <div
              key={option.value}
              className={`relative p-4 rounded-lg border cursor-pointer transition-colors ${
                kind === option.value
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-muted/50"
              }`}
              onClick={() => onChange("kind", option.value)}
            >
              {kind === option.value && (
                <CheckCircle className="absolute top-3 right-3 h-4 w-4 text-primary" />
              )}
              <div className="font-medium text-sm">{option.label}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {option.description}
              </div>
            </div>
          ))}
        </div>
        {errors.kind && (
          <p className="text-sm text-destructive">{errors.kind}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Criticality</Label>
        <Select
          value={criticality}
          onValueChange={(value) => onChange("criticality", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select criticality level" />
          </SelectTrigger>
          <SelectContent>
            {criticalityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div>
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {option.description}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.criticality && (
          <p className="text-sm text-destructive">{errors.criticality}</p>
        )}
      </div>
    </div>
  );
}
