"use client";

import { PieChart, Pie, Cell, Legend } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ColumnProfile {
  name: string;
  dataType: string;
}

interface TypeDistributionChartProps {
  columns: ColumnProfile[];
}

const TYPE_COLORS: Record<string, string> = {
  string: "hsl(221, 83%, 53%)",
  number: "hsl(142, 71%, 45%)",
  integer: "hsl(162, 63%, 41%)",
  float: "hsl(172, 66%, 50%)",
  boolean: "hsl(280, 67%, 54%)",
  date: "hsl(38, 92%, 50%)",
  datetime: "hsl(25, 95%, 53%)",
  null: "hsl(0, 84%, 60%)",
  object: "hsl(199, 89%, 48%)",
  array: "hsl(258, 90%, 66%)",
};

const FALLBACK_COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 67%, 54%)",
  "hsl(0, 84%, 60%)",
  "hsl(199, 89%, 48%)",
  "hsl(162, 63%, 41%)",
  "hsl(258, 90%, 66%)",
];

function getTypeColor(type: string, index: number): string {
  return (
    TYPE_COLORS[type.toLowerCase()] ??
    FALLBACK_COLORS[index % FALLBACK_COLORS.length]
  );
}

export function TypeDistributionChart({ columns }: TypeDistributionChartProps) {
  const typeCounts = columns.reduce<Record<string, number>>((acc, col) => {
    const t = col.dataType.toLowerCase();
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  const data = Object.entries(typeCounts).map(([type, count]) => ({
    type,
    count,
  }));

  const chartConfig = data.reduce<ChartConfig>((acc, item, i) => {
    acc[item.type] = {
      label: item.type.charAt(0).toUpperCase() + item.type.slice(1),
      color: getTypeColor(item.type, i),
    };
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Type Distribution</CardTitle>
        <CardDescription>
          Breakdown of detected column data types
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[300px]"
        >
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) =>
                    `${name}: ${value} column${Number(value) !== 1 ? "s" : ""}`
                  }
                />
              }
            />
            <Pie
              data={data}
              dataKey="count"
              nameKey="type"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell key={entry.type} fill={getTypeColor(entry.type, index)} />
              ))}
            </Pie>
            <Legend />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
