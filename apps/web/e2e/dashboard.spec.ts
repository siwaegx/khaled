import { test, expect } from "@playwright/test";
import { randomUUID } from "crypto";

async function loginAs(page: import("@playwright/test").Page, email: string, password = "Password123!") {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
}

async function fullSetup(page: import("@playwright/test").Page) {
  const userEmail = `test-${randomUUID().slice(0, 8)}@e2e.test`;
  const orgName   = `E2E Corp ${randomUUID().slice(0, 6)}`;

  await page.goto("/register");
  await page.fill('input[name="name"]',     "E2E Dash");
  await page.fill('input[name="email"]',    userEmail);
  await page.fill('input[name="password"]', "Password123!");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 10_000 });

  const nameInput = page.locator('input[name="name"], input[placeholder*="name"], input[placeholder*="company"]').first();
  await nameInput.fill(orgName);
  const nextBtn = page.getByRole("button", { name: /next|continue/i }).first();
  await nextBtn.click();

  // Skip through remaining steps
  for (let i = 0; i < 3; i++) {
    const btn = page.getByRole("button", { name: /next|continue|finish|create|launch|done/i }).first();
    if (await btn.isVisible({ timeout: 1_500 }).catch(() => false)) await btn.click();
    else break;
  }

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  return userEmail;
}

test.describe("Dashboard navigation", () => {
  test("dashboard loads with sidebar", async ({ page }) => {
    await fullSetup(page);
    await expect(page.getByText(/business360/i)).toBeVisible();
    await expect(page.getByText(/app store/i)).toBeVisible();
  });

  test("navigates to App Store", async ({ page }) => {
    await fullSetup(page);
    await page.getByText(/app store/i).click();
    await expect(page).toHaveURL(/\/store/, { timeout: 5_000 });
  });

  test("navigates to Billing page", async ({ page }) => {
    await fullSetup(page);
    await page.getByText(/billing/i).click();
    await expect(page).toHaveURL(/\/billing/, { timeout: 5_000 });
    await expect(page.getByText(/plan/i)).toBeVisible();
  });

  test("navigates to Activity page", async ({ page }) => {
    await fullSetup(page);
    await page.getByText(/activity/i).click();
    await expect(page).toHaveURL(/\/activity/, { timeout: 5_000 });
    await expect(page.getByText(/activity log/i)).toBeVisible();
  });

  test("navigates to Settings", async ({ page }) => {
    await fullSetup(page);
    await page.getByText(/settings/i).click();
    await expect(page).toHaveURL(/\/settings/, { timeout: 5_000 });
  });
});
