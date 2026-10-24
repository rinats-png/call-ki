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
| ☐ | Latenz- und Gleichzeitigkeitstest mit echten Anbietern (Concurrency-Limits der Tarife, Twilio CPS) | 2 | |
| ☑ | Sprach-KI wartet nicht auf E-Mail/SMS; Versand mit Wiederholung | 1 | Tests „lässt die Sprach-KI nicht auf den Versand warten …“, „wiederholt fehlgeschlagene SMS …“; Commit 4a1309e, lokal grün 2026-10-24 |
| ☐ | Ersatzziel je Rufnummer als TwiML Bin bei Twilio gesetzt und mit gestoppter App getestet (`docs/testanrufe.md` Nr. 18) | 2 | |
| ☐ | Aufzeichnung: Standard „aus“ entschieden; Einwilligung (Variante C) gebaut, bevor Aufzeichnung verkauft wird (`docs/recht/aufzeichnung.md`) | 2 | |

### Sicherheit (aus security/checkliste.md, vollständig; Risikostufe 2)
| ✓ | Prüfpunkt | Stufe | Nachweis |
|---|---|---|---|
| ☐ | Keine geheimen Schlüssel im Frontend-Build / App-Paket (Build-Scan aus `sicherheitstests.md` grün) | 1 |  |
| ☑ | `.env*` in `.gitignore`, `.env.example` vorhanden | 1 | `.gitignore` Zeilen 6–7, `.env.example`, geprüft 2026-10-24 |
| ☑ | GitHub Secret Scanning / Push Protection aktiv (oder `gitleaks` in CI) | 1 | `.github/workflows/ci.yml` Schritt „Secret-Scan (gitleaks)“ |
| ☐ | Getrennte Schlüssel für Entwicklung / Test / Produktion | 2 |  |
| ☐ | Liste aller Schlüssel mit Ort und Verantwortlichem; Rotationsplan | 3 |  |
| ☐ | Jede Tabelle mit Nutzerdaten hat aktive Zugriffsregeln (RLS / Security Rules / Server-Prüfung) | 2 |  |
| ☐ | Test: Nutzer A kann Daten von B weder lesen, ändern, löschen noch in Listen sehen; Antwort gemäß Zugriffs-Antwortstrategie | 2 |  |
| ☐ | Test: Dateien von B sind für A nicht abrufbar | 2 |  |
| ☐ | Test: `role`, `owner_id` u. ä. können vom Client nicht gesetzt werden | 2 |  |
| ☐ | Admin-Bereich serverseitig geschützt, Admins mit 2FA | 1 |  |
| ☐ | Admin-Aktionen im Audit-Log | 3 |  |
| ☐ | Erprobter Login-Anbieter oder Passwort-Hashing gemäß `docs/sicherheit.md` | 2 |  |
| ☐ | Passwortregeln gemäß `docs/sicherheit.md` inkl. Prüfung gegen geleakte Passwörter | 2 |  |
| ☐ | Keine Nutzer-Enumeration bei Login, Registrierung, Reset | 2 |  |
| ☐ | Reset-Links einmalig, kurzlebig; Sitzungen nach Passwortänderung beendet | 2 |  |
| ☑ | Cookies `HttpOnly`, `Secure`, `SameSite` | 2 | `src/lib/auth/session.ts` Zeilen 63–65 |
| ☐ | Logout beendet Sitzung serverseitig | 2 |  |
| ☐ | 2FA für Nutzer angeboten (Stufe 3: Pflicht oder dringend empfohlen) | 3 |  |
| ☐ | Rate Limit auf Login, Registrierung, Reset (pro Konto und IP) gemäß `docs/sicherheit.md` – Test grün | 2 |  |
| ☐ | Rate Limit / Tageslimit auf teuren Endpunkten + Budget-Grenze beim Anbieter | 1 |  |
| ☐ | Keine dauerhafte automatische Kontosperre | 2 |  |
| ☑ | Größenlimits für Anfragen, Uploads, Listen | 1 | `src/lib/voice/handle-tools.ts` (256 KB), `src/app/api/voice/events/route.ts` (2 MB), `docs/sicherheit.md` „Größenlimits“ |
| ☐ | Serverseitige Schema-Validierung aller Eingaben | 1 |  |
| ☑ | Nur parametrisierte Datenbankabfragen / ORM | 1 | Prisma-ORM durchgängig (`src/lib/db.ts`); Roh-SQL nur `SELECT 1` in `src/app/api/health/route.ts` |
| ☐ | Keine ungefilterte HTML-Ausgabe von Nutzerinhalten | 1 |  |
| ☐ | CSRF-Schutz bei Cookie-Sitzungen | 2 |  |
| ☐ | Uploads: Typprüfung, Größenlimit, privat, zufälliger Name | 1 |  |
| ☐ | Keine offenen Weiterleitungen; SSRF-Schutz falls URLs abgerufen werden | 1 |  |
| ☑ | HTTPS überall, HSTS | 1 | `deploy/Caddyfile` (Strict-Transport-Security), geprüft 2026-10-24 |
| ☑ | Security-Header gesetzt (CSP, nosniff, Referrer-Policy, frame-ancestors, Permissions-Policy) | 1 | `next.config.ts` (CSP, nosniff, Referrer-Policy, frame-ancestors, Permissions-Policy) |
| ☐ | CORS nur eigene Domains | 1 |  |
| ☐ | CSP ohne `unsafe-inline` / `unsafe-eval` (oder begründete Ausnahme) | 3 |  |
| ☐ | Keine sensiblen Daten in Logs, URLs, Fehlermeldungen, Analytics, Push-Texten | 1 |  |
| ☐ | Konto löschen entfernt alle Daten inkl. Dateien | 2 |  |
| ☐ | Datenexport nur für den Nutzer selbst | 2 |  |
| ☐ | Backups verschlüsselt, Wiederherstellung getestet | 2 |  |
| ☐ | 2FA auf allen Betreiber-Zugängen (GitHub, Hosting, DB, Domain, E-Mail, Stores) | 1 |  |
| ☐ | Fehler-Tracking ohne sensible Daten; Alarme für Sicherheitsereignisse | 2 |  |
| ☐ | Notfall-/Incident-Plan ausgefüllt (`templates/incident-plan.md`), Kontaktliste aktuell, Übung durchgeführt | 2 |  |
| ☐ | Rollback eines Releases einmal geübt (Vorgehen in `docs/betrieb.md`) | 2 |  |
| ☐ | Support-Kanal und Störungs-Kommunikation festgelegt (`templates/support-playbook.md`) | 2 |  |
| ☑ | Lockfile eingecheckt | 1 | `package-lock.json` |
| ☐ | Keine bekannten hohen/kritischen Schwachstellen (`npm audit` o. ä.) | 1 |  |
| ☑ | Automatische Update-Hinweise aktiv (Dependabot / Renovate) | 2 | `.github/dependabot.yml` |
| ☐ | Neue Abhängigkeiten geprüft: Paket existiert, Herausgeber und Pflegestand plausibel (Regel 9.5) | 1 |  |
| ☐ | CI-Workflows: Aktionen mit festgelegter Version, minimale Rechte, keine Geheimnisse in Protokollen (Regel 9.6) | 2 |  |
| ☐ | Schema-Änderungen nur über versionierte Migrationen, Backup vor Migration (Regel 9.7) | 2 |  |
| ☐ | Lizenzliste bzw. Software-Stückliste (SBOM) der Abhängigkeiten erzeugt (`guides/lieferkette.md`) | 3 |  |
| ☑ | Preis und Freischaltung nur serverseitig; Webhook-Signatur geprüft | 1 | Twilio-Signatur `src/lib/security.ts` (`validateTwilioRequest`) + Test „validiert Requests mit gesetztem Token“ (`tests/security.test.ts`); Sprach-KI-Webhooks `verifyVoiceRequest` + `tests/voice-auth.test.ts`, Commit 8bdaa52 |
| ☑ | Mobile: keine Geheimnisse im Paket; Tokens im Keychain/Keystore | 2 | n/a – keine Mobile-App |
| ☑ | KI: Ausgaben nicht ungeprüft ausgeführt; nur erlaubte Daten im Kontext; Limits | 1 | Tool-Argumente per zod geprüft, Mandant und Anrufer nur aus dem Anrufkontext (`src/lib/voice/tools.ts` `runTool`, `src/lib/voice/context.ts`); Tests in `tests/integration/tenancy.test.ts`, Commit 8bdaa52 |
| ☐ | KI: Einordnung nach EU-KI-Verordnung dokumentiert, Transparenzhinweise für Nutzer vorhanden (`guides/recht-eu-ueberblick.md`) | 1 |  |
| ☐ | Abgleich mit OWASP ASVS Level 1 | 2 |  |
| ☐ | Abgleich mit OWASP ASVS Level 2 | 3 |  |
| ☐ | Externe Fachprüfung (Pentest / Code-Review) durchgeführt, Bericht in `pruefungen/externe-pruefung-….md` – oder Risiko bewusst akzeptiert (`E-…`, Stichwort „extern“) | 3 |  |

