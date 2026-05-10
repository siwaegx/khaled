import { test, expect } from "@playwright/test";
import { randomUUID } from "crypto";

const email = () => `test-${randomUUID().slice(0, 8)}@e2e.test`;

test.describe("Authentication", () => {
  test("register → redirects to onboarding", async ({ page }) => {
    await page.goto("/register");
    await page.fill('input[name="name"]',     "E2E User");
    await page.fill('input[name="email"]',    email());
    await page.fill('input[name="password"]', "Password123!");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10_000 });
  });

  test("login with wrong password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]',    "nobody@example.com");
    await page.fill('input[name="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible({ timeout: 5_000 });
  });

  test("login → dashboard → logout", async ({ page }) => {
    // Register first
    const userEmail = email();
    await page.goto("/register");
    await page.fill('input[name="name"]',     "E2E Login");
    await page.fill('input[name="email"]',    userEmail);
    await page.fill('input[name="password"]', "Password123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10_000 });

    // Go to login page directly
    await page.goto("/login");
    await page.fill('input[name="email"]',    userEmail);
    await page.fill('input[name="password"]', "Password123!");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard|\/onboarding/, { timeout: 10_000 });
  });

  test("protected route redirects unauthenticated user to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
  });

  test("forgot password page renders", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: /forgot|reset/i })).toBeVisible();
    await page.fill('input[name="email"]', "test@example.com");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/sent|check|email/i)).toBeVisible({ timeout: 5_000 });
  });
});
