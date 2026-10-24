# Betreiberkonten und Zwei-Faktor-Schutz

> Liste aller Konten, mit denen der Betreiber die Plattform steuert (OP-20-10). Stand: 2026-10-24. **Keine Passwörter, Schlüssel oder Codes in diese Datei schreiben** – nur, *wo* sie liegen.
> Die Spalte „2FA aktiv“ trägt der Kontoinhaber selbst ein, **mit Datum der Prüfung** (z. B. „ja, App, geprüft 2026-11-02“). Leer heißt: nicht nachgewiesen. Für den Launch (`docs/idea-to-app/23-launch.md`) muss jede Zeile mit Pflicht „ja“ einen Eintrag haben.

## Grundsätze

- **2FA mit Authenticator-App oder Sicherheitsschlüssel (Passkey/FIDO2)**, nicht per SMS, wo der Dienst das erlaubt.
- **Wiederherstellungscodes** jedes Kontos liegen im Passwort-Manager des Betreibers (Tresor „call-ki Betrieb“) **und** ausgedruckt im verschlossenen Umschlag an einem zweiten Ort (z. B. Bürosafe). Nicht in E-Mails, Chats, Notiz-Apps oder im Repository.
- Konto-E-Mail ist eine Rollenadresse der Firma (z. B. `betrieb@<domain>`), nicht privat; das E-Mail-Postfach selbst ist ebenfalls mit 2FA geschützt (sonst ist jede Passwort-Rücksetzung offen).
- Höchstens zwei Personen mit Admin-Rechten je Dienst; jede Person mit eigenem Login, keine geteilten Zugänge.
- Verlässt jemand das Team: am selben Tag Zugänge entziehen und die Geheimnisse rotieren, die er kannte (`docs/recht/incident-plan.md` Abschnitt 3).
- Schlüssel, die in die `.env` bzw. in Verwaltung → Plattform gehen, sind in der Spalte „Geheimnisse“ genannt (nur Namen).

## Konten

| # | Dienst | Zweck | Pflicht | Konto / Inhaber | 2FA aktiv (Art, geprüft am) | Wiederherstellungscodes liegen in | Geheimnisse daraus (nur Namen) |
|---|---|---|---|---|---|---|---|
| 1 | **GitHub** (Organisation/Repository `rinats-png/call-ki`) | Quellcode, CI, Dependabot, Secret-Scan | ja | | | Passwort-Manager Tresor „call-ki Betrieb“ + Umschlag | Deploy-Schlüssel des Servers (nur lesen) |
| 2 | **IONOS** (Cloud Panel: VPS, Firewall, Object Storage, ggf. Domain/Mail) | Produktionsserver, Backup-Bucket | ja | | | wie oben | `BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY`, SSH-Schlüssel (liegt nur beim Admin) |
| 3 | **Twilio** | Rufnummern, Anrufe, SMS, TwiML Bins (Ersatzziel), Usage-Alarme | ja | | | wie oben | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM` |
| 4 | **Retell AI** | Sprach-KI, Agenten | ja, wenn genutzt | | | wie oben | `RETELL_API_KEY`, `RETELL_AGENT_ID…`, `VOICE_TOOL_SECRET_RETELL` |
| 5 | **Vapi** | Sprach-KI | ja, wenn genutzt | | | wie oben | `VAPI_API_KEY`, `VAPI_ASSISTANT_ID`, `VOICE_TOOL_SECRET_VAPI` |
| 6 | **ElevenLabs** | Sprach-KI (Agents), Stimmen | ja, wenn genutzt | | | wie oben | `ELEVENLABS_API_KEY`, `ELEVENLABS_WEBHOOK_SECRET`, `VOICE_TOOL_SECRET_ELEVENLABS` |
| 7 | **Netlify** | Testumgebung (Oberfläche ohne echte Anrufe) | ja | | | wie oben | Test-`APP_ENCRYPTION_KEY`, `SETUP_TOKEN`, `CRON_SECRET` (nur Test, nie Produktionswerte) |
| 8 | **Google Cloud** (Projekt der OAuth-App für Google Kalender) | OAuth-Client für Kunden-Kalender | ja, wenn Google-Kalender angeboten wird | | | wie oben | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| 9 | **Microsoft Entra ID** (App-Registrierung, mandantenfähig; Partner Center für „Publisher verified“) | Microsoft-365-Kalender der Kunden | ja, wenn Microsoft angeboten wird | | | wie oben | `MS_CLIENT_ID`, `MS_CLIENT_SECRET` (Ablaufdatum des Secrets notieren: `<…>`) |
| 10 | **Domain-Registrar / DNS** (`<Registrar>`) | Domain, DNS (A-Record, SPF/DKIM) | ja | | | wie oben | – (Registrar-Sperre/Transfer-Lock aktivieren ☐) |
| 11 | **SMTP-Anbieter / Postfach** (`<Anbieter>`, z. B. IONOS Mail) | Versand von Einladungen, Bestätigungen, Alarmen | ja | | | wie oben | `SMTP_USER`, `SMTP_PASS` |
| 12 | **Support- und Betriebspostfach** (`support@`, `betrieb@`) | Kundenkommunikation, Konto-E-Mail aller Dienste | ja | | | wie oben | – |
| 13 | **Externer Lebenszeichen-Dienst** (z. B. healthchecks.io) | Alarm bei Serverausfall | ja | | | wie oben | `HEALTHCHECK_PING_URL` |
| 14 | **Uptime-Check** (z. B. UptimeRobot, Better Stack) | Erreichbarkeit `/api/health` von außen | ja | | | wie oben | – |
| 15 | **S3-Backup-Speicher**, falls nicht bei IONOS (z. B. anderer Anbieter) | verschlüsselte Backups | ja, wenn genutzt | | | wie oben | wie Zeile 2 |
| 16 | **Passwort-Manager** selbst | Ablage aller obigen Geheimnisse | ja | | | Notfall-Kit ausgedruckt im Umschlag | Hauptpasswort (nur im Kopf + Notfall-Kit) |
| 17 | Zahlungsanbieter (sobald gewählt, OP-17-04) | Abrechnung | ja, wenn genutzt | | | wie oben | – |

## Außerhalb der Konten zu sichern

| Was | Wo | Warum |
|---|---|---|
| Komplette Produktions-`.env` (vor allem `APP_ENCRYPTION_KEY`, ggf. `APP_ENCRYPTION_KEYS_OLD`) | Passwort-Manager + Umschlag | ohne den Schlüssel sind 2FA-Geheimnisse, in der Oberfläche gespeicherte Anbieter-Schlüssel und Google-Tokens aus einem Backup nicht lesbar (`docs/betrieb.md`) |
| `secrets/backup-age.key` (privater Backup-Schlüssel) | Passwort-Manager + Umschlag, **getrennt** vom Bucket-Zugang | ohne ihn sind Backups wertlos |
| Plattform-Admin-Wiederherstellungscodes der App selbst | Passwort-Manager + Umschlag | Zugang zur Verwaltung bei Verlust des 2FA-Geräts |
| SSH-Schlüssel des Admin-Benutzers `betrieb` | Gerät des Admins (mit Passphrase) + Ersatzschlüssel im Passwort-Manager | Serverzugang |

## Prüfung

| Datum | Wer | Ergebnis | Nächste Prüfung |
|---|---|---|---|
| | | | vierteljährlich, zusammen mit dem Wiederherstellungstest |
