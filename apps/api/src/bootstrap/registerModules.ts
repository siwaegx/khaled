import { register } from "@business360/engine";
import { crmManifest } from "../modules/crm/manifest";
import { inventoryManifest } from "../modules/inventory/manifest";
import { accountingManifest } from "../modules/accounting/manifest";
import { hrManifest } from "../modules/hr/manifest";
import { projectsManifest } from "../modules/projects/manifest";
import { reportsManifest } from "../modules/reports/manifest";

export function bootstrapModules(): void {
  register(crmManifest);
  register(inventoryManifest);
  register(accountingManifest);
  register(hrManifest);
  register(projectsManifest);
  register(reportsManifest);
}
