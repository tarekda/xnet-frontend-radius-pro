import { describe, expect, it } from "vitest";
import {
  classifyLine,
  currentMonthKey,
  getGroupEffectiveStatus,
  groupExternalInvoices,
  invoiceGroupKey,
  mergePinnedRows,
} from "@/lib/externalInvoiceGrouping";
import type { ExternalInvoice } from "@/types/api";

const NOW = new Date("2026-07-15T12:00:00Z");
const THIS_MONTH = "2026-07-01";
const LAST_MONTH = "2026-06-01";

let nextId = 1;
function inv(overrides: Partial<ExternalInvoice>): ExternalInvoice {
  return {
    id: nextId++,
    username: "user1",
    fullName: "John Doe",
    email: "",
    phoneNumber: "",
    billingMonth: THIS_MONTH,
    amount: 30,
    status: "pending",
    createdAt: "2026-07-01T00:00:00Z",
    paidAt: null,
    modifiedBy: null,
    provider: "idm",
    ...overrides,
  };
}

describe("invoiceGroupKey", () => {
  it("groups by username + full name + provider, case-insensitively", () => {
    expect(invoiceGroupKey(inv({ username: "User1", fullName: " John Doe " }))).toBe(
      invoiceGroupKey(inv({ username: "user1", fullName: "john doe" }))
    );
    expect(invoiceGroupKey(inv({ fullName: "Jane Doe" }))).not.toBe(
      invoiceGroupKey(inv({ fullName: "John Doe" }))
    );
  });
});

describe("classifyLine", () => {
  const nowMonth = currentMonthKey(NOW);

  it("marks unpaid previous months as due", () => {
    expect(classifyLine(inv({ billingMonth: LAST_MONTH, status: "unpaid" }), nowMonth)).toBe("due");
  });

  it("marks unpaid labelled lines as debit", () => {
    expect(classifyLine(inv({ debitLabel: "carryover", status: "pending" }), nowMonth)).toBe("debit");
  });

  it("marks paid lines as paid regardless of month", () => {
    expect(classifyLine(inv({ billingMonth: LAST_MONTH, status: "paid" }), nowMonth)).toBe("paid");
  });

  it("marks unpaid current-month primary lines as current", () => {
    expect(classifyLine(inv({ billingMonth: THIS_MONTH, status: "pending" }), nowMonth)).toBe("current");
  });
});

