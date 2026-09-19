import type React from "react";

/** Reads CSS variable values from the :root for Recharts usage */
function getCssVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** 5-color palette for Recharts — reads --chart-1 through --chart-5 CSS vars */
export const CHART_COLORS = {
  get primary() { return getCssVar('--chart-1') || '#6366f1'; },
  get secondary() { return getCssVar('--chart-2') || '#0ea5e9'; },
  get tertiary() { return getCssVar('--chart-3') || '#10b981'; },
  get quaternary() { return getCssVar('--chart-4') || '#f59e0b'; },
  get quinary() { return getCssVar('--chart-5') || '#ef4444'; },
};

/** Array form for indexed access (e.g., pie chart cells) */
export function getChartPalette(): string[] {
  return [
    CHART_COLORS.primary,
    CHART_COLORS.secondary,
    CHART_COLORS.tertiary,
    CHART_COLORS.quaternary,
    CHART_COLORS.quinary,
  ];
}

/** Shared tooltip style matching the design system Card component */
export const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--card)',
  borderColor: 'var(--border)',
  borderRadius: '0.625rem',
  color: 'var(--card-foreground)',
  boxShadow: 'var(--shop-shadow)',
};
