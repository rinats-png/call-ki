# Daten und Rechte

> Phasen 11 und 12 (beide „in Arbeit“), Stand 2026-10-24. **Maßgeblich:** `docs/idea-to-app/11-daten.md` (Datenmodell, Klassifizierung, Fristen, Datenflüsse zu Anbietern) und `docs/idea-to-app/12-berechtigungen.md` (Rollen, Berechtigungsmatrix, Telefon-KI, technische Absender, Pflicht-Testfälle). Schema: `prisma/schema.prisma`.

## Datenmodell – Grundsätze

- Jede fachliche Tabelle trägt `tenantId`; Zugriffe nur mit `tenantId` aus der Sitzung bzw. aus der eigenen Anrufzeile.
- Plattform-Tabellen ohne Mandant: `PlatformSetting`, `Plan`, `SystemState`, `RateLimitHit`.
- `BillingSnapshot` (Monatsabschluss, `48e363a`) trägt `tenantId` bewusst ohne Fremdschlüssel, damit Abrechnungssummen nach Mandanten-Löschung erhalten bleiben (GoBD, `docs/recht/loeschkonzept.md` §5).
- Sensible Inhaltsdaten: Transkripte, Zusammenfassungen, Aufnahmen, Vorgangsnotizen – können Gesundheitsangaben enthalten (E-017). Nicht feldverschlüsselt; nie in Logs, SMS-Texte oder Alarme.
- Verschlüsselt (AES-256-GCM, `src/lib/secret-box.ts`): TOTP-Secrets, Anbieter-Schlüssel in der Oberfläche, Google-Refresh-Tokens.
- Kundendaten: SMS-Einwilligung/-Widerspruch (`smsConsentAt`, `smsConsentSource`, `smsOptOutAt`), Aufzeichnungs-Einwilligung am Anruf (`ae31147`).
- Löschfrist je Mandant (Standard 365 Tage) für Transkripte/Aufnahmen in der DB **und** bei den Anbietern; Anrufe erst nach Monatsabschluss; DSGVO-Löschung eines Anrufers anonymisiert Abrechnungsdaten; Betreiber-Alarme nach 90 Tagen. Offen: Frist für `CallTicket.summary`/`notes` (Entscheidung, `docs/OFFENE-PUNKTE.md`).
- Neue Datenfelder sind eine **wesentliche Abweichung** (AGENTS.md Abschnitt 7) und ziehen `docs/recht/verarbeitungsverzeichnis.md`, `docs/recht/loeschkonzept.md` und `11-daten.md` nach.

## Rollen und Rechte – Kurzfassung

| Rolle | Darf |
|---|---|
| Gast | Login, Passwort vergessen, Einladungs-/Reset-Link, Ersteinrichtung (nur mit `SETUP_TOKEN`, nur ohne Plattform-Admin), `/api/health` |
| Kunden-Mitarbeiter (`TENANT_USER`) | Vorgänge, Anrufe, Kunden des eigenen Mandanten; keine Einstellungen, Benutzer, DSGVO-Löschung [A-014] |
| Kunden-Admin (`TENANT_ADMIN`) | alles im eigenen Mandanten inkl. Team, KI-Texte, Integrationen, Benutzer, Protokoll, Export, DSGVO-Löschung (sensible Aktionen mit Re-Auth) |
| Plattform-Admin (`PLATFORM_ADMIN`) | Verwaltung aller Mandanten, Pakete, Abrechnung, Verbindungen; Mandantendaten nur nach „Portal öffnen“ (Re-Auth, Audit `platform.enter_tenant`); 2FA Pflicht |
| Telefon-KI | Funktionsaufrufe nur mit Anbieter-Geheimnis/Signatur, gebunden an einen laufenden Anruf; Mandant und Anrufernummer nie aus KI-Argumenten |
| Twilio / Cron | Webhooks mit Signatur bzw. `Authorization: Bearer CRON_SECRET` |

Matrix je Ressource und Aktion: `12-berechtigungen.md` → „Berechtigungsmatrix“. Antwort bei fehlender Berechtigung: Paket-`docs/sicherheit.md` → „Zugriffs-Antwortstrategie“. Pflicht-Testfälle: `12-berechtigungen.md` → „Pflicht-Testfälle“ und `19-tests.md` (T-SEC-01…04, -14, -21).
