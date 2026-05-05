import type { ModuleManifest } from "@business360/engine";

export const accountingManifest: ModuleManifest = {
  key: "accounting",
  name: "Accounting",
  description: "Invoices, expenses, and financial reports.",
  version: "1.0.0",
  requiredPlan: "pro",
  icon: "Calculator",
  routes: [
    { path: "/dashboard/accounting", label: "Accounting" },
    { path: "/dashboard/accounting/invoices", label: "Invoices" },
    { path: "/dashboard/accounting/expenses", label: "Expenses" },
    { path: "/dashboard/accounting/reports", label: "Reports" },
  ],
  permissions: [
    { key: "accounting:invoices:read",  label: "View invoices",  roles: ["owner", "admin", "member"] },
    { key: "accounting:invoices:write", label: "Edit invoices",  roles: ["owner", "admin"] },
    { key: "accounting:expenses:read",  label: "View expenses",  roles: ["owner", "admin", "member"] },
    { key: "accounting:expenses:write", label: "Edit expenses",  roles: ["owner", "admin"] },
    { key: "accounting:reports:read",   label: "View reports",   roles: ["owner", "admin"] },
  ],
};
