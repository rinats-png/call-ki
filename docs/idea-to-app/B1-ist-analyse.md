# Ist-Analyse: KI-Telefonzentrale (mandantenfähig)

> Erstellt im Modus „Bestehende App“ (B1) des Regelwerks [idea-to-app](https://github.com/rinats-png/idea-to-app) v1.2.0.
> Analysierter Stand: Branch `claude/awesome-johnson-2wmjas`, Commit `5515082` · Datum 2026-10-23.
> Prüfmaßstab: `security/checkliste.md`, `security/standardwerte.md`, `security/regeln-fuer-ki.md`, Phasen 10, 12, 16, 17, 19, 20, 23.
> Vier Abweichungen aus dem Abgleich wurden bereits behoben (siehe „Bereits behoben“).

## Zusammenfassung

- **Gesamteindruck:** Technisch solide Basis. Mandantentrennung, Eingabevalidierung, Webhook-Signaturen, CSRF, Sicherheits-Header, Audit-Log und Löschfristen sind umgesetzt und teils durch Integrationstests belegt. Die größten Lücken liegen **außerhalb des Codes** (Verträge, Datenschutz-Dokumente, Betrieb) sowie bei 2FA, Rate-Limits und der Löschung von Aufnahmen beim Sprach-KI-Anbieter.
- **Befunde (offen):** kritisch 0 · hoch 7 · mittel 11 · niedrig 5
- **Risikostufe:** **2**, Tendenz 3. Konten und personenbezogene Daten Dritter (Anrufer). Transkripte können **Gesundheitsdaten (Art. 9 DSGVO)** enthalten, z. B. „Allergiker gestochen“. Deshalb ist eine DSFA-Schwellwertprüfung nötig.
- **Nicht prüfbar:** Einstellungen in Retell, Twilio und Microsoft Entra (Datenaufbewahrung, Region, Budget-Grenzen), GitHub-Einstellungen (Secret Scanning, Branch-Schutz), Härtung des IONOS-VPS.

## 1. Überblick

| Punkt | Ist |
|---|---|
| Sprache / Framework | TypeScript, Next.js 15 (App Router), React 19, Tailwind 3 |
| Daten | PostgreSQL 16, Prisma 6 (versionierte Migrationen) |
| Externe Dienste | Twilio (Telefonie, SMS), Retell AI (Sprach-KI inkl. Sprachmodell des Anbieters), Microsoft Graph (optional), SMTP |
| Start / Build / Test | `npm run dev` · `npm run build` · `npm test` (44 Tests, davon 6 Integrationstests gegen Postgres) |
| Hosting | Docker Compose auf IONOS-VPS: App, Postgres, Caddy (HTTPS), Backup-Dienst, Cron-Dienst |
| CI | **keine** (BF-06) |

## 4. Sicherheit (Abgleich mit `security/checkliste.md`)

| Prüfpunkt | Ist | Bewertung | Befund |
|---|---|---|---|
| Secrets nur serverseitig, `.env` ignoriert, `.env.example` | ja, keine `NEXT_PUBLIC_`-Secrets | ✅ | – |
| Secret-Scan / Push Protection | nicht eingerichtet bzw. nicht prüfbar | ⚠️ | BF-06 |
| Zugriffskontrolle je Mandant | `tenantId` in jeder Abfrage, fremde IDs → 404; Integrationstest `tests/integration/tenancy.test.ts` | ✅ | – |
| Zweite Schutzschicht in der DB (RLS) | nein | ⚠️ | BF-13 |
| Mass Assignment | zod-Allowlists in allen Routen | ✅ | – |
| Rollen aus Server-Sitzung | ja (`src/lib/auth/session.ts`) | ✅ | – |
| 2FA für Admins | **fehlt** | ❌ | BF-01 |
| Passwort-Hashing / Regeln | scrypt N=2^17, min. 12 Zeichen | ✅ (behoben) | BF-14 (Leak-Prüfung) |
| Nutzer-Enumeration | Login/Reset antworten gleich | ✅ | – |
| Reset/Einladung | gehasht, einmalig, 30 min / 7 Tage, Sitzungen werden beendet | ✅ | – |
| Sitzungsdauer / Re-Auth | 14 Tage gleitend für alle; keine erneute Anmeldung für sensible Aktionen | ⚠️ | BF-12 |
| Rate Limiting | nur Kontosperre (5 Fehlversuche/15 min), **kein IP-Limit**, keines auf Reset/Tools | ❌ | BF-02 |
| Eingaben / SQL / XSS | zod, ORM, kein `dangerouslySetInnerHTML` mit Nutzerdaten | ✅ | – |
| CSRF | Origin-Prüfung in `src/middleware.ts` + SameSite=Lax | ✅ | – |
| Header / HTTPS / CORS | CSP, nosniff, Referrer, Permissions, frame-ancestors; HSTS über Caddy; kein CORS | ✅ | BF-19 (`unsafe-inline`) |
| Größenlimits | Felder und Listen begrenzt, JSON-Body nicht ausdrücklich | ⚠️ | BF-20 |
| Abhängigkeiten | `npm audit`: hoch bei prisma (CLI) und next/postcss, nur per Major-Update lösbar | ❌ | BF-05 |
| Logging | Rufnummern maskiert, keine Transkripte im Log | ✅ | – |
| Webhooks | Twilio HMAC-SHA1, Retell HMAC-SHA256 mit Zeitstempel bzw. Secret; idempotent | ✅ | BF-17 (echter Test) |
| KI: Ausgaben nicht ungeprüft ausgeführt | Tool-Argumente validiert, Mandant nie aus KI-Argumenten | ✅ | BF-23 |
| KI: Transparenz (Art. 50) | Begrüßung legt KI offen, nicht mehr abschaltbar | ✅ (behoben) | – |

## Befunde

| ID | Schwere | Bereich | Fundstelle | Beschreibung | Empfehlung |
|---|---|---|---|---|---|
| BF-01 | hoch | Sicherheit | `src/lib/auth/*` | Keine Zwei-Faktor-Anmeldung. Der Plattform-Admin sieht **alle** Kunden. 2FA für Admins ist laut Checkliste ab Stufe 1 Pflicht. | TOTP (App) für Plattform-Admin verpflichtend, für Kunden-Admins anbieten; Wiederherstellungscodes. |
| BF-02 | hoch | Sicherheit | `src/app/api/auth/*`, `src/app/api/voice/*`, `src/app/api/tickets` | Kein Rate-Limit pro IP. „Passwort vergessen“ lässt sich für E-Mail-Flut missbrauchen, ebenso Setup-Token-Raten und Tool-Endpunkte. | Limiter (ein Server → Speicher im Prozess genügt) gemäß `standardwerte.md` §6, Antwort 429 mit `Retry-After`. |
| BF-03 | hoch | Datenschutz | `src/lib/services/retention.ts`, `customers.ts` (`eraseCustomer`), `TicketDrawer.tsx` | Löschfrist und DSGVO-Löschung entfernen nur **unsere** Kopie. Aufnahmen und Transkripte bei Retell/Twilio bleiben bestehen. Aufnahme-Links zeigen direkt auf den Anbieter. | Löschung über die APIs von Retell und Twilio ergänzen. Aufnahmen über einen eigenen Endpunkt mit Berechtigungsprüfung ausliefern. Aufbewahrung beim Anbieter minimal einstellen. |
| BF-04 | hoch | Recht | `src/lib/tenant/settings.ts` (`announceRecording`) | Der Aufzeichnungshinweis lässt sich abschalten, Retell zeichnet aber weiter auf. Die Rechtsgrundlage für Mitschnitte ist ungeklärt (§ 201 StGB, DSGVO). | Hinweis aus ⇒ Aufzeichnung beim Anbieter aus. Anwaltlich klären, ob ein Hinweis genügt oder eine Einwilligung nötig ist. |
| BF-05 | hoch | Lieferkette | `package.json` | Bekannte Schwachstellen: prisma 6 (CLI, hoch) und next 15 → postcss (hoch/mittel). Behebung nur per Major-Update. | Update auf Prisma 7 (braucht `prisma.config.ts` und Treiber-Adapter) und Next 16 als eigene Aufgaben, jeweils mit vollem Testlauf. |
| BF-06 | hoch | Betrieb | – | Keine CI. Tests, Lint, `npm audit`, Secret-Scan und Docker-Build laufen nicht automatisch (Regel 10.2). | GitHub Actions mit Postgres-Service, Dependabot, Secret Scanning / Push Protection aktivieren. |
| BF-07 | hoch | Recht / Vertrag | – | Du bist **Auftragsverarbeiter** deiner Kunden. Es fehlen: AV-Vertrag für Kunden, Liste der Unterauftragsverarbeiter (IONOS, Twilio, Retell inkl. Sprachmodell, SMTP, ggf. Microsoft), Verarbeitungsverzeichnis, TOMs, Mustertext für die Informationspflicht gegenüber Anrufern (Art. 13), Impressum und Datenschutz der Plattform, DSFA-Schwellwertprüfung, Incident-Plan (72 h), Prüfung des Drittlandtransfers (USA). | Phase 16 mit den Vorlagen `templates/auftragsverarbeiter-liste.md`, `verarbeitungsverzeichnis.md`, `loeschkonzept.md`, `dsfa-vorlage.md`, `incident-plan.md`, `datenschutzerklaerung-geruest.md` durchlaufen. Danach anwaltliche Prüfung. |
| BF-08 | mittel | Betrieb | – | Kein Monitoring und keine Alarme: Ausfall, Fehlerquote, fehlgeschlagene Nachrichten, abgelaufene Microsoft-Verbindung, Plattenplatz. | Uptime-Monitor auf `/api/health`, Fehler-Tracking ohne personenbezogene Daten, tägliche Fehler-Mail aus dem Nachrichtenprotokoll. |
| BF-09 | mittel | Betrieb | `deploy/backup.sh` | Backups sind unverschlüsselt und liegen nur auf demselben Server. Eine Wiederherstellung wurde nie geübt. | Verschlüsselt auslagern (z. B. `age` + IONOS S3), Wiederherstellung vor dem Launch testen und danach vierteljährlich. |
| BF-10 | mittel | Kosten | `src/app/api/twilio/voice/route.ts` | Minutenlimit pro Kunde vorhanden, aber ohne Warnung bei 80 % / 100 %. Kein plattformweites Budget, Budget-Grenzen bei Twilio/Retell nicht prüfbar. Preismodell fehlt. | Phase 17: Kosten je Minute, Preise und Marge. Warn-E-Mails, Budget-Alarme beim Anbieter. |
| BF-11 | mittel | Qualität | `tests/` | Berechtigungen nur auf Service-Ebene getestet. HTTP-Tests je Endpunkt (fremder Mandant → 404, Mitarbeiter → keine Einstellungen) und eine Rückverfolgungsmatrix fehlen. | Phase 19: Tests je Endpunkt + Playwright-Durchlauf in der CI. |
| BF-12 | mittel | Sicherheit | `src/lib/auth/session.ts` | 14 Tage Sitzung für alle. Für Admins empfohlen: ≤ 12 h absolut, 30 min Inaktivität. Keine erneute Anmeldung vor sensiblen Aktionen (Löschung, Rollen). | Rollenabhängige Laufzeiten, Re-Auth für sensible Aktionen. |
| BF-13 | mittel | Sicherheit | `prisma/schema.prisma` | Die Mandantentrennung hängt allein am Anwendungscode. | Optional: Postgres Row-Level-Security als zweite Schicht. |
| BF-14 | mittel | Sicherheit | `src/lib/auth/crypto.ts` | Keine Prüfung gegen bekannte geleakte Passwörter. | HIBP-Range-API (k-Anonymität) beim Setzen des Passworts. |
| BF-15 | mittel | Funktion / Recht | – | Offboarding fehlt: Kunde kündigt → Komplett-Export und vollständige Löschung (inkl. Anbieter-Aufnahmen). Der Admin kann einen Mandanten nicht löschen. | Export + Löschung eines Mandanten mit Bestätigung und Audit-Eintrag. |
| BF-16 | mittel | Recht | Transkripte | Gesundheitsangaben können in Transkripten landen (Art. 9). | In die DSFA-Schwellwertprüfung (BF-07) aufnehmen; Löschfrist ggf. verkürzen. |
| BF-17 | mittel | Qualität | `src/lib/voice/*` | Twilio → Retell → Tools → Events wurde nie mit echten Konten getestet. Das Retell-Signaturformat ist nur anhand der Doku umgesetzt. | Pilot mit echtem Konto und Testnummer, Ergebnisse als Nachweis ablegen. |
| BF-18 | mittel | Barrierefreiheit | `src/components/**` | Einige Formulare haben nur Platzhalter statt Beschriftungen. Animationen ignorieren „Bewegung reduzieren“. Kontraste nicht dokumentiert. | Phase 10 (verkürzt): Labels, `prefers-reduced-motion`, Kontrastprüfung. BFSG beim B2B-Portal voraussichtlich nicht einschlägig – einordnen. |
| BF-19 | niedrig | Sicherheit | `next.config.ts` | CSP erlaubt `unsafe-inline` für Skripte. | Bei Stufe 2 als begründete Ausnahme dokumentieren, später auf Nonces umstellen. |
| BF-20 | niedrig | Sicherheit | API-Routen | JSON-Body ohne ausdrückliches Größenlimit. | Limit (z. B. 100 KB) im Reverse-Proxy oder in `readJson`. |
| BF-21 | niedrig | Sicherheit | `src/app/api/auth/login/route.ts` | 429 ohne `Retry-After`-Header. | Mit BF-02 erledigen. |
| BF-22 | niedrig | Betrieb | – | Keine Staging-Umgebung. Rollback (vorheriges Image) nicht dokumentiert und nicht geübt. | Image-Tags je Release, Rollback-Ablauf in `docs/betrieb.md`. |
| BF-23 | niedrig | KI / Missbrauch | `src/app/api/twilio/voice/route.ts` | Kein Schutz gegen Spam- oder Massenanrufe (Kosten). Anrufer könnten der KI Zusagen entlocken, die nicht im FAQ stehen. | Anrufe je Rufnummer und Stunde begrenzen. Prompt-Regeln (keine Zusagen außerhalb FAQ) mit Testanrufen prüfen. |

## Stand nach Sicherheitsblock (2026-10-23, Commits `06143d0`, `d4a3c1f`)
| Befund | Status | Nachweis |
|---|---|---|
| BF-01 2FA | ✅ behoben – TOTP, Pflicht für Plattform-Admin | `tests/totp.test.ts` (RFC-6238-Vektoren), Browser-Durchlauf |
| BF-02 / BF-21 Rate-Limits, Retry-After | ✅ behoben | `tests/rate-limit.test.ts`, Browser-Durchlauf (429 nach 20 Versuchen) |
| BF-03 Löschung bei Anbietern, Aufnahmen-Endpunkt | ✅ behoben (Echtbetrieb mit Anbieter-Konten noch zu belegen) | `src/lib/voice/providers.ts`, SSRF-Test |
| BF-04 stille Aufzeichnung | ✅ technisch behoben; rechtliche Klärung bleibt offen | `tests/urgency.test.ts` („Keine stille Aufzeichnung“) |
| BF-06 CI | ✅ eingerichtet (Lauf auf GitHub steht aus) | `.github/workflows/ci.yml`, `.github/dependabot.yml` |
| BF-12 Sitzungen/Re-Auth | ✅ behoben | Browser-Durchlauf (Bestätigungsdialog) |
| BF-14 Leak-Prüfung | ✅ behoben | `tests/pwned.test.ts` |
| BF-19 CSP | akzeptiert als E-001 | `docs/sicherheit.md` |
| BF-20 Größenlimit | ✅ behoben | `src/lib/http.ts` |
| BF-23 Mehrfachanrufe | ✅ behoben (Limit je Anrufer) | `src/lib/rate-limit.ts` |
| BF-05 Major-Updates | offen (E-003) | – |

## Bereits behoben (Commit `5515082`)
- Eigene Begrüßung konnte den KI-Hinweis (Art. 50 KI-VO) und den Aufzeichnungshinweis entfernen → werden jetzt erzwungen (Test vorhanden).
- Externe Aufrufe ohne Timeout (Microsoft Graph, Twilio-SMS, SMTP) → die KI hätte im Gespräch hängen können.
- Passwort-Parameter unter Standard → scrypt N=2^17, 12 Zeichen, Reset-Link 30 Minuten.
- `nodemailer` 6 mit bekannter Schwachstelle → Version 10.

## Vorschlag für B2 – welche Phasen jetzt laufen
Ziel laut Gespräch: **Weiterentwickeln + Absichern** für den Verkauf an mehrere Kunden.

| Reihenfolge | Phase | Warum | Befunde |
|---|---|---|---|
| 1 | 14 Sicherheitsarchitektur | `docs/sicherheit.md` mit festen Werten, 2FA, Rate-Limits, Sitzungen | BF-01, 02, 12, 14, 19–21 |
| 2 | 16 Recht & Datenschutz | Größter Block vor dem ersten zahlenden Kunden | BF-03, 04, 07, 15, 16 |
| 3 | 20 Betrieb | CI, Monitoring, Backups, Incident-Plan, Rollback | BF-06, 08, 09, 22 |
| 4 | 17 Monetarisierung & Kosten | Preis je Minute/Paket, harte Limits, Alarme | BF-10, 23 |
| 5 | 12 + 19 Rechte & Tests | Berechtigungsmatrix formal, Tests je Endpunkt, Rückverfolgungsmatrix | BF-11, 13 |
| 6 | 10 Barrierefreiheit (verkürzt) | Labels, Fokus, reduzierte Bewegung | BF-18 |
| 7 | 23 Launch | Checkliste mit Nachweisen, Pilot mit echtem Konto | BF-05, 17 |
