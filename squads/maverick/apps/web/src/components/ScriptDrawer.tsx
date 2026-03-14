import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Copy, ThumbsUp, ThumbsDown, Check, Sparkles, BookOpen, Crown, ImageIcon, Download, ExternalLink, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { MaverickAPI } from "@/services/api";

export interface ScriptData {
  title?: string;
  description?: string;
  hook?: string;
  body?: string;
  cta?: string;
  script?: string;
  format?: string;       // "Reels" | "Carrossel"
  format_type?: string;  // "carrossel_educativo" etc
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

// Parses carousel slides from the body text (slide number markers or general split)
function parseCarouselSlides(script: ScriptData): { title: string; body: string; cta?: string }[] {
  const bodyText = script.script || script.body || '';
  const title = script.title || script.hook || '';
  const cta = script.cta;

  // Try to detect "Slide X:" markers
  const slideMatches = bodyText.match(/Slide\s*\d+[:\-–][^\n]*/gi);
  if (slideMatches && slideMatches.length >= 2) {
    const parts = bodyText.split(/(?=Slide\s*\d+[:\-–])/i).filter(Boolean);
    return parts.map((part, i) => ({
      title: part.split('\n')[0].replace(/^Slide\s*\d+[:\-–]\s*/i, '').trim() || `Slide ${i + 1}`,
      body: part.split('\n').slice(1).join('\n').trim(),
      cta: i === parts.length - 1 ? cta : undefined,
    }));
  }

  // Fallback: treat entire content as a single slide
  return [{ title, body: bodyText, cta }];
}

export function ScriptDrawer({ scriptData, open, onClose }: Props) {
  const [feedbackSent, setFeedbackSent] = useState<"up" | "down" | null>(null);
  const [copied, setCopied] = useState(false);

  // Canva state
  const [canvaLoading, setCanvaLoading] = useState(false);
  const [canvaImages, setCanvaImages] = useState<string[]>([]);
  const [canvaError, setCanvaError] = useState<string | null>(null);
  const [canvaAuthenticated, setCanvaAuthenticated] = useState<boolean | null>(null);

  const isCarousel = scriptData?.format === 'Carrossel' ||
    scriptData?.format_type?.startsWith('carrossel') ||
    (scriptData?.body || scriptData?.script || '').toLowerCase().includes('slide');

  // Check Canva auth status when drawer opens and script is a carousel
  useEffect(() => {
    if (open && isCarousel && canvaAuthenticated === null) {
      MaverickAPI.checkCanvaStatus().then(status => {
        setCanvaAuthenticated(status.authenticated);
      });
    }
    // Reset images when script changes
    if (!open) {
      setCanvaImages([]);
      setCanvaError(null);
    }
  }, [open, isCarousel]);

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

  const handleCanvaGenerate = async () => {
    setCanvaLoading(true);
    setCanvaError(null);
    setCanvaImages([]);

    try {
      const slides = parseCarouselSlides(scriptData);
      const result = await MaverickAPI.generateCarouselImages(slides);

      if (!result.success) {
        // Not authenticated — open OAuth flow in new tab
        if (result.authUrl) {
          setCanvaAuthenticated(false);
          window.open('http://localhost:3000' + result.authUrl, '_blank', 'width=600,height=700');
          setCanvaError('Complete o login no Canva na janela que abriu, depois clique em "Gerar Imagens" novamente.');
        } else {
          setCanvaError(result.error || 'Erro ao gerar imagens.');
        }
        return;
      }

      setCanvaImages(result.images || []);
      setCanvaAuthenticated(true);
    } catch (err: any) {
      setCanvaError('Falha ao conectar com a API. Verifique se o servidor está rodando.');
    } finally {
      setCanvaLoading(false);
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

            {/* Format + Framework badges */}
            <div className="flex items-center gap-2 flex-wrap mt-4">
              {isCarousel && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-[#007AFF]/10 text-[#007AFF] border border-[#007AFF]/20">
                  <ImageIcon className="w-3 h-3" />
                  Carrossel
                </span>
              )}
              {scriptData.meta?.framework && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-[#BF5AF2]/10 text-[#BF5AF2] border border-[#BF5AF2]/20">
                  <Sparkles className="w-3 h-3" />
                  {scriptData.meta.framework}
                </span>
              )}
              {scriptData.meta?.ragChunks && scriptData.meta.ragChunks > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-[#30D158]/10 text-[#30D158] border border-[#30D158]/20">
                  <BookOpen className="w-3 h-3" />
                  {scriptData.meta.ragChunks} ref. RAG
                </span>
              )}
              {scriptData.meta?.masterPrinciples && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-[#FF9F0A]/10 text-[#FF9F0A] border border-[#FF9F0A]/20">
                  <Crown className="w-3 h-3" />
                  Voz de Mestre
                </span>
              )}
            </div>
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

          {/* ── Canva Carousel Image Generation ──────────────────────────── */}
          {isCarousel && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-[#7B2FBE]/5 to-[#00C2FF]/5 border border-[#7B2FBE]/15 rounded-[24px] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#7B2FBE] to-[#00C2FF] flex items-center justify-center">
                    <ImageIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-[13px] font-bold text-[#1D1D1F]">Gerar Imagens no Canva</span>
                  <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#7B2FBE]/10 text-[#7B2FBE]">BETA</span>
                </div>
                <p className="text-[12px] text-[#8E8E93] mb-4 leading-relaxed">
                  Gera automaticamente os slides do carrossel usando o template do Canva configurado.
                  {canvaAuthenticated === false && " Você precisará fazer login no Canva primeiro."}
                </p>

                <button
                  onClick={handleCanvaGenerate}
                  disabled={canvaLoading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[16px] bg-gradient-to-r from-[#7B2FBE] to-[#00C2FF] text-white font-semibold text-[14px] hover:opacity-90 hover:scale-[0.98] transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                >
                  {canvaLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gerando no Canva...
                    </>
                  ) : canvaAuthenticated === false ? (
                    <>
                      <ExternalLink className="w-4 h-4" />
                      Conectar Canva & Gerar
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-4 h-4" />
                      Gerar Imagens no Canva
                    </>
                  )}
                </button>

                {canvaError && (
                  <div className="mt-3 p-3 bg-[#FF3B30]/5 border border-[#FF3B30]/15 rounded-[12px]">
                    <p className="text-[12px] text-[#FF3B30] leading-relaxed">{canvaError}</p>
                  </div>
                )}
              </div>

              {/* Image results grid */}
              {canvaImages.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[12px] font-bold text-[#8E8E93] uppercase tracking-wider">
                    {canvaImages.length} imagem(ns) gerada(s)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {canvaImages.map((url, i) => (
                      <div key={i} className="relative group rounded-[16px] overflow-hidden border border-black/5 shadow-sm bg-white aspect-square">
                        <img
                          src={url}
                          alt={`Slide ${i + 1}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <a
                            href={url}
                            download={`carousel-slide-${i + 1}.png`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white text-[#1D1D1F] text-[11px] font-bold shadow-lg"
                            onClick={e => e.stopPropagation()}
                          >
                            <Download className="w-3 h-3" />
                            Baixar
                          </a>
                        </div>
                        <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/50 text-white backdrop-blur-sm">
                          Slide {i + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

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


