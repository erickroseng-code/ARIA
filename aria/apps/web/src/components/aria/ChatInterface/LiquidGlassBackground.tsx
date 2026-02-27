import { useEffect, useRef } from "react";

interface Particle {
  angle: number;       // current orbital angle
  radius: number;      // orbital radius from center
  baseRadius: number;
  speed: number;       // angular speed
  baseSpeed: number;
  size: number;
  baseSize: number;
  layer: number;       // 0-2 for depth layers
  hueOffset: number;
  pulse: number;
  pulseSpeed: number;
  wobble: number;      // orbital wobble amplitude
  wobbleSpeed: number;
  tilt: number;        // orbital plane tilt for 3D feel
}

const PARTICLE_COUNT = 600;

interface Props {
  energy?: number;
}

const LiquidGlassBackground = ({ energy = 0 }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const energyRef = useRef(0);

  useEffect(() => {
    energyRef.current = energy;
  }, [energy]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let w = 0;
    let h = 0;
    let particles: Particle[] = [];
    let time = 0;
    let smoothEnergy = 0;

    const spawnParticle = (): Particle => {
      const minR = Math.min(w, h) * 0.08;
      const maxR = Math.min(w, h) * 0.45;
      const baseRadius = minR + Math.random() * (maxR - minR);
      const layer = baseRadius < maxR * 0.33 ? 0 : baseRadius < maxR * 0.66 ? 1 : 2;
      // Inner particles orbit faster (Kepler-like)
      const baseSpeed = (0.0006 + Math.random() * 0.0012) * (1.5 - baseRadius / maxR);
      // Alternate directions
      const direction = Math.random() > 0.5 ? 1 : -1;

      return {
        angle: Math.random() * Math.PI * 2,
        radius: baseRadius,
        baseRadius,
        speed: baseSpeed * direction,
        baseSpeed: baseSpeed * direction,
        size: 0.6 + Math.random() * 1.2,
        baseSize: 0.6 + Math.random() * 1.2,
        layer,
        hueOffset: Math.random() * 360,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.015 + Math.random() * 0.03,
        wobble: 2 + Math.random() * 8,
        wobbleSpeed: 0.5 + Math.random() * 1.5,
        tilt: (Math.random() - 0.5) * 0.4, // slight Y-axis tilt for 3D
      };
    };

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(spawnParticle());
      }
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const targetEnergy = energyRef.current;
      smoothEnergy += (targetEnergy - smoothEnergy) * 0.05;
      time += 0.008 + smoothEnergy * 0.012;

      // Clear canvas fully to preserve the CSS gradient background behind it
      ctx.clearRect(0, 0, w, h);

      const cx = w * 0.5;
      const cy = h * 0.45;

      ctx.globalCompositeOperation = "lighter";

      // Pre-calculate positions for connections
      const positions: { x: number; y: number; intensity: number; hue: number; sat: number; light: number }[] = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.pulse += p.pulseSpeed;

        // Orbital motion — continuous rotation
        const energyBoost = 1 + smoothEnergy * 3;
        p.speed = p.baseSpeed * energyBoost;
        p.angle += p.speed;

        // Breathing radius
        const breathe = Math.sin(p.pulse) * 0.5 + 0.5;
        const radiusOscillation = Math.sin(time * p.wobbleSpeed + p.hueOffset) * p.wobble * (1 + smoothEnergy * 2);
        p.radius = p.baseRadius + radiusOscillation;

        // 3D-ish orbital position with tilt
        const x = cx + Math.cos(p.angle) * p.radius;
        const yOffset = Math.sin(p.angle) * p.radius * (0.85 + p.tilt);
        const y = cy + yOffset;

        // Skip if offscreen
        if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue;

        // Depth-based opacity (back particles dimmer)
        const depthFade = Math.sin(p.angle) * 0.3 + 0.7; // dimmer when "behind"
        const pulseIntensity = 0.5 + breathe * 0.5;
        const intensity = depthFade * pulseIntensity;

        // Color — Jarvis blue/cyan palette
        const colorPhase = Math.sin(p.hueOffset + time * 0.15);
        let hue: number, sat: number, light: number;

        if (colorPhase > 0.3) {
          hue = 200 + colorPhase * 15; // blue
          sat = 50 + smoothEnergy * 30;
          light = 55 + intensity * 25;
        } else if (colorPhase > -0.3) {
          hue = 190; // cyan
          sat = 40 + smoothEnergy * 25;
          light = 60 + intensity * 20;
        } else {
          hue = 220 + colorPhase * 20; // deep blue
          sat = 45 + smoothEnergy * 30;
          light = 50 + intensity * 25;
        }

        // Size with pulse and depth
        const depthSize = 0.7 + depthFade * 0.3;
        const currentSize = p.baseSize * depthSize * (1 + smoothEnergy * 0.6 + breathe * 0.2);

        // Core dot
        const alpha = intensity * (0.45 + smoothEnergy * 0.4);
        ctx.beginPath();
        ctx.arc(x, y, currentSize, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, ${sat}%, ${Math.min(light + 15, 95)}%, ${Math.min(alpha, 0.9)})`;
        ctx.fill();

        // Glow halo
        if (intensity > 0.3) {
          const glowSize = currentSize * (2.5 + smoothEnergy * 3);
          ctx.beginPath();
          ctx.arc(x, y, glowSize, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, ${sat + 10}%, ${light}%, ${intensity * (0.05 + smoothEnergy * 0.08)})`;
          ctx.fill();
        }

        // Sparkle on high energy
        if (smoothEnergy > 0.3 && intensity > 0.7 && breathe > 0.85) {
          ctx.beginPath();
          ctx.arc(x, y, currentSize * 0.3, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, ${sat}%, 95%, ${intensity * 0.6})`;
          ctx.fill();
        }

        positions.push({ x, y, intensity, hue, sat, light });
      }

      // Neural connections
      const connDist = 65 + smoothEnergy * 35;
      const connDistSq = connDist * connDist;

      for (let i = 0; i < positions.length; i++) {
        const a = positions[i];
        if (a.intensity < 0.2) continue;

        for (let j = i + 1; j < positions.length; j++) {
          const b = positions[j];
          if (b.intensity < 0.2) continue;

          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > connDistSq) continue;

          const proximity = 1 - Math.sqrt(distSq) / connDist;
          const lineAlpha = proximity * proximity * a.intensity * b.intensity * (0.06 + smoothEnergy * 0.12);
          if (lineAlpha < 0.004) continue;

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `hsla(205, ${30 + smoothEnergy * 30}%, ${55 + proximity * 25}%, ${lineAlpha})`;
          ctx.lineWidth = 0.2 + proximity * 0.5 + smoothEnergy * 0.4;
          ctx.stroke();
        }
      }

      ctx.globalCompositeOperation = "source-over";

      // Energy pulses radiating from center
      const pulseCount = 3;
      for (let i = 0; i < pulseCount; i++) {
        const pulsePhase = (time * 0.4 + i * (Math.PI * 2 / pulseCount)) % (Math.PI * 2);
        const pulseProgress = pulsePhase / (Math.PI * 2); // 0 to 1
        const pulseRadius = pulseProgress * Math.min(w, h) * 0.5;
        const pulseAlpha = (1 - pulseProgress) * (0.06 + smoothEnergy * 0.12);

        if (pulseAlpha > 0.005) {
          ctx.beginPath();
          ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `hsla(200, ${50 + smoothEnergy * 30}%, ${60 + smoothEnergy * 20}%, ${pulseAlpha})`;
          ctx.lineWidth = 0.8 + smoothEnergy * 1.5;
          ctx.stroke();
        }
      }



      animationId = requestAnimationFrame(draw);
    };

    // Start drawing frame-by-frame
    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
    />
  );
};

export default LiquidGlassBackground;
