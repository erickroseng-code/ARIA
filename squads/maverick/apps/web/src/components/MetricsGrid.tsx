import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { metrics } from "@/data/mockData";

export function MetricsGrid() {
  return (
    <section>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 + i * 0.08 }}
            className="glass-card p-4 md:p-5"
          >
            <p className="text-xs text-muted-foreground mb-2 font-medium">
              {metric.label}
            </p>
            <div className="flex items-baseline gap-1">
              <span className="stat-number text-foreground">{metric.value}</span>
              {metric.suffix && (
                <span className="text-sm text-muted-foreground">{metric.suffix}</span>
              )}
            </div>
            {metric.trend && (
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="w-3 h-3 text-success" />
                <span className="text-xs text-success font-medium">{metric.trend}</span>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </section>
  );
}
