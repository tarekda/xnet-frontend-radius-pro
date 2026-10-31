import { test, expect, type Page } from "@playwright/test";

/**
 * Smoke tests for authenticated flows. The backend is mocked at the network
 * layer (page.route) so these run without a database or RADIUS stack.
 */

const FAKE_USER = {
  id: 1,
  username: "e2e-admin",
  email: "e2e@example.com",
  role: "admin",
  permissions: [
    "users.view",
    "users.manage",
    "profiles.view",
    "profiles.manage",
    "online.view",
    "nas.view",
    "invoices.view",
    "audit.view",
    "analytics.view",
    "alerts.view",
  ],
};

const PROFILES = [
  {
    id: 1,
    profileName: "Fiber 50M",
    dailyQuota: "0",
    monthlyQuota: String(200 * 1024 ** 3),
    price: 25,
    speedDown: 50,
    speedUp: 10,
    maxSessions: 1,
  },
  {
    id: 2,
    profileName: "Fiber 100M",
    dailyQuota: "0",
    monthlyQuota: String(500 * 1024 ** 3),
    price: 40,
    speedDown: 100,
    speedUp: 20,
    maxSessions: 1,
  },
];

async function signInWithMocks(page: Page) {
  // Generic API fallback: empty success envelope for anything not explicitly mocked.
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/api/profiles/usage")) {
      return route.fulfill({
        json: { success: true, data: [{ profileId: 1, userCount: 12, activeCount: 9 }] },
      });
    }
    if (url.includes("/api/profiles")) {
      return route.fulfill({ json: { success: true, message: "ok", data: PROFILES } });
    }
    if (url.includes("/api/auth/profile")) {
      return route.fulfill({ json: { success: true, data: FAKE_USER } });
    }
    return route.fulfill({ json: { success: true, data: [] } });
  });

  // Cookie must exist before the first request so the middleware sees it.
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

test.describe("middleware route guard", () => {
  test("unauthenticated deep link redirects to /login with from param", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/profiles/list");
    await expect(page).toHaveURL(/\/login\?from=%2Fprofiles%2Flist/);
  });

  test("authenticated visit to /login bounces back into the app", async ({ page }) => {
    await signInWithMocks(page);
    await page.goto("/login");
    await expect(page).not.toHaveURL(/\/login/);
  });
});

test.describe("profiles page (mocked API)", () => {
  test("renders profile cards from API data", async ({ page }) => {
    await signInWithMocks(page);
    await page.goto("/profiles/list");
    await expect(page.getByText("Fiber 50M").first()).toBeVisible();
    await expect(page.getByText("Fiber 100M").first()).toBeVisible();
  });

  test("search filters the grid", async ({ page }) => {
    await signInWithMocks(page);
    await page.goto("/profiles/list");
    await expect(page.getByText("Fiber 50M").first()).toBeVisible();

    const search = page.getByPlaceholder(/search profiles/i);
    await search.fill("100M");
    // SearchBar may need explicit submit; Enter covers both modes.
    await search.press("Enter");

    await expect(page.getByText("Fiber 100M").first()).toBeVisible();
    await expect(page.getByText("Fiber 50M")).toHaveCount(0);
  });
});