### Betrieb, Recht, Qualität
| ✓ | Prüfpunkt | Stufe | Nachweis |
|---|---|---|---|
| ☐ | Server gehärtet (`deploy/harden.sh`), Nachweise laut `docs/betrieb.md` abgelegt | 2 | |
| ☐ | Backup-Wiederherstellung auf dem Produktionsserver getestet (lokaler Probelauf der Skripte 2026-10-24 ok, Commit 815c26c) | 2 | |
| ☐ | Externer Lebenszeichen-Dienst und Uptime-Check aktiv (Überwachung: `src/lib/services/monitor.ts`, Commit 9e3df2d) | 1 | |
| ☐ | Rate Limits über mehrere Instanzen wirksam (heute nur im Speicher) | 2 | |
| ☐ | Dependabot-Sicherheitsupdates und Branch-Schutz im Repository aktiv | 2 | |
| ☐ | Monitoring, Uptime- und Kosten-Alarme aktiv (inkl. Budget-Grenzen bei den Anbietern) | 1 | |
| ☐ | AVV mit allen Dienstleistern abgeschlossen (IONOS, Twilio, Retell, Vapi, ElevenLabs, SMTP) | 2 | |
| ☐ | Drittland-Übermittlungen geprüft (Retell-TIA, Unterauftragnehmer schriftlich) | 2 | |
| ☐ | Alle 54 Prüfmarkierungen in `docs/recht/` fachlich geklärt | 2 | |
| ☐ | Impressum und Datenschutzerklärung veröffentlicht, `LEGAL_*_URL` gesetzt | 2 | |
| ☐ | AGB, Leistungsbeschreibung und SLA final | 2 | |
| ☐ | DSFA-Schwellwertprüfung dokumentiert (Transkripte können Gesundheitsdaten enthalten) | 3 | |
| ☐ | Datenexport und Löschung eines Kunden auf Produktion geprüft | 2 | |
| ☐ | Testkonten und Testdaten aus der Produktion entfernt | 1 | |
| ☐ | Feedback-Kanal eingerichtet | 1 | |

## Freigabebericht
| Bereich | Pflichtpunkte | mit Nachweis | n/a | offen | akzeptiert (E-…) |
|---|---|---|---|---|---|
| Sprach-KI | 9 | 4 | 0 | 5 | 0 |
| Sicherheit | 55 | 11 | 1 | 43 | 0 |
| Betrieb, Recht, Qualität | 15 | 0 | 0 | 15 | 0 |

**Freigabestatus:** Nicht freigabefähig (Stand 2026-10-24). Offen sind vor allem Punkte, die echte Konten, den Produktionsserver oder eine rechtliche Prüfung brauchen.
