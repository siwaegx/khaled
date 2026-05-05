import type { ModuleManifest } from "@business360/engine";

export const inventoryManifest: ModuleManifest = {
  key: "inventory",
  name: "Inventory",
  description: "Track stock levels, warehouses, and transfers.",
  version: "1.0.0",
  requiredPlan: "growth",
  icon: "Boxes",
  routes: [
    { path: "/dashboard/inventory", label: "Inventory" },
    { path: "/dashboard/inventory/products", label: "Products" },
    { path: "/dashboard/inventory/warehouses", label: "Warehouses" },
    { path: "/dashboard/inventory/transfers", label: "Transfers" },
  ],
  permissions: [
    { key: "inventory:products:read",    label: "View products",    roles: ["owner", "admin", "member"] },
    { key: "inventory:products:write",   label: "Edit products",    roles: ["owner", "admin"] },
    { key: "inventory:warehouses:read",  label: "View warehouses",  roles: ["owner", "admin", "member"] },
    { key: "inventory:warehouses:write", label: "Edit warehouses",  roles: ["owner", "admin"] },
    { key: "inventory:transfers:read",   label: "View transfers",   roles: ["owner", "admin", "member"] },
    { key: "inventory:transfers:write",  label: "Create transfers", roles: ["owner", "admin"] },
  ],
};
