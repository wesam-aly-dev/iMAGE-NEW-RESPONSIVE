import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === "production") {
    return globalForPrisma.prisma ?? (globalForPrisma.prisma = new PrismaClient());
  }

  // In development, verify the in-memory client has the latest runtime model
  if (globalForPrisma.prisma) {
    const contactFields = (globalForPrisma.prisma as any)._runtimeDataModel?.models?.ContactPage?.fields;
    const homepageFields = (globalForPrisma.prisma as any)._runtimeDataModel?.models?.Homepage?.fields;
    const contactHasHero = Array.isArray(contactFields) && contactFields.some((f: any) => f.name === "heroEnabled");
    const homepageHasTeamHero = Array.isArray(homepageFields) && homepageFields.some((f: any) => f.name === "teamHeroEnabled");

    if (!contactHasHero || !homepageHasTeamHero) {
      console.warn("[prisma.ts] Stale in-memory PrismaClient detected. Re-initializing PrismaClient with latest schema...");
      try {
        globalForPrisma.prisma.$disconnect().catch(() => {});
      } catch {}
      globalForPrisma.prisma = new PrismaClient();
    }
    return globalForPrisma.prisma;
  }

  globalForPrisma.prisma = new PrismaClient();
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = (client as any)[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
