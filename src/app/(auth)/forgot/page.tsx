"use client";

import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { apiFetch } from "@/components/session";

export default function Page() {
  return (
    <AuthForm
      title="Passwort vergessen"
      subtitle="Wir senden Ihnen einen Link zum Zurücksetzen."
      submitLabel="Link anfordern"
      fields={[{ name: "email", label: "E-Mail", type: "email", autoComplete: "username" }]}
      onSubmit={async (v) => {
        await apiFetch("/api/auth/forgot", { method: "POST", json: v });
        return "Falls ein Zugang zu dieser Adresse existiert, ist eine E-Mail unterwegs. Kein Postfachzugriff? Ihr Administrator kann einen Link erzeugen.";
      }}
      footer={<Link href="/login" className="hover:text-cyan-300">Zurück zur Anmeldung</Link>}
    />
  );
}
