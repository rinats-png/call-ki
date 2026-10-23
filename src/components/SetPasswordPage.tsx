"use client";

import { useRouter } from "next/navigation";
import { AuthForm } from "./AuthForm";
import { apiFetch } from "./session";

export function SetPasswordPage({ token, type }: { token: string; type: "INVITE" | "PASSWORD_RESET" }) {
  const router = useRouter();
  const invite = type === "INVITE";
  return (
    <AuthForm
      title={invite ? "Zugang einrichten" : "Neues Passwort"}
      subtitle={invite ? "Willkommen! Legen Sie Ihren Namen und ein Passwort fest." : "Legen Sie ein neues Passwort fest."}
      submitLabel={invite ? "Zugang aktivieren" : "Passwort speichern"}
      fields={[
        ...(invite ? [{ name: "name", label: "Ihr Name", autoComplete: "name", required: false }] : []),
        { name: "password", label: "Passwort", type: "password", autoComplete: "new-password", hint: "Mindestens 10 Zeichen – ein Satz ist sicherer als Sonderzeichen." },
        { name: "password2", label: "Passwort wiederholen", type: "password", autoComplete: "new-password" },
      ]}
      onSubmit={async (v) => {
        if (v.password !== v.password2) throw new Error("Die Passwörter stimmen nicht überein.");
        await apiFetch("/api/auth/reset", { method: "POST", json: { token, type, password: v.password, ...(v.name ? { name: v.name } : {}) } });
        router.replace("/");
      }}
    />
  );
}
