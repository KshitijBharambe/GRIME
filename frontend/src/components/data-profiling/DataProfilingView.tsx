"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NullDistributionChart } from "./NullDistributionChart";
import { TypeDistributionChart } from "./TypeDistributionChart";
import { ColumnHistogram } from "./ColumnHistogram";

export interface ColumnProfile {
  name: string;
  dataType: string;
  nullCount: number;
  totalCount: number;
  uniqueCount: number;
  min?: string | number;
  max?: string | number;
  mean?: number;
  histogram?: { bin: string; count: number }[];
}

export interface DataProfilingViewProps {
  columns: ColumnProfile[];
  totalRows: number;
}

function formatValue(value: string | number | undefined): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  }
  return String(value);
}

function getNullBadgeVariant(
  pct: number,
): "default" | "secondary" | "destructive" | "outline" {
  if (pct === 0) return "outline";
  if (pct < 5) return "secondary";
  if (pct < 25) return "default";
  return "destructive";
}

export function DataProfilingView({
  columns,
  totalRows,
}: DataProfilingViewProps) {
  const columnsWithHistograms = columns.filter(
    (col) => col.histogram && col.histogram.length > 0,
  );

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Rows</CardDescription>
            <CardTitle className="text-2xl">
              {totalRows.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Columns</CardDescription>
            <CardTitle className="text-2xl">{columns.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completeness</CardDescription>
            <CardTitle className="text-2xl">
              {columns.length > 0
                ? (
                    ((totalRows * columns.length -
                      columns.reduce((sum, c) => sum + c.nullCount, 0)) /
                      (totalRows * columns.length)) *
                    100
                  ).toFixed(1)
                : 0}
              %
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Column overview table */}
      <Card>
        <CardHeader>
          <CardTitle>Column Overview</CardTitle>
          <CardDescription>
            Summary statistics for each column in the dataset
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Column</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Nulls</TableHead>
                <TableHead className="text-right">Null %</TableHead>
                <TableHead className="text-right">Unique</TableHead>
                <TableHead className="text-right">Min</TableHead>
                <TableHead className="text-right">Max</TableHead>
                <TableHead className="text-right">Mean</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {columns.map((col) => {
                const nullPct = (col.nullCount / col.totalCount) * 100;
                return (
                  <TableRow key={col.name}>
                    <TableCell className="font-medium">{col.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{col.dataType}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {col.nullCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={getNullBadgeVariant(nullPct)}>
                        {nullPct.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {col.uniqueCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatValue(col.min)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatValue(col.max)}
                    </TableCell>
                    <TableCell className="text-right">
                      {col.mean !== undefined ? col.mean.toFixed(2) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Charts row: null distribution + type distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        <NullDistributionChart columns={columns} />
        <TypeDistributionChart columns={columns} />
      </div>

      {/* Value histograms for numeric columns */}
      {columnsWithHistograms.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Value Distributions</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {columnsWithHistograms.map((col) => (
              <ColumnHistogram
                key={col.name}
                columnName={col.name}
                histogram={col.histogram!}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
