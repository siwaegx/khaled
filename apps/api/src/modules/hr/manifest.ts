import type { ModuleManifest } from "@business360/engine";

export const hrManifest: ModuleManifest = {
  key: "hr",
  name: "HR",
  version: "1.0.0",
  description: "Employee records, leave management, payroll, and org chart",
  icon: "Briefcase",
  requiredPlan: "pro",
  routes: [
    { path: "/dashboard/hr",             label: "Overview" },
    { path: "/dashboard/hr/employees",   label: "Employees" },
    { path: "/dashboard/hr/leave",       label: "Leave" },
    { path: "/dashboard/hr/payroll",     label: "Payroll" },
  ],
  permissions: [
    { key: "hr:employees:read",   label: "View employees",  roles: ["owner", "admin", "member"] },
    { key: "hr:employees:write",  label: "Edit employees",  roles: ["owner", "admin"] },
    { key: "hr:leave:manage",     label: "Manage leave",    roles: ["owner", "admin"] },
    { key: "hr:payroll:read",     label: "View payroll",    roles: ["owner", "admin"] },
    { key: "hr:payroll:manage",   label: "Manage payroll",  roles: ["owner"] },
  ],
};
