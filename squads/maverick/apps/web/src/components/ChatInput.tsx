import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  onSubmit: (value: string) => void;
}

export function ChatInput({ onSubmit }: Props) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="relative glass-card p-1.5 rounded-2xl border border-border/50 focus-within:border-primary/40 transition-colors">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Cole o @ do perfil que deseja analisar..."
          rows={1}
          className="w-full bg-transparent text-foreground placeholder:text-muted-foreground text-sm md:text-base px-4 py-3 pr-14 resize-none focus:outline-none"
          style={{ minHeight: 48, maxHeight: 160 }}
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="absolute right-3 bottom-3 w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      </div>
      <p className="text-center text-xs text-muted-foreground/60 mt-3">
        Maverick analisa perfis públicos e sugere estratégias baseadas em dados.
      </p>
    </motion.div>
  );
}
