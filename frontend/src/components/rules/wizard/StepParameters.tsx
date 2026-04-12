"use client";

import { RuleKind } from "@/types/api";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const paramsTemplates: Record<
  RuleKind,
  { label: string; fields: ParamField[] }
> = {
  missing_data: {
    label: "Missing Data",
    fields: [
      {
        key: "default_value",
        label: "Default Value",
        type: "text",
        placeholder: "Value to suggest when field is empty",
      },
    ],
  },
  standardization: {
    label: "Standardization",
    fields: [
      {
        key: "type",
        label: "Standardization Type",
        type: "select",
        options: ["date", "phone", "email", "name", "address"],
      },
      {
        key: "format",
        label: "Target Format",
        type: "text",
        placeholder: "e.g., %Y-%m-%d for dates",
      },
    ],
  },
  value_list: {
    label: "Value List",
    fields: [
      {
        key: "allowed_values",
        label: "Allowed Values",
        type: "textarea",
        placeholder: "One value per line",
      },
      { key: "case_sensitive", label: "Case Sensitive", type: "switch" },
    ],
  },
  length_range: {
    label: "Length Range",
    fields: [
      {
        key: "min_length",
        label: "Minimum Length",
        type: "number",
        placeholder: "0",
      },
      {
        key: "max_length",
        label: "Maximum Length",
        type: "number",
        placeholder: "255",
      },
    ],
  },
  char_restriction: {
    label: "Character Restriction",
    fields: [
      {
        key: "type",
        label: "Character Type",
        type: "select",
        options: ["alphabetic", "numeric", "alphanumeric", "ascii"],
      },
    ],
  },
  cross_field: {
    label: "Cross Field",
    fields: [
      {
        key: "type",
        label: "Rule Type",
        type: "select",
        options: ["dependency", "comparison", "conditional"],
      },
      {
        key: "dependent_field",
        label: "Dependent Field",
        type: "text",
        placeholder: "Field that depends on another",
      },
      {
        key: "required_field",
        label: "Required Field",
        type: "text",
        placeholder: "Field that must be present",
      },
    ],
  },
  regex: {
    label: "Regex Pattern",
    fields: [
      {
        key: "pattern",
        label: "Pattern",
        type: "text",
        placeholder: "^[a-zA-Z0-9]+$",
      },
      {
        key: "pattern_name",
        label: "Pattern Name",
        type: "text",
        placeholder: "e.g., email_format",
      },
      { key: "must_match", label: "Must Match", type: "switch" },
    ],
  },
  custom: {
    label: "Custom Rule",
    fields: [
      {
        key: "type",
        label: "Custom Type",
        type: "select",
        options: ["python_expression", "lookup_table"],
      },
      {
        key: "expression",
        label: "Expression",
        type: "text",
        placeholder: "e.g., age >= 18",
      },
      {
        key: "error_message",
        label: "Error Message",
        type: "text",
        placeholder: "Custom error message",
      },
    ],
  },
};

interface ParamField {
  key: string;
  label: string;
  type: "text" | "number" | "textarea" | "select" | "switch";
  placeholder?: string;
  options?: string[];
}

interface StepParametersProps {
  kind: RuleKind;
  params: Record<string, unknown>;
  rawJson: string;
  useJsonMode: boolean;
  onChange: (field: string, value: unknown) => void;
  errors: Record<string, string>;
}

export function StepParameters({
  kind,
  params,
  rawJson,
  useJsonMode,
  onChange,
  errors,
}: StepParametersProps) {
  const template = paramsTemplates[kind];

  const setParam = (key: string, value: unknown) => {
    onChange("params", { ...params, [key]: value });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">
            Parameters for {template.label}
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            Configure how this rule validates data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="json-mode" className="text-xs text-muted-foreground">
            JSON mode
          </Label>
          <Switch
            id="json-mode"
            checked={useJsonMode}
            onCheckedChange={(checked) => onChange("useJsonMode", checked)}
          />
        </div>
      </div>

      {useJsonMode ? (
        <div className="space-y-2">
          <Textarea
            className="min-h-[250px] font-mono text-sm"
            placeholder='{"key": "value"}'
            value={rawJson}
            onChange={(e) => onChange("rawJson", e.target.value)}
          />
          {errors.rawJson && (
            <p className="text-sm text-destructive">{errors.rawJson}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Enter parameters as raw JSON. This gives full control over the
            parameter structure.
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {template.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                {field.type === "text" && (
                  <Input
                    id={field.key}
                    placeholder={field.placeholder}
                    value={(params[field.key] as string) ?? ""}
                    onChange={(e) => setParam(field.key, e.target.value)}
                  />
                )}
                {field.type === "number" && (
                  <Input
                    id={field.key}
                    type="number"
                    placeholder={field.placeholder}
                    value={(params[field.key] as string) ?? ""}
                    onChange={(e) =>
                      setParam(
                        field.key,
                        e.target.value ? Number(e.target.value) : "",
                      )
                    }
                  />
                )}
                {field.type === "textarea" && (
                  <Textarea
                    id={field.key}
                    placeholder={field.placeholder}
                    className="min-h-[100px]"
                    value={(params[field.key] as string) ?? ""}
                    onChange={(e) => setParam(field.key, e.target.value)}
                  />
                )}
                {field.type === "select" && field.options && (
                  <Select
                    value={(params[field.key] as string) ?? ""}
                    onValueChange={(value) => setParam(field.key, value)}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={`Select ${field.label.toLowerCase()}`}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt.charAt(0).toUpperCase() +
                            opt.slice(1).replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {field.type === "switch" && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id={field.key}
                      checked={(params[field.key] as boolean) ?? false}
                      onCheckedChange={(checked) =>
                        setParam(field.key, checked)
                      }
                    />
                    <Label
                      htmlFor={field.key}
                      className="text-sm text-muted-foreground"
                    >
                      {(params[field.key] as boolean) ? "Yes" : "No"}
                    </Label>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {errors.params && (
        <p className="text-sm text-destructive">{errors.params}</p>
      )}
    </div>
  );
}
