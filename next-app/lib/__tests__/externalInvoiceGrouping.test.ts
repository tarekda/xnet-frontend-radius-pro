import { describe, expect, it } from "vitest";
import {
  classifyLine,
  currentMonthKey,
  groupExternalInvoices,
  invoiceGroupKey,
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
  });

  it("has no payable when the current month is already paid", () => {
    const current = inv({ billingMonth: THIS_MONTH, status: "paid" });
    const overdue = inv({ billingMonth: LAST_MONTH, status: "unpaid" });

    const [group] = groupExternalInvoices([current, overdue], NOW);
    expect(group!.currentMonthPayable).toBeNull();
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
  });
});
