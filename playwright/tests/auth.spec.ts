import { test, expect } from "@playwright/test";

test.describe("auth smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.locator("#username")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("protected route redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login form submits credentials to the mocked API", async ({ page }) => {
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      if (request.url().includes("/auth/login") && request.method() === "POST") {
        return route.fulfill({
          json: {
            success: true,
            message: "Login successful",
            data: {
              user: {
                id: 1,
                username: "e2e-admin",
                email: "e2e@example.com",
                role: "admin",
                permissions: [],
              },
              accessToken: "e2e-token",
              refreshToken: "e2e-refresh",
            },
          },
        });
      }
      return route.fulfill({ json: { success: true, data: [] } });
    });

    await page.goto("/login");
    await page.locator("#username").fill("e2e-admin");
    await page.locator("#password").fill("GoodPass12");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).not.toHaveURL(/\/login/);
  });
});

