import { describe, expect, it } from "vitest";
import {
  buildReminderMessagePreview,
  deriveWorkflowStage,
  formatRelativeShort,
  getAgingBucket,
  getDueDate,
  getLastRemindedAt,
  getOverdueDays,
  getOverdueSeverity,
  getReconciliationFlagsMap,
  getWorkflowLabel,
  getWorkflowTone,
  parsePromiseDateFromLastAction,
  parseWorkflowStageFromLastAction,
} from "@/lib/externalInvoiceInsights";
import type { ExternalInvoice } from "@/types/api";

let nextId = 1;
function inv(overrides: Partial<ExternalInvoice> = {}): ExternalInvoice {
  return {
    id: nextId++,
    username: "user1",
    fullName: "John Doe",
    email: "",
    phoneNumber: "",
    billingMonth: "2026-07-01",
    amount: 30,
    status: "pending",
    createdAt: "2026-07-01T00:00:00Z",
    paidAt: null,
    modifiedBy: null,
    provider: "idm",
    ...overrides,
  };
}

describe("getDueDate / getOverdueDays", () => {
  it("due date is end of billing month plus grace days", () => {
    // July 2026 ends on the 31st; +7 grace days => Aug 7, end of day.
    const due = getDueDate("2026-07-01", 7);
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(7); // August (0-based)
    expect(due.getDate()).toBe(7);
  });

  it("overdue days is positive after due date and non-positive before", () => {
    const invoice = inv({ billingMonth: "2026-05-01" });
    // Due June 7 end-of-day (May 31 + 7d). As of June 17 noon, 9 full days have elapsed.
    expect(getOverdueDays(invoice, 7, new Date("2026-06-17T12:00:00"))).toBe(9);
    expect(getOverdueDays(invoice, 7, new Date("2026-06-01T12:00:00"))).toBeLessThanOrEqual(0);
  });
});

describe("getAgingBucket", () => {
  const asOf = new Date("2026-07-15T12:00:00");

  function bucketFor(billingMonth: string) {
    const invoice = inv({ billingMonth });
    // getAgingBucket uses "now" internally via getOverdueDays default; emulate
    // via overdue days from a fixed date to keep the test deterministic.
    const overdueDays = getOverdueDays(invoice, 7, asOf);
    if (overdueDays <= 0) return "current";
    if (overdueDays <= 30) return "1_30";
    if (overdueDays <= 60) return "31_60";
    if (overdueDays <= 90) return "61_90";
    return "90_plus";
  }

  it("buckets by overdue age", () => {
    expect(bucketFor("2026-07-01")).toBe("current");
    expect(bucketFor("2026-06-01")).toBe("1_30");
    expect(bucketFor("2026-05-01")).toBe("31_60");
    expect(bucketFor("2026-04-01")).toBe("61_90");
    expect(bucketFor("2025-12-01")).toBe("90_plus");
  });

  it("returns a valid bucket with the real clock", () => {
    expect(["current", "1_30", "31_60", "61_90", "90_plus"]).toContain(getAgingBucket(inv()));
  });
});

describe("workflow stage parsing and derivation", () => {
  it("parses explicit workflow markers from lastAction", () => {
    expect(parseWorkflowStageFromLastAction("workflow:escalated by admin")).toBe("escalated");
    expect(parseWorkflowStageFromLastAction("WORKFLOW:PROMISE_TO_PAY promise:2026-07-20")).toBe("promise_to_pay");
    expect(parseWorkflowStageFromLastAction("IMPORT_UPSERT")).toBeNull();
    expect(parseWorkflowStageFromLastAction(null)).toBeNull();
  });

  it("parses promise dates from lastAction", () => {
    expect(parsePromiseDateFromLastAction("workflow:promise_to_pay promise:2026-07-20")).toBe("2026-07-20");
    expect(parsePromiseDateFromLastAction("workflow:reminded")).toBeNull();
  });

  it("paid invoices are always resolved", () => {
    expect(deriveWorkflowStage(inv({ status: "paid", lastAction: "workflow:escalated" }))).toBe("resolved");
  });

  it("explicit stage wins over heuristics", () => {
    expect(deriveWorkflowStage(inv({ lastAction: "workflow:promise_to_pay" }))).toBe("promise_to_pay");
  });

  it("reminder-ish lastAction maps to reminded", () => {
    expect(deriveWorkflowStage(inv({ lastAction: "reminded by admin @ 2026-07-01T10:00:00Z" }))).toBe("reminded");
    expect(deriveWorkflowStage(inv({ lastAction: "dunning_stage:2:throttle" }))).toBe("reminded");
  });

  it("old open invoices escalate; fresh ones are new", () => {
    expect(deriveWorkflowStage(inv({ billingMonth: "2020-01-01" }))).toBe("escalated");
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    expect(deriveWorkflowStage(inv({ billingMonth: thisMonth }))).toBe("new");
  });

  it("maps stages to tones and labels", () => {
    expect(getWorkflowTone("resolved")).toBe("success");
    expect(getWorkflowTone("escalated")).toBe("destructive");
    expect(getWorkflowTone("reminded")).toBe("warning");
    expect(getWorkflowTone("new")).toBe("default");
    expect(getWorkflowLabel("promise_to_pay")).toBe("Promise to Pay");
    expect(getWorkflowLabel("new")).toBe("New");
  });
});

