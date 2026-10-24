# Launch & Freigabe

Stand: 2026-10-24 · Risikostufe 2 (Tendenz 3, siehe `B1-ist-analyse.md`). Ein Haken zählt nur mit nachprüfbarem Nachweis (Datum, Pfad, Commit, Lauf-Nummer). Offene Punkte haben eine leere Nachweis-Spalte.

## Strategie
- Start: **Soft Launch** mit 1–2 Pilotbetrieben (Gründerkunden), Rückweg jederzeit über die alte Rufumleitung.
- Feedback-Kanal: E-Mail-Adresse des Betreibers + wöchentliches Telefonat mit den Pilotbetrieben (noch festzulegen).
- Plan für die ersten 2 Wochen: tägliche Durchsicht von Alarmen, Anrufliste und Nachrichtenprotokoll; jedes fehlgeschlagene Gespräch wird nachgehört und als Testfall in `docs/testanrufe.md` ergänzt.

## Checkliste

### Sprach-KI (projektspezifisch)
| ✓ | Prüfpunkt | Stufe | Nachweis |
|---|---|---|---|
| ☑ | Kundendaten nur zur verifizierten Anrufernummer, keine Fremddaten über genannte Nummern | 2 | Test „gibt Kundendaten nur zur verifizierten Anrufernummer heraus“ (`tests/integration/tenancy.test.ts`), Commit 8bdaa52, lokal grün 2026-10-24 |
| ☑ | Funktionsaufrufe nur für laufende, selbst angelegte Anrufe; Geheimnis je Anbieter | 2 | Tests „bindet ElevenLabs-/SIP-Funktionen fest an einen laufenden Anruf“, „lehnt Funktionsaufrufe im Format eines anderen Anbieters ab“, `tests/voice-auth.test.ts`; Commit 8bdaa52, lokal grün 2026-10-24 |
| ☑ | Agent-Konfiguration passt zum Server (Kundentypen) | 1 | Test „nutzt genau die Kundentypen, die der Server kennt“ (`tests/voice-auth.test.ts`), Commit 8bdaa52 |
| ☐ | Testanruf-Protokoll (20 Szenarien) je Anbieter durchlaufen | 2 | |
| ☐ | Echte Tool- und Ereignis-Payloads je Anbieter als Fixtures abgelegt und Tests grün | 2 | |
| ☐ | Latenz- und Gleichzeitigkeitstest mit echten Anbietern (Concurrency-Limits der Tarife, Twilio CPS) – eigener Server lokal geprüft: `scripts/loadtest.ts`, 60 gleichzeitig p95 816 ms (2026-10-24, Commit 94468b2) | 2 | |
| ☑ | Sprach-KI wartet nicht auf E-Mail/SMS; Versand mit Wiederholung | 1 | Tests „lässt die Sprach-KI nicht auf den Versand warten …“, „wiederholt fehlgeschlagene SMS …“; Commit 4a1309e, lokal grün 2026-10-24 |
| ☐ | Ersatzziel je Rufnummer als TwiML Bin bei Twilio gesetzt und mit gestoppter App getestet (`docs/testanrufe.md` Nr. 18) | 2 | |
| ☐ | Aufzeichnung: Standard „aus“ entschieden (offen, E-010); Einwilligung Variante C ist gebaut (Commit ae31147, `docs/recht/aufzeichnung.md`) | 2 | |

