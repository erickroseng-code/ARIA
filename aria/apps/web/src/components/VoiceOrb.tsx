'use client';

import { useEffect, useRef } from 'react';
import { VoiceState } from '@/hooks/useVoiceMode';

interface VoiceOrbProps {
  state: VoiceState;
  energy?: number;            // 0-1, usado durante fala
  lastTranscript?: string;    // texto sendo ouvido em tempo real
  onToggle?: () => void;      // clique para ligar/desligar
  isActive?: boolean;
}

const STATE_LABELS: Record<VoiceState, string> = {
  idle: 'Voz desligada',
  wake_listening: 'Diga "Ei ARIA"',
  cmd_listening: 'Ouvindo...',
  processing: 'Processando...',
  error: 'Mic. negado',
};

const STATE_COLORS: Record<VoiceState, string> = {
  idle: 'rgba(255,255,255,0.15)',
  wake_listening: 'rgba(0,212,255,0.6)',
  cmd_listening: 'rgba(0,255,136,0.8)',
  processing: 'rgba(100,100,255,0.8)',
  error: 'rgba(255,80,80,0.9)',
};

export function VoiceOrb({ state, energy = 0, lastTranscript = '', onToggle, isActive }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef(0);
  const energyRef = useRef(energy);

  // Atualiza energia sem re-render
  useEffect(() => {
    energyRef.current = energy;
  }, [energy]);

  // Animação canvas: círculos concêntricos que pulsam conforme estado
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width = 80;
    const H = canvas.height = 80;
    const cx = W / 2;
    const cy = H / 2;

    const draw = () => {
      timeRef.current += 0.04;
      const t = timeRef.current;
      const e = energyRef.current;

      ctx.clearRect(0, 0, W, H);

      if (state === 'idle') {
        // Ponto pequeno respirando suavemente
        const pulse = 0.5 + Math.sin(t * 0.5) * 0.2;
        ctx.beginPath();
        ctx.arc(cx, cy, 5 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fill();
      } else if (state === 'wake_listening') {
        // Anel ciano lento, indica "aguardando"
        const breathe = 0.7 + Math.sin(t * 0.6) * 0.3;

        // Anel externo sutil
        ctx.beginPath();
        ctx.arc(cx, cy, 30 * breathe, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,212,255,0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Anel médio
        ctx.beginPath();
        ctx.arc(cx, cy, 20 * breathe, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,212,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Núcleo
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,212,255,${0.4 + Math.sin(t * 0.6) * 0.2})`;
        ctx.fill();
      } else if (state === 'cmd_listening') {
        // Anéis verdes expandindo — ativa, ouvindo comando
        for (let i = 0; i < 3; i++) {
          const phase = (t * 1.5 + i * 1.0) % (Math.PI * 2);
          const radius = 10 + (Math.sin(phase) * 0.5 + 0.5) * 28;
          const alpha = (Math.cos(phase) * 0.5 + 0.5) * 0.5;

          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0,255,136,${alpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Núcleo pulsante
        const corePulse = 1 + Math.sin(t * 2) * 0.15;
        ctx.beginPath();
        ctx.arc(cx, cy, 9 * corePulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,255,136,0.9)';
        ctx.fill();

        // Glow central
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
        grad.addColorStop(0, 'rgba(0,255,136,0.3)');
        grad.addColorStop(1, 'rgba(0,255,136,0)');
        ctx.beginPath();
        ctx.arc(cx, cy, 20, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      } else if (state === 'error') {
        // X vermelho pulsante
        const pulse = 0.9 + Math.sin(t * 3) * 0.1;
        ctx.strokeStyle = `rgba(255,80,80,${pulse})`;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        const s = 12 * pulse;
        ctx.beginPath();
        ctx.moveTo(cx - s, cy - s);
        ctx.lineTo(cx + s, cy + s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + s, cy - s);
        ctx.lineTo(cx - s, cy + s);
        ctx.stroke();
      } else if (state === 'processing') {
        // Arco girando tipo loading — azul/roxo
        ctx.beginPath();
        ctx.arc(cx, cy, 22, t * 2, t * 2 + Math.PI * 1.3);
        ctx.strokeStyle = 'rgba(120,100,255,0.9)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Arco secundário
        ctx.beginPath();
        ctx.arc(cx, cy, 16, -t * 1.5, -t * 1.5 + Math.PI * 0.8);
        ctx.strokeStyle = 'rgba(180,100,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Núcleo
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(150,120,255,0.9)';
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [state]);

  const label = STATE_LABELS[state];
  const glowColor = STATE_COLORS[state];

  return (
    <div
      className="flex flex-col items-center gap-1.5 select-none"
      title={label}
    >
      {/* Orbe clicável */}
      <button
        onClick={onToggle}
        className="relative w-[80px] h-[80px] rounded-full flex items-center justify-center
                   transition-all duration-300 cursor-pointer outline-none border-none bg-transparent
                   hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400"
        style={{
          filter: state !== 'idle'
            ? `drop-shadow(0 0 12px ${glowColor})`
            : 'none',
        }}
        aria-label={`Modo de voz: ${label}`}
      >
        {/* Fundo do orbe */}
        <div
          className="absolute inset-0 rounded-full border transition-all duration-500"
          style={{
            borderColor: glowColor,
            background: `radial-gradient(circle at 40% 35%, rgba(255,255,255,0.06), transparent 70%),
                         radial-gradient(circle, ${glowColor.replace(')', ', 0.05)')} 0%, transparent 70%)`,
            backdropFilter: 'blur(8px)',
          }}
        />

        {/* Canvas animado */}
        <canvas
          ref={canvasRef}
          width={80}
          height={80}
          className="relative z-10"
        />
      </button>

      {/* Label de estado */}
      <span
        className="text-[10px] font-mono tracking-widest uppercase transition-all duration-300"
        style={{ color: state === 'idle' ? 'rgba(255,255,255,0.3)' : glowColor }}
      >
        {label}
      </span>

      {/* Transcrição ao vivo — mostra o que está sendo ouvido */}
      {(state === 'wake_listening' || state === 'cmd_listening') && lastTranscript && (
        <div
          className="absolute bottom-[-28px] left-1/2 -translate-x-1/2 whitespace-nowrap
                     text-[9px] font-mono px-2 py-0.5 rounded-full border max-w-[180px] truncate"
          style={{
            color: glowColor,
            borderColor: glowColor.replace(')', ', 0.3)'),
            background: 'rgba(0,0,0,0.6)',
          }}
          title={lastTranscript}
        >
          {lastTranscript}
        </div>
      )}
    </div>
  );
}
