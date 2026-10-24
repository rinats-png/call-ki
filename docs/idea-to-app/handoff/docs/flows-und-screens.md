# Flows und Screens

> Phasen 6 und 7, Stand 2026-10-24. **Maßgeblich:** `docs/idea-to-app/06-flows.md` (Abläufe mit Diagrammen, Zustände, Missbrauchsfälle, Fehlermeldungen der KI) und `docs/idea-to-app/07-screens.md` (Navigation, Screen-Liste S…, Pflicht-Screens, Screen-Map). Rekonstruiert aus dem Code; bei Abweichung gilt der Code und die Abweichung wird gemeldet.

## Abläufe (`06-flows.md`)

| ID | Ablauf | Code-Einstieg |
|---|---|---|
| FL-01 | Anruf – Neukunde mit Anliegen und Termin | `src/app/api/twilio/voice`, `src/lib/voice/tools.ts` |
| FL-02 | Anruf – Bestandskunde, Fremddaten-Schutz (nur verifizierte Nummer, E-009) | `src/lib/voice/context.ts` |
| FL-03 | Anruf – Notfall (112-Hinweis, `escalate_emergency`, Durchstellung, Alarm) | `src/lib/voice/tools.ts`, `src/lib/notify/*` |
| FL-04 | Anruf – Termin verschieben oder absagen | `src/lib/voice/tools.ts` |
| FL-05 | Sonderwege vor der KI (Pause, Kontingent, Kostenschutz, unterdrückte Nummer, Störung → Fallback) | `src/lib/cost-guard.ts`, `src/lib/voice/twilio-fallback.ts` |
| FL-06 | Gesprächsende, Auflegen, Rückruf, Abrechnung, Löschung | `src/app/api/twilio/status`, `src/lib/voice/events.ts` |
| FL-07 | Portal – Vorgang bearbeiten, Anruf nachhören (inkl. Zustände leer/laden/Fehler) | `src/app/(app)/` |
| FL-08 | Anmeldung, 2FA, Passwort vergessen, Einladung | `src/app/(auth)/`, `src/lib/auth/*` |
| FL-09 | Betreiber – Kunde einrichten bis zum ersten Anruf | `src/app/(app)/admin/` |
| FL-10 | DSGVO-Auskunft, Löschung, Offboarding | `src/lib/services/*` |
| FL-11 | Betrieb – Überwachung, Backup, Wiederherstellung | `src/lib/services/monitor.ts`, `deploy/*` |

Missbrauchsfälle am Telefon (Prompt-Injection, fremde Nummer nennen, Kostenangriffe) und vorgegebene Formulierungen der KI bei Fehlern: Abschnitte „Missbrauchsfälle“ und „Fehlermeldungen“ in `06-flows.md`. Testanrufe dazu: `docs/testanrufe.md`.

## Navigation und Screens (`07-screens.md`)

- **Portal** (Mitarbeiter, Kunden-Admin): Hub · Anrufe · Kunden · Team · Tarif · Einstellungen · Mein Konto.
- **Verwaltung** (Plattform-Admin): Leitstand · Preise & Pakete · Abrechnung · Verbindungen · Mein Konto.
- **Support-Zugriff:** Plattform-Admin öffnet ein Kunden-Portal (Re-Auth, Audit-Eintrag, Banner `TenantBanner`).
- Schwebende Icon-Leiste (Desktop) bzw. untere Leiste (Handy), Einstellungen mit Reiter-Leiste (`src/components/Sidebar.tsx`, `src/app/(app)/settings/layout.tsx`).
- Ausgeblendete Menüpunkte sind **keine** Zugriffskontrolle (Regel 2.9) – jede Seite lädt Daten über geprüfte API-Routen.

Offen: A-013 (Leerzustand/Verbindungsverlust im Hub), A-014 (was Mitarbeiter sehen), A-015 (kein Self-Service „Konto löschen“). Offene Entwürfe aus dem Glas-Design stehen im Parkplatz von `PROJECT_STATE.md`.
