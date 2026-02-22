import { useState } from "react";
import { Bird, Menu } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/AppSidebar";
import { FluidOrganism } from "@/components/FluidOrganism";
import { ChatInput } from "@/components/ChatInput";

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleProfileSubmit = (profile: string) => {
    const handle = profile.replace(/^@/, "").trim();
    if (handle) navigate(`/analysis/${handle}`);
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-background overflow-hidden">
      {/* Fluid organism background */}
      <FluidOrganism />

      {/* Top bar - only sidebar toggle + logo */}
      <header className="relative z-10 flex items-center justify-between p-4 md:p-6">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <button className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <Menu className="w-5 h-5 text-muted-foreground" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 bg-sidebar border-border/40">
            <AppSidebar />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <Bird className="w-5 h-5 text-primary" />
          <span className="font-display text-lg font-bold text-foreground tracking-tight">Maverick</span>
        </div>
        <div className="w-9" /> {/* Spacer for centering */}
      </header>

      {/* Center content - ChatGPT style */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground tracking-tight mb-3">
            Qual perfil vamos analisar?
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-md mx-auto">
            Cole o @ do perfil a ser analisado.
          </p>
        </motion.div>

        <ChatInput onSubmit={handleProfileSubmit} />
      </main>
    </div>
  );
};

export default Index;
