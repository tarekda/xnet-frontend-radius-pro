/**
 * Helpers for billing month calculations, ranges, and formatting in external invoices.
 */

export type MonthRange = {
  from: string; // YYYY-MM-01
  to: string;   // YYYY-MM-lastDay
  year: number;
  month: number; // 1..12
  monthName: string;
  label: string;
  isCurrentMonth: boolean;
};

/**
 * Returns the 1-indexed days in a month.
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Formats a Date object to YYYY-MM-DD.
 */
export function formatYyyyMmDd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Gets the date range for a specific year and 1-indexed month (1..12).
 */
export function getMonthDateRange(year: number, month: number, now = new Date()): MonthRange {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const isCurrentMonth = year === currentYear && month === currentMonth;

  const days = getDaysInMonth(year, month);
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = `${year}-${String(month).padStart(2, "0")}-${String(days).padStart(2, "0")}`;

  const tempDate = new Date(year, month - 1, 1);
  const monthName = tempDate.toLocaleDateString("en-US", { month: "long" });
  const label = isCurrentMonth ? `${monthName} ${year} (Current Month)` : `${monthName} ${year}`;

  return {
    from,
    to,
    year,
    month,
    monthName,
    label,
    isCurrentMonth,
  };
}

/**
 * Gets the date range for the current month.
 */
export function getCurrentMonthDateRange(now = new Date()): MonthRange {
  return getMonthDateRange(now.getFullYear(), now.getMonth() + 1, now);
}

/**
 * Gets a relative month range given an offset from baseDate (e.g. -1 for previous month, +1 for next month).
 */
export function getRelativeMonthDateRange(offsetMonths: number, baseDate = new Date()): MonthRange {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + offsetMonths, 1);
  return getMonthDateRange(d.getFullYear(), d.getMonth() + 1, baseDate);
}

/**
 * Generates a human-friendly billing month label for the given from/to parameters.
 */
export function formatBillingMonthLabel(from?: string, to?: string, now = new Date()): string {
  if (!from && !to) {
    return "All Time";
  }

  const currentRange = getCurrentMonthDateRange(now);
  if (from === currentRange.from && to === currentRange.to) {
    return `${currentRange.monthName} ${currentRange.year} (Current Month)`;
  }

  if (from && to && from.slice(0, 7) === to.slice(0, 7) && from.endsWith("-01")) {
    const [yStr, mStr] = from.split("-");
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    if (!Number.isNaN(year) && !Number.isNaN(month) && month >= 1 && month <= 12) {
      const tempDate = new Date(year, month - 1, 1);
      const monthName = tempDate.toLocaleDateString("en-US", { month: "long" });
      const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1;
      return isCurrent ? `${monthName} ${year} (Current Month)` : `${monthName} ${year}`;
    }
  }

  if (from && to) {
    return `${from} → ${to}`;
  }
  if (from) return `From ${from}`;
  return `Until ${to}`;
}
