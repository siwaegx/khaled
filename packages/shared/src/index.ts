export type Plan = "starter" | "growth" | "pro" | "enterprise";
export type OrgRole = "owner" | "manager" | "member";
export type StoreCategory = "core" | "integration" | "industry" | "community" | "premium";

export const PLANS: Record<Plan, { label: string; price: number; modules: string[] }> = {
  starter:    { label: "Starter",    price: 29,  modules: ["crm", "contacts"] },
  growth:     { label: "Growth",     price: 79,  modules: ["crm", "contacts", "inventory"] },
  pro:        { label: "Pro",        price: 149, modules: ["crm", "contacts", "inventory", "accounting", "hr"] },
  enterprise: { label: "Enterprise", price: 299, modules: ["crm", "contacts", "inventory", "accounting", "hr", "projects", "reports"] },
};

// ModuleMeta is the enriched type returned by /api/store/catalog
export interface ModuleMeta {
  key: string;
  name: string;
  description: string;
  longDescription?: string;
  icon: string;
  requiredPlan: Plan;
  category?: StoreCategory;
  version: string;
  author?: string;
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  features?: string[];
  price?: number | null;
  isComingSoon?: boolean;
  // Enriched at API level
  installed?: boolean;
  available?: boolean;
}
