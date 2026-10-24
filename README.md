# KI-Telefonzentrale – Mandantenfähige Plattform

Eine Plattform, mit der **du als Anbieter** beliebig viele Firmen (Mandanten) mit einer KI-Telefonassistenz versorgst. Jeder Kunde erhält ein eigenes Portal, sieht nur seine Daten, und die KI arbeitet mit seinem Firmenwissen, seinem Team und seinem Kalender.

```
Anrufer ─▶ Kunden-Nr. (Rufumleitung) ─▶ Twilio-Nummer ─▶ /api/twilio/voice
                                                  │ Nummer → Mandant, Kontingent prüfen
                                                  ▼
                       Retell-Agent (EIN Prompt für alle, Variablen je Mandant)
                                                  │ Function Calls (an Mandant gebunden)
                                                  ▼
            identify_caller · save_customer · find_technician · book_appointment · escalate_emergency
                                                  │
     PostgreSQL (tenantId überall) ◀──────────────┼──────────▶ Kalender: intern + optional Microsoft 365
                                                  │                 Benachrichtigung: E-Mail (+ICS) · SMS
            /api/voice/events ◀── Gesprächsende: Transkript, Zusammenfassung, Rückruf-Vorgang bei Abbruch
                                                  ▼
          Portal des Kunden (Hub, Anrufe, Kunden, Team, Einstellungen)   ·   Deine Verwaltung (/admin)
```

## Rollen
| Rolle | Sieht / darf |
|---|---|
| **Plattform-Admin** (du) | Alle Mandanten anlegen, pausieren, Tarif & Minutenlimit, Rufnummern zuordnen, Zugangslinks erzeugen, Plattform-Status. „Portal öffnen“ für Support (wird im Kunden-Protokoll sichtbar). |
| **Kunden-Admin** | Eigenes Portal komplett: Team & Einsatzgebiete, KI-Texte, Geschäftszeiten, Benachrichtigungen, Microsoft 365, Benutzer, Protokoll, DSGVO-Löschung. |
| **Kunden-Mitarbeiter** | Vorgänge, Anrufe, Kunden bearbeiten – keine Einstellungen. |

## Was die Plattform abdeckt
- **Mehrere Branchen** über Vorlagen (`src/lib/tenant/templates.ts`): Schädlingsbekämpfung, Handwerk (SHK/Elektro/Dach), Allgemeiner Dienstleister. Jede Vorlage bringt Anliegen-Kategorien, Notfall-Stichwörter, Rollenbezeichnungen und Gesprächsleitfaden mit; Kunden ergänzen eigene Kategorien/Stichwörter/FAQ.
- **Kunden ohne Microsoft**: interner Kalender + E-Mail mit Kalendereintrag (.ics) funktioniert mit Outlook, Google, Apple.
- **Kunden mit Microsoft 365**: „Mit Microsoft verbinden“ → Admin-Freigabe → echte Outlook-Verfügbarkeit, Termine direkt im Kalender, Kundenbestätigung als Entwurf. Keine Kunden-Passwörter/Secrets gespeichert (eine mandantenfähige Entra-App).
- **Kunde behält seine Nummer**: Rufumleitung (bei besetzt / nach X Sekunden / außerhalb Geschäftszeiten) auf die zugeordnete Twilio-Nummer.
- **Ausfallsicherheit**: KI nicht erreichbar, Kunde pausiert oder Minutenlimit erreicht → Weiterleitung an Fallback-Nummer oder Mailbox → Rückruf-Vorgang mit Aufnahme.
- **Kein verlorener Lead**: aufgelegte Gespräche erzeugen automatisch Rückruf-Vorgänge.
- **Doppelbuchungsschutz**: Slot wird unmittelbar vor der Buchung neu geprüft; je Anruf höchstens ein Vorgang (idempotent).
- **DSGVO**: Löschfristen je Kunde (Transkripte/Aufnahmen), Datenauskunft (JSON), vollständige Löschung eines Anrufers, Audit-Log, KI-Transparenzhinweis in der Begrüßung, Hosting in Deutschland (IONOS).

## Installation auf dem IONOS-VPS
Voraussetzung: VPS mit Ubuntu 24.04, min. 2 vCPU / 4 GB RAM, eine (Sub-)Domain.

```bash
# 1. DNS: A-Record app.deine-domain.de → IP des VPS
# 2. Auf dem Server:
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git ufw
sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
git clone https://github.com/rinats-png/call-ki.git && cd call-ki
cp .env.example .env && nano .env      # DOMAIN, POSTGRES_PASSWORD, APP_ENCRYPTION_KEY, SETUP_TOKEN, CRON_SECRET, VOICE_TOOL_SECRET_<ANBIETER>, SMTP, Twilio, Retell
docker compose up -d --build
# 3. https://app.deine-domain.de/setup öffnen → Setup-Token eingeben → Plattform-Admin anlegen
#    → danach wird die Zwei-Faktor-Anmeldung (Authenticator-App) eingerichtet – Wiederherstellungscodes sicher aufbewahren!
```
Secrets erzeugen: `openssl rand -hex 24`. Updates: `git pull && docker compose up -d --build` (Migrationen laufen beim Start automatisch).

