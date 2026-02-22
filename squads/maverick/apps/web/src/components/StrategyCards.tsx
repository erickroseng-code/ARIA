import { motion } from "framer-motion";
import { Flame, BarChart3, Bot } from "lucide-react";
import { strategies } from "@/data/mockData";

const iconMap: Record<string, React.ElementType> = {
  Flame, BarChart3, Bot,
};

interface Props {
  onGenerateScript: (strategyId: number) => void;
  data?: any[];
  loading?: boolean;
}

export function StrategyCards({ onGenerateScript, data = [], loading = false }: Props) {
  if (loading) {
    return (
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-4">
          Gerando Estratégias Customizadas...
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-5 flex flex-col gap-4 animate-pulse h-48">
              <div className="flex justify-between">
                <div className="w-10 h-10 rounded-lg bg-muted"></div>
                <div className="w-16 h-6 rounded-md bg-muted"></div>
              </div>
              <div className="space-y-2 mt-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-5/6"></div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const displayStrategies = data.length > 0 ? data : strategies;

  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-4">
        {data.length > 0 ? "Estratégias Maverick Baseadas na Análise" : "Caminhos Recomendados para Hoje"}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {displayStrategies.map((strategy: any, i: number) => {
          // If real API data, type might be mapped differently, fallback to Bot for generic
          let iconName = strategy.icon || "Bot";
          if (strategy.type === "Vídeos Curtos" || strategy.type === "Reels") iconName = "Flame";
          if (strategy.type === "Carrossel") iconName = "BarChart3";

          const Icon = iconMap[iconName] || Bot;

          return (
            <motion.div
              key={strategy.id || `strat-${i}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.1 }}
              className="glass-card hover-glow p-5 flex flex-col gap-4 group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  {Icon && <Icon className="w-5 h-5 text-primary" />}
                </div>
                <span className={`tag-${strategy.tagType || "growth"}`}>{strategy.tag || strategy.type}</span>
              </div>
              <div className="flex-1">
                <h3 className="font-display font-semibold text-foreground mb-1">
                  {strategy.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {strategy.description}
                </p>

                {/* Opcional: Renderizar pilares reais se a API retornou */}
                {strategy.pillars && strategy.pillars.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {strategy.pillars.slice(0, 2).map((p: string, idx: number) => (
                      <li key={idx} className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-primary/50"></span>
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                onClick={() => onGenerateScript(strategy.id)}
                className="w-full py-2 rounded-lg border border-border/60 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all mt-4"
              >
                {strategy.action || "Gerar Roteiro Desta Estratégia"}
              </button>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
