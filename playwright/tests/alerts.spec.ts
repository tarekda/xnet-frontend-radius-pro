import { test, expect, type Page } from "@playwright/test";

const FAKE_USER = {
  id: 1,
  username: "e2e-admin",
  email: "e2e@example.com",
  role: "admin",
  permissions: ["admin.alerts.view"],
};

const MOCK_RULE = {
  id: "rule-1",
  name: "High User Load",
  description: "Alert when active users exceed threshold",
  metric: {
    type: "users",
    label: "Active Users",
    unit: "users",
    description: "Number of active users",
  },
  condition: "greater_than",
  threshold: 1000,
  duration: 5,
  severity: "high",
  enabled: true,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  triggerCount: 2,
};

const MOCK_SETTINGS = {
  emailNotifications: true,
  smsNotifications: false,
  webhookNotifications: false,
  inAppNotifications: true,
  emailRecipients: [],
  smsRecipients: [],
  quietHours: {
    enabled: false,
    startTime: "22:00",
    endTime: "07:00",
    timezone: "UTC",
  },
  escalationPolicy: {
    enabled: false,
    escalationDelay: 30,
    maxEscalations: 3,
  },
};

async function signInWithMocks(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();

    if (url.includes("/api/auth/profile")) {
      return route.fulfill({ json: { success: true, data: FAKE_USER } });
    }
    if (url.includes("/api/alerts/rules")) {
      return route.fulfill({ json: { success: true, data: [MOCK_RULE] } });
    }
    if (url.includes("/api/alerts/settings")) {
      return route.fulfill({ json: { success: true, data: MOCK_SETTINGS } });
    }
    if (url.includes("/api/alerts")) {
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

test.describe("alerts (mocked API)", () => {
  test("renders alert rules from API data", async ({ page }) => {
    await signInWithMocks(page);
    await page.goto("/alerts");

    await expect(page.getByRole("heading", { name: /alert management/i })).toBeVisible();
    await expect(page.getByText("High User Load").first()).toBeVisible();
    await expect(page.getByRole("tab", { name: /alert rules/i })).toBeVisible();
  });

  test("active alerts tab shows empty state", async ({ page }) => {
    await signInWithMocks(page);
    await page.goto("/alerts");

    await page.getByRole("tab", { name: /active alerts/i }).click();
    await expect(page.getByText(/no alerts found/i)).toBeVisible();
  });

  test("alert history tab shows empty state from the API", async ({ page }) => {
    await signInWithMocks(page);
    await page.goto("/alerts");

    await page.getByRole("tab", { name: /alert history/i }).click();
    await expect(page.getByText(/no resolved alerts yet/i)).toBeVisible();
  });
});