### Sicherheit (aus security/checkliste.md, vollständig; Risikostufe 2)
| ✓ | Prüfpunkt | Stufe | Nachweis |
|---|---|---|---|
| ☑ | Keine geheimen Schlüssel im Frontend-Build / App-Paket (Build-Scan aus `sicherheitstests.md` grün) | 1 | `scripts/scan-build.sh` + CI-Schritt „Build-Scan“ (Bau mit Kanarienwerten), Commit 33c0708, lokal 2026-10-24 ohne Treffer |
| ☑ | `.env*` in `.gitignore`, `.env.example` vorhanden | 1 | `.gitignore` Zeilen 6–7, `.env.example`, geprüft 2026-10-24 |
| ☑ | GitHub Secret Scanning / Push Protection aktiv (oder `gitleaks` in CI) | 1 | `.github/workflows/ci.yml` Schritt „Secret-Scan (gitleaks)“ |
| ☐ | Getrennte Schlüssel für Entwicklung / Test / Produktion | 2 |  |
| ☑ | Liste aller Schlüssel mit Ort und Verantwortlichem; Rotationsplan | 3 | `14-sicherheit.md` Abschnitt Schlüssel (Ort, Zweck, Rotation), `docs/sicherheit.md` „Geheimnisse“, Verfahren `docs/betrieb.md` „Schlüsselwechsel“ (Commit fa49bd4) |
| ☑ | Jede Tabelle mit Nutzerdaten hat aktive Zugriffsregeln (RLS / Security Rules / Server-Prüfung) | 2 | Server-Prüfung: `tenantId` aus der Sitzung in jeder Abfrage (`requireTenant`, `src/lib/auth/session.ts`); T-SEC-HTTP-02/-10 in `tests/e2e/http.test.ts` (scripts/e2e.sh gegen Produktions-Build, lokal 2026-10-24 19/19 grün, CI-Schritt „HTTP- und Browser-Tests“); RLS bewusst nicht (E-004) |
| ☑ | Test: Nutzer A kann Daten von B weder lesen, ändern, löschen noch in Listen sehen; Antwort gemäß Zugriffs-Antwortstrategie | 2 | T-SEC-HTTP-02 (lesen, Liste), T-SEC-HTTP-10 (ändern, löschen → 404) in `tests/e2e/http.test.ts` (scripts/e2e.sh gegen Produktions-Build, lokal 2026-10-24 19/19 grün, CI-Schritt „HTTP- und Browser-Tests“); Integration „trennt Kundendaten strikt …“ |
| ☑ | Test: Dateien von B sind für A nicht abrufbar | 2 | T-SEC-HTTP-15 (Aufnahme eines fremden Mandanten → 404) in `tests/e2e/http.test.ts` (scripts/e2e.sh gegen Produktions-Build, lokal 2026-10-24 19/19 grün, CI-Schritt „HTTP- und Browser-Tests“), Commit 669cc2f |
| ☑ | Test: `role`, `owner_id` u. ä. können vom Client nicht gesetzt werden | 2 | T-SEC-HTTP-11 (Rolle `PLATFORM_ADMIN` → 400, `tenantId` im Body ignoriert) in `tests/e2e/http.test.ts` (scripts/e2e.sh gegen Produktions-Build, lokal 2026-10-24 19/19 grün, CI-Schritt „HTTP- und Browser-Tests“), Commit 33c0708 |
| ☑ | Admin-Bereich serverseitig geschützt, Admins mit 2FA | 1 | T-SEC-HTTP-03, -05 (2FA-Pflicht), -06 (Re-Auth) in `tests/e2e/http.test.ts` (scripts/e2e.sh gegen Produktions-Build, lokal 2026-10-24 19/19 grün, CI-Schritt „HTTP- und Browser-Tests“), Commit 7404f55 |
| ☑ | Admin-Aktionen im Audit-Log | 3 | `src/lib/audit.ts`, Aufrufe u. a. in `src/app/api/admin/tenants/[id]/route.ts`, `src/lib/services/tenants.ts`; Umfang `docs/sicherheit.md` „Protokollierung“, geprüft 2026-10-24 |
| ☑ | Erprobter Login-Anbieter oder Passwort-Hashing gemäß `docs/sicherheit.md` | 2 | `src/lib/auth/crypto.ts` (scrypt N=2^17, r=8, p=1 nach OWASP), geprüft 2026-10-24 |
| ☑ | Passwortregeln gemäß `docs/sicherheit.md` inkl. Prüfung gegen geleakte Passwörter | 2 | `PASSWORD_MIN` 12 (`src/lib/auth/crypto.ts`), Leak-Prüfung `tests/pwned.test.ts`, geprüft 2026-10-24 |
| ☑ | Keine Nutzer-Enumeration bei Login, Registrierung, Reset | 2 | T-SEC-HTTP-09 (Login), T-SEC-HTTP-13 (Passwort vergessen) in `tests/e2e/http.test.ts` (scripts/e2e.sh gegen Produktions-Build, lokal 2026-10-24 19/19 grün, CI-Schritt „HTTP- und Browser-Tests“); Registrierung nur per Einladung |
| ☑ | Reset-Links einmalig, kurzlebig; Sitzungen nach Passwortänderung beendet | 2 | T-SEC-HTTP-12 (zweite Nutzung und abgelaufen → 410, alle Sitzungen beendet) in `tests/e2e/http.test.ts` (scripts/e2e.sh gegen Produktions-Build, lokal 2026-10-24 19/19 grün, CI-Schritt „HTTP- und Browser-Tests“), Commit 33c0708 |
| ☑ | Cookies `HttpOnly`, `Secure`, `SameSite` | 2 | `src/lib/auth/session.ts` Zeilen 63–65 |
| ☑ | Logout beendet Sitzung serverseitig | 2 | T-SEC-HTTP-16 in `tests/e2e/http.test.ts` (scripts/e2e.sh gegen Produktions-Build, lokal 2026-10-24 19/19 grün, CI-Schritt „HTTP- und Browser-Tests“), Commit 669cc2f |
| ☑ | 2FA für Nutzer angeboten (Stufe 3: Pflicht oder dringend empfohlen) | 3 | TOTP + Wiederherstellungscodes für alle Konten unter `/account` (`src/app/(app)/account/page.tsx`, `/api/auth/2fa/*`), `tests/totp.test.ts` |
| ☑ | Rate Limit auf Login, Registrierung, Reset (pro Konto und IP) gemäß `docs/sicherheit.md` – Test grün | 2 | Integration „zählt sicherheitsrelevante Limits gemeinsam in der Datenbank“ (`tests/integration/tenancy.test.ts`), `tests/rate-limit.test.ts`; Werte `docs/sicherheit.md` „Rate-Limits“, Commit 136bc7f |
| ☐ | Rate Limit / Tageslimit auf teuren Endpunkten + Budget-Grenze beim Anbieter | 1 |  |
| ☑ | Keine dauerhafte automatische Kontosperre | 2 | 5 Fehlversuche → 15 min Pause (`lockedUntil`), `docs/sicherheit.md` „Rate-Limits“, geprüft 2026-10-24 |
| ☑ | Größenlimits für Anfragen, Uploads, Listen | 1 | `src/lib/voice/handle-tools.ts` (256 KB), `src/app/api/voice/events/route.ts` (2 MB), `docs/sicherheit.md` „Größenlimits“ |
| ☑ | Serverseitige Schema-Validierung aller Eingaben | 1 | zod in allen Routen (`readJson` + Schema), KI-Argumente per zod (`src/lib/voice/tools.ts`); T-SEC-HTTP-11 (400) in `tests/e2e/http.test.ts` (scripts/e2e.sh gegen Produktions-Build, lokal 2026-10-24 19/19 grün, CI-Schritt „HTTP- und Browser-Tests“) |
| ☑ | Nur parametrisierte Datenbankabfragen / ORM | 1 | Prisma-ORM durchgängig (`src/lib/db.ts`); Roh-SQL nur `SELECT 1` in `src/app/api/health/route.ts` |
| ☑ | Keine ungefilterte HTML-Ausgabe von Nutzerinhalten | 1 | React-Escaping; einziges `dangerouslySetInnerHTML` ist das feste Theme-Skript (`src/app/layout.tsx`); `xmlEscape` in E-Mails/TwiML; grep geprüft 2026-10-24 |
| ☑ | CSRF-Schutz bei Cookie-Sitzungen | 2 | Origin-Prüfung `src/middleware.ts`, T-SEC-HTTP-04 in `tests/e2e/http.test.ts` (scripts/e2e.sh gegen Produktions-Build, lokal 2026-10-24 19/19 grün, CI-Schritt „HTTP- und Browser-Tests“) |
| ☑ | Uploads: Typprüfung, Größenlimit, privat, zufälliger Name | 1 | n/a – keine Datei-Uploads; `formData` nur für Twilio-Webhooks (`src/lib/voice/inbound.ts`), geprüft 2026-10-24 |
| ☑ | Keine offenen Weiterleitungen; SSRF-Schutz falls URLs abgerufen werden | 1 | Login-`next` nur relative Pfade (`src/app/(auth)/login/page.tsx`); OAuth-Rücksprung fest auf `PUBLIC_BASE_URL`; SSRF: `recordingUrlAllowed` + Weiterleitungen geprüft, `tests/recording-fetch.test.ts`, Commit 0e0efc5 |
| ☑ | HTTPS überall, HSTS | 1 | `deploy/Caddyfile` (Strict-Transport-Security), geprüft 2026-10-24 |
| ☑ | Security-Header gesetzt (CSP, nosniff, Referrer-Policy, frame-ancestors, Permissions-Policy) | 1 | `next.config.ts` (CSP, nosniff, Referrer-Policy, frame-ancestors, Permissions-Policy) |
| ☑ | CORS nur eigene Domains | 1 | keine CORS-Header gesetzt (nur gleiche Herkunft), grep `Access-Control` ohne Treffer 2026-10-24; `docs/sicherheit.md` „Security-Header“ |
| ☑ | CSP ohne `unsafe-inline` / `unsafe-eval` (oder begründete Ausnahme) | 3 | Skripte nur mit Nonce (`src/middleware.ts`), Tests T-SEC-HTTP-08 und E2E-04 (keine CSP-Verstöße), 2026-10-24; begründete Ausnahme `unsafe-inline` nur für Styles (E-001) |
| ☑ | Keine sensiblen Daten in Logs, URLs, Fehlermeldungen, Analytics, Push-Texten | 1 | grep der Log-Aufrufe 2026-10-24: Anrufernummern per `maskPhone`, im Klartext nur Firmennummern, keine Transkripte/Tokens/Passwörter; kein Analytics, keine Push-Nachrichten; Reset-Token nur im Pfad mit `Referrer-Policy` (`next.config.ts`) |
| ☑ | Konto löschen entfernt alle Daten inkl. Dateien | 2 | Integration „löscht einen Mandanten nur nach Anbieter-Löschung …“ (inkl. Aufnahmen beim Anbieter), Schlussabrechnung bleibt (Commit 48e363a) |
| ☑ | Datenexport nur für den Nutzer selbst | 2 | Integration „exportiert nur Daten des eigenen Mandanten“ (`tests/integration/tenancy.test.ts`) |
| ☐ | Backups verschlüsselt, Wiederherstellung getestet | 2 |  |
| ☐ | 2FA auf allen Betreiber-Zugängen (GitHub, Hosting, DB, Domain, E-Mail, Stores) | 1 |  |
| ☑ | Fehler-Tracking ohne sensible Daten; Alarme für Sicherheitsereignisse | 2 | Fehler als JSON-Log ohne Inhaltsdaten (`src/lib/logger.ts`), Überwachung `src/lib/services/monitor.ts` mit Alarm bei gehäuften Fehlanmeldungen, Integrationstest „alarmiert bei einer Häufung fehlgeschlagener Anmeldungen“, Commit 0098ab2 |
| ☐ | Notfall-/Incident-Plan ausgefüllt (`templates/incident-plan.md`), Kontaktliste aktuell, Übung durchgeführt | 2 |  |
| ☐ | Rollback eines Releases einmal geübt (Skript `deploy/deploy.sh --rollback`, Commit a37f425; Übung auf dem Server offen) | 2 |  |
| ☐ | Support-Kanal und Störungs-Kommunikation festgelegt (Vorlage ausgefüllt: `docs/support-playbook.md`; Kanal noch festlegen) | 2 |  |
| ☑ | Lockfile eingecheckt | 1 | `package-lock.json` |
| ☑ | Keine bekannten hohen/kritischen Schwachstellen (`npm audit` o. ä.) | 1 | `npm audit --omit=dev` 0 Funde (2026-10-24, Commit 859b8e0), CI bricht ab „high“ ab; Entwicklungswerkzeuge: E-003 |
| ☑ | Automatische Update-Hinweise aktiv (Dependabot / Renovate) | 2 | `.github/dependabot.yml` |
| ☑ | Neue Abhängigkeiten geprüft: Paket existiert, Herausgeber und Pflegestand plausibel (Regel 9.5) | 1 | Neu seit Projektstart: `@playwright/test` 1.56.1 (Microsoft, devDependency), `zod` 4 (bestehendes Paket, Major-Update); Herausgeber und Pflegestand geprüft 2026-10-24, Commits 7404f55, 859b8e0 |
| ☑ | CI-Workflows: Aktionen mit festgelegter Version, minimale Rechte, keine Geheimnisse in Protokollen (Regel 9.6) | 2 | `.github/workflows/ci.yml`: Aktionen auf Commit-SHA, `permissions: contents: read`, `persist-credentials: false`, keine Geheimnisse; geprüft 2026-10-24 |
| ☑ | Schema-Änderungen nur über versionierte Migrationen, Backup vor Migration (Regel 9.7) | 2 | `prisma/migrations/` (+ Kopie `netlify/database/migrations`, `tests/netlify-migrations.test.ts`); Backup vor Migration in `deploy/deploy.sh` (Commit a37f425) |
| ☐ | Lizenzliste bzw. Software-Stückliste (SBOM) der Abhängigkeiten erzeugt (`guides/lieferkette.md`) | 3 |  |
| ☑ | Preis und Freischaltung nur serverseitig; Webhook-Signatur geprüft | 1 | Twilio-Signatur `src/lib/security.ts` (`validateTwilioRequest`) + Test „validiert Requests mit gesetztem Token“ (`tests/security.test.ts`); Sprach-KI-Webhooks `verifyVoiceRequest` + `tests/voice-auth.test.ts`, Commit 8bdaa52 |
| ☑ | Mobile: keine Geheimnisse im Paket; Tokens im Keychain/Keystore | 2 | n/a – keine Mobile-App |
| ☑ | KI: Ausgaben nicht ungeprüft ausgeführt; nur erlaubte Daten im Kontext; Limits | 1 | Tool-Argumente per zod geprüft, Mandant und Anrufer nur aus dem Anrufkontext (`src/lib/voice/tools.ts` `runTool`, `src/lib/voice/context.ts`); Tests in `tests/integration/tenancy.test.ts`, Commit 8bdaa52 |
| ☑ | KI: Einordnung nach EU-KI-Verordnung dokumentiert, Transparenzhinweise für Nutzer vorhanden (`guides/recht-eu-ueberblick.md`) | 1 | `docs/recht/ki-verordnung.md`; KI-Offenlegung serverseitig in der Begrüßung erzwungen (`src/lib/voice/context.ts` `AI_DISCLOSURE`) |
| ☐ | Abgleich mit OWASP ASVS Level 1 | 2 |  |
| ☐ | Abgleich mit OWASP ASVS Level 2 | 3 |  |
| ☐ | Externe Fachprüfung (Pentest / Code-Review) durchgeführt, Bericht in `pruefungen/externe-pruefung-….md` – oder Risiko bewusst akzeptiert (`E-…`, Stichwort „extern“) | 3 |  |

