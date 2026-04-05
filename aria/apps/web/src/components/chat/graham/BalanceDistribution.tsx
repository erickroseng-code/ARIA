'use client';

import { MoreHorizontal } from 'lucide-react';

interface BarData {
  label: string;
  value: number;
  color: string;
}

interface LegendItem {
  name: string;
  color: string;
}

interface BalanceDistributionProps {
  totalBalance: string;
  totalBalanceLabel?: string;
  barData: BarData[];
  legend?: LegendItem[];
}

export function BalanceDistribution({
  totalBalance,
  totalBalanceLabel = 'Total wallet balance',
  barData,
  legend = [],
}: BalanceDistributionProps) {
  return (
    <div className="bg-card rounded-2xl p-6 shadow-sm border">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-card-foreground">Distribuição de Despesas</h2>
        <button className="text-muted-foreground hover:text-card-foreground transition-colors">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      {/* Legend */}
      {legend.length > 0 && (
        <div className="flex items-center gap-4 mb-4">
          {legend.map((item) => (
            <div key={item.name} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-muted-foreground">{item.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Balance */}
      <div className="mb-5">
        <p className="text-3xl font-bold text-card-foreground tracking-tight">{totalBalance}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{totalBalanceLabel}</p>
      </div>

      {/* Horizontal bar chart */}
      <div className="space-y-3">
        {barData.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhum dado disponível</p>
        ) : (
          barData.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-[11px] font-medium text-muted-foreground w-10 shrink-0">{item.label}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${item.value}%`, backgroundColor: item.color }}
                />
              </div>
              <span className="text-[11px] font-semibold text-card-foreground w-8 text-right">{item.value}%</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
