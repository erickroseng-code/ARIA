import { useState } from "react";
import { Bird, Menu, Clock, Search } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/AppSidebar";
import { FluidOrganism } from "@/components/FluidOrganism";

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const handle = inputValue.replace(/^@/, "").trim();
    if (handle) navigate(`/analysis/${handle}`);
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-apple-base overflow-hidden selection:bg-apple-softBlue/40 selection:text-[#1D1D1F]">
      {/* Siri / Vision Pro style background - Light Mode */}
      <div className="absolute inset-0 pointer-events-none opacity-80 mix-blend-multiply">
        <FluidOrganism />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-4">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <button className="p-2.5 rounded-2xl bg-white/60 backdrop-blur-apple border border-black/5 text-[#1D1D1F] hover:bg-white/80 active:scale-95 transition-all shadow-sm">
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-[#1C1C1E]/95 backdrop-blur-apple border-r border-white/10">
              <AppSidebar />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-apple-softBlue to-apple-gold flex items-center justify-center shadow-sm border border-black/5">
              <Bird className="w-4.5 h-4.5 text-[#1D1D1F]" />
            </div>
            <span className="font-display text-lg font-semibold text-[#1D1D1F] tracking-tight">Maverick</span>
          </div>
        </div>
        <button
          onClick={() => navigate("/history")}
          title="Histórico"
          className="p-2.5 rounded-2xl bg-white/60 backdrop-blur-apple border border-black/5 text-[#8E8E93] hover:text-[#1D1D1F] hover:bg-white/80 active:scale-95 transition-all shadow-sm"
        >
          <Clock className="w-5 h-5" />
        </button>
      </header>

      {/* Center Spotlight Search */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-32">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} // Apple characteristic spring curve
          className="w-full max-w-2xl"
        >
          <h1 className="font-display text-[40px] leading-tight font-semibold text-center text-[#1D1D1F] tracking-[-0.03em] mb-12 drop-shadow-sm">
            Qual perfil<br />vamos investigar?
          </h1>

          <form onSubmit={handleSubmit} className="relative group">
            {/* Glow effect behind the input */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-apple-softBlue/30 via-apple-gold/30 to-apple-softBlue/30 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

            <div className="relative flex items-center w-full bg-white/80 backdrop-blur-apple border border-black/5 rounded-3xl shadow-sm pl-6 pr-2 py-2 overflow-hidden transition-all duration-300 focus-within:border-black/10 focus-within:bg-white focus-within:shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <Search className="w-5 h-5 text-[#8E8E93] shrink-0" />
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Nome do usuário (ex: thefuture)"
                className="w-full bg-transparent border-none text-xl text-[#1D1D1F] placeholder:text-[#8E8E93] outline-none px-4 py-3"
                autoFocus
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="shrink-0 bg-[#1D1D1F] text-white px-6 py-3 rounded-2xl font-semibold text-sm disabled:opacity-40 hover:bg-black active:scale-95 transition-all shadow-sm"
              >
                Analisar
              </button>
            </div>
          </form>

          <p className="text-center text-[#8E8E93] text-sm mt-8 tracking-tight font-medium">
            Insira qualquer usuário do Instagram para extrair o blueprint estratégico.
          </p>
        </motion.div>
      </main>
    </div>
  );
};

export default Index;
