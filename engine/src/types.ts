export type Plan = "starter" | "growth" | "pro" | "enterprise";

const PLAN_RANK: Record<Plan, number> = {
  starter: 0,
  growth: 1,
  pro: 2,
  enterprise: 3,
};

export function planIncludes(orgPlan: Plan, requiredPlan: Plan): boolean {
  return PLAN_RANK[orgPlan] >= PLAN_RANK[requiredPlan];
}

export interface ModulePermission {
  key: string;    // e.g. "crm:leads:read"
  label: string;
  roles: string[]; // which org roles get this permission by default
}

export interface ModuleRoute {
  path: string;  // e.g. "/dashboard/crm"
  label: string;
}

export type StoreCategory = "core" | "integration" | "industry" | "community" | "premium";

export interface ModuleManifest {
  key: string;
  name: string;
  description: string;
  version: string;
  requiredPlan: Plan;
  icon: string;
  routes: ModuleRoute[];
  permissions: ModulePermission[];
  // Store metadata — populated from manifest.json, used by the App Store
  category?: StoreCategory;
  longDescription?: string;
  author?: string;
  tags?: string[];
  features?: string[];
  price?: number | null;
  rating?: number;
  reviewCount?: number;
  isComingSoon?: boolean;
}
