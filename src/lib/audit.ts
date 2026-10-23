import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { logger } from "./logger";

/** Revisionssicheres Protokoll sicherheits- und datenschutzrelevanter Aktionen. */
export async function audit(entry: { tenantId?: string | null; userId?: string | null; action: string; target?: string; meta?: Prisma.InputJsonValue }) {
  try {
    await prisma.auditLog.create({ data: { tenantId: entry.tenantId ?? null, userId: entry.userId ?? null, action: entry.action, target: entry.target, meta: entry.meta } });
  } catch (err) {
    logger.error("audit.failed", { action: entry.action, error: (err as Error).message });
  }
}
