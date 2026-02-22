import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Copy, Image } from "lucide-react";

export interface ScriptData {
  title: string;
  description: string;
  hook: string;
  body: string;
  cta: string;
}

interface Props {
  scriptData: ScriptData | null;
  open: boolean;
  onClose: (open: boolean) => void;
}

export function ScriptDrawer({ scriptData, open, onClose }: Props) {
  if (!scriptData) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg bg-card border-border/40 overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="font-display text-xl text-foreground">
            {scriptData.title}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">{scriptData.description}</p>
        </SheetHeader>

        <div className="space-y-6">
          <div className="glass-card p-4 rounded-xl border border-white/5">
            <h3 className="text-xs font-bold text-primary mb-2 uppercase tracking-wider">🎣 Gancho (0-3s)</h3>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{scriptData.hook}</p>
          </div>

          <div className="glass-card p-4 rounded-xl border border-white/5">
            <h3 className="text-xs font-bold text-primary mb-2 uppercase tracking-wider">📝 Corpo (3-50s)</h3>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{scriptData.body}</p>
          </div>

          <div className="glass-card p-4 rounded-xl border border-white/5">
            <h3 className="text-xs font-bold text-primary mb-2 uppercase tracking-wider">📢 CTA (Final)</h3>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{scriptData.cta}</p>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors">
            <Copy className="w-4 h-4" />
            Copiar Texto
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border/60 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
            <Image className="w-4 h-4" />
            Gerar Imagens
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

