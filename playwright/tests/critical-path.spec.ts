import { test, expect, type Page } from "@playwright/test";

/**
 * Critical-path coverage with the backend mocked at the network layer.
 * Real login → create RADIUS user → pay an invoice, without a live database.
 */

const FAKE_USER = {
  id: 1,
  username: "e2e-admin",
  email: "e2e@example.com",
  role: "admin",
  permissions: [
    "users.view",
    "users.online.view",
    "invoices.view",
    "billing.externalInvoices.view",
    "billing.externalInvoices.viewTotals",
    "billing.externalInvoices.pay",
  ],
};

const PROFILE = {
  id: 1,
  profileName: "Fiber 50M",
  dailyQuota: "0",
  monthlyQuota: String(200 * 1024 ** 3),
  price: 25,
  speedDown: 50,
  speedUp: 10,
  maxSessions: 1,
};

const UNPAID_INVOICE = {
  id: 1,
  username: "alpha-user",
  fullName: "Alpha Customer",
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
};

function usersListEnvelope() {
  return {
    success: true,
    message: "ok",
    data: {
      totalUsers: 0,
      totalPages: 1,
      currentPage: 1,
      limit: 10,
      users: [],
    },
  };
}

async function mockApi(page: Page, hooks?: { onCreateUser?: (body: unknown) => void; onPay?: (id: number) => void }) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path.includes("/api/auth/login") && method === "POST") {
      return route.fulfill({
        json: {
          success: true,
          message: "Login successful",
          data: {
            user: FAKE_USER,
            accessToken: "e2e-token",
            refreshToken: "e2e-refresh",
          },
        },
      });
    }

    if (path.includes("/api/auth/profile")) {
      return route.fulfill({ json: { success: true, data: FAKE_USER } });
    }

    if (path.includes("/api/profiles")) {
      return route.fulfill({ json: { success: true, message: "ok", data: [PROFILE] } });
    }

    if (path.includes("/api/radius/users") && method === "POST") {
      const body = request.postDataJSON();
      hooks?.onCreateUser?.(body);
      return route.fulfill({
        json: {
          success: true,
          data: { username: body?.username ?? "new-user", profileId: 1 },
        },
      });
    }

    if (path.includes("/api/radius/users")) {
      return route.fulfill({ json: usersListEnvelope() });
    }

    const payMatch = /\/api\/invoices\/external\/pay\/(\d+)$/.exec(path);
    if (payMatch && method === "POST") {
      const id = parseInt(payMatch[1], 10);
      hooks?.onPay?.(id);
      return route.fulfill({
        json: {
          success: true,
          data: { ...UNPAID_INVOICE, status: "paid", paidAt: new Date().toISOString() },
        },
      });
    }

    if (path.endsWith("/api/invoices/external/aging-summary")) {
      return route.fulfill({
        json: {
          success: true,
          data: {
            buckets: [
              { key: "current", count: 1, amount: 30 },
              { key: "1_30", count: 0, amount: 0 },
              { key: "31_60", count: 0, amount: 0 },
              { key: "61_90", count: 0, amount: 0 },
              { key: "90_plus", count: 0, amount: 0 },
            ],
            overdueAmount: 0,
            avgDaysOverdue: 0,
            overdueRatePercent: 0,
          },
        },
      });
    }

    if (path.endsWith("/api/invoices/external/trend")) {
      return route.fulfill({ json: { success: true, data: [] } });
    }

    if (path.endsWith("/api/invoices/external") && method === "GET") {
      return route.fulfill({
        json: {
          success: true,
          message: "ok",
          data: {
            data: [UNPAID_INVOICE],
            page: 1,
            totalPages: 1,
            total: 1,
            metrics: { totalInvoices: 1, totalPaid: 0, totalUnpaid: 0, totalPending: 1, totalAmount: 30 },
          },
        },
      });
    }

    return route.fulfill({ json: { success: true, data: [] } });
  });
}

async function seedSession(page: Page) {
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

test.describe("critical path (mocked API)", () => {
  test("login form stores tokens and leaves /login", async ({ page }) => {
    await mockApi(page);
    await page.goto("/login");
    await page.locator("#username").fill("e2e-admin");
    await page.locator("#password").fill("GoodPass12");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).not.toHaveURL(/\/login/);
    await expect.poll(async () => page.evaluate(() => localStorage.getItem("accessToken"))).toBe("e2e-token");
  });

  test("create user posts username, password, and profile then lands on the list", async ({ page }) => {
    const created: unknown[] = [];
    await mockApi(page, { onCreateUser: (body) => created.push(body) });
    await seedSession(page);

    await page.goto("/users/new");
    await expect(page.getByText("Fiber 50M").first()).toBeVisible();
    await page.getByText("Fiber 50M").first().click();
    await page.locator("#username").fill("newsub");
    await page.locator("#password").fill("subscriber1");
    await page.getByRole("button", { name: "Create user" }).click();

    await expect(page).toHaveURL(/\/users\/list/);
    expect(created).toHaveLength(1);
    const body = created[0] as { username?: string; password?: string; profileId?: number };
    expect(body.username).toBe("newsub");
    expect(body.password).toBe("subscriber1");
    expect(body.profileId).toBe(1);
  });

  test("pay invoice marks the row paid via the actions menu", async ({ page }) => {
    const paidIds: number[] = [];
    await mockApi(page, { onPay: (id) => paidIds.push(id) });
    await seedSession(page);

    await page.goto("/external-invoices");
    const alphaRow = page.getByRole("row").filter({ hasText: "alpha-user" });
    await expect(alphaRow).toBeVisible();

    const inlinePay = alphaRow.getByRole("button", { name: /^Pay$/ });
    if (await inlinePay.count()) {
      await inlinePay.click();
    } else {
      await alphaRow.getByRole("button", { name: /open menu/i }).click();
      await page.getByRole("menuitem", { name: /set as paid/i }).click();
    }

    await expect(page.getByText(/marked as paid/i).first()).toBeVisible();
    expect(paidIds).toEqual([1]);
  });
});
