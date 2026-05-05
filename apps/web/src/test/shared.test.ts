import { describe, it, expect } from "vitest";
import { PLANS, MODULE_REGISTRY } from "@business360/shared";
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

  it("enterprise includes all modules", () => {
    const enterprise = PLANS.enterprise.modules;
    expect(enterprise).toContain("crm");
    expect(enterprise).toContain("inventory");
    expect(enterprise).toContain("accounting");
    expect(enterprise).toContain("hr");
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

describe("MODULE_REGISTRY", () => {
  it("has at least 6 core modules", () => {
    expect(MODULE_REGISTRY.length).toBeGreaterThanOrEqual(6);
  });

  it("has exactly 6 core modules", () => {
    const core = MODULE_REGISTRY.filter((m) => m.category === "core");
    expect(core).toHaveLength(6);
  });

  it("all have required fields", () => {
    for (const mod of MODULE_REGISTRY) {
      expect(mod.key).toBeTruthy();
      expect(mod.name).toBeTruthy();
      expect(mod.description).toBeTruthy();
      expect(mod.icon).toBeTruthy();
      expect(["starter", "growth", "pro", "enterprise"]).toContain(mod.requiredPlan);
      expect(["core", "integration", "industry", "community", "premium"]).toContain(mod.category);
      expect(typeof mod.rating).toBe("number");
      expect(Array.isArray(mod.features)).toBe(true);
    }
  });

  it("CRM is starter tier", () => {
    const crm = MODULE_REGISTRY.find((m) => m.key === "crm");
    expect(crm?.requiredPlan).toBe("starter");
  });

  it("reports is enterprise tier", () => {
    const reports = MODULE_REGISTRY.find((m) => m.key === "reports");
    expect(reports?.requiredPlan).toBe("enterprise");
  });

  it("keys are unique", () => {
    const keys = MODULE_REGISTRY.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
