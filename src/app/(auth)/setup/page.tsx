"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { apiFetch } from "@/components/session";

/** Ersteinrichtung des Plattform-Admins (nur solange keiner existiert). */
export default function Page() {
  const router = useRouter();
  const [state, setState] = useState<{ needed: boolean; tokenConfigured: boolean } | null>(null);
  useEffect(() => {
    apiFetch<{ needed: boolean; tokenConfigured: boolean }>("/api/auth/setup").then(setState).catch(() => setState({ needed: false, tokenConfigured: false }));
  }, []);

  if (!state) return <p className="text-sm text-zinc-500">Prüfe …</p>;
  if (!state.needed) return <p className="text-sm text-zinc-400">Die Einrichtung ist abgeschlossen. <a className="text-cyan-300" href="/login">Zur Anmeldung</a></p>;
  if (!state.tokenConfigured) return <p className="text-sm text-amber-300">Bitte zuerst <code>SETUP_TOKEN</code> in der Server-Konfiguration (.env) setzen und die App neu starten.</p>;

  return (
    <AuthForm
      title="Ersteinrichtung"
      subtitle="Legen Sie den Plattform-Administrator an. Das Setup-Token steht in Ihrer .env-Datei."
      submitLabel="Administrator anlegen"
      fields={[
        { name: "setupToken", label: "Setup-Token", type: "password" },
        { name: "name", label: "Name", autoComplete: "name" },
        { name: "email", label: "E-Mail", type: "email", autoComplete: "username" },
        { name: "password", label: "Passwort", type: "password", autoComplete: "new-password", hint: "Mindestens 12 Zeichen." },
      ]}
      onSubmit={async (v) => {
        await apiFetch("/api/auth/setup", { method: "POST", json: v });
        router.replace("/admin");
      }}
    />
  );
}
