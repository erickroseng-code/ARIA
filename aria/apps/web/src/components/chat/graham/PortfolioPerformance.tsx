'use client';

import { useState } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChevronLeft } from 'lucide-react';

const data = [
  { month: 'Jan', income: 6000, expense: 3000 },
  { month: 'Fev', income: 7500, expense: 4500 },
  { month: 'Mar', income: 6800, expense: 3800 },
  { month: 'Abr', income: 9000, expense: 5500 },
  { month: 'Mai', income: 8200, expense: 12000 },
  { month: 'Jun', income: 10800, expense: 14000 },
  { month: 'Jul', income: 9500, expense: 13500 },
  { month: 'Ago', income: 15200, expense: 8000 },
  { month: 'Set', income: 18000, expense: 6000 },
  { month: 'Out', income: 16200, expense: 5000 },
  { month: 'Nov', income: 19800, expense: 4500 },
  { month: 'Dez', income: 21000, expense: 4000 },
];

const periods = ['1W', '1M', '3M', '6M', '1Y', 'All'];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const incomeVal = payload.find((p: any) => p.dataKey === 'income');
    const expenseVal = payload.find((p: any) => p.dataKey === 'expense');
    return (
      <div className="bg-foreground text-background px-3 py-2 rounded-lg text-[11px] shadow-lg">
        <p className="font-semibold">
          Receitas R$ {incomeVal ? (incomeVal.value / 1000).toFixed(1) : 0}K
        </p>
        <p className="text-muted-foreground">
          Despesas R$ {expenseVal ? (expenseVal.value / 1000).toFixed(1) : 0}K
        </p>
      </div>
    );
  }
  return null;
};

interface PerformancePoint {
  month: string;
  income: number | null;
  expense: number | null;
}

interface PortfolioPerformanceProps {
  title?: string;
  value?: string;
  change?: string;
  points?: PerformancePoint[];
}

export function PortfolioPerformance({
  title = 'Evolução Receitas x Despesas',
  value = 'R$ 128,4K',
  change = '+ 14.6%',
  points = data,
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
          <ComposedChart data={points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
              tickFormatter={(v) => `R$ ${v / 1000}K`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="expense"
              fill="hsl(var(--destructive))"
              opacity={0.7}
              radius={[2, 2, 0, 0]}
              barSize={8}
            />
            <Line
              type="monotone"
              dataKey="income"
              stroke="hsl(var(--accent))"
              strokeWidth={2.5}
              dot={{ r: 2.5, fill: 'hsl(var(--accent))', strokeWidth: 0 }}
              activeDot={{ r: 4, fill: 'hsl(var(--accent))', strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
