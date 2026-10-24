# Betrieb

> Phase 20 („in Arbeit“), Stand 2026-10-24. **Maßgeblich:** `docs/betrieb.md` (Betriebshandbuch: Server-Härtung, Dienste, Backups, Ersatzziel, Überwachung, Kostenschutz, Schlüsselwechsel, Auslieferung und Rückweg) und `docs/idea-to-app/20-betrieb.md` (Zuordnung zur Phase, was fehlt). Dazu `docs/release-checkliste.md`, `docs/support-playbook.md`, `docs/recht/incident-plan.md`, `docs/betreiber-konten.md`.

## Kurzfassung

- **Produktion:** ein IONOS-VPS, Docker Compose (`docker-compose.yml`: app, db, caddy, cron, backup), Härtung `deploy/harden.sh`. **Noch nicht aufgesetzt** (TASK-020).
- **Test:** Netlify (nur Oberfläche, keine echte Telefonie); eigene Schlüssel, nie die der Produktion. Kein Staging mit Testnummer (OP-20-07).
- **Auslieferung:** `bash deploy/deploy.sh` – Backup, Image `callki-app:<commit>`, Start mit `prisma migrate deploy`, Smoke-Test `/api/health`, bei Fehler automatisch zurück; `--rollback` manuell (`a37f425`). Releases nach `docs/release-checkliste.md`, Tag `vJJJJ.MM.TT-n`.
- **Migrationen:** nur vorwärts und rückwärtskompatibel (expand/contract), weil der Rückweg das alte Image mit neuem Schema startet.
- **Backups:** täglich `pg_dump` → age-verschlüsselt, lokal 14 Tage, S3 30 Tage, monatlicher automatischer Wiederherstellungstest; auf Produktion offen (TASK-021).
- **Überwachung:** `/api/cron/monitor` alle 5 min (Notfall-Alarme nicht zugestellt, gescheiterte Nachrichten, hängende Anrufe, Backup, Plattenplatz, Twilio-Konfiguration, gehäufte Fehlanmeldungen `0098ab2`); Alarme per E-Mail/SMS/Webhook. Externer Lebenszeichen-Dienst und Uptime-Check offen (TASK-022).
- **Ersatzziel:** TwiML Bin je Nummer bei Twilio (E-007), Einrichtung offen (TASK-023).
- **Kill-Switches:** `AI_KILL_SWITCH`, Kunde pausieren, Kostenschutz-Grenzen (Paket-`docs/sicherheit.md`).
- **Schlüsselwechsel `APP_ENCRYPTION_KEY`:** `docs/betrieb.md` → „Schlüsselwechsel“ (`/api/cron/rekey`).
- **Zugänge:** 2FA auf allen Betreiberkonten nachweisen (TASK-029); Bereitschaft/SLA offen.

## Regeln für das Coding-Tool

- Nie gegen Produktion testen oder migrieren; keine Befehle auf dem Server ohne ausdrücklichen Auftrag.
- Neuer Cron-Job → Route unter `src/app/api/cron/<name>` mit `CRON_SECRET` und Eintrag in `deploy/cron.sh`; neue Alarme ohne personenbezogene Daten.
- Änderungen an Deployment, Backup oder Überwachung in `docs/betrieb.md` dokumentieren.
