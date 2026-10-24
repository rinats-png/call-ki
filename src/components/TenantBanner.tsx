"use client";

import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { apiFetch, useSession } from "./session";

/** Hinweis, wenn der Plattform-Admin das Portal eines Kunden geöffnet hat. */
export function TenantBanner() {
  const { me, reload } = useSession();
  const router = useRouter();
  if (!me?.isPlatformAdmin || !me.tenant) return null;
  return (
    <div className="mx-auto mb-4 flex max-w-[1500px] flex-wrap items-center justify-between gap-2 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200">
      <span className="flex min-w-0 items-start gap-2"><Eye className="mt-0.5 h-4 w-4 shrink-0" /><span>Sie sehen das Portal von <b>{me.tenant.name}</b> (Support-Zugriff, wird protokolliert).</span></span>
      <button
        className="btn-ghost py-1 text-xs"
        onClick={async () => {
          await apiFetch("/api/admin/switch", { method: "POST", json: { tenantId: null } });
          await reload();
          router.push("/admin");
        }}
      >
        Zur Verwaltung
      </button>
    </div>
  );
}
