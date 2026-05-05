import type { ModuleManifest } from "@business360/engine";

export const crmManifest: ModuleManifest = {
  key: "crm",
  name: "CRM",
  description: "Manage leads, deals, and customers in one pipeline.",
  version: "1.0.0",
  requiredPlan: "starter",
  icon: "Users",
  routes: [
    { path: "/dashboard/crm", label: "CRM" },
    { path: "/dashboard/crm/leads", label: "Leads" },
    { path: "/dashboard/crm/deals", label: "Deals" },
    { path: "/dashboard/crm/customers", label: "Customers" },
  ],
  permissions: [
    { key: "crm:leads:read",   label: "View leads",   roles: ["owner", "admin", "member"] },
    { key: "crm:leads:write",  label: "Edit leads",   roles: ["owner", "admin"] },
    { key: "crm:deals:read",   label: "View deals",   roles: ["owner", "admin", "member"] },
    { key: "crm:deals:write",  label: "Edit deals",   roles: ["owner", "admin"] },
    { key: "crm:customers:read",  label: "View customers",  roles: ["owner", "admin", "member"] },
    { key: "crm:customers:write", label: "Edit customers",  roles: ["owner", "admin"] },
  ],
};
