"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { apiFetch } from "@/components/session";

function Login() {
  const router = useRouter();
  const next = useSearchParams().get("next");
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
        const r = await apiFetch<{ role: string }>("/api/auth/login", { method: "POST", json: v });
        const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
        router.replace(safeNext ?? (r.role === "PLATFORM_ADMIN" ? "/admin" : "/"));
      }}
      footer={<Link href="/forgot" className="hover:text-cyan-300">Passwort vergessen?</Link>}
    />
  );
}

export default function Page() {
  return <Suspense><Login /></Suspense>;
}
