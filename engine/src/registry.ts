import type { ModuleManifest, Plan } from "./types";
import { planIncludes } from "./types";

const manifests = new Map<string, ModuleManifest>();

export function register(manifest: ModuleManifest): void {
  if (manifests.has(manifest.key)) {
    throw new Error(`Module "${manifest.key}" is already registered`);
  }
  manifests.set(manifest.key, manifest);
}

export function getManifest(key: string): ModuleManifest | undefined {
  return manifests.get(key);
}

export function getAllManifests(): ModuleManifest[] {
  return [...manifests.values()];
}

export function isAvailableForPlan(key: string, plan: Plan): boolean {
  const m = manifests.get(key);
  if (!m) return false;
  return planIncludes(plan, m.requiredPlan);
}

export function getModulesForPlan(plan: Plan): ModuleManifest[] {
  return [...manifests.values()].filter((m) => planIncludes(plan, m.requiredPlan));
}

export function hasPermission(
  moduleKey: string,
  permissionKey: string,
  role: string
): boolean {
  const m = manifests.get(moduleKey);
  if (!m) return false;
  const perm = m.permissions.find((p) => p.key === permissionKey);
  if (!perm) return false;
  return perm.roles.includes(role);
}
