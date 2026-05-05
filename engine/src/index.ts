export type { ModuleManifest, ModulePermission, ModuleRoute, Plan } from "./types";
export { planIncludes } from "./types";
export {
  register,
  getManifest,
  getAllManifests,
  isAvailableForPlan,
  getModulesForPlan,
  hasPermission,
} from "./registry";
