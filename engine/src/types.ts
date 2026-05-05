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

export interface ModuleManifest {
  key: string;           // unique identifier, e.g. "crm"
  name: string;          // display name
  description: string;
  version: string;
  requiredPlan: Plan;
  icon: string;          // lucide icon name
  routes: ModuleRoute[];
  permissions: ModulePermission[];
}