**Backups**: Der Dienst `backup` sichert täglich, mit age verschlüsselt, nach `./backups` (14 Tage) und auf einen externen S3-Bucket (30 Tage) und prüft monatlich automatisch die Wiederherstellung. Einrichtung, Schlüsselablage und Wiederherstellung: [`docs/betrieb.md`](docs/betrieb.md#backups). Ohne Schlüssel und Bucket meldet die Überwachung einen kritischen Alarm.

**Zeitgesteuerte Aufgaben** (Dienst `cron`, `deploy/cron.sh`): jede Minute werden fehlgeschlagene E-Mails und SMS erneut gesendet (bis zu 5 Versuche, Notfall-Alarme nach 1, 2, 5, 10 Minuten, sonst nach 2, 10, 30, 120 Minuten), täglich um 3 Uhr laufen die Löschfristen. Die Sprach-KI wartet während des Gesprächs nicht auf den Versand – Kalender, E-Mail und SMS laufen direkt nach der Antwort an den Anbieter.

**Überwachung** (alle 5 Minuten, `/api/cron/monitor`): alarmiert bei Notfall-Alarmen, die nicht zugestellt oder gar nicht versendet wurden, bei endgültig gescheiterten Nachrichten, gestörtem Versand, Anrufen ohne Gesprächsende, fehlendem oder fehlgeschlagenem Backup und knappem Speicherplatz. Alarme gehen per E-Mail, für kritische Fälle per SMS und optional an einen Webhook (Einstellungen → Plattform → „Überwachung & Alarme“). Damit auch ein kompletter Serverausfall auffällt, unbedingt einen externen Lebenszeichen-Dienst (z. B. healthchecks.io, `HEALTHCHECK_PING_URL`) und einen Uptime-Check auf `/api/health` einrichten.

## Testumgebung auf Netlify

Zum Ausprobieren der Oberfläche (ohne echte Anrufe) baut Netlify jeden Push dieses Branches (`netlify.toml`). Datenbank ist die Netlify Database; ihre Migrationen in `netlify/database/migrations` sind Kopien von `prisma/migrations` (Test `tests/netlify-migrations.test.ts`). Nötige Umgebungsvariablen bei Netlify: `APP_ENCRYPTION_KEY`, `SETUP_TOKEN`, `CRON_SECRET`, `PUBLIC_BASE_URL`. Als „geheim“ markierte Variablen brauchen bei Netlify einen eigenen Kontext (z. B. Production) – mit „alle Kontexte“ werden sie nicht angelegt.

## Recht & Datenschutz

Vorlagen und Einordnung (AVV, TOM, VVT, Löschkonzept, DSFA, Anrufer-Information, KI-Verordnung, Incident-Plan, Datenschutzerklärung, Impressum) liegen in [`docs/recht/`](docs/recht/README.md) – **keine Rechtsberatung, [PRÜFEN]-Stellen vor dem ersten Kunden klären lassen.** Im Produkt umgesetzt:
- Mandant lässt sich erst mit eingetragener AVV-Version und -Datum auf „Aktiv“ setzen.
- Vertragsende: Gesamtexport (Admin und Kunden-Admin) und endgültige Löschung eines pausierten Mandanten inkl. Retell/Twilio.
- Datenschutz-URL des Kunden wird der KI als `{{privacy_notice}}` übergeben (im Retell-Prompt verwenden, siehe `voice-agent/system-prompt.md`).
- `LEGAL_IMPRINT_URL` / `LEGAL_PRIVACY_URL` in `.env` → Links im Fuß von Portal und Login.

## Externe Dienste einrichten (einmalig, für alle Kunden)
Alle URLs zum Kopieren stehen nach dem Login unter **Plattform**.

1. **Twilio**: Konto anlegen, deutsche Nummern kaufen (Regulatory Bundle mit Adressnachweis nötig). Je Nummer unter *Voice Configuration*: „A call comes in“ → `https://DOMAIN/api/twilio/voice` (POST), „Primary handler fails“ → `https://DOMAIN/api/twilio/fallback`. `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` in `.env`.
2. **Retell AI**: Einen Agenten anlegen (Sprache Deutsch, deutsche Stimme).
   - General Prompt: Inhalt von `voice-agent/system-prompt.md`, Begin Message: `{{greeting}}`.
   - Custom Functions aus `voice-agent/tools.json`, URL `https://DOMAIN/api/voice/tools/<name>`, Header `x-tool-secret: <VOICE_TOOL_SECRET_RETELL>` (je Anbieter ein eigenes Geheimnis).
   - Eingebaute Funktionen „End Call“ und „Transfer Call“ (dynamische Nummer aus `transferNumber`) aktivieren.
   - Agent-Webhook: `https://DOMAIN/api/voice/events`. Post-Call-Analyse (Zusammenfassung) aktivieren.
   - `RETELL_API_KEY` und `RETELL_AGENT_ID` in `.env`. Für Sonderfälle kann je Nummer ein eigener Agent hinterlegt werden.
3. **E-Mail (SMTP)**: z. B. ein IONOS-Postfach `noreply@deine-domain.de`; SPF/DKIM für die Domain setzen, damit Mails nicht im Spam landen.
4. **SMS (optional)**: `TWILIO_SMS_FROM` (SMS-fähige Nummer oder Messaging-Service-SID).
5. **Microsoft 365 (optional)**: Entra ID → App-Registrierung → „Konten in einem beliebigen Organisationsverzeichnis“ (mandantenfähig). Redirect-URI (Web): `https://DOMAIN/api/integrations/microsoft/callback`. API-Berechtigungen (Anwendung): `Calendars.ReadWrite`, `Mail.ReadWrite`. Client-Secret erzeugen → `MS_CLIENT_ID`/`MS_CLIENT_SECRET`. Für produktiven Einsatz bei fremden Firmen: App bei Microsoft als „Publisher verified“ verifizieren lassen.

## Neuen Kunden aufschalten (ca. 15 Minuten)
1. **/admin → Neuer Kunde**: Name, Branche, Admin-E-Mail, Twilio-Nummer, Minutenlimit → Einladung geht per E-Mail raus (ohne SMTP wird der Link angezeigt).
2. Kunde aktiviert den Zugang und pflegt unter **Team** Mitarbeiter mit PLZ-Gebieten, E-Mail und Handy (für Notfälle).
3. Unter **Konto**: Unternehmensbeschreibung, Einsatzgebiet, FAQ, Geschäftszeiten, Benachrichtigungen. Optional Microsoft 365 verbinden.
4. Testanruf auf die Twilio-Nummer. Danach beim Kunden die **Rufumleitung** seiner bisherigen Nummer einrichten.
5. Status in /admin auf **Aktiv** setzen.

## Entwicklung
```bash
docker compose -f docker-compose.dev.yml up -d   # Postgres auf localhost:5432
cp .env.example .env                              # DATABASE_URL zeigt auf die Dev-DB
npm install && npx prisma migrate dev && npx prisma db seed
npm run dev   # http://localhost:3000 – admin@example.com / storm@example.com, Passwort demo-passwort-123
              # Plattform-Admin muss beim ersten Login 2FA einrichten (lokal abschaltbar: REQUIRE_PLATFORM_ADMIN_2FA=false)
```
| Befehl | Zweck |
|---|---|
| `npm test` | Unit-Tests; mit `TEST_DATABASE_URL=… ` zusätzlich Integrationstests gegen Postgres (Mandantentrennung, Doppelbuchung, Idempotenz, Rückruf-Vorgänge) |
| `npm run typecheck` · `npm run lint` | Qualitätschecks |
| `npx prisma migrate dev --name <name>` | Schemaänderung als Migration |

## Sicherheit
Alle Werte und akzeptierten Restrisiken: [`docs/sicherheit.md`](docs/sicherheit.md). Ist-Analyse und offene Punkte: [`docs/idea-to-app/B1-ist-analyse.md`](docs/idea-to-app/B1-ist-analyse.md).
- Zwei-Faktor-Anmeldung (Pflicht für Plattform-Admins), Rate-Limits, erneute Bestätigung für sensible Aktionen, Prüfung gegen geleakte Passwörter
- Login mit scrypt-Hashes, httpOnly-Sitzungscookies (SameSite=Lax), Sperre nach 5 Fehlversuchen, CSRF-Prüfung der Herkunft, Sicherheits-Header (CSP, HSTS via Caddy).
- Mandantentrennung in jeder Abfrage (`tenantId`), Mandant bei Sprachanrufen nur aus eigener Call-Tabelle/angerufener Nummer – nie aus KI-Parametern. Integrationstests prüfen das.
- Webhooks: Twilio-Signatur (HMAC-SHA1), Retell-Signatur (HMAC-SHA256) bzw. Shared Secret.
- Datenbank ohne öffentlichen Port; Rufnummern in Logs maskiert.

## Erweiterungen (vorbereitet, noch nicht umgesetzt)
- **Abrechnung**: Minuten je Kunde/Monat werden erfasst (Admin-Übersicht) → Export bzw. Stripe-Anbindung.
- **Google Calendar** als weiterer Kalender-Provider (`src/lib/calendar.ts`, Stelle `busyFromProviders`).
- **Eigene Absenderdomain je Kunde**, eigenes Branding/Farbe, eigene Portal-Domain.
- **2-Faktor-Anmeldung**, Postgres Row-Level-Security als zweite Schutzschicht.
- **Aufnahmen über die Plattform ausliefern** (statt Link zum Anbieter), Wissensdatenbank je Kunde, weitere Branchenvorlagen, Outbound-Rückrufe durch die KI.

## Wichtig vor dem Verkauf (nicht technisch)
AV-Vertrag (Auftragsverarbeitung) mit jedem Kunden und Unterauftragsverarbeiter-Liste (IONOS, Twilio, Retell inkl. genutztem Sprachmodell, ggf. Microsoft, SMTP-Anbieter), Datenschutzerklärung, AGB/SLA, Prüfung der Datenübermittlung in Drittländer (Twilio/Retell sind US-Anbieter). Bitte anwaltlich prüfen lassen.
