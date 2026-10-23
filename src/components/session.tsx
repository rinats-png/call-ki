"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { CustomerType, EmployeeRole } from "@/lib/constants";

export type Me = {
  user: { id: string; email: string; name: string | null; role: string; tenantId: string | null };
  isPlatformAdmin: boolean;
  tenant: null | {
    id: string; name: string; slug: string; industry: string; status: string; logoUrl: string | null; timezone: string;
    categories: string[]; roleLabels: Record<EmployeeRole, string>; customerTypeLabels: Record<CustomerType, string>; jobNoun: string;
  };
};

type Ctx = { me: Me | null; reload: () => Promise<void>; isTenantAdmin: boolean };
const SessionCtx = createContext<Ctx>({ me: null, reload: async () => {}, isTenantAdmin: false });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const router = useRouter();
  const path = usePathname();

  const reload = useCallback(async () => {
    const r = await fetch("/api/auth/me", { cache: "no-store" });
    if (r.status === 401) {
      router.replace(`/login?next=${encodeURIComponent(path)}`);
      return;
    }
    if (r.ok) setMe(await r.json());
  }, [router, path]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Plattform-Admin ohne gewählten Kunden → Verwaltung
  useEffect(() => {
    if (me?.isPlatformAdmin && !me.tenant && !path.startsWith("/admin")) router.replace("/admin");
  }, [me, path, router]);

  const isTenantAdmin = !!me && (me.isPlatformAdmin || me.user.role === "TENANT_ADMIN");
  return <SessionCtx.Provider value={{ me, reload, isTenantAdmin }}>{children}</SessionCtx.Provider>;
}

export const useSession = () => useContext(SessionCtx);

/** Kleiner Helfer für JSON-Requests mit Fehlermeldung aus der API. */
export async function apiFetch<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.json !== undefined ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fields = data?.details?.fieldErrors ? Object.values(data.details.fieldErrors as Record<string, string[]>).flat().join(" · ") : "";
    throw new Error([data?.error ?? `Fehler ${res.status}`, fields].filter(Boolean).join(": "));
  }
  return data as T;
}
