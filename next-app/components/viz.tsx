import React, { useEffect, useRef, useState } from "react";

/** Animated count-up for KPI values. */
export function useCountUp(target: number, durationMs = 700): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = from + (target - from) * eased;
      setDisplay(value);
      if (progress < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return display;
}

export const CountUpNumber = ({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) => {
  const display = useCountUp(value);
  return <span className="tabular-nums">{prefix}{Math.round(display).toLocaleString()}{suffix}</span>;
};

/** Minimal dependency-free sparkline — supports optional area fill & animation. */
export const Sparkline = ({
  data,
  strokeClass = "stroke-blue-500",
  fillClass,
  animated = false,
  width: svgWidth = 120,
  height: svgHeight = 28,
}: {
  data: number[];
  strokeClass?: string;
  /** Tailwind fill class for the gradient area under the line (e.g. "fill-blue-500/20"). Pass to enable area fill. */
  fillClass?: string;
  /** Animate the stroke drawing on mount. */
  animated?: boolean;
  width?: number;
  height?: number;
}) => {
  const polyRef = useRef<SVGPolylineElement>(null);

  const max = data.length >= 2 ? Math.max(...data) : 0;
  const min = data.length >= 2 ? Math.min(...data) : 0;
  const range = max - min || 1;
  const pad = 3;
  const innerW = svgWidth - pad * 2;
  const innerH = svgHeight - pad * 2;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * innerW + pad;
    const y = svgHeight - pad - ((v - min) / range) * innerH;
    return [x, y] as [number, number];
  });

  const polyPoints = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  // Area path: line across all points, then close down along the bottom
  const areaPath = pts.length
    ? `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)} ` +
      pts.slice(1).map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(" ") +
      ` L${pts[pts.length - 1][0].toFixed(1)},${(svgHeight - pad).toFixed(1)} L${pts[0][0].toFixed(1)},${(svgHeight - pad).toFixed(1)} Z`
    : "";

  // Animate the stroke draw on mount — hook must be before any early return
  useEffect(() => {
    if (!animated || data.length < 2) return;
    const el = polyRef.current;
    if (!el) return;
    const len = el.getTotalLength?.() ?? 300;
    el.style.strokeDasharray = String(len);
    el.style.strokeDashoffset = String(len);
    el.style.transition = "stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1)";
    requestAnimationFrame(() => {
      el.style.strokeDashoffset = "0";
    });
  }, [animated, data]);

  // Early return AFTER all hooks
  if (data.length < 2) return null;

  const gradId = `sp-${Math.random().toString(36).slice(2, 7)}`;

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="w-full"
      style={{ height: svgHeight }}
      preserveAspectRatio="none"
      aria-hidden
    >
      {fillClass && (
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" className={fillClass} stopOpacity="0.5" />
            <stop offset="100%" className={fillClass} stopOpacity="0.02" />
          </linearGradient>
        </defs>
      )}
      {fillClass && areaPath && (
        <path d={areaPath} fill={`url(#${gradId})`} />
      )}
      <polyline
        ref={polyRef}
        points={polyPoints}
        fill="none"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={strokeClass}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

/**
 * AnimatedSparkline — same as Sparkline but always animates the stroke on mount.
 * Convenience alias for readability.
 */
export const AnimatedSparkline = (props: Omit<React.ComponentProps<typeof Sparkline>, "animated">) => (
  <Sparkline {...props} animated />
);

/**
 * MiniBarChart — lightweight horizontal bar chart for ModuleCard / StatCard footer slots.
 * Renders N bars with optional labels and values.
 */
export const MiniBarChart = ({
  data,
  barClass = "bg-primary/70",
  height = 32,
  showLabels = false,
}: {
  data: { label?: string; value: number }[];
  barClass?: string;
  height?: number;
  showLabels?: boolean;
}) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-0.5 w-full" style={{ height }}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5" style={{ height }}>
            <div
              className={`w-full rounded-t-sm transition-all duration-700 ${barClass}`}
              style={{ height: `${Math.max(pct, 4)}%` }}
              title={d.label ? `${d.label}: ${d.value}` : String(d.value)}
            />
            {showLabels && d.label && (
              <span className="text-[9px] text-muted-foreground truncate w-full text-center leading-none">{d.label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

/** Progress ring (SVG) with severity coloring by percentage.
 * tone="auto": high % is good (green). tone="inverse": high % is bad (red). */
export const ProgressRing = ({
  percent,
  size = 116,
  tone = "auto",
}: {
  percent: number;
  size?: number;
  tone?: "auto" | "inverse";
}) => {
  const clamped = Math.max(0, Math.min(100, percent));
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const severity = tone === "inverse" ? 100 - clamped : clamped;
  const toneClass =
    severity >= 75 ? "stroke-emerald-500" : severity >= 45 ? "stroke-amber-500" : "stroke-red-500";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        className="stroke-muted"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className={`${toneClass} transition-[stroke-dashoffset] duration-700 ease-out`}
      />
    </svg>
  );
};
