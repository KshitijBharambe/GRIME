"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HistogramBin {
  bin: string;
  count: number;
}

interface ColumnHistogramProps {
  columnName: string;
  histogram: HistogramBin[];
}

const chartConfig = {
  count: {
    label: "Count",
    color: "hsl(221, 83%, 53%)",
  },
} satisfies ChartConfig;

export function ColumnHistogram({
  columnName,
  histogram,
}: ColumnHistogramProps) {
  if (!histogram || histogram.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{columnName}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-[2/1] w-full">
          <BarChart data={histogram} margin={{ left: 0, right: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="bin"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
              angle={-30}
              textAnchor="end"
              height={50}
            />
            <YAxis tick={{ fontSize: 11 }} width={45} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="count"
              fill="var(--color-count)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
