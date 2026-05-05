import type { ModuleManifest } from "@business360/engine";

export const inventoryManifest: ModuleManifest = {
  key: "inventory",
  name: "Inventory",
  version: "1.0.0",
  description: "Track products, stock levels, warehouses, and purchase orders",
  icon: "Package",
  requiredPlan: "growth",
  routes: [
    { path: "/dashboard/inventory",              label: "Overview" },
    { path: "/dashboard/inventory/products",     label: "Products" },
    { path: "/dashboard/inventory/warehouses",   label: "Warehouses" },
    { path: "/dashboard/inventory/orders",       label: "Purchase Orders" },
  ],
  permissions: [
    { key: "inventory:products:read",   label: "View products",         roles: ["owner", "admin", "member"] },
    { key: "inventory:products:write",  label: "Edit products",         roles: ["owner", "admin"] },
    { key: "inventory:stock:read",      label: "View stock levels",     roles: ["owner", "admin", "member"] },
    { key: "inventory:warehouses:manage",label: "Manage warehouses",    roles: ["owner", "admin"] },
    { key: "inventory:orders:read",     label: "View purchase orders",  roles: ["owner", "admin", "member"] },
    { key: "inventory:orders:write",    label: "Edit purchase orders",  roles: ["owner", "admin"] },
  ],
};
