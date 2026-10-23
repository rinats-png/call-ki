import type { Tenant } from "@prisma/client";
import { prisma } from "../db";
import { notFound } from "../http";
import { resolveConfig, type TenantConfig } from "./settings";

export type LoadedTenant = { tenant: Tenant; cfg: TenantConfig };

export async function loadTenant(tenantId: string): Promise<LoadedTenant> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw notFound("Mandant");
  return { tenant, cfg: resolveConfig(tenant) };
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "kunde"
  );
}