### Betrieb, Recht, Qualität
| ✓ | Prüfpunkt | Stufe | Nachweis |
|---|---|---|---|
| ☐ | Server gehärtet (`deploy/harden.sh`), Nachweise laut `docs/betrieb.md` abgelegt | 2 | |
| ☐ | Backup-Wiederherstellung auf dem Produktionsserver getestet (lokaler Probelauf der Skripte 2026-10-24 ok, Commit 815c26c) | 2 | |
| ☐ | Externer Lebenszeichen-Dienst und Uptime-Check aktiv (Überwachung: `src/lib/services/monitor.ts`, Commit 9e3df2d) | 1 | |
| ☑ | Rate Limits über mehrere Instanzen wirksam | 2 | Sicherheitsrelevante Limits in PostgreSQL (`RateLimitHit`), Commit 136bc7f; übrige Zähler im Prozess (E-002) |
| ☐ | Dependabot-Sicherheitsupdates und Branch-Schutz im Repository aktiv | 2 | |
| ☐ | Monitoring, Uptime- und Kosten-Alarme aktiv (inkl. Budget-Grenzen bei den Anbietern) | 1 | |
| ☐ | AVV mit allen Dienstleistern abgeschlossen (IONOS, Twilio, Retell, Vapi, ElevenLabs, SMTP) | 2 | |
| ☐ | Drittland-Übermittlungen geprüft (Retell-TIA, Unterauftragnehmer schriftlich) | 2 | |
| ☐ | Alle 54 Prüfmarkierungen in `docs/recht/` fachlich geklärt | 2 | |
| ☐ | Impressum und Datenschutzerklärung veröffentlicht, `LEGAL_*_URL` gesetzt | 2 | |
| ☐ | AGB, Leistungsbeschreibung und SLA final | 2 | |
| ☑ | DSFA-Schwellwertprüfung dokumentiert (Transkripte können Gesundheitsdaten enthalten) | 3 | `docs/recht/dsfa.md` (Ergebnis: für Kunden voraussichtlich erforderlich, Vorlage Teil B), `16-recht.md`, 2026-10-24 |
| ☐ | Datenexport und Löschung eines Kunden auf Produktion geprüft | 2 | |
| ☐ | Testkonten und Testdaten aus der Produktion entfernt | 1 | |
| ☐ | Feedback-Kanal eingerichtet | 1 | |

