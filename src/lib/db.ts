import { PrismaClient } from "@prisma/client";
import { getConnectionString } from "@netlify/database";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Lokal: SQLite aus prisma/schema.prisma.
 * Gehostet: PostgreSQL-Client (prisma/postgres) mit DATABASE_URL bzw. Netlify Database.
 */
function resolveDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.NETLIFY_DB_URL) return process.env.NETLIFY_DB_URL;
  try {
    return getConnectionString();
  } catch {
    return undefined; // nicht auf Netlify → SQLite-Default aus dem Schema
  }
}

function createClient() {
  const url = resolveDatabaseUrl();
  return new PrismaClient({
    ...(url ? { datasourceUrl: url } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
