# Build-Handoff (bestehende App)

> Phase 22 (`phases/22-build-handoff.md`) im Modus „Bestehende App“, Stand 2026-10-24. Übergabe für Coding-Tools (Claude Code, Codex, Cursor …), die an `/home/user/call-ki` weiterarbeiten. Dieses Dokument ersetzt **nicht** das Übergabepaket `docs/idea-to-app/handoff/` mit `AGENTS.md` (wörtliche Sicherheitsregeln aus `security/regeln-fuer-ki.md`), `CLAUDE.md` und `START-PROMPT.md` – das liegt unter `handoff/`.

## 1. Worum geht es?

Mandantenfähige **KI-Telefonzentrale**: Firmen leiten ihre Nummer auf eine Twilio-Nummer um; eine Sprach-KI (Retell, Vapi oder ElevenLabs, je Mandant wählbar) nimmt an, erfasst Anliegen, bucht Termine (interner Kalender, Google, Microsoft 365), benachrichtigt per E-Mail/SMS und stellt Notfälle durch. Betreiber (Plattform-Admin) verwaltet Mandanten, Pakete, Abrechnung. Risikostufe 2, Tendenz 3 (Transkripte können Gesundheitsangaben enthalten) – `docs/sicherheit.md`.

## 2. Wo liegt was?

| Bereich | Ort |
|---|---|
| Seiten (Portal, Verwaltung, Anmeldung) | `src/app/(app)/`, `src/app/(auth)/` |
| API-Routen | `src/app/api/<bereich>/…/route.ts` (u. a. `twilio/voice`, `twilio/status`, `voice/tools/[name]`, `voice/events`, `cron/*`, `integrations/google|microsoft`, `admin/*`, `billing`) |
| Fachlogik | `src/lib/services/*` (Anrufe, Vorgänge, Kunden, Mandanten, Löschfristen, Überwachung, Erinnerungen, Kontingent-Warnungen, Umschlüsseln) |
| Sprach-KI | `src/lib/voice/*` (Übergabe `handoff.ts`, Kontext/Mandantenbindung `context.ts`, Tools `tools.ts`, Ereignisse `events.ts`, Anbieter-Löschung `providers.ts`, Twilio-Ersatzziel `twilio-fallback.ts`); Prompt und Tool-Definitionen `voice-agent/system-prompt.md`, `voice-agent/tools.json` |
| Abrechnung, Pakete, Kosten | `src/lib/billing.ts`, `src/lib/plan-limits.ts`, `src/lib/cost-guard.ts` |
| Anmeldung, 2FA, Sitzungen, Rate-Limits | `src/lib/auth/*`, `src/lib/rate-limit.ts`, `src/lib/security.ts` |
| Plattform-Einstellungen (Oberfläche überschreibt `.env`) | `src/lib/platform/config.ts` (`setting()`, `settingNumber()`), Modell `PlatformSetting` |
| Verschlüsselung gespeicherter Geheimnisse | `src/lib/secret-box.ts` (`APP_ENCRYPTION_KEY`, `APP_ENCRYPTION_KEYS_OLD`) |
| Datenmodell und Migrationen | `prisma/schema.prisma`, `prisma/migrations/` (Kopien für Netlify: `netlify/database/migrations/`) |
| Betrieb | `docker-compose.yml`, `Dockerfile`, `deploy/*.sh`, `deploy/Caddyfile`; Handbuch `docs/betrieb.md`; Release `docs/release-checkliste.md` |
| Tests | `tests/*.test.ts` (Unit), `tests/integration/tenancy.test.ts` (gegen Postgres), `tests/e2e/` (in Arbeit) |
| Recht | `docs/recht/*` (VVT, TOM, AVV, Löschkonzept, Incident-Plan …) |
| Planung (idea-to-app) | `docs/idea-to-app/*` (Phasen-Dokumente, `PROJECT_STATE.md`, `ENTSCHEIDUNGEN.md`, `QUELLEN.md`) |

## 3. Tech-Stack

TypeScript, Next.js 15 (App Router), React 19, Tailwind 3, Prisma 6 mit PostgreSQL 16, zod, nodemailer; Vitest für Tests; Docker Compose (App, Postgres, Caddy, Cron, Backup) auf einem IONOS-VPS; Testumgebung Netlify (nur Oberfläche). Major-Updates (Prisma 7, Next 16) sind bewusst zurückgestellt (E-003).

