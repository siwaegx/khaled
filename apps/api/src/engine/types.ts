export type PlanTier = "starter" | "growth" | "pro" | "enterprise";

export interface ModuleManifest {
  key: string;
  name: string;
  version: string;
  description: string;
  icon: string;
  routes: string[];
  permissions: string[];
  dependencies: string[];
  planRequired: PlanTier;
}

export interface ModuleWithStatus extends ModuleManifest {
  installed: boolean;
  active: boolean;
}
