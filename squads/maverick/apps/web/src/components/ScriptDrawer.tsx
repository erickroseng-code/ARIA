import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Copy, ThumbsUp, ThumbsDown, Check, Sparkles, BookOpen, Crown } from "lucide-react";
import { useState } from "react";

export interface ScriptData {
  title?: string;
  description?: string;
  hook?: string;
  body?: string;
  cta?: string;
  script?: string;
  meta?: {
    framework?: string;
    frameworkId?: string;
    ragChunks?: number;
    masterPrinciples?: boolean;
  };
  topic?: string;
}

interface Props {
  scriptData: ScriptData | null;
  open: boolean;
  onClose: (open: boolean) => void;
}

export function ScriptDrawer({ scriptData, open, onClose }: Props) {
  const [feedbackSent, setFeedbackSent] = useState<"up" | "down" | null>(null);
  const [copied, setCopied] = useState(false);

  if (!scriptData) return null;

  const fullScript = scriptData.script || [scriptData.hook, scriptData.body, scriptData.cta]
    .filter(Boolean)
    .join("\n\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(fullScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedback = async (approved: boolean) => {
    setFeedbackSent(approved ? "up" : "down");
    try {
      await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/script-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: scriptData.topic || scriptData.title,
          frameworkId: scriptData.meta?.frameworkId || "",
          script: fullScript,
          approved,
        }),
      });
    } catch (e) {
      console.error("Feedback error:", e);
    }
  };

  const BlockCard = ({ title, content }: { title: string, content: string }) => (
    <div className="bg-white border border-black/5 rounded-[24px] p-5 shadow-sm w-full">
      <h3 className="text-[12px] font-bold text-apple-primary mb-2 uppercase tracking-wider">{title}</h3>
      <p className="text-[15px] text-[#1D1D1F] leading-relaxed whitespace-pre-wrap font-medium">{content}</p>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onClose}>
      {/* iOS style sheet drawer */}
      <SheetContent className="w-full sm:max-w-xl bg-apple-base/95 backdrop-blur-apple border-l border-black/5 overflow-y-auto p-0 shadow-[-10px_0_30px_rgba(0,0,0,0.1)]">

        <div className="p-6 md:p-8 space-y-6">
          <SheetHeader className="mb-2 text-left">
            <SheetTitle className="text-2xl font-bold tracking-tight text-[#1D1D1F] mb-1">
              {scriptData.title}
            </SheetTitle>
            {scriptData.description && (
              <p className="text-[14px] text-[#8E8E93] leading-relaxed">{scriptData.description}</p>
            )}

            {/* Framework badges */}
            {scriptData.meta?.framework && (
              <div className="flex items-center gap-2 flex-wrap mt-4">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-[#BF5AF2]/10 text-[#BF5AF2] border border-[#BF5AF2]/20">
                  <Sparkles className="w-3 h-3" />
                  {scriptData.meta.framework}
                </span>
                {scriptData.meta.ragChunks && scriptData.meta.ragChunks > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-[#30D158]/10 text-[#30D158] border border-[#30D158]/20">
                    <BookOpen className="w-3 h-3" />
                    {scriptData.meta.ragChunks} ref. RAG
                  </span>
                )}
                {scriptData.meta.masterPrinciples && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-[#FF9F0A]/10 text-[#FF9F0A] border border-[#FF9F0A]/20">
                    <Crown className="w-3 h-3" />
                    Voz de Mestre
                  </span>
                )}
              </div>
            )}
          </SheetHeader>

          {/* Script Content Blocks */}
          <div className="space-y-4 pt-2">
            {scriptData.script ? (
              <BlockCard title="📄 Conteúdo Gerado" content={scriptData.script} />
            ) : (
              <>
                {scriptData.hook && <BlockCard title="🎣 Hook (0-3s)" content={scriptData.hook} />}
                {scriptData.body && <BlockCard title="📝 Corpo & Retenção" content={scriptData.body} />}
                {scriptData.cta && <BlockCard title="📢 Chamada para Ação (CTA)" content={scriptData.cta} />}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="pt-4 pb-2">
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-[20px] bg-[#1D1D1F] text-white font-semibold text-[15px] hover:bg-black hover:scale-[0.98] transition-all shadow-sm"
            >
              {copied ? <Check className="w-5 h-5 text-[#34C759]" /> : <Copy className="w-5 h-5" />}
              {copied ? "Script copiado!" : "Copiar Script Completo"}
            </button>
          </div>

          {/* Feedback */}
          <div className="bg-white/50 border border-black/5 rounded-[24px] p-5 mt-2">
            <p className="text-[13px] text-[#8E8E93] font-medium text-center mb-4">
              Calibrou bem a voz? Seu feedback aprimora a IA para o próximo.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => handleFeedback(true)}
                disabled={feedbackSent !== null}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-[16px] text-[14px] font-bold transition-all shadow-sm ${feedbackSent === "up"
                  ? "bg-[#34C759]/10 border border-[#34C759]/30 text-[#34C759]"
                  : "bg-white border border-black/5 text-[#1D1D1F] hover:bg-[#34C759]/10 hover:text-[#34C759] hover:border-[#34C759]/30"
                  } disabled:cursor-not-allowed`}
              >
                <ThumbsUp className="w-4 h-4" />
                {feedbackSent === "up" ? "Salvo na memória" : "Gostei, use de base"}
              </button>
              <button
                onClick={() => handleFeedback(false)}
                disabled={feedbackSent !== null}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-[16px] text-[14px] font-bold transition-all shadow-sm ${feedbackSent === "down"
                  ? "bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30]"
                  : "bg-white border border-black/5 text-[#1D1D1F] hover:bg-[#FF3B30]/10 hover:text-[#FF3B30] hover:border-[#FF3B30]/30"
                  } disabled:cursor-not-allowed`}
              >
                <ThumbsDown className="w-4 h-4" />
                {feedbackSent === "down" ? "Feedback enviado" : "Abaixo da média"}
              </button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
