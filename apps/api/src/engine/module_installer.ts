import { prisma } from "../lib/prisma";
import { getManifest, isAvailableForPlan, getAllManifests } from "@business360/engine";
import { AppError } from "../middleware/errorHandler";
import type { Plan } from "@business360/engine";

export async function installModule(
  orgId: string,
  moduleKey: string,
  orgPlan: Plan
): Promise<void> {
  const manifest = getManifest(moduleKey);
  if (!manifest) throw new AppError(404, `Module "${moduleKey}" not found`);

  if (!isAvailableForPlan(moduleKey, orgPlan)) {
    throw new AppError(
      403,
      `Module "${moduleKey}" requires the ${manifest.requiredPlan} plan or higher`
    );
  }

  await prisma.installedModule.upsert({
    where: { organizationId_moduleKey: { organizationId: orgId, moduleKey } },
    create: { organizationId: orgId, moduleKey, isActive: true },
    update: { isActive: true },
  });
}

export async function uninstallModule(orgId: string, moduleKey: string): Promise<void> {
  const existing = await prisma.installedModule.findUnique({
    where: { organizationId_moduleKey: { organizationId: orgId, moduleKey } },
  });
  if (!existing) throw new AppError(404, "Module not installed");

  const allModules = getAllManifests();
  const installed = await prisma.installedModule.findMany({
    where: { organizationId: orgId, isActive: true, moduleKey: { not: moduleKey } },
    select: { moduleKey: true },
  });
  const installedKeys = installed.map((m) => m.moduleKey);
  const dependents = installedKeys.filter((key) => {
    const m = allModules.find((mm) => mm.key === key);
    // modules don't have explicit deps yet — placeholder for future use
    return false;
  });
  if (dependents.length > 0) {
    throw new AppError(400, `Cannot uninstall: required by ${dependents.join(", ")}`);
  }

  await prisma.installedModule.update({
    where: { organizationId_moduleKey: { organizationId: orgId, moduleKey } },
    data: { isActive: false },
  });
}
