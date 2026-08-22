import { describe, it, expect } from "vitest";
import {
  getCurrentMonthDateRange,
  getRelativeMonthDateRange,
  getMonthDateRange,
  formatBillingMonthLabel,
} from "../externalInvoiceDateUtils";

describe("externalInvoiceDateUtils", () => {
  const fixedNow = new Date("2026-08-21T12:00:00Z");

  it("calculates current month date range correctly", () => {
    const range = getCurrentMonthDateRange(fixedNow);
    expect(range.from).toBe("2026-08-01");
    expect(range.to).toBe("2026-08-31");
    expect(range.year).toBe(2026);
    expect(range.month).toBe(8);
    expect(range.isCurrentMonth).toBe(true);
    expect(range.label).toContain("August 2026");
  });

  it("calculates relative months correctly", () => {
    const prev = getRelativeMonthDateRange(-1, fixedNow);
    expect(prev.from).toBe("2026-07-01");
    expect(prev.to).toBe("2026-07-31");

    const next = getRelativeMonthDateRange(1, fixedNow);
    expect(next.from).toBe("2026-09-01");
    expect(next.to).toBe("2026-09-30");
  });

  it("handles leap year february correctly", () => {
    const feb2024 = getMonthDateRange(2024, 2, fixedNow);
    expect(feb2024.from).toBe("2024-02-01");
    expect(feb2024.to).toBe("2024-02-29");

    const feb2025 = getMonthDateRange(2025, 2, fixedNow);
    expect(feb2025.from).toBe("2025-02-01");
    expect(feb2025.to).toBe("2025-02-28");
  });

  it("formats human-readable billing month labels", () => {
    expect(formatBillingMonthLabel(undefined, undefined, fixedNow)).toBe("All Time");
    expect(formatBillingMonthLabel("2026-08-01", "2026-08-31", fixedNow)).toBe(
      "August 2026 (Current Month)"
    );
    expect(formatBillingMonthLabel("2026-07-01", "2026-07-31", fixedNow)).toBe(
      "July 2026"
    );
  });
});
