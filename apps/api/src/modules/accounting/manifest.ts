import type { ModuleManifest } from "@business360/engine";

export const accountingManifest: ModuleManifest = {
  key: "accounting",
  name: "Accounting",
  version: "1.0.0",
  description: "Invoices, expenses, accounts payable/receivable, and financial reporting",
  icon: "DollarSign",
  requiredPlan: "pro",
  routes: [
    { path: "/dashboard/accounting",            label: "Overview" },
    { path: "/dashboard/accounting/invoices",   label: "Invoices" },
    { path: "/dashboard/accounting/expenses",   label: "Expenses" },
    { path: "/dashboard/accounting/reports",    label: "Reports" },
  ],
  permissions: [
    { key: "accounting:invoices:read",   label: "View invoices",     roles: ["owner", "admin", "member"] },
    { key: "accounting:invoices:write",  label: "Edit invoices",     roles: ["owner", "admin"] },
    { key: "accounting:expenses:read",   label: "View expenses",     roles: ["owner", "admin", "member"] },
    { key: "accounting:expenses:write",  label: "Edit expenses",     roles: ["owner", "admin"] },
    { key: "accounting:reports:read",    label: "View reports",      roles: ["owner", "admin"] },
  ],
};
