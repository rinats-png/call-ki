"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, KeyRound, Loader2, MailCheck } from "lucide-react";
import { apiFetch } from "@/components/session";

/** Passwort vergessen: Formular, danach eine eigene Bestätigung mit den nächsten Schritten. */
export default function Page() {
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request(email: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/auth/forgot", { method: "POST", json: { email } });
      setSent(email);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-5">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400/15 text-cyan-300"><MailCheck className="h-6 w-6" /></span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-50">Prüfen Sie Ihr Postfach</h1>
          <p className="mt-1 text-sm text-zinc-500">Falls ein Zugang zu <b className="break-all text-zinc-200">{sent}</b> existiert, ist eine E-Mail mit einem Link unterwegs.</p>
        </div>
        <ol className="glass-soft space-y-2 p-4 text-sm text-zinc-300">
          <li className="flex gap-3"><span className="font-bold text-cyan-300">1</span>Link in der E-Mail öffnen. Er ist 30 Minuten gültig.</li>
          <li className="flex gap-3"><span className="font-bold text-cyan-300">2</span>Neues Passwort mit mindestens 12 Zeichen wählen.</li>
          <li className="flex gap-3"><span className="font-bold text-cyan-300">3</span>Mit dem neuen Passwort anmelden.</li>
        </ol>
        <p className="text-xs leading-relaxed text-zinc-500">Keine E-Mail? Schauen Sie im Spam-Ordner nach. Ihr Administrator kann Ihnen auch direkt einen Link erzeugen.</p>
        {error && <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">{error}</p>}
        <div className="flex flex-col gap-2">
          <Link href="/login" className="btn-primary w-full py-3 text-base">Zur Anmeldung</Link>
          <button type="button" className="btn-ghost w-full" disabled={busy} onClick={() => request(sent)}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Erneut senden</button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        request(String(new FormData(e.currentTarget).get("email") ?? ""));
      }}
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400/15 text-cyan-300"><KeyRound className="h-6 w-6" /></span>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-50">Passwort vergessen?</h1>
        <p className="mt-1 text-sm text-zinc-500">Geben Sie die E-Mail-Adresse Ihres Zugangs ein. Wir senden Ihnen einen Link, mit dem Sie ein neues Passwort festlegen.</p>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-zinc-300">E-Mail</span>
        <input id="forgot-email" className="input" name="email" type="email" autoComplete="username" required maxLength={200} autoFocus />
      </label>
      {error && <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">{error}</p>}
      <button className="btn-primary w-full py-3 text-base" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Link anfordern</button>
      <div className="pt-1 text-center text-sm">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-cyan-300"><ArrowLeft className="h-4 w-4" />Zurück zur Anmeldung</Link>
      </div>
    </form>
  );
}
