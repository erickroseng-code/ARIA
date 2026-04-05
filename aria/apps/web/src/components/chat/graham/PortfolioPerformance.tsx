'use client';

import { useState } from 'react';
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChevronLeft } from 'lucide-react';

const data = [
  { month: 'Jan', area: 6000, bar: 3000 },
  { month: 'Feb', area: 7500, bar: 4500 },
  { month: 'Mar', area: 6800, bar: 3800 },
  { month: 'Apr', area: 9000, bar: 5500 },
  { month: 'May', area: 8200, bar: 12000 },
  { month: 'Jun', area: 10800, bar: 14000 },
  { month: 'Jul', area: 9500, bar: 13500 },
  { month: 'Aug', area: 15200, bar: 8000 },
  { month: 'Sep', area: 18000, bar: 6000 },
  { month: 'Oct', area: 16200, bar: 5000 },
  { month: 'Nov', area: 19800, bar: 4500 },
  { month: 'Dec', area: 21000, bar: 4000 },
];

const periods = ['1W', '1M', '3M', '6M', '1Y', 'All'];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const areaVal = payload.find((p: any) => p.dataKey === 'area');
    const barVal = payload.find((p: any) => p.dataKey === 'bar');
    return (
      <div className="bg-foreground text-background px-3 py-2 rounded-lg text-[11px] shadow-lg">
        <p className="font-semibold">
          Actual ${areaVal ? (areaVal.value / 1000).toFixed(1) : 0}K
        </p>
        <p className="text-muted-foreground">
          Potential ${barVal ? (barVal.value / 1000).toFixed(1) : 0}K
        </p>
      </div>
    );
  }
  return null;
};

interface PortfolioPerformanceProps {
  title?: string;
  value?: string;
  change?: string;
}

export function PortfolioPerformance({
  title = 'Portfolio Performance',
  value = '$128,4K',
  change = '+ 14.6%',
}: PortfolioPerformanceProps) {
  const [activePeriod, setActivePeriod] = useState('1Y');

  return (
    <div className="bg-card rounded-2xl p-6 shadow-sm border">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-[15px] font-semibold text-card-foreground">{title}</h2>
        </div>
        <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
          {periods.map((period) => (
            <button
              key={period}
              onClick={() => setActivePeriod(period)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                period === activePeriod
                  ? 'bg-card text-card-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-card-foreground'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-card-foreground tracking-tight">{value}</span>
          <span className="text-sm font-semibold text-accent">{change}</span>
        </div>
      </div>

      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(212, 80%, 71%)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="hsl(212, 80%, 71%)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(220, 13%, 91%)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(220, 10%, 55%)', fontWeight: 500 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(220, 10%, 55%)', fontWeight: 500 }}
              tickFormatter={(v) => `$${v / 1000}K`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="bar"
              fill="hsl(25, 85%, 60%)"
              opacity={0.6}
              radius={[2, 2, 0, 0]}
              barSize={8}
            />
            <Area
              type="monotone"
              dataKey="area"
              stroke="hsl(212, 80%, 65%)"
              strokeWidth={2}
              fill="url(#areaGradient)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
