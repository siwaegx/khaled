import type { ModuleManifest } from "@business360/engine";

export const reportsManifest: ModuleManifest = {
  key: "reports",
  name: "Reports",
  description: "KPI dashboards, cross-module analytics, and exports.",
  version: "1.0.0",
  requiredPlan: "enterprise",
  icon: "BarChart3",
  routes: [
    { path: "/dashboard/reports", label: "Reports" },
    { path: "/dashboard/reports/kpis", label: "KPIs" },
    { path: "/dashboard/reports/exports", label: "Exports" },
  ],
  permissions: [
    { key: "reports:read",   label: "View reports",   roles: ["owner", "admin"] },
    { key: "reports:export", label: "Export reports", roles: ["owner", "admin"] },
  ],
};
