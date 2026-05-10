import { test, expect } from "@playwright/test";
import { randomUUID } from "crypto";

async function registerAndGetToOnboarding(page: import("@playwright/test").Page) {
  const userEmail = `test-${randomUUID().slice(0, 8)}@e2e.test`;
  await page.goto("/register");
  await page.fill('input[name="name"]',     "E2E Onboard");
  await page.fill('input[name="email"]',    userEmail);
  await page.fill('input[name="password"]', "Password123!");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 10_000 });
  return userEmail;
}

test.describe("Onboarding", () => {
  test("onboarding page renders after registration", async ({ page }) => {
    await registerAndGetToOnboarding(page);
    await expect(page.getByText(/organization|company|get started/i)).toBeVisible();
  });

  test("creates organization and lands on dashboard", async ({ page }) => {
    await registerAndGetToOnboarding(page);

    const orgName = `E2E Org ${randomUUID().slice(0, 6)}`;

    // Step 1: org name
    const nameInput = page.locator('input[name="name"], input[placeholder*="name"], input[placeholder*="company"]').first();
    await nameInput.fill(orgName);

    const nextBtn = page.getByRole("button", { name: /next|continue/i }).first();
    await nextBtn.click();

    // Step 2: plan selection — pick starter
    const starterOption = page.getByText(/starter/i).first();
    if (await starterOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await starterOption.click();
      const next2 = page.getByRole("button", { name: /next|continue/i }).first();
      if (await next2.isVisible({ timeout: 1_000 }).catch(() => false)) await next2.click();
    }

    // Step 3: finish / create
    const finishBtn = page.getByRole("button", { name: /finish|create|launch|done/i }).first();
    if (await finishBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await finishBtn.click();
    }

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });
});
