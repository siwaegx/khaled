import { describe, it, expect } from "vitest";
import { PLANS } from "@business360/shared";
import type { Plan } from "@business360/shared";

describe("PLANS", () => {
  it("has all four tiers", () => {
    expect(Object.keys(PLANS)).toEqual(["starter", "growth", "pro", "enterprise"]);
  });

  it("price increases with tier", () => {
    const prices = (["starter", "growth", "pro", "enterprise"] as Plan[]).map((p) => PLANS[p].price);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]!).toBeGreaterThan(prices[i - 1]!);
    }
  });

  it("starter includes crm", () => {
    expect(PLANS.starter.modules).toContain("crm");
  });

  it("growth includes inventory", () => {
    expect(PLANS.growth.modules).toContain("inventory");
  });

  it("pro includes accounting and hr", () => {
    expect(PLANS.pro.modules).toContain("accounting");
    expect(PLANS.pro.modules).toContain("hr");
  });

  it("enterprise includes all modules", () => {
    const enterprise = PLANS.enterprise.modules;
    expect(enterprise).toContain("crm");
    expect(enterprise).toContain("contacts");
    expect(enterprise).toContain("inventory");
    expect(enterprise).toContain("accounting");
    expect(enterprise).toContain("hr");
    expect(enterprise).toContain("projects");
    expect(enterprise).toContain("reports");
  });

  it("each tier includes all lower-tier modules", () => {
    const tiers: Plan[] = ["starter", "growth", "pro", "enterprise"];
    for (let i = 1; i < tiers.length; i++) {
      const prev = PLANS[tiers[i - 1]!].modules;
      const curr = PLANS[tiers[i]!].modules;
      prev.forEach((m) => expect(curr).toContain(m));
    }
  });
});
