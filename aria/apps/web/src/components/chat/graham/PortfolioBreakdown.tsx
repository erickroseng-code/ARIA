'use client';

import { MoreHorizontal } from 'lucide-react';
import { HealthScoreGauge } from './HealthScoreGauge';

interface BreakdownItem {
  label: string;
  description?: string;
  emphasizeDescription?: boolean;
  value: string;
  change: string;
  positive: boolean;
  color: string;
  valueColor?: string;
}

interface PortfolioBreakdownProps {
  items: BreakdownItem[];
  healthScore: number;
}

export function PortfolioBreakdown({ items, healthScore }: PortfolioBreakdownProps) {
  return (
    <div className="bg-card rounded-2xl p-6 shadow-sm border">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[15px] font-semibold text-card-foreground">Fluxo de Caixa</h2>
        <button className="text-muted-foreground hover:text-card-foreground transition-colors">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4 mb-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-1 h-10 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <div>
                <p className="text-sm font-medium text-card-foreground">{item.label}</p>
                {item.description ? (
                  <p className={item.emphasizeDescription ? 'text-xs font-semibold text-card-foreground/90' : 'text-xs text-muted-foreground'}>
                    {item.description}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="text-right">
              <p
                className="text-sm font-semibold"
                style={{ color: item.valueColor ?? 'hsl(var(--card-foreground))' }}
              >
                {item.value}
              </p>
              <p
                className="text-xs font-medium"
                style={{
                  color: item.positive ? 'hsl(var(--accent))' : 'hsl(var(--destructive))',
                }}
              >
                {item.change}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-2">
        <HealthScoreGauge score={healthScore} />
      </div>
    </div>
  );
}
