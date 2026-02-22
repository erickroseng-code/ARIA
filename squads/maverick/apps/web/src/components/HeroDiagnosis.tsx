import { motion } from "framer-motion";
import { AlertTriangle, Rocket, ArrowRight } from "lucide-react";
import { dailyDiagnosis } from "@/data/mockData";

export function HeroDiagnosis() {
  const isWarning = dailyDiagnosis.status === "warning";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-card gradient-hero p-6 md:p-8"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-1 font-medium">
            Raio-X de Hoje: {dailyDiagnosis.date}
          </p>
          <div className="flex items-center gap-2 mb-3">
            {isWarning ? (
              <AlertTriangle className="w-5 h-5 text-warning" />
            ) : (
              <Rocket className="w-5 h-5 text-success" />
            )}
            <span
              className={`font-display text-xl font-bold ${
                isWarning ? "text-warning" : "text-success"
              }`}
            >
              {dailyDiagnosis.statusLabel}
            </span>
          </div>
          <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-2xl">
            {dailyDiagnosis.analysis}
          </p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shrink-0">
          Ver Análise Detalhada
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
