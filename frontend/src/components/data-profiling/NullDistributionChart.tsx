"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
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
  nullCount: number;
  totalCount: number;
}

interface NullDistributionChartProps {
  columns: ColumnProfile[];
}

const chartConfig = {
  nullPct: {
    label: "Null %",
    color: "hsl(0, 84%, 60%)",
  },
  presentPct: {
    label: "Present %",
    color: "hsl(142, 71%, 45%)",
  },
} satisfies ChartConfig;

export function NullDistributionChart({ columns }: NullDistributionChartProps) {
  const data = columns.map((col) => ({
    name: col.name,
    nullPct: Number(((col.nullCount / col.totalCount) * 100).toFixed(1)),
    presentPct: Number(
      (((col.totalCount - col.nullCount) / col.totalCount) * 100).toFixed(1),
    ),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Null Distribution</CardTitle>
        <CardDescription>Percentage of null values per column</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto w-full"
          style={{ height: Math.max(columns.length * 40, 200) }}
        >
          <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" domain={[0, 100]} unit="%" />
            <YAxis
              type="category"
              dataKey="name"
              width={75}
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent formatter={(value) => `${value}%`} />
              }
            />
            <Bar
              dataKey="nullPct"
              stackId="a"
              fill="var(--color-nullPct)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="presentPct"
              stackId="a"
              fill="var(--color-presentPct)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