## 4. Starten und testen

```bash
docker compose -f docker-compose.dev.yml up -d          # Postgres auf localhost:5432
cp .env.example .env                                     # DATABASE_URL auf die Dev-DB
npm install && npx prisma migrate dev && npx prisma db seed
npm run dev                                              # http://localhost:3000

npm run lint && npm run typecheck                        # Pflicht vor jedem Commit
npm test                                                 # Unit-Tests; Integrationstests werden ohne DB übersprungen

# Integrationstests gegen eine eigene, leere Test-Datenbank (nie die Dev- oder Produktions-DB!)
export TEST_DATABASE_URL=postgresql://callki:callki@localhost:5432/callki_test
DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
npm test                                                 # führt jetzt auch tests/integration/* aus
```

- `vitest.config.ts` setzt `DATABASE_URL` auf `TEST_DATABASE_URL`; ohne die Variable laufen nur die Unit-Tests (`tests/integration/tenancy.test.ts` prüft `enabled = !!process.env.TEST_DATABASE_URL`).
- Die CI (`.github/workflows/ci.yml`) macht dasselbe mit einem Postgres-Service plus `npm audit`, gitleaks und Docker-Build. Ein Commit gilt erst als fertig, wenn die CI grün ist.
- Neue Umgebungsvariablen **immer** in `.env.example` eintragen – `tests/env-example.test.ts` vergleicht Code und Datei.
- Schemaänderung: `npx prisma migrate dev --name <name>`; die Migration auch nach `netlify/database/migrations/` kopieren (`tests/netlify-migrations.test.ts`). Nur rückwärtskompatible Migrationen (expand/contract, `docs/release-checkliste.md` A4).

## 5. Konventionen

- **Sprache:** Oberfläche, Fehlermeldungen, Kommentare, Doku und Commit-Nachrichten auf **Deutsch**; Code-Bezeichner Englisch.
- **Mandantentrennung:** jede Abfrage mit `tenantId` aus der Sitzung (`requireTenant`) bzw. aus dem eigenen Anrufdatensatz; **nie** aus Request-Body oder KI-Argumenten. Fremde IDs → 404 (Zugriffs-Antwortstrategie in `docs/sicherheit.md`). Neuer Endpunkt → Test „anderer Mandant“.
- **Eingaben:** zod-Schema mit Allowlist, `readJson` mit Größenlimit (`src/lib/http.ts`); nur Prisma, kein String-SQL (Ausnahme: getaggte `$queryRaw`-Vorlagen).
- **Geheimnisse:** nur serverseitig; neue Anbieter-Schlüssel über `setting()` lesen und als `secret` in der Registry (`src/lib/platform/registry.ts`) führen, damit sie verschlüsselt gespeichert werden. Keine Werte in Logs oder Doku.
- **Logs:** `src/lib/logger.ts`, Rufnummern maskiert, keine Transkripte oder Nachrichtentexte.
- **Externe Aufrufe:** immer mit Timeout (`AbortSignal.timeout`); nichts Langsames im Gesprächspfad – Benachrichtigungen laufen nach der Antwort (`src/lib/defer.ts`) mit Wiederholung.
- **Zeit:** intern UTC, Anzeige und Kalenderlogik über `src/lib/time.ts` mit Zeitzone des Mandanten (Tests für Zeitumstellung vorhanden).
- **Cron-Endpunkte:** `POST /api/cron/<name>` mit `Authorization: Bearer CRON_SECRET` (`src/lib/cron-auth.ts`); neue Jobs in `deploy/cron.sh` eintragen.
- **Paketgrenzen und Funktionen** serverseitig prüfen (`hasFeature`, `plan-limits.ts`), nie nur in der Oberfläche ausblenden.
- **Sprach-KI-Änderungen** (Tools, Prompt) gleichzeitig in `voice-agent/*` und beim Anbieter; KI-Hinweis (Art. 50 KI-VO) bleibt unabschaltbar.
- **Doku nachziehen:** Änderungen an Daten, Anbietern oder Fristen → `docs/recht/*` (VVT, TOM, Löschkonzept, AVV-Anlage 1, Unterauftragsverarbeiter); Betrieb → `docs/betrieb.md`.

