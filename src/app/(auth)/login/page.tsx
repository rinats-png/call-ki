"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { apiFetch } from "@/components/session";

function Login() {
  const router = useRouter();
  const q = useSearchParams();
  const next = q.get("next");
  const [step, setStep] = useState<"password" | "mfa">(q.get("mfa") === "1" ? "mfa" : "password");
  const [useRecovery, setUseRecovery] = useState(false);
  const go = (role?: string) => {
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    router.replace(safeNext ?? (role === "PLATFORM_ADMIN" ? "/admin" : "/"));
  };

  if (step === "mfa") {
    return (
      <AuthForm
        key={useRecovery ? "rc" : "totp"}
        title="Zwei-Faktor-Anmeldung"
        subtitle={useRecovery ? "Geben Sie einen Ihrer Wiederherstellungscodes ein. Jeder Code funktioniert nur einmal." : "Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein."}
        submitLabel="Bestätigen"
        fields={[useRecovery
          ? { name: "code", label: "Wiederherstellungscode", autoComplete: "off" }
          : { name: "code", label: "Code", autoComplete: "one-time-code", inputMode: "numeric" }]}
        onSubmit={async (v) => {
          const r = await apiFetch<{ role: string; recoveryCodesLeft?: number }>("/api/auth/2fa/verify", { method: "POST", json: v });
          if (r.recoveryCodesLeft != null && r.recoveryCodesLeft <= 3) alert(`Hinweis: Es sind nur noch ${r.recoveryCodesLeft} Wiederherstellungscodes übrig. Bitte unter „Konto“ neue erzeugen.`);
          go(r.role);
        }}
        footer={
          <span className="flex justify-center gap-3">
            <button type="button" className="hover:text-cyan-300" onClick={() => setUseRecovery(!useRecovery)}>{useRecovery ? "Code aus der App verwenden" : "Wiederherstellungscode verwenden"}</button>
            <Link href="/login" onClick={() => setStep("password")} className="hover:text-cyan-300">Abbrechen</Link>
          </span>
        }
      />
    );
  }

  return (
    <AuthForm
      title="Anmelden"
      subtitle="Mit Ihrem Zugang zur KI-Telefonzentrale."
      submitLabel="Anmelden"
      fields={[
        { name: "email", label: "E-Mail", type: "email", autoComplete: "username" },
        { name: "password", label: "Passwort", type: "password", autoComplete: "current-password" },
      ]}
      onSubmit={async (v) => {
        const r = await apiFetch<{ role?: string; mfaRequired?: boolean }>("/api/auth/login", { method: "POST", json: v });
        if (r.mfaRequired) setStep("mfa");
        else go(r.role);
      }}
      footer={<Link href="/forgot" className="hover:text-cyan-300">Passwort vergessen?</Link>}
    />
  );
}

export default function Page() {
  return <Suspense><Login /></Suspense>;
}