describe("groupExternalInvoices", () => {
  it("merges same-customer rows into one record with payment lines", () => {
    const current = inv({ billingMonth: THIS_MONTH, amount: 30 });
    const overdue = inv({ billingMonth: LAST_MONTH, amount: 25, status: "unpaid" });
    const other = inv({ username: "user2", fullName: "Jane Smith" });

    const groups = groupExternalInvoices([current, overdue, other], NOW);

    expect(groups).toHaveLength(2);
    const merged = groups.find((g) => g.primary.username === "user1")!;
    expect(merged.lines).toHaveLength(2);
    expect(merged.primary.id).toBe(current.id);
    expect(merged.outstandingTotal).toBe(55);
    expect(merged.openLineCount).toBe(1); // the overdue "due" line
  });

  it("targets the unpaid current-month primary line for the pay button", () => {
    const carryover = inv({ debitLabel: "carryover", amount: 20 });
    const current = inv({ billingMonth: THIS_MONTH, amount: 30 });
    const overdue = inv({ billingMonth: LAST_MONTH, status: "unpaid" });

    const [group] = groupExternalInvoices([carryover, current, overdue], NOW);
    expect(group!.currentMonthPayable?.id).toBe(current.id);
    expect(group!.payableTarget?.id).toBe(current.id);
    // The two open current-month lines are stored as "pending", so the group mirrors that.
    expect(getGroupEffectiveStatus(group!)).toBe("pending");
  });

  it("falls back payableTarget to open prior line when current month is paid", () => {
    const current = inv({ billingMonth: THIS_MONTH, status: "paid" });
    const overdue = inv({ billingMonth: LAST_MONTH, status: "unpaid" });

    const [group] = groupExternalInvoices([current, overdue], NOW);
    expect(group!.currentMonthPayable).toBeNull();
    expect(group!.payableTarget?.id).toBe(overdue.id);
    expect(getGroupEffectiveStatus(group!)).toBe("unpaid");
  });

  it("inherits the most recent due payment date from unpaid lines", () => {
    const overdue = inv({ billingMonth: LAST_MONTH, status: "unpaid", payDueDate: "2026-06-10" });
    const current = inv({ billingMonth: THIS_MONTH, payDueDate: "2026-07-10" });
    const paidOld = inv({ billingMonth: "2026-05-01", status: "paid", payDueDate: "2026-08-20" });

    const [group] = groupExternalInvoices([overdue, current, paidOld], NOW);
    expect(group!.inheritedPayDueDate).toBe("2026-07-10");
  });

  it("falls back to paid lines when no unpaid line has a due date", () => {
    const current = inv({ billingMonth: THIS_MONTH, payDueDate: null });
    const paidOld = inv({ billingMonth: LAST_MONTH, status: "paid", payDueDate: "2026-06-12" });

    const [group] = groupExternalInvoices([current, paidOld], NOW);
    expect(group!.inheritedPayDueDate).toBe("2026-06-12");
  });

  it("uses the newest line as primary when there is no current-month line", () => {
    const may = inv({ billingMonth: "2026-05-01", status: "unpaid" });
    const june = inv({ billingMonth: LAST_MONTH, status: "unpaid" });

    const [group] = groupExternalInvoices([may, june], NOW);
    expect(group!.primary.id).toBe(june.id);
    expect(group!.currentMonthPayable).toBeNull();
    expect(group!.payableTarget?.id).toBe(may.id);
  });

  it("uses remainingDue for outstanding when a line is partially paid", () => {
    const partial = inv({ billingMonth: THIS_MONTH, amount: 50, amountPaid: 20, remainingDue: 30, status: "pending" });
    const [group] = groupExternalInvoices([partial], NOW);
    expect(group!.outstandingTotal).toBe(30);
    expect(getGroupEffectiveStatus(group!)).toBe("pending");
  });

  it("returns paid for getGroupEffectiveStatus when all lines are paid", () => {
    const current = inv({ billingMonth: THIS_MONTH, status: "paid" });
    const overdue = inv({ billingMonth: LAST_MONTH, status: "paid" });
    const [group] = groupExternalInvoices([current, overdue], NOW);
    expect(getGroupEffectiveStatus(group!)).toBe("paid");
    expect(group!.payableTarget).toBeNull();
  });

  it("does not call an open zero-amount invoice paid just because nothing is owed", () => {
    const zero = inv({ billingMonth: THIS_MONTH, amount: 0, totalAmount: 0, amountPaid: 0, status: "pending" });

    const [group] = groupExternalInvoices([zero], NOW);

    // outstandingTotal is 0, but the stored status is still "pending" — this used
    // to render as Paid, which disagreed with reconciliation mode.
    expect(group!.outstandingTotal).toBe(0);
    expect(getGroupEffectiveStatus(group!)).toBe("pending");
  });

  it("mirrors the stored status instead of inferring it from the outstanding amount", () => {
    const unpaid = inv({ billingMonth: THIS_MONTH, amount: 0, totalAmount: 0, status: "unpaid" });

    const [group] = groupExternalInvoices([unpaid], NOW);

    expect(getGroupEffectiveStatus(group!)).toBe("unpaid");
  });
});

describe("mergePinnedRows", () => {
  it("puts a settled row the refetch dropped back at its old position", () => {
    const a = inv({ username: "a" });
    const b = inv({ username: "b" });
    const c = inv({ username: "c" });

    // b was paid, so the filtered refetch no longer returns it.
    const merged = mergePinnedRows([a, c], [{ page: 1, index: 1, row: { ...b, status: "paid" } }], 1);

    expect(merged.map((row) => row.id)).toEqual([a.id, b.id, c.id]);
  });

  it("does not duplicate a row the refetch still returns", () => {
    const a = inv({ username: "a" });
    const b = inv({ username: "b" });

    const merged = mergePinnedRows([a, b], [{ page: 1, index: 1, row: b }], 1);

    expect(merged).toEqual([a, b]);
  });

  it("ignores pins recorded for another page", () => {
    const a = inv({ username: "a" });
    const b = inv({ username: "b" });

    const merged = mergePinnedRows([a], [{ page: 2, index: 0, row: b }], 1);

    expect(merged).toEqual([a]);
  });

  it("clamps a stale index to the end of the page", () => {
    const a = inv({ username: "a" });
    const b = inv({ username: "b" });

    const merged = mergePinnedRows([a], [{ page: 1, index: 9, row: b }], 1);

    expect(merged.map((row) => row.id)).toEqual([a.id, b.id]);
  });

  it("re-inserts multiple pins in their original order", () => {
    const a = inv({ username: "a" });
    const b = inv({ username: "b" });
    const c = inv({ username: "c" });
    const d = inv({ username: "d" });

    const merged = mergePinnedRows(
      [a, d],
      [
        { page: 1, index: 2, row: c },
        { page: 1, index: 1, row: b },
      ],
      1
    );

    expect(merged.map((row) => row.id)).toEqual([a.id, b.id, c.id, d.id]);
  });
});