## 6. Commits und Branches

- Nicht direkt auf den Standard-Branch committen; Feature-Branch, Pull Request, CI grün.
- **Betreffzeile:** deutscher Satz, der das Ergebnis beschreibt, ohne Präfix (Beispiele aus dem Verlauf: „Gesprächsende von Twilio: Abrechnung und Löschung auch ohne Anbieter-Ereignis“, „Paketgrenzen serverseitig durchsetzen“). Ein Commit = ein Thema.
- **Text:** Aufzählung mit `- `, was sich ändert und warum, plus Hinweis auf Tests/Doku und offene Entscheidungen.
- **Trailer** bei Arbeit durch eine KI-Sitzung: die von der Sitzung vorgegebenen Zeilen (z. B. `Co-Authored-By: …`, `Claude-Session: …`).
- Releases werden getaggt (`vJJJJ.MM.TT-n`) und nach `docs/release-checkliste.md` ausgerollt.

## 7. Sicherheitsregeln

Verbindlich sind die Regeln aus `security/regeln-fuer-ki.md` des Regelwerks (wörtlich zu übernehmen in `handoff/AGENTS.md`, Abschnitt „Nicht verhandelbare Sicherheitsregeln“) und die Projektwerte in `docs/sicherheit.md` (Passwörter, Sitzungen, 2FA, Rate-Limits, Größenlimits, Header, Zugriffs-Antwortstrategie, Geheimnisse, akzeptierte Risiken E-001 bis E-004).

## 8. Abweichungen vom Plan (Rückweg)

1. Kleine Abweichung (keine Auswirkung auf Daten, Rechte, Sicherheit, Kosten): umsetzen, in `docs/idea-to-app/aenderungen.md` (anzulegen nach `templates/aenderungen.md`) eintragen.
2. Wesentliche Abweichung (neue Daten, neuer Anbieter, neue Rolle, Sicherheitsregel, Löschfrist, Preis): **stoppen und den Projektinhaber fragen**; danach Doku unter `docs/recht/` und `docs/idea-to-app/` anpassen.
3. Größere Weiterentwicklung: zurück in idea-to-app, Modus „Bestehende App“.

## 9. Offene Aufgaben mit Bezug zu den neuen Dokumenten

| Thema | Quelle | Art |
|---|---|---|
| Monatsabschluss für die Abrechnung, Löschjob/`eraseCustomer`/Mandanten-Löschung nach Regeln R4–R6 | `docs/recht/loeschkonzept.md` Abschnitt 5 (OP-16-13) | Code |
| Löschfrist für Plattform-Alarme (Nachrichten ohne Mandant) | `docs/recht/loeschkonzept.md` | Code |
| KI-Kosten je Anbieter statt einem `COST_VOICE_CENTS_PER_MIN`; Standard `COST_SMS_CENTS` auf 10 | `docs/idea-to-app/17-kosten.md` | Code/Einstellung |
| Weiterleitungsminuten (Notfall, Fallback) erfassen und bepreisen | `17-kosten.md` | Code + Entscheidung |
| Image-Registry, Staging mit Test-Rufnummer, automatischer Smoke-Test | `docs/release-checkliste.md`, `20-betrieb.md` (OP-20-07) | Betrieb |
| Übergabepaket `handoff/` erzeugen und `pruefe-projekt.mjs --handoff` ohne FEHLER | Phase 22 (OP-22-03) | Planung |

## 10. Vor einer Veröffentlichung zusätzlich nötig

Launch-Gate `docs/idea-to-app/23-launch.md` mit Nachweisen; Prüfskript `--launch`; die P0-Punkte aus der Prüfung vom 2026-10-24 (Produktionsserver, Ersatzziel je Nummer, Backups mit Wiederherstellungstest, Überwachung, AVV/DPA mit allen Anbietern, rechtliche Prüfung der `[PRÜFEN]`-Stellen, Ende-zu-Ende-Test mit echten Konten). Bei Einordnung in Stufe 3: externe Fachprüfung oder bewusst akzeptiertes Risiko (`E-…`).
