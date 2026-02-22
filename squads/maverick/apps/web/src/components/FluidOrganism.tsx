import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  opacity: number;
  // Distortion: each dot is drawn as an ellipse with varying radii
  scaleX: number;
  scaleY: number;
  noiseOffsetX: number;
  noiseOffsetY: number;
}

const DEFAULT_COLORS = [
  "hsla(263, 70%, 66%,",
  "hsla(187, 94%, 43%,",
  "hsla(340, 75%, 55%,",
  "hsla(45, 93%, 58%,",
  "hsla(142, 71%, 45%,",
  "hsla(220, 70%, 55%,",
];

interface FluidOrganismProps {
  colors?: string[];
}

export function FluidOrganism({ colors }: FluidOrganismProps) {
  const COLORS = colors || DEFAULT_COLORS;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1, y: -1 });
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const count = Math.min(180, Math.floor((window.innerWidth * window.innerHeight) / 8000));
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push(createParticle(canvas.width, canvas.height, COLORS));
    }
    particlesRef.current = particles;

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { x: -1, y: -1 };
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    let time = 0;

    const draw = () => {
      time += 0.008;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const hasMouseTarget = mx >= 0 && my >= 0;

      for (const p of particles) {
        if (hasMouseTarget) {
          const dx = p.x - mx;
          const dy = p.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const influence = 180;
          if (dist < influence) {
            const force = (1 - dist / influence) * 0.6;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        // Organic drift
        p.vx += Math.sin(time * 1.3 + p.noiseOffsetX) * 0.008;
        p.vy += Math.cos(time * 0.9 + p.noiseOffsetY) * 0.008;

        p.vx *= 0.985;
        p.vy *= 0.985;

        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        // Animate distortion over time
        const distortTime = time * 0.6;
        const dynamicScaleX = p.scaleX + Math.sin(distortTime + p.noiseOffsetX) * 0.3;
        const dynamicScaleY = p.scaleY + Math.cos(distortTime + p.noiseOffsetY) * 0.3;

        // Wrap
        if (p.x < -30) p.x = canvas.width + 30;
        if (p.x > canvas.width + 30) p.x = -30;
        if (p.y < -30) p.y = canvas.height + 30;
        if (p.y > canvas.height + 30) p.y = -30;

        // Draw distorted dot (ellipse)
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.scale(dynamicScaleX, dynamicScaleY);
        ctx.globalAlpha = p.opacity;

        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.opacity})`;
        // Soft blur via shadow
        ctx.shadowBlur = p.size * 2.5;
        ctx.shadowColor = `${p.color}0.4)`;
        ctx.fill();

        ctx.restore();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  // Update particle colors when prop changes
  useEffect(() => {
    const currentColors = colors || DEFAULT_COLORS;
    for (const p of particlesRef.current) {
      p.color = currentColors[Math.floor(Math.random() * currentColors.length)];
    }
  }, [colors]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
}

function createParticle(w: number, h: number, colors: string[]): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.2,
    vy: (Math.random() - 0.5) * 0.2,
    size: 2 + Math.random() * 5,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.015,
    color: colors[Math.floor(Math.random() * colors.length)],
    opacity: 0.2 + Math.random() * 0.5,
    scaleX: 0.6 + Math.random() * 0.8,
    scaleY: 0.6 + Math.random() * 0.8,
    noiseOffsetX: Math.random() * Math.PI * 2,
    noiseOffsetY: Math.random() * Math.PI * 2,
  };
}
