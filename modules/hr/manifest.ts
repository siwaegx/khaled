import type { ModuleManifest } from "@business360/engine";

export const hrManifest: ModuleManifest = {
  key: "hr",
  name: "HR",
  description: "Manage employees, leave requests, and contracts.",
  version: "1.0.0",
  requiredPlan: "pro",
  icon: "UserCheck",
  routes: [
    { path: "/dashboard/hr", label: "HR" },
    { path: "/dashboard/hr/employees", label: "Employees" },
    { path: "/dashboard/hr/leave", label: "Leave" },
    { path: "/dashboard/hr/contracts", label: "Contracts" },
  ],
  permissions: [
    { key: "hr:employees:read",   label: "View employees",   roles: ["owner", "admin", "member"] },
    { key: "hr:employees:write",  label: "Edit employees",   roles: ["owner", "admin"] },
    { key: "hr:leave:read",       label: "View leave",       roles: ["owner", "admin", "member"] },
    { key: "hr:leave:write",      label: "Manage leave",     roles: ["owner", "admin"] },
    { key: "hr:contracts:read",   label: "View contracts",   roles: ["owner", "admin"] },
    { key: "hr:contracts:write",  label: "Edit contracts",   roles: ["owner", "admin"] },
  ],
};