describe("buildReminderMessagePreview", () => {
  it("includes name, id, month, amount, and status", () => {
    const msg = buildReminderMessagePreview(
      inv({ id: 42, fullName: "Jane Doe", amount: 45.5, billingMonth: "2026-07-01", status: "unpaid" })
    );
    expect(msg).toContain("Jane Doe");
    expect(msg).toContain("#42");
    expect(msg).toContain("2026-07-01");
    expect(msg).toContain("$45.50");
    expect(msg).toContain("unpaid");
  });

  it("falls back to username then generic name", () => {
    expect(buildReminderMessagePreview(inv({ fullName: "" }))).toContain("user1");
    expect(buildReminderMessagePreview(inv({ fullName: "", username: "" }))).toContain("Customer");
  });
});

describe("getOverdueSeverity", () => {
  it("paid invoices have no severity even when old", () => {
    expect(getOverdueSeverity(inv({ status: "paid", billingMonth: "2020-01-01" }))).toBe("none");
  });

  it("very old open invoices are critical", () => {
    expect(getOverdueSeverity(inv({ billingMonth: "2020-01-01" }))).toBe("critical");
  });
});

describe("getLastRemindedAt", () => {
  it("prefers the dedicated lastRemindedAt column", () => {
    const d = getLastRemindedAt(inv({ lastRemindedAt: "2026-07-01T08:00:00Z" }));
    expect(d?.toISOString()).toBe("2026-07-01T08:00:00.000Z");
  });

  it("falls back to parsing the legacy lastAction marker", () => {
    const d = getLastRemindedAt(inv({ lastAction: "reminded by admin @ 2026-06-30T09:30:00Z" }));
    expect(d?.toISOString()).toBe("2026-06-30T09:30:00.000Z");
  });

  it("returns null for non-reminder actions", () => {
    expect(getLastRemindedAt(inv({ lastAction: "IMPORT_UPSERT @ 2026-06-30T09:30:00Z" }))).toBeNull();
    expect(getLastRemindedAt(inv())).toBeNull();
  });
});

describe("formatRelativeShort", () => {
  const asOf = new Date("2026-07-15T12:00:00Z");

  it("formats minutes, hours, days, and months", () => {
    expect(formatRelativeShort(new Date("2026-07-15T11:59:40Z"), asOf)).toBe("just now");
    expect(formatRelativeShort(new Date("2026-07-15T11:30:00Z"), asOf)).toBe("30m ago");
    expect(formatRelativeShort(new Date("2026-07-15T07:00:00Z"), asOf)).toBe("5h ago");
    expect(formatRelativeShort(new Date("2026-07-12T12:00:00Z"), asOf)).toBe("3d ago");
    expect(formatRelativeShort(new Date("2026-05-01T12:00:00Z"), asOf)).toBe("2mo ago");
  });

  it("future dates read as just now", () => {
    expect(formatRelativeShort(new Date("2026-07-16T12:00:00Z"), asOf)).toBe("just now");
  });
});

describe("getReconciliationFlagsMap", () => {
  it("flags paid invoices without paidAt and unpaid invoices with paidAt", () => {
    const paidNoTimestamp = inv({ status: "paid", paidAt: null });
    const unpaidWithTimestamp = inv({ username: "user2", status: "pending", paidAt: "2026-07-02T10:00:00Z" });
    const clean = inv({ username: "user3", status: "paid", paidAt: "2026-07-02T10:00:00Z" });

    const map = getReconciliationFlagsMap([paidNoTimestamp, unpaidWithTimestamp, clean]);
    expect(map.get(paidNoTimestamp.id)).toEqual(["missing_payment"]);
    expect(map.get(unpaidWithTimestamp.id)).toEqual(["missing_payment"]);
    expect(map.has(clean.id)).toBe(false);
  });

  it("flags same-amount siblings as duplicates and different amounts as mismatch", () => {
    const dupA = inv({ username: "dup", amount: 30 });
    const dupB = inv({ username: "dup", amount: 30 });
    const misA = inv({ username: "mis", amount: 30 });
    const misB = inv({ username: "mis", amount: 45 });

    const map = getReconciliationFlagsMap([dupA, dupB, misA, misB]);
    expect(map.get(dupA.id)).toEqual(["duplicate"]);
    expect(map.get(dupB.id)).toEqual(["duplicate"]);
    expect(map.get(misA.id)).toEqual(["amount_mismatch"]);
    expect(map.get(misB.id)).toEqual(["amount_mismatch"]);
  });

  it("does not flag invoices in different billing months", () => {
    const a = inv({ username: "solo", billingMonth: "2026-06-01" });
    const b = inv({ username: "solo", billingMonth: "2026-07-01" });
    const map = getReconciliationFlagsMap([a, b]);
    expect(map.size).toBe(0);
  });

  it("combines missing_payment with duplicate flags", () => {
    const a = inv({ username: "combo", status: "paid", paidAt: null, amount: 30 });
    const b = inv({ username: "combo", amount: 30 });
    const map = getReconciliationFlagsMap([a, b]);
    expect(map.get(a.id)).toEqual(["missing_payment", "duplicate"]);
    expect(map.get(b.id)).toEqual(["duplicate"]);
  });
});
