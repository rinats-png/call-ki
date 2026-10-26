"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import type { CustomerType, EmployeeRole } from "@/lib/constants";

export type Me = {
  user: { id: string; email: string; name: string | null; role: string; tenantId: string | null };
  isPlatformAdmin: boolean;
  mfa: { enabled: boolean; setupRequired: boolean };
  tenant: null | {
    id: string; name: string; slug: string; industry: string; status: string; logoUrl: string | null; timezone: string;
    categories: string[]; roleLabels: Record<EmployeeRole, string>; customerTypeLabels: Record<CustomerType, string>; jobNoun: string;
    /** Gebuchte bzw. im Paket enthaltene Zusatzoptionen (src/lib/addons.ts) */
    modules: string[]; hasBills: boolean;
  };
};

type Ctx = { me: Me | null; reload: () => Promise<void>; isTenantAdmin: boolean };

/** Ist die Zusatzoption gebucht? (Oberfläche blendet nicht gebuchte Funktionen aus.) */
export function useModule(key: "invoicing" | "field_app" | "customer_contact"): boolean {
  return !!useSession().me?.tenant?.modules.includes(key);
}
const SessionCtx = createContext<Ctx>({ me: null, reload: async () => {}, isTenantAdmin: false });

/** Wird vom Provider gesetzt: öffnet den Bestätigungsdialog und löst bei Erfolg auf. */
let requestReauth: (() => Promise<boolean>) | null = null;

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

  useEffect(() => {
    if (!me) return;
    // Pflicht-2FA noch nicht eingerichtet → zuerst einrichten
    if (me.mfa.setupRequired && path !== "/account") router.replace("/account?setup=2fa");
    // Plattform-Admin ohne gewählten Kunden → Verwaltung
    else if (me.isPlatformAdmin && !me.tenant && !path.startsWith("/admin") && path !== "/account") router.replace("/admin");
  }, [me, path, router]);

  const isTenantAdmin = !!me && (me.isPlatformAdmin || me.user.role === "TENANT_ADMIN");
  return (
    <SessionCtx.Provider value={{ me, reload, isTenantAdmin }}>
      {children}
      <ReauthDialog mfaEnabled={!!me?.mfa.enabled} />
    </SessionCtx.Provider>
  );
}

export const useSession = () => useContext(SessionCtx);

/** Bestätigung mit Passwort (+ Code) für sensible Aktionen; danach wird die Anfrage wiederholt. */
function ReauthDialog({ mfaEnabled }: { mfaEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    requestReauth = () =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setErr(null);
        setOpen(true);
      });
    return () => {
      requestReauth = null;
    };
  }, []);

  function close(ok: boolean) {
    setOpen(false);
    resolver.current?.(ok);
    resolver.current = null;
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const v = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    const r = await fetch("/api/auth/reauth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: v.password, ...(v.code ? { code: v.code } : {}) }) });
    setBusy(false);
    if (r.ok) return close(true);
    const j = await r.json().catch(() => ({}));
    setErr(j.error ?? "Bestätigung fehlgeschlagen");
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="absolute inset-0 bg-scrim/60 backdrop-blur-sm" onClick={() => close(false)} />
      <form onSubmit={submit} className="glass relative w-full max-w-sm space-y-3 p-5 animate-fadein">
        <h3 className="flex items-center gap-2 font-semibold text-zinc-100"><ShieldCheck className="h-4 w-4 text-cyan-300" />Aktion bestätigen</h3>
        <p className="text-xs text-zinc-400">Zum Schutz Ihres Kontos bestätigen Sie diese Aktion bitte erneut.</p>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-400">Passwort</span>
          <input className="input" name="password" type="password" autoComplete="current-password" required autoFocus />
        </label>
        {mfaEnabled && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-400">Code aus der Authenticator-App</span>
            <input className="input font-mono tracking-widest" name="code" inputMode="numeric" autoComplete="one-time-code" required />
          </label>
        )}
        {err && <p className="text-xs text-amber-400">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => close(false)}>Abbrechen</button>
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Bestätigen</button>
        </div>
      </form>
    </div>
  );
}

type FetchInit = RequestInit & { json?: unknown };

/**
 * JSON-Request mit Fehlermeldung aus der API. Verlangt der Server eine erneute
 * Bestätigung (REAUTH_REQUIRED), öffnet sich der Dialog und die Anfrage wird wiederholt.
 */
export async function apiFetch<T = unknown>(url: string, init?: FetchInit, retried = false): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.json !== undefined ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 403 && data?.details?.code === "REAUTH_REQUIRED" && !retried && requestReauth) {
    if (await requestReauth()) return apiFetch<T>(url, init, true);
    throw new Error("Aktion abgebrochen.");
  }
  if (!res.ok) {
    const fields = data?.details?.fieldErrors ? Object.values(data.details.fieldErrors as Record<string, string[]>).flat().join(" · ") : "";
    throw Object.assign(new Error([data?.error ?? `Fehler ${res.status}`, fields].filter(Boolean).join(": ")), { code: data?.details?.code as string | undefined });
  }
  return data as T;
}

/** Datei-Download nach Berechtigungs-/Re-Auth-Prüfung (z. B. DSGVO-Auskunft). */
export async function apiDownload(url: string, filename: string) {
  let res = await fetch(url);
  if (res.status === 403) {
    const j = await res.clone().json().catch(() => ({}));
    if (j?.details?.code === "REAUTH_REQUIRED" && requestReauth && (await requestReauth())) res = await fetch(url);
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `Fehler ${res.status}`);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