## Freigabebericht
| Bereich | Pflichtpunkte | mit Nachweis | n/a | offen | akzeptiert (E-…) |
|---|---|---|---|---|---|
| Sprach-KI | 9 | 4 | 0 | 5 | 0 |
| Sicherheit | 55 | 42 | 2 | 11 | 0 |
| Betrieb, Recht, Qualität | 15 | 1 | 0 | 14 | 0 |

**Freigabestatus:** Nicht freigabefähig (Stand 2026-10-24, Prüfskript `--launch`: 43 von 71 Pflichtpunkten mit Nachweis, 2 n/a, 26 offen). Alles, was ohne echte Konten, Produktionsserver oder rechtliche Prüfung nachweisbar war, ist belegt. Die offenen Punkte brauchen:
- **echte Anbieterkonten:** Testanrufe (20 Szenarien), echte Payloads als Fixtures, Latenz/Gleichzeitigkeit mit Anbietern, TwiML-Bin-Ersatzziel, Budget-Grenzen bei Anbietern;
- **den Produktionsserver:** Härtung, Backup-Wiederherstellung, Uptime/Lebenszeichen, Rollback-Übung, Export/Löschung auf Produktion, Testdaten entfernen, getrennte Schlüssel;
- **Konten und Organisation des Betreibers:** 2FA auf allen Zugängen (`docs/betreiber-konten.md`), Branch-Schutz, Incident-Kontakte und Übung, Support- und Feedback-Kanal;
- **rechtliche Prüfung und Verträge:** AVV, Drittland/TIA, Prüfmarkierungen in `docs/recht/`, Impressum/Datenschutz veröffentlicht, AGB/SLA, DSFA-Schwellwert;
- **Entscheidungen:** Aufzeichnung standardmäßig aus (E-010).
