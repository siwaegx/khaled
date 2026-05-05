import { PrismaClient } from "../generated/tenant";

const cache = new Map<string, PrismaClient>();

export function getTenantClient(dbUrl: string): PrismaClient {
  if (!cache.has(dbUrl)) {
    cache.set(
      dbUrl,
      new PrismaClient({ datasources: { db: { url: dbUrl } } })
    );
  }
  return cache.get(dbUrl)!;
}

export async function disconnectTenantClient(dbUrl: string): Promise<void> {
  const client = cache.get(dbUrl);
  if (client) {
    await client.$disconnect();
    cache.delete(dbUrl);
  }
}

export async function disconnectAll(): Promise<void> {
  await Promise.all([...cache.values()].map((c) => c.$disconnect()));
  cache.clear();
}
