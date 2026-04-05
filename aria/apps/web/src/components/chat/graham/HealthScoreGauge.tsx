'use client';

interface HealthScoreGaugeProps {
  score: number;
}

export function HealthScoreGauge({ score }: HealthScoreGaugeProps) {
  const normalizedScore = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
  const displayScore = normalizedScore.toFixed(1);

  const cx = 100, cy = 100;
  const totalSweep = 250;
  const startDeg = -215;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const outerThinR = 92;
  const mainOuterR = 85;
  const mainInnerR = 60;
  const innerThinR = 54;

  const segments = [
    { color: 'hsl(8, 70%, 52%)', from: 0, to: 6 },
    { color: 'hsl(28, 80%, 55%)', from: 6, to: 14 },
    { color: 'hsl(42, 80%, 55%)', from: 14, to: 26 },
    { color: 'hsl(140, 45%, 48%)', from: 26, to: 76 },
    { color: 'hsl(0, 0%, 91%)', from: 76, to: 93 },
    { color: 'hsl(262, 45%, 58%)', from: 93, to: 100 },
  ];

  const arcPathStroke = (r: number, fromPct: number, toPct: number) => {
    const a1 = startDeg + (fromPct / 100) * totalSweep;
    const a2 = startDeg + (toPct / 100) * totalSweep;
    const x1 = cx + r * Math.cos(toRad(a1));
    const y1 = cy + r * Math.sin(toRad(a1));
    const x2 = cx + r * Math.cos(toRad(a2));
    const y2 = cy + r * Math.sin(toRad(a2));
    const large = (a2 - a1) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  const sectorPath = (oR: number, iR: number, fromPct: number, toPct: number) => {
    const a1 = startDeg + (fromPct / 100) * totalSweep;
    const a2 = startDeg + (toPct / 100) * totalSweep;
    const ox1 = cx + oR * Math.cos(toRad(a1));
    const oy1 = cy + oR * Math.sin(toRad(a1));
    const ox2 = cx + oR * Math.cos(toRad(a2));
    const oy2 = cy + oR * Math.sin(toRad(a2));
    const ix1 = cx + iR * Math.cos(toRad(a1));
    const iy1 = cy + iR * Math.sin(toRad(a1));
    const ix2 = cx + iR * Math.cos(toRad(a2));
    const iy2 = cy + iR * Math.sin(toRad(a2));
    const large = (a2 - a1) > 180 ? 1 : 0;
    return `M ${ox1} ${oy1} A ${oR} ${oR} 0 ${large} 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${iR} ${iR} 0 ${large} 0 ${ix1} ${iy1} Z`;
  };

  return (
    <div className="flex flex-col items-center pt-6 pb-2">
      <div className="relative w-full max-w-[240px] mx-auto" style={{ height: 172 }}>
        <svg viewBox="0 0 200 165" className="w-full h-full overflow-visible">
          <defs>
            <pattern id="hatchFine" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(55)">
              <line x1="0" y1="0" x2="0" y2="4" stroke="hsl(140, 40%, 38%)" strokeWidth="1.2" opacity="0.35" />
            </pattern>
          </defs>

          {/* OUTER THIN RING - very subtle */}
          <path
            d={arcPathStroke(outerThinR, 0, 100)}
            fill="none"
            stroke="hsl(0, 0%, 93%)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {segments.filter(s => s.from < normalizedScore).map((seg, i) => (
            <path
              key={`ot-${i}`}
              d={arcPathStroke(outerThinR, seg.from, Math.min(seg.to, normalizedScore))}
              fill="none"
              stroke={seg.color}
              strokeWidth="2"
              opacity={0.5}
            />
          ))}

          {/* MAIN THICK GAUGE */}
          <path d={sectorPath(mainOuterR, mainInnerR, 0, 100)} fill="hsl(0, 0%, 95%)" />

          {segments.map((seg, i) => (
            <path
              key={`m-${i}`}
              d={sectorPath(mainOuterR, mainInnerR, seg.from, seg.to)}
              fill={seg.color}
            />
          ))}

          {/* Hatch on filled portion only */}
          <path
            d={sectorPath(mainOuterR, mainInnerR, 0, normalizedScore)}
            fill="url(#hatchFine)"
          />

          {/* Thin white separators */}
          {segments.slice(0, -1).map((seg, i) => {
            const angle = startDeg + (seg.to / 100) * totalSweep;
            const x1 = cx + (mainInnerR - 1) * Math.cos(toRad(angle));
            const y1 = cy + (mainInnerR - 1) * Math.sin(toRad(angle));
            const x2 = cx + (mainOuterR + 1) * Math.cos(toRad(angle));
            const y2 = cy + (mainOuterR + 1) * Math.sin(toRad(angle));
            return <line key={`s-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="1.5" />;
          })}

          {/* INNER THIN RING */}
          <path
            d={arcPathStroke(innerThinR, 0, 100)}
            fill="none"
            stroke="hsl(0, 0%, 93%)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {segments.filter(s => s.from < normalizedScore).map((seg, i) => (
            <path
              key={`it-${i}`}
              d={arcPathStroke(innerThinR, seg.from, Math.min(seg.to, normalizedScore))}
              fill="none"
              stroke={seg.color}
              strokeWidth="1.5"
              opacity={0.4}
            />
          ))}
        </svg>

        {/* Center text */}
        <div
          className="absolute left-0 right-0 flex flex-col items-center"
          style={{ top: 106, transform: "translateY(-50%)" }}
        >
          <span className="text-[28px] font-bold text-card-foreground leading-none tracking-tight whitespace-nowrap tabular-nums">{displayScore}%</span>
          <span className="text-[10px] font-semibold text-accent mt-2 bg-accent/10 px-3 py-0.5 rounded-full border border-accent/20">
            Health Score
          </span>
        </div>
      </div>
      <div className="flex justify-between w-full px-6 -mt-1">
        <span className="text-[10px] text-muted-foreground">0%</span>
        <span className="text-[10px] text-muted-foreground">- 100%</span>
      </div>
    </div>
  );
}
