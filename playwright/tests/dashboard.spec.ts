import { test, expect, type Page } from "@playwright/test";

const FAKE_USER = {
  id: 1,
  username: "e2e-admin",
  email: "e2e@example.com",
  role: "admin",
  permissions: [
    "users.view",
    "users.online.view",
    "dashboard.widget.totalAmount",
    "dashboard.widget.invoiceCounts",
    "billing.collections.view",
    "admin.alerts.view",
    "admin.analytics.view",
    "admin.expenses.view",
    "audit.view",
  ],
};

const MOCK_DAILY_OPS_BRIEF = {
  generatedAt: "2024-01-01T12:00:00.000Z",
  severity: "ok",
  summary: "All systems nominal.",
  aiEnhanced: false,
  metrics: {
    usersWithRecentRejects: 0,
    offlineWithRecentRejects: 0,
    quotaExceeded: 0,
    accountIssues: 0,
    overdueInvoices: 0,
    overdueInvoiceAmount: 0,
    missingPayDueInvoices: 0,
    authAttempts24h: 1200,
    authRejected24h: 50,
    authRejectRate24h: 4.2,
  },
  highlights: [],
  usersWithRecentRejects: [],
  topNasAuthFailures: [],
  recentRejectUsernames: {},
};

async function signInWithMocks(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();

    if (url.includes("/api/auth/profile")) {
      return route.fulfill({ json: { success: true, data: FAKE_USER } });
    }
    if (url.includes("/api/online-users-metrics")) {
      return route.fulfill({
        json: { success: true, data: { totalOnlineUsers: 42, totalActiveUsers: 38 } },
      });
    }
    if (url.includes("/api/auth-metrics")) {
      return route.fulfill({
        json: {
          success: true,
          data: { current: { attempts: 1200, accepted: 1150, rejected: 50 } },
        },
      });
    }
    if (url.includes("/api/noc-snapshot")) {
      return route.fulfill({
        json: {
          success: true,
          data: { generatedAt: null, authRejectTrend: [], topNasBySessions: [] },
        },
      });
    }
    if (url.includes("/api/noc-health")) {
      return route.fulfill({
        json: {
          success: true,
          data: {
            generatedAt: new Date().toISOString(),
            dbLatencyMs: 12,
            serverProcessingMs: 8,
            activeSessions: 42,
          },
        },
      });
    }
    if (url.includes("/api/radius/users/quota-exceeded")) {
      return route.fulfill({
        json: { success: true, data: { totalUsers: 100, monthlyCount: 0, dailyCount: 0 } },
      });
    }
    if (url.includes("/api/alerts")) {
      return route.fulfill({ json: { success: true, data: [] } });
    }
    if (url.includes("/api/bandwidth/metrics")) {
      return route.fulfill({
        json: {
          success: true,
          data: {
            bandwidth: {
              download: { rate: 10, bytes: 0, utilization: 1 },
              upload: { rate: 50, bytes: 0, utilization: 5 },
              total: { rate: 60, bytes: 0 },
            },
            system: { cpuLoad: "5%", memoryUsage: 40, uptime: "1d" },
            interfaces: [],
            timestamp: new Date().toISOString(),
          },
        },
      });
    }
    if (url.includes("/api/ai/ops/daily-brief")) {
      return route.fulfill({ json: { success: true, data: MOCK_DAILY_OPS_BRIEF } });
    }
    if (url.includes("/api/nas")) {
      return route.fulfill({
        json: {
          success: true,
          data: {
            totalEntries: 3,
            totalPages: 1,
            currentPage: 1,
            limit: 1,
            nasEntries: [],
          },
        },
      });
    }
    if (url.includes("/api/online-users")) {
      return route.fulfill({
        json: {
          success: true,
          totalPages: 1,
          currentPage: 1,
          limit: 5,
          totalUsers: 42,
          data: [],
        },
      });
    }
    if (url.includes("/api/invoices/collected/metrics")) {
      return route.fulfill({
        json: {
          success: true,
          data: { totalCollectedInvoices: 10, totalCashCollected: 500 },
        },
      });
    }
    if (url.includes("/api/expenses/monthly-totals")) {
      return route.fulfill({ json: { success: true, data: [] } });
    }
    if (url.includes("/api/audit")) {
      return route.fulfill({ json: { success: true, data: [] } });
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
      localStorage.setItem("user", JSON.stringify(user));
    },
    { user: FAKE_USER }
  );
}

test.describe("dashboard (mocked API)", () => {
  test("renders KPI widgets and NOC section", async ({ page }) => {
    await signInWithMocks(page);
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
    await expect(page.getByText("Live Sessions").first()).toBeVisible();
    await expect(page.getByText("42").first()).toBeVisible();
    await expect(page.getByText("NOC Snapshot (24h)").first()).toBeVisible();
  });
});
