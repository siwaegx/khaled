import type { ModuleManifest } from "@business360/engine";

export const reportsManifest: ModuleManifest = {
  key: "reports",
  name: "Reports",
  version: "1.0.0",
  description: "KPI dashboards, cross-module analytics, and exports",
  icon: "BarChart3",
  requiredPlan: "enterprise",
  routes: [
    { path: "/dashboard/reports",            label: "Dashboards" },
    { path: "/dashboard/reports/analytics",  label: "Analytics" },
  ],
  permissions: [
    { key: "reports:view",   label: "View reports",   roles: ["owner", "admin", "member"] },
    { key: "reports:export", label: "Export reports", roles: ["owner", "admin"] },
  ],
};
