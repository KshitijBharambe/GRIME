"use client";

import { useState } from "react";
import { DatasetColumn } from "@/types/api";
import { useDatasets, useDatasetColumns } from "@/lib/hooks/useDatasets";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, X, Database } from "lucide-react";

interface StepColumnsProps {
  selectedColumns: string[];
  datasetId: string;
  onChange: (field: string, value: string | string[]) => void;
  errors: Record<string, string>;
}

export function StepColumns({
  selectedColumns,
  datasetId,
  onChange,
  errors,
}: StepColumnsProps) {
  const [search, setSearch] = useState("");
  const { data: datasetsData } = useDatasets();
  const { data: columns, isLoading: columnsLoading } =
    useDatasetColumns(datasetId);

  const datasets = datasetsData?.items ?? [];

  const filteredColumns = (columns ?? []).filter((col) =>
    col.name.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleColumn = (columnName: string) => {
    const updated = selectedColumns.includes(columnName)
      ? selectedColumns.filter((c) => c !== columnName)
      : [...selectedColumns, columnName];
    onChange("target_columns", updated);
  };

  const removeColumn = (columnName: string) => {
    onChange(
      "target_columns",
      selectedColumns.filter((c) => c !== columnName),
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Dataset (Optional)</Label>
        <p className="text-xs text-muted-foreground">
          Select a dataset to browse its columns, or type column names manually
          below.
        </p>
        <Select
          value={datasetId}
          onValueChange={(value) => onChange("datasetId", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a dataset to browse columns..." />
          </SelectTrigger>
          <SelectContent>
            {datasets.map((ds) => (
              <SelectItem key={ds.id} value={ds.id}>
                <div className="flex items-center gap-2">
                  <Database className="h-3 w-3" />
                  {ds.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {datasetId && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search columns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {columnsLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Loading columns...
            </p>
          ) : filteredColumns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No columns found
            </p>
          ) : (
            <div className="border rounded-lg max-h-[280px] overflow-y-auto">
              {filteredColumns.map((col) => (
                <label
                  key={col.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                >
                  <Checkbox
                    checked={selectedColumns.includes(col.name)}
                    onCheckedChange={() => toggleColumn(col.name)}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{col.name}</span>
                    {col.inferred_type && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({col.inferred_type})
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="manual-columns">
          {datasetId ? "Or add columns manually" : "Enter column names"}
        </Label>
        <Input
          id="manual-columns"
          placeholder="Type a column name and press Enter..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const value = (e.target as HTMLInputElement).value.trim();
              if (value && !selectedColumns.includes(value)) {
                onChange("target_columns", [...selectedColumns, value]);
                (e.target as HTMLInputElement).value = "";
              }
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          Press Enter to add each column name
        </p>
      </div>

      {selectedColumns.length > 0 && (
        <div className="space-y-2">
          <Label>Selected Columns ({selectedColumns.length})</Label>
          <div className="flex flex-wrap gap-2">
            {selectedColumns.map((col) => (
              <Badge key={col} variant="secondary" className="gap-1 pr-1">
                {col}
                <button
                  type="button"
                  onClick={() => removeColumn(col)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {errors.target_columns && (
        <p className="text-sm text-destructive">{errors.target_columns}</p>
      )}
    </div>
  );
}
