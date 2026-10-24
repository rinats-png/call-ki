"use client";

import Link from "next/link";
import { ArrowRight, Download, FlaskConical, LogOut, PhoneCall, Plug, Plus, Users, Wrench } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { cn, eur, fmtDuration } from "@/lib/ui";
import { ThemeToggle } from "./ThemeToggle";
import { apiDownload, apiFetch, type Me } from "./session";
import { LiveDot } from "./hub/Primitives";

const nf = (n: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(n);
const initialsOf = (s: string) => s.split(/[\s@.]+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

/** Rechte Spalte im Glasfenster: Profil, Schnellaktionen, leuchtende Karte, kurze Liste. */
export function SidePanel({ me, admin, onLogout }: { me: Me; admin: boolean; onLogout: () => void }) {
  const name = me.user.name ?? me.user.email;
  return (
    <div className="flex min-h-[calc(100vh-2.5rem)] flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-2">
        <ThemeToggle compact />
        {admin ? (
          <span className="chip border-transparent bg-cyan-400/15 text-cyan-300">Plattform-Admin</span>
        ) : (
          <span className={cn("chip border-transparent", me.tenant?.status === "PAUSED" ? "bg-amber-400/15 text-amber-300" : "bg-emerald-400/15 text-emerald-300")}>
            <LiveDot color={me.tenant?.status === "PAUSED" ? "amber" : "emerald"} />
            {me.tenant?.status === "PAUSED" ? "Pausiert" : "KI erreichbar"}
          </span>
        )}
      </div>

      <Link href="/account" className="group text-center" title="Mein Konto">
        <span className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-cyan-500 text-lg font-extrabold text-white glow-accent" style={{ boxShadow: "0 0 0 4px rgb(var(--glass) / var(--glass-alpha)), 0 0 26px rgb(var(--acg) / var(--acg-alpha))" }}>
          {initialsOf(name) || "?"}
        </span>
        <span className="block truncate text-xs text-zinc-500">{admin ? "Plattform-Admin" : me.tenant?.name}</span>
        <span className="block truncate text-[15px] font-bold text-zinc-50 group-hover:text-cyan-300">{name}</span>
      </Link>

      {admin ? <AdminBlocks /> : <TenantBlocks />}

      <button type="button" onClick={onLogout} className="glass-soft mt-auto flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-zinc-200 transition hover:text-zinc-50">
        Abmelden<LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

function QuickAction({ href, onClick, icon: Icon, label }: { href?: string; onClick?: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  const inner = (
    <>
      <span className="glass-soft mx-auto mb-1.5 grid h-10 w-10 place-items-center rounded-full text-zinc-100 transition group-hover:text-cyan-300"><Icon className="h-4 w-4" /></span>
      <span className="block text-[10px] leading-tight text-zinc-500">{label}</span>
    </>
  );
  return href ? <Link href={href} className="group text-center">{inner}</Link> : <button type="button" onClick={onClick} className="group text-center">{inner}</button>;
}

type Billing = { plan: { name: string; hasPlan: boolean; includedMinutes: number; overageMode: string; overageCentsPerMinute?: number }; usage: { minutes: number }; projectedMinutes: number; daily: { day: number }[] };
type CallRow = { id: string; fromNumber: string; startedAt: string; durationSec: number | null; status: string; customer: { name: string | null; companyName: string | null } | null; tickets: { urgency: string; category: string | null }[] };

function TenantBlocks() {
  const { data: b } = usePoll<Billing>("/api/billing", 60_000);
  const { data: calls } = usePoll<{ calls: CallRow[] }>("/api/calls", 30_000);
  const incl = b?.plan.hasPlan ? b.plan.includedMinutes : 0;
  const used = b?.usage.minutes ?? 0;
  const pct = incl > 0 ? Math.min(100, (used / incl) * 100) : 0;
  const over = b && incl > 0 ? Math.max(0, b.projectedMinutes - incl) : 0;
  const daysLeft = b ? Math.max(0, b.daily.length - new Date().getDate()) : 0;
  const month = new Date().toLocaleDateString("de-DE", { month: "long" });

  return (
    <>
      <div className="grid grid-cols-4 gap-1">
        <QuickAction href="/?erfassen=1" icon={Plus} label="Anruf erfassen" />
        <QuickAction href="/calls" icon={PhoneCall} label="Anrufe" />
        <QuickAction href="/customers" icon={Users} label="Kunden" />
        <QuickAction href="/team" icon={Wrench} label="Team" />
      </div>

      <Link href="/settings/plan" className="hero block p-4 transition hover:brightness-110">
        <span className="flex items-center justify-between text-[11px] font-bold tracking-[0.08em] opacity-90"><span>KONTINGENT</span><span className="font-medium tracking-normal opacity-85">{b?.plan.hasPlan ? `Paket ${b.plan.name}` : ""}</span></span>
        <span className="mt-5 block text-[11px] opacity-85">{month} · noch {daysLeft} Tage</span>
        <span className="block text-3xl font-extrabold tracking-tight tabular-nums">{b ? nf(used) : "–"}{incl > 0 && <span className="text-base font-semibold opacity-85"> / {nf(incl)} Min.</span>}</span>
        {incl > 0 && (
          <>
            <span className="mt-2.5 block h-1.5 rounded-full bg-white/25"><span className="block h-full rounded-full bg-white" style={{ width: `${pct}%`, boxShadow: "0 0 12px rgb(255 255 255 / 0.7)" }} /></span>
            <span className="mt-2 flex justify-between text-[10.5px] opacity-90"><span>Prognose {nf(b!.projectedMinutes)} Min.</span><span>{over > 0 ? (b!.plan.overageMode === "BLOCK" ? "reicht nicht" : `≈ ${eur(over * (b!.plan.overageCentsPerMinute ?? 0))} extra`) : "im Paket"}</span></span>
          </>
        )}
        <Wave />
      </Link>

      <div className="text-sm font-bold text-zinc-100">Letzte Anrufe</div>
      <ul className="space-y-2">
        {calls?.calls.slice(0, 3).map((c) => {
          const t = c.tickets[0];
          return (
            <li key={c.id}>
              <Link href="/calls" className="glass-soft flex items-center gap-2.5 px-2.5 py-2 transition hover:brightness-110">
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", t?.urgency === "CRITICAL" ? "bg-rose-400/15 text-rose-400" : "bg-cyan-400/15 text-cyan-300")}><PhoneCall className="h-3.5 w-3.5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-zinc-100">{c.customer?.companyName ?? c.customer?.name ?? c.fromNumber}</span>
                  <span className="block text-[10.5px] text-zinc-500">{new Date(c.startedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} · {fmtDuration(c.durationSec)}</span>
                </span>
                {t?.category && <span className={cn("chip border-transparent", t.urgency === "CRITICAL" ? "bg-rose-400/15 text-rose-400" : "bg-cyan-400/15 text-cyan-300")}>{t.urgency === "CRITICAL" ? "Notfall" : t.category}</span>}
              </Link>
            </li>
          );
        })}
        {calls && calls.calls.length === 0 && <li className="text-xs text-zinc-500">Noch keine Anrufe.</li>}
      </ul>
      <Link href="/calls" className="glass-soft flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-zinc-200 hover:text-zinc-50">Alle Anrufe<ArrowRight className="h-4 w-4" /></Link>
    </>
  );
}

type AdminBilling = { rows: { tenantId: string; tenantName: string; usagePercent: number | null; usage: { minutes: number }; plan: { includedMinutes: number } }[]; totals: { netCents: number; costCents: number; marginCents: number } };

function AdminBlocks() {
  const { data } = usePoll<AdminBilling>("/api/admin/billing", 120_000);
  const t = data?.totals;
  const month = new Date().toLocaleDateString("de-DE", { month: "long" }).toUpperCase();
  const rows = [...(data?.rows ?? [])].sort((a, b) => (b.usagePercent ?? -1) - (a.usagePercent ?? -1)).slice(0, 5);
  const ym = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  return (
    <>
      <div className="grid grid-cols-4 gap-1">
        <QuickAction href="/admin?neu=1" icon={Plus} label="Neuer Kunde" />
        <QuickAction onClick={async () => { const r = await apiFetch<{ id: string }>("/api/admin/demo", { method: "POST" }); location.href = `/admin/tenants/${r.id}`; }} icon={FlaskConical} label="Test-Kunde" />
        <QuickAction onClick={() => apiDownload(`/api/admin/billing?month=${ym}&format=csv`, `abrechnung-${ym}.csv`)} icon={Download} label="CSV" />
        <QuickAction href="/admin/platform" icon={Plug} label="Verbin­dungen" />
      </div>

      <Link href="/admin/billing" className="hero block p-4 transition hover:brightness-110">
        <span className="flex items-center justify-between text-[11px] font-bold tracking-[0.08em] opacity-90"><span>UMSATZ {month}</span><span className="font-medium tracking-normal opacity-85">netto</span></span>
        <span className="mt-6 block text-3xl font-extrabold tracking-tight tabular-nums">{t ? eur(t.netCents, { decimals: 0 }) : "–"}</span>
        <span className="mt-2 flex justify-between text-[10.5px] opacity-90"><span>Kosten {t ? eur(t.costCents, { decimals: 0 }) : "–"}</span><span>Marge {t && t.netCents > 0 ? Math.round((t.marginCents / t.netCents) * 100) : 0} %</span></span>
        <Wave />
      </Link>

      <div className="flex items-baseline justify-between"><span className="text-sm font-bold text-zinc-100">Kontingent</span><span className="text-[11px] text-zinc-500">höchste zuerst</span></div>
      <ul className="space-y-2">
        {rows.map((r) => {
          const p = r.usagePercent ?? 0;
          const color = p > 100 ? "stroke-rose-400" : p >= 85 ? "stroke-amber-400" : "stroke-cyan-400";
          return (
            <li key={r.tenantId}>
              <Link href={`/admin/tenants/${r.tenantId}`} className="glass-soft flex items-center gap-2.5 px-2.5 py-2 transition hover:brightness-110">
                <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden className="shrink-0">
                  <circle cx="20" cy="20" r="15" fill="none" className="stroke-zinc-700/50" strokeWidth="5" />
                  <circle cx="20" cy="20" r="15" fill="none" className={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(94.2 * Math.min(p, 100)) / 100} 94.2`} transform="rotate(-90 20 20)" />
                </svg>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-zinc-100">{r.tenantName}</span>
                  <span className="block text-[10.5px] text-zinc-500">{nf(r.usage.minutes)}{r.plan.includedMinutes ? ` / ${nf(r.plan.includedMinutes)}` : ""} Min.</span>
                </span>
                <span className={cn("text-xs font-bold tabular-nums", p > 100 ? "text-rose-400" : p >= 85 ? "text-amber-400" : "text-zinc-500")}>{r.usagePercent == null ? "–" : `${p} %`}</span>
              </Link>
            </li>
          );
        })}
        {data && rows.length === 0 && <li className="text-xs text-zinc-500">Noch keine Kunden.</li>}
      </ul>
      <Link href="/admin/billing" className="glass-soft flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-zinc-200 hover:text-zinc-50">Zur Abrechnung<ArrowRight className="h-4 w-4" /></Link>
    </>
  );
}

function Wave() {
  return (
    <svg viewBox="0 0 200 60" aria-hidden className="pointer-events-none absolute -right-5 top-5 w-40 opacity-25">
      <path d="M0 40 C30 10 50 60 80 30 S130 0 160 30 S190 50 200 20" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M0 50 C30 20 50 70 80 40 S130 10 160 40 S190 60 200 30" fill="none" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}
