import { test, expect, type Page } from "@playwright/test";

/**
 * External invoices flow with the backend mocked at the network layer:
 * rendering, search, status filter, pay action, and the search-resets-pagination fix.
 */

const FAKE_USER = {
  id: 1,
  username: "e2e-admin",
  email: "e2e@example.com",
  role: "admin",
  permissions: [
    "invoices.view",
    "billing.externalInvoices.viewTotals",
    "billing.externalInvoices.pay",
    "billing.externalInvoices.unpay",
  ],
};

type MockInvoice = {
  id: number;
  username: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string | null;
  billingMonth: string;
  payDueDate: string | null;
  amount: number;
  status: "paid" | "unpaid" | "pending";
  createdAt: string;
  paidAt: string | null;
  provider: string;
  debitLabel?: string;
};

function invoiceRow(overrides: Partial<MockInvoice> & { id: number }): MockInvoice {
  return {
    username: `user${overrides.id}`,
    fullName: `Customer ${overrides.id}`,
    email: "",
    phoneNumber: "",
    address: null,
    billingMonth: "2026-07-01",
    payDueDate: "2026-07-20",
    amount: 30,
    status: "pending",
    createdAt: "2026-07-01T00:00:00Z",
    paidAt: null,
    provider: "idm",
    ...overrides,
  };
}

const INVOICES: MockInvoice[] = [
  invoiceRow({ id: 1, username: "alpha-user", fullName: "Alpha Customer", status: "pending" }),
  invoiceRow({ id: 2, username: "bravo-user", fullName: "Bravo Customer", status: "unpaid" }),
  invoiceRow({ id: 3, username: "charlie-user", fullName: "Charlie Customer", status: "paid", paidAt: "2026-07-02T10:00:00Z" }),
];

const AGING_SUMMARY = {
  buckets: [
    { key: "current", count: 2, amount: 60 },
    { key: "1_30", count: 0, amount: 0 },
    { key: "31_60", count: 0, amount: 0 },
    { key: "61_90", count: 0, amount: 0 },
    { key: "90_plus", count: 0, amount: 0 },
  ],
  overdueAmount: 0,
  avgDaysOverdue: 0,
  overdueRatePercent: 0,
};

function listResponse(url: URL) {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "200", 10);
  const search = (url.searchParams.get("search") || "").toLowerCase();
  const status = url.searchParams.get("status") || "";

  let rows = INVOICES;
  if (search) {
    rows = rows.filter(
      (r) => r.username.toLowerCase().includes(search) || r.fullName.toLowerCase().includes(search)
    );
  }
  if (status && status !== "all") {
    rows = rows.filter((r) => r.status === status);
  }

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pageRows = rows.slice((page - 1) * limit, page * limit);
  const metrics = {
    totalInvoices: total,
    totalPaid: rows.filter((r) => r.status === "paid").length,
    totalUnpaid: rows.filter((r) => r.status === "unpaid").length,
    totalPending: rows.filter((r) => r.status === "pending").length,
    totalAmount: rows.reduce((acc, r) => acc + r.amount, 0),
  };

  return { success: true, message: "ok", data: { data: pageRows, page, totalPages, total, metrics } };
}

async function signInWithInvoiceMocks(page: Page, options?: { onPay?: (invoiceId: number) => void }) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.includes("/api/auth/profile")) {
      return route.fulfill({ json: { success: true, data: FAKE_USER } });
    }
    const payMatch = /\/api\/invoices\/external\/pay\/(\d+)$/.exec(path);
    if (payMatch && request.method() === "POST") {
      const id = parseInt(payMatch[1], 10);
      options?.onPay?.(id);
      const paid = INVOICES.find((r) => r.id === id);
      return route.fulfill({
        json: { success: true, data: { ...paid, status: "paid", paidAt: new Date().toISOString() } },
      });
    }
    if (path.endsWith("/api/invoices/external/aging-summary")) {
      return route.fulfill({ json: { success: true, data: AGING_SUMMARY } });
    }
    if (path.endsWith("/api/invoices/external/trend")) {
      return route.fulfill({ json: { success: true, data: [] } });
    }
    if (path.endsWith("/api/invoices/external") && request.method() === "GET") {
      return route.fulfill({ json: listResponse(url) });
    }
    return route.fulfill({ json: { success: true, data: [] } });
  });

  await page.context().addCookies([
    {
      name: "xnet_auth",
      value: "1",
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173",
    },
  ]);

  await page.addInitScript(
    ({ user }) => {
      localStorage.setItem("accessToken", "e2e-token");
      localStorage.setItem("user", JSON.stringify(user));
    },
    { user: FAKE_USER }
  );
}

test.describe("external invoices (mocked API)", () => {
  test("renders invoice rows from API data", async ({ page }) => {
    await signInWithInvoiceMocks(page);
    await page.goto("/external-invoices");

    await expect(page.getByText("alpha-user").first()).toBeVisible();
    await expect(page.getByText("bravo-user").first()).toBeVisible();
    await expect(page.getByText("charlie-user").first()).toBeVisible();
  });

  test("search narrows the table to matching invoices", async ({ page }) => {
    await signInWithInvoiceMocks(page);
    await page.goto("/external-invoices");
    await expect(page.getByText("alpha-user").first()).toBeVisible();

    const search = page.getByPlaceholder(/search invoice id/i);
    await search.fill("bravo");
    await search.press("Enter");

    await expect(page.getByText("bravo-user").first()).toBeVisible();
    await expect(page.getByText("alpha-user")).toHaveCount(0);
  });

  test("status filter pill narrows to paid invoices", async ({ page }) => {
    await signInWithInvoiceMocks(page);
    await page.goto("/external-invoices");
    await expect(page.getByText("alpha-user").first()).toBeVisible();

    await page.getByText(/^Paid \(/).first().click();

    await expect(page.getByText("charlie-user").first()).toBeVisible();
    await expect(page.getByText("alpha-user")).toHaveCount(0);
    await expect(page).toHaveURL(/status=paid/);
  });

  test("pay button posts to the pay endpoint and confirms", async ({ page }) => {
    const paidIds: number[] = [];
    await signInWithInvoiceMocks(page, { onPay: (id) => paidIds.push(id) });
    await page.goto("/external-invoices");

    const alphaRow = page.getByRole("row").filter({ hasText: "alpha-user" });
    await alphaRow.getByRole("button", { name: /^Pay$/ }).click();

    await expect(page.getByText(/marked as paid/i).first()).toBeVisible();
    expect(paidIds).toEqual([1]);
  });

  test("searching from a later page resets to page 1 and shows the match", async ({ page }) => {
    await signInWithInvoiceMocks(page);
    // Page size 2 => alpha+bravo on page 1, charlie on page 2. Start on page 2.
    await page.goto("/external-invoices?ps=2&p=2");
    await expect(page.getByText("charlie-user").first()).toBeVisible();
    await expect(page.getByText("alpha-user")).toHaveCount(0);

    // alpha-user lives on page 1; before the fix this search showed an empty table.
    const search = page.getByPlaceholder(/search invoice id/i);
    await search.fill("alpha");
    await search.press("Enter");

    await expect(page.getByText("alpha-user").first()).toBeVisible();
  });
});
