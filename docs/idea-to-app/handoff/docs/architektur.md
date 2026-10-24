# Architektur

> Phasen 13, 15 und 18 (alle „in Arbeit“), Stand 2026-10-24. **Maßgeblich:** `docs/idea-to-app/13-architektur.md` (Entscheidung, Architekturdiagramm, Abläufe Anruf/Funktionsaufruf/Gesprächsende/Portal, Cron, Umgebungen, Lock-in), `docs/idea-to-app/15-integrationen.md` (Login, Zahlung, je Anbieter: Endpunkte, Ausweis, Verifizierungsstatus), `docs/idea-to-app/18-qualitaetsziele.md` (Latenz, Verfügbarkeit, Last). Code-Landkarte: `docs/idea-to-app/22-handoff.md` Abschnitt 2.

## Tech-Stack (Kurzfassung)

Next.js 15 (App Router) mit Route Handlers auf Node.js 22, React 19, Tailwind 3 · PostgreSQL 16 über Prisma 6 · zod 4 · Eigenbau-Auth (scrypt, DB-Sitzungen, TOTP) · Twilio (Nummern, SIP, SMS) · Retell (Standard), Vapi, ElevenLabs je Mandant/Nummer · Kalender intern, Microsoft Graph, Google Calendar · SMTP über nodemailer · Produktion IONOS-VPS mit Docker Compose (app, db, caddy, cron, backup), Netlify nur Testumgebung (E-016) · CI GitHub Actions.

## Ablauf eines Anrufs (Kurzfassung)

1. Twilio → `POST /api/twilio/voice` (Signatur): Nummer → Mandant, Kostenschutz und Anrufer-Limits prüfen, sonst Fallback (FL-05).
2. Übergabe an die Sprach-KI (`src/lib/voice/handoff.ts`) mit Mandanten-Variablen; Anrufzeile wird angelegt.
3. Funktionsaufrufe → `/api/voice/tools/[name]` (Anbieter-Geheimnis/Signatur, laufender Anruf, Mandant aus der Anrufzeile, zod-Validierung); langsame Arbeit nach der Antwort (`src/lib/defer.ts`).
4. Gesprächsende: Twilio-Status (`/api/twilio/status`, Abrechnungsgrundlage E-006) und Anbieter-Ereignis (`/api/voice/events`): Transkript, Zusammenfassung, Rückruf-Vorgang.
5. Zeitgesteuert (`deploy/cron.sh` → `POST /api/cron/*`): Wiederholung von Nachrichten, Löschfristen und Monatsabschluss, Überwachung, Erinnerungen, Umschlüsseln.

Sprach-KI-Konfiguration: `voice-agent/system-prompt.md`, `voice-agent/tools.json` (Konsistenztest gegen das Server-Schema); Änderungen auch beim Anbieter nachziehen. KI-Hinweis (Art. 50 KI-VO) bleibt unabschaltbar.

## Qualitätsziele (Auszug, `18-qualitaetsziele.md`)

- Funktionsaufrufe der KI: p95 < 1 s (lokal belegt: p95 207/444/816 ms bei 10/30/60 gleichzeitigen Gesprächen, `94468b2`, `scripts/loadtest.ts`); externe Aufrufe immer mit Timeout.
- Benachrichtigungen asynchron mit Wiederholung (E-011); Ersatzziel bei Serverausfall über Twilio (E-007).
- Offen: Messung mit echten Anbietern (TASK-062), Ereignisse bis 2 MB, Portal-Polling.

## Regeln für Änderungen an der Architektur

Neuer externer Dienst, neues Framework, zweite Instanz/Skalierung, Wechsel des Hostings: **wesentliche Abweichung** (AGENTS.md Abschnitt 7) – vorher fragen, danach `13-architektur.md`, `docs/recht/unterauftragsverarbeiter.md` und Paket-`docs/sicherheit.md` nachziehen.
