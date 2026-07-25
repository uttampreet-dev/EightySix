"use client";

import { useRef, useState } from "react";

// Single-series sparkline. Series color #3987e5 is the validated
// categorical slot 1 for dark surfaces; text stays in text tokens.
const SERIES = "#3987e5";

export function Sparkline({
  points,
  labelFor,
  height = 56,
}: {
  points: { hour: number; count: number }[];
  labelFor: (p: { hour: number; count: number }) => string;
  height?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const width = 260;
  const pad = 6;
  const max = Math.max(1, ...points.map((p) => p.count));
  const stepX =
    points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;

  const x = (i: number) => pad + i * stepX;
  const y = (count: number) =>
    height - pad - (count / max) * (height - pad * 2);

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.count).toFixed(1)}`)
    .join(" ");
  const areaPath =
    points.length > 1
      ? `${linePath} L${x(points.length - 1).toFixed(1)},${height - pad} L${pad},${height - pad} Z`
      : "";

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || points.length < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const i = Math.round((px - pad) / stepX);
    setHoverIndex(Math.max(0, Math.min(points.length - 1, i)));
  }

  const hover = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIndex(null)}
        role="img"
        aria-label={points.map(labelFor).join(", ")}
      >
        {/* recessive baseline */}
        <line
          x1={pad}
          y1={height - pad}
          x2={width - pad}
          y2={height - pad}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={1}
        />
        {areaPath && <path d={areaPath} fill={SERIES} fillOpacity={0.15} />}
        <path d={linePath} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" />
        {hover !== null && hoverIndex !== null && (
          <>
            <line
              x1={x(hoverIndex)}
              y1={pad}
              x2={x(hoverIndex)}
              y2={height - pad}
              stroke="currentColor"
              strokeOpacity={0.25}
              strokeWidth={1}
            />
            <circle
              cx={x(hoverIndex)}
              cy={y(hover.count)}
              r={4}
              fill={SERIES}
              stroke="var(--card)"
              strokeWidth={2}
            />
          </>
        )}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md">
          {labelFor(hover)}
        </div>
      )}
    </div>
  );
}
