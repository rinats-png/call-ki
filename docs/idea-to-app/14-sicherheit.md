# Sicherheitskonzept

Risikostufe: **2 laut `docs/sicherheit.md` und E-017 („Tendenz 3“), Empfehlung 3** (Art.-9-Daten in Transkripten möglich, umfangreiche Daten Dritter; Begründung in `11-daten.md`) | Zielstandard: **ASVS Level 1 erreicht/teilweise (Abgleich unten); bei Stufe 3 ASVS Level 2 + externe Fachprüfung**

> Phase 14 im Modus „Bestehende App“. Ergänzt `docs/sicherheit.md` (festgelegte Werte und E-001…E-004) um Bedrohungsmodell, Schlüsseltabelle, ASVS-Abgleich und Testzuordnung. Alle Aussagen sind gegen den Code geprüft (Stand 2026-10-24, Commit `33c0708`; Nachträge aus `48e363a`, `859b8e0`, `0e0efc5`, `33c0708` sind mit Commit gekennzeichnet). Keine Sicherheitsgarantie.

## Bedrohungsmodell

STRIDE: S = Spoofing, T = Tampering, R = Repudiation, I = Information Disclosure, D = Denial of Service, E = Elevation of Privilege. Wahrscheinlichkeit h/m/n. Abschnitt = Festlegungen A–K unten.

| ID | Was ist wertvoll? | Wer greift an? | Wie? (STRIDE) | Folge | Wahrscheinlichkeit | Gegenmaßnahme | Abschnitt | Test / akzeptiert |
|---|---|---|---|---|---|---|---|---|
| BD-01 | Verhalten der Telefon-KI, Kundendaten, Zusagen im Namen des Betriebs | Anrufer | **Prompt-Injection** am Telefon („Ignoriere deine Anweisungen …“, falsche Rolle, erfundene Preise), auch über FAQ-/Zusatztexte des Kunden (T, I, E) | Datenabfluss, falsche Zusagen, Missbrauch der Tools | h | Tools setzen Grenzen serverseitig: Mandant und Anrufernummer nur aus der Anrufzeile, Argumente per zod validiert, fremde Mitarbeiter-IDs ignoriert, keine Lese-Tools für Dritte; KI-Offenlegung fest im Server; Preisregel und FAQ als Variablen | I | T-SEC-17, T-SEC-20, T-SEC-23 |
| BD-02 | Stammdaten und Termine von Bestandskunden | Anrufer, Nachbar, Ex-Partner | **Fremddaten erfragen**: andere Nummer nennen, Vorgangsnummer raten, „Ich bin der Nachbar von …“ (I) | Name, Adresse, Termine Dritter preisgegeben | h | `identify_caller`, `find_appointments`, `reschedule_appointment`, `cancel_appointment` nur zur verifizierten Anrufernummer; genannte Nummer nur zum Speichern (Lücken füllen, keine Rückmeldung) | C, I | T-SEC-17 (E-009) |
| BD-03 | Telefon- und SMS-Budget des Betreibers | Betrüger (Toll Fraud, SMS-Pumping) | KI bringt man dazu, an teure/ausländische Nummern **durchzustellen** (`transfer_call` des Anbieters wählt die Nummer aus dem Gespräch) oder eine **Bestätigungs-SMS an eine genannte Auslandsnummer** zu schicken (`book_appointment` mit `phone`) (D) | hohe Telefonrechnung | m | Durchstellnummer kommt aus dem Server (Mitarbeiter-Direktnummer/Notfallnummer, Paket `emergency_forwarding`); Kostenschutz (Höchstdauer, gleichzeitige Anrufe); **behoben (Commit `0e0efc5`):** SMS nur in freigegebene Länder (`SMS_ALLOWED_PREFIXES`, Standard `+49,+43,+41`; `smsDestinationAllowed` in `src/lib/notify/index.ts`, sonst Status `SKIPPED`), „Benachrichtigung erneut senden“ höchstens 5× je Vorgang in 24 h (`LIMITS.notifyPerTicket`, `src/app/api/tickets/[id]/notify/route.ts`); **offen:** `transfer_call` beim Anbieter auf feste Ziele beschränken (Anbieter-Konfiguration), Twilio Geo-Permissions `[PRÜFEN]` | E, I | T-SEC-24, T-SEC-07 |
| BD-04 | Minuten bei Twilio und Sprach-KI | Kostentreiber, Bots, Konkurrent | **Denial of Wallet**: viele parallele oder sehr lange Anrufe, Anrufe mit unterdrückter Nummer (D) | Rechnung, Kontingent des Kunden verbraucht | h | Anrufe je Anrufer und Nummer (10/h; unterdrückte Nummern gemeinsam 30/h je angerufener Nummer, Commit `7404f55`), Minutenlimit je Mandant, gleichzeitige Anrufe je Mandant und gesamt, Tagesbudget, Höchstdauer (`timeLimit` + Cron-Abbruch), Notschalter, Kontingent-Warnungen 80/100 % | E | T-SEC-07 (E-014) |
| BD-05 | Anruf- und Vorgangsdaten, Benachrichtigungen | Angreifer im Internet | **Gefälschte Webhooks**: Twilio-, Tool-, Ereignis- oder Cron-Aufruf ohne echten Absender; Replay; Geheimnis eines Anbieters für einen anderen nutzen (S, T) | gefälschte Anrufe, Vorgänge, SMS-Versand, Datenabfrage | m | Twilio-HMAC (in Produktion nicht abschaltbar), Retell-Signatur nur mit Zeitstempel ±5 min (Altformat ohne Zeitstempel abgelehnt, `src/lib/security.ts`, Commit `0e0efc5`), ElevenLabs-HMAC ±30 min, eigenes Geheimnis je Anbieter, Format muss zum Absender passen, Funktionen nur für laufende Anrufe (Retell/Vapi ohne eigene Anrufzeile: Anrufernummer gilt als unverifiziert, `src/lib/voice/context.ts`, Commit `0e0efc5`), Cron-Geheimnis; Rate-Limit 600/IP/min, Größenlimits | I | T-SEC-19, T-SEC-18 (E-005, E-013) |
| BD-06 | Vertrauen der Kunden des Betriebs | Betrüger (Vishing) | **Rufnummer fälschen** (Caller-ID-Spoofing) und als Bestandskunde anrufen → KI begrüßt mit Namen und lässt die Adresse „bestätigen“; oder Büro-Mitarbeiter am Telefon mit Insiderwissen täuschen (S, I) | Adresse und Auftragslage eines Kunden preisgegeben; Grundlage für weiteren Betrug | m | Kundendaten nur zur Anrufernummer, nur wenige Felder; **offen:** Prompt so ändern, dass die KI die Adresse nicht vorliest, sondern erfragt und vergleicht; Schulung Büro (Support-Playbook, Agent C) | I | T-SEC-30 |
| BD-07 | Daten aller Mandanten | Kunde B (neugieriger Nutzer) | **Mandantentrennung brechen**: fremde ID in URL/Body, Listen ohne Filter (I, T) | Datenleck zwischen Firmen | m | `tenantId` aus Sitzung in jeder Abfrage, `404` für fremde Datensätze, zod-Allowlists; Integrationstest „Mandantentrennung“ | C | T-SEC-01, T-SEC-02, T-SEC-04, E-004 |
| BD-08 | Konten der Kunden-Admins und Plattform-Admins | Bots, bekannte Personen | **Kontoübernahme**: Passwort raten, Credential Stuffing, Reset-Link missbrauchen, Sitzung stehlen, 2FA-Code wiederverwenden (S) | Zugriff auf Mandanten bzw. alle Mandanten | h | scrypt, 12 Zeichen, HIBP-Prüfung, Login-Limits je Konto und IP (gemeinsam in Postgres), Reset 30 min einmalig + alle Sitzungen enden, TOTP Pflicht für Plattform-Admin, Zeitschritt nicht wiederverwendbar, Admin-Sitzung 30 min/12 h, HttpOnly/Secure/SameSite-Cookies | A, B | T-SEC-05, T-SEC-06, T-SEC-09, T-SEC-22 (E-012, E-018) |
| BD-09 | Admin-Rechte | Mitarbeiter, Kunden-Admin | **Rechteausweitung**: `role` im Body, Admin-Endpunkte aufrufen, Kollegen-Konto per Reset-Link übernehmen (E) | Einstellungen, Löschung, fremde Konten | m | Rolle nur `TENANT_ADMIN`/`TENANT_USER` per zod, `requireTenant({ adminOnly })`, `requirePlatformAdmin`, Re-Auth für Rollen/Sperren und – **behoben in Commit `0e0efc5`** – auch für Reset-/Einladungslinks von Kollegen (`src/app/api/users/[id]/route.ts`, Test T-SEC-HTTP-14) | C | T-SEC-03, T-SEC-14, T-SEC-29 |
| BD-10 | Anbieter-Schlüssel, Webhook-Geheimnisse, `APP_ENCRYPTION_KEY` | Angreifer mit Zugriff auf Repo, Server, Netlify oder Logs | **Secret-Leak**: Schlüssel im Repository (öffentlich), in Logs, im Frontend, im Netlify-Dashboard, in der DB im Klartext (I) | Webhooks fälschen, Anrufe/SMS auf Kosten des Betreibers, Daten bei Anbietern lesen | m | `.env` nicht im Repo, gitleaks in CI, Build-Scan des Browser-Codes auf Schlüsselmuster und Kanarienwerte in der CI (`scripts/scan-build.sh`, Commit `33c0708`), Geheimnisse in der DB AES-256-GCM mit Schlüssel-ID, Oberfläche zeigt nur `••••1234`, Logs ohne Tokens; Rotation mit Schlüssel-ID und `APP_ENCRYPTION_KEYS_OLD` (Commit `fa49bd4`) | D, J | T-SEC-13, T-SEC-26 (offen: E-022 Repository privat) |
| BD-11 | Vollständige Datenbank | Angreifer mit Zugriff auf S3-Bucket oder Server | **Backup-Diebstahl** (I) | alle Daten aller Mandanten | n | Dumps mit age verschlüsselt, Bucket-Schlüssel nur für diesen Bucket, Object Lock empfohlen; privater age-Schlüssel getrennt im Tresor. **Rest-Risiko, offen (Entscheidung nötig):** privater Schlüssel liegt für den automatischen Wiederherstellungstest auch auf dem Server (`./secrets/backup-age.key`) – wer den Server übernimmt, hat beides | H | T-SEC-25 |
| BD-12 | Alle Mandanten, Plattform-Einstellungen | kompromittierter oder neugieriger Plattform-Admin | **Support-Zugriff missbrauchen**, Webhook-Geheimnisse/Twilio-Token in der Oberfläche ändern, Daten exportieren (E, R) | Vollzugriff, Umleitung von Webhooks | n | 2FA Pflicht, Re-Auth für Wechsel, Export, Löschung, Geheimnisse; Audit-Log im Kundenprotokoll; **offen:** Kundenbenachrichtigung beim Support-Zugriff (OP-12-02) | C | T-SEC-21, T-SEC-22 |
| BD-13 | Interne Netze, Anbieter-Zugangsdaten | Angreifer, der eine Aufnahme-URL setzt | **SSRF** über `recordingUrl` (Ereignis mit beliebiger URL) (I) | Abruf interner Dienste mit Twilio-Zugangsdaten | n | Host-Allowlist `RECORDING_HOSTS`, nur HTTPS, Auslieferung nur nach Berechtigungsprüfung; **behoben (Commit `0e0efc5`):** Weiterleitungen nur auf erlaubte Hosts, Zugangsdaten nur an Twilio (`fetchRecording` in `src/lib/voice/providers.ts`, Test `tests/recording-fetch.test.ts`) | F | T-SEC-10 |
| BD-14 | Sitzungen der Portal-Nutzer | Anrufer (Transkript), Kunde (FAQ-Text) | **XSS/HTML-Injektion** über Transkript, Zusammenfassung, Namen in Portal und E-Mails (T, I) | Sitzungsübernahme | n | React escaped Ausgaben, E-Mail-Vorlagen escapen (`xmlEscape`), CSP `default-src 'self'`, `frame-ancestors 'none'`; `unsafe-inline` akzeptiert | F, G | T-SEC-11, T-SEC-12, E-001 |
| BD-15 | Schreibende Aktionen im Portal | fremde Website | **CSRF** (T) | ungewollte Änderungen | n | SameSite=Lax, Origin-Prüfung in der Middleware für alle schreibenden `/api/*` außer Webhooks | G | T-SEC-28 |
| BD-16 | Löschversprechen gegenüber Anrufern | – (Fehlerfall) | **Daten bleiben beim Anbieter** nach Frist oder DSGVO-Löschung: hängende Anrufe, fehlende Anbieter-ID, SIP-Anbieter ohne Lösch-API (I) | Verstoß gegen Löschpflicht | m | Löschung zuerst beim Anbieter, dann lokal; Vapi-Löschung nutzt `VAPI_API_BASE` (Commit `0e0efc5`); Mandant erst nach Anbieter-Löschung löschbar; hängende Anrufe werden geschlossen; SIP-Anbieter „nicht freigegeben“; DSGVO-Löschung anonymisiert Anrufe und Nachrichten statt sie zu löschen, Monatssummen werden vor dem Löschen festgeschrieben (`BillingSnapshot`, `src/lib/services/billing-close.ts`, Commit `48e363a`) | H | T-SEC-15 |
| BD-17 | Erreichbarkeit des Betriebs (Notfälle) | Ausfall, Angreifer | **Ausfall des VPS** oder der App (D) | Notfälle gehen verloren | m | Ersatzziel als TwiML Bin bei Twilio (unabhängig vom Server), Überwachung prüft Twilio-Konfiguration, Lebenszeichen-Ping, Fallback bei KI-Fehler | E, J | T-SEC-31 (E-007) |
| BD-18 | Gesamte App | Angreifer über Abhängigkeiten | **Lieferkette**: bekannte Schwachstellen, kompromittiertes Paket, unsichere CI-Aktion (T, E) | Codeausführung | m | Lockfile, `npm audit --omit=dev` in CI (blockiert ab „high“, Produktionsabhängigkeiten ohne Befund seit Commit `859b8e0`: zod 4, Overrides für postcss/deepmerge-ts), Dependabot, Actions per Commit-SHA; Restfunde nur in Entwicklungswerkzeugen (vitest, tailwind) | J | E-003 |
| BD-19 | Gesundheits- und Inhaltsdaten | Mitleser bei E-Mail, SMS, Kalender | **Sensible Inhalte in Benachrichtigungen**: Zusammenfassung im Kalendereintrag und in der Techniker-E-Mail, Betreff mit Kategorie und Name (I) | Art.-9-Daten bei Dritten (Postfach, Kalender, SMS-Anbieter) | m | Kundenbestätigung enthält nur Kategorie/Adresse/Termin; Löschfrist leert auch `Message.subject` (Commit `0e0efc5`); **offen:** Zusammenfassung in Kalender/E-Mail kürzen oder optional machen (OP-18-05) | H | T-SEC-32 |
| BD-20 | Aufzeichnungsrecht (§ 201 StGB), Vertrauen | – (Fehlkonfiguration) | **Stille Aufzeichnung**: Aufzeichnung ohne Hinweis, weil Agent ohne Speicherung fehlt (T) | Strafbarkeit, Vertrauensverlust | n | Agent-Auswahl so, dass nie ohne Hinweis aufgezeichnet wird; eigener Agent je Nummer gilt als aufzeichnend; optional ausdrückliche Einwilligung (Variante C, Tool `recording_consent`); Standard bleibt offene Entscheidung E-010 | I | T-SEC-33 |

**Mindestanzahl:** 20 Bedrohungen (Stufe 3 verlangt ≥ 8).

## Projektwerte (aus security/standardwerte.md übernommen bzw. angepasst)

| Punkt | Wert | Abweichung vom Standard? Begründung |
|---|---|---|
| Zugriffs-Antwortstrategie | `401` nicht angemeldet · `404` fremder Mandant (Vorgang, Kunde, Anruf, Aufnahme, Mitarbeiter, Benutzer) · `403` Rolle reicht nicht, `403 MFA_SETUP_REQUIRED`, `403 REAUTH_REQUIRED` | – |
| Login | Eigenbau (kein Login-Anbieter), E-Mail + Passwort + TOTP | Regelwerk empfiehlt Anbieter; Eigenbau mit Standardwerten umgesetzt |
| Passwort-Hashing / Mindestlänge | scrypt N=2^17, r=8, p=1 · 12 Zeichen, max. 200, keine Kompositionsregeln, HIBP-Prüfung (fail-open) | Argon2id bevorzugt, braucht native Abhängigkeit; scrypt ist zulässige Alternative. 12 statt 15 ohne 2FA: für Mitarbeiter ohne 2FA strenger wäre 15 – bei Stufe 3 anheben |
| Reset-Link-Laufzeit | 30 min, einmalig, gehasht, danach alle Sitzungen beendet | – |
| Einladung | 7 Tage, einmalig, gehasht, erneutes Senden entwertet alte Links | – |
| Sitzungen | Plattform-Admin 30 min Inaktivität / 12 h absolut; Kundenkonten 14 Tage gleitend / 90 Tage; ausstehender 2. Faktor 10 min; Re-Auth-Fenster 15 min | Kundenkonten bei Stufe 3 deutlich zu lang (Standard Stufe 3: 30 min bis 12 h); Entscheidung nötig |
| 2FA | TOTP; Pflicht für Plattform-Admin (`REQUIRE_PLATFORM_ADMIN_2FA`), optional erzwingbar für Kunden-Admins (`REQUIRE_TENANT_ADMIN_2FA`), angeboten für Mitarbeiter | Stufe 3: für Kundenkonten „Pflicht oder dringend empfohlen“ → `REQUIRE_TENANT_ADMIN_2FA=true` empfohlen |
| Größenlimits | JSON 100 KB (`readJson`), Tool-Webhooks 256 KB, Ereignisse/Vapi 2 MB, Listen 100–200, Freitext per zod | – |
| Security-Header | CSP (`default-src 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, `base-uri 'self'`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; HSTS 1 Jahr über Caddy | HSTS 1 Jahr statt 2 Jahre (Caddyfile) – unkritisch; `unsafe-inline` = E-001 |
| Audit-Log | 730 Tage; Logins, Fehlversuche, 2FA, Passwort, Sitzungen, Support-Zugriff, Admin-Aktionen, DSGVO, Aufnahme abgespielt | länger als 30–90 Tage Standard für Sicherheitslogs, begründet als Audit-Log (Stufe 3 Pflicht) |
| Server-Log | JSON, Rufnummern maskiert, keine Passwörter/Tokens/Transkripte; Docker-Rotation 5 × 20 MB | keine feste Aufbewahrungsfrist (OP-20-15) |
| Backups | täglich, lokal 14 Tage, S3 30 Tage, age-verschlüsselt, Restore-Test monatlich | häufiger als Standard (vierteljährlich) |

## Rate Limits

Sicherheitsrelevante Zähler liegen seit 2026-10-24 gemeinsam in PostgreSQL (`RateLimitHit`, `hitShared`); Webhook- und API-Zähler im Prozessspeicher (E-002).

| Endpunkt | Pro Konto | Pro IP | Reaktion |
|---|---|---|---|
| `POST /api/auth/login` | 5 Fehlversuche → 15 min Pause (`lockedUntil`, keine Dauersperre) | 20 / 15 min | `429` + `Retry-After` |
| `POST /api/auth/forgot` | 3 E-Mails / h (still) | 10 / h | gleiche Antwort, kein Versand |
| `POST /api/auth/setup` | – | 5 / h | `429` |
| `POST /api/auth/2fa/verify` | 5 / Sitzung in 10 min, danach neu anmelden | 20 / 15 min | `429` |
| `POST /api/auth/reauth` | 5 / Nutzer in 15 min | – | `429` |
| `POST /api/admin/settings/test` | 30 / Nutzer in 10 min | – | `429` |
| Alle Routen mit `requireAuth` | 120 / Nutzer / min | – | `429` |
| `/api/voice/*` (Tools, Ereignisse, Vapi) | – | 600 / min | `429` + `Retry-After` |
| `POST /api/twilio/voice` (je Anrufer und Nummer) | 10 Anrufe / h je Anrufernummer; unterdrückte Nummern zusammen 30 / h je angerufener Nummer | – | Fallback statt KI |
| Kostenschutz Anrufe | Minutenlimit je Mandant, gleichzeitige Anrufe je Mandant (Standard 5) und gesamt (50), Tagesbudget, Höchstdauer 20 min | – | Fallback-Nummer bzw. Mailbox |
| `POST /api/tickets/[id]/notify` | 5 / Vorgang in 24 h (`LIMITS.notifyPerTicket`, gemeinsam in Postgres, Commit `0e0efc5`) | – | `429` mit Hinweis |
| SMS-Versand (alle Anlässe) | nur Zielländer aus `SMS_ALLOWED_PREFIXES` (Standard `+49,+43,+41`, Commit `0e0efc5`) | – | Nachricht mit Status `SKIPPED`, Log `sms.destination_blocked` |

## Schlüssel

**Wichtig:** Werte aus der Oberfläche (Verwaltung → Plattform, Tabelle `PlatformSetting`) **überlagern gleichnamige Umgebungsvariablen** (`setting()` in `src/lib/platform/config.ts`, `env()` in `src/lib/env.ts`). Ausgenommen sind `DATABASE_URL`, `NODE_ENV` und `APP_ENCRYPTION_KEY`, die nur aus der `.env` kommen. Wer eine Einstellung in der `.env` ändert, während in der Oberfläche ein Wert gesetzt ist, ändert nichts. Geheime Oberflächenwerte sind mit `APP_ENCRYPTION_KEY` verschlüsselt; Ändern erfordert Re-Auth.

Ort: **.env** = nur Server-Datei · **UI** = in der Oberfläche einstellbar (überlagert `.env`) · **CI/Netlify** = nur dort. Verantwortlich ist überall der Betreiber (Plattform-Admin); „Rotation“ = Vorschlag, letzte Rotation ist nirgends dokumentiert (OP-14-12).

| Name der Umgebungsvariable | Öffentlich / geheim | Wo gespeichert | Wer nutzt ihn | Rotation |
|---|---|---|---|---|
| `APP_ENCRYPTION_KEY` | geheim (kritisch) | .env + Tresor (getrennt vom Backup) | secret-box: TOTP, UI-Geheimnisse, Google-Refresh-Tokens | nur bei Verdacht; mit `APP_ENCRYPTION_KEYS_OLD` und Umschlüsselung (`/api/cron/rekey`, `docs/betrieb.md` → „Schlüsselwechsel“) |
| `APP_ENCRYPTION_KEYS_OLD` | geheim | .env (nur während Wechsel) | Entschlüsseln alter Werte | nach Umschlüsselung und Ablauf der Backups entfernen |
| `POSTGRES_PASSWORD` / `DATABASE_URL` | geheim | .env | App, Backup | jährlich oder bei Verdacht |
| `SETUP_TOKEN` | geheim | .env | Ersteinrichtung | nach Einrichtung entfernen |
| `CRON_SECRET` | geheim | .env (an `cron`/`backup`-Container) | `/api/cron/*` | jährlich |
| `VOICE_TOOL_SECRET_RETELL` / `_VAPI` / `_ELEVENLABS` / `_SIP` | geheim | .env oder UI | Tool- und Ereignis-Webhooks je Anbieter | jährlich, bei Verdacht sofort; kein Parallelbetrieb zweier Werte → kurzer Ausfall beim Wechsel |
| `VOICE_TOOL_SECRET` | geheim | .env oder UI | Übergang, gilt nur ohne Anbieter-Geheimnis | entfernen |
| `TWILIO_ACCOUNT_SID` | öffentlich (Kennung) | .env oder UI | Twilio-API | – |
| `TWILIO_AUTH_TOKEN` | geheim | .env oder UI | Twilio-API, Signaturprüfung | jährlich (Twilio Secondary Token) |
| `TWILIO_SMS_FROM` | öffentlich | .env oder UI | SMS-Absender | – |
| `RETELL_API_KEY` | geheim | .env oder UI | Retell-API, Retell-Signaturprüfung | jährlich |
| `RETELL_AGENT_ID`, `RETELL_AGENT_ID_NO_STORAGE`, `RETELL_SIP_DOMAIN` | öffentlich | .env oder UI | Übergabe an Retell | – |
| `VAPI_API_KEY` | geheim | .env oder UI | Vapi-API (Löschung, Nummern) | jährlich |
| `VAPI_ASSISTANT_ID`, `VAPI_SIP_HOST`, `VAPI_API_BASE` | öffentlich | .env bzw. UI | Übergabe an Vapi | – |
| `ELEVENLABS_API_KEY` | geheim | .env oder UI | ElevenLabs-API | jährlich |
| `ELEVENLABS_WEBHOOK_SECRET` | geheim | .env oder UI | Signatur Post-Call-Webhook | jährlich |
| `ELEVENLABS_AGENT_ID`, `ELEVENLABS_API_BASE` | öffentlich | .env oder UI | Übergabe an ElevenLabs | – |
| `SIP_<ID>_URI` | öffentlich | UI | SIP-Anbieter | – |
| `SIP_<ID>_API_KEY` | geheim | UI | SIP-Anbieter (vorbereitet) | jährlich |
| `MS_CLIENT_ID` | öffentlich | .env oder UI | Microsoft Graph | – |
| `MS_CLIENT_SECRET` | geheim | .env oder UI | Microsoft Graph (App-Berechtigung auf Kunden-Tenants) | vor Ablauf (max. Laufzeit in Entra) |
| `GOOGLE_CLIENT_ID` | öffentlich | .env oder UI | Google OAuth | – |
| `GOOGLE_CLIENT_SECRET` | geheim | .env oder UI | Google OAuth | jährlich |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_FROM` | öffentlich | .env oder UI | E-Mail-Versand | – |
| `SMTP_PASS` | geheim | .env oder UI | E-Mail-Versand | jährlich |
| `ALERT_WEBHOOK_URL`, `HEALTHCHECK_PING_URL` | geheim (URL ist Zugang) | UI oder .env | Alarme, Lebenszeichen | bei Verdacht |
| `ALERT_EMAIL`, `ALERT_SMS` | öffentlich (personenbezogen) | UI oder .env | Alarme | – |
| `BACKUP_AGE_RECIPIENT` | öffentlich | .env | Verschlüsselung der Backups | mit Schlüsselpaar |
| privater age-Schlüssel `secrets/backup-age.key` | geheim (kritisch) | Datei auf dem Server (600) + Tresor | Restore-Test, Wiederherstellung | alten Schlüssel aufheben, bis Backups abgelaufen |
| `BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY` | geheim | .env | Upload in den Bucket | jährlich; Rechte nur auf den Bucket |
| `BACKUP_S3_ENDPOINT`, `_REGION`, `_BUCKET` | öffentlich | .env | Backup | – |
| `DOMAIN`, `ACME_EMAIL`, `PUBLIC_BASE_URL` | öffentlich | .env | Caddy, Links, Twilio-Signatur-URL | – |
| `TWILIO_VALIDATE_SIGNATURE`, `REQUIRE_PLATFORM_ADMIN_2FA`, `REQUIRE_TENANT_ADMIN_2FA`, `COOKIE_SECURE`, `PWNED_CHECK`, `RECORDING_HOSTS` | öffentlich (Sicherheitsschalter) | nur .env | Schutzfunktionen | nicht in Produktion abschwächen |
| `AI_KILL_SWITCH`, `MAX_CALL_MINUTES`, `MAX_CONCURRENT_CALLS_*`, `PLATFORM_DAILY_MINUTE_LIMIT`, `SMS_ALLOWED_PREFIXES` | öffentlich (Kostenschutz) | UI oder .env | Kostenschutz, SMS-Zielländer | – |
| `BUILD_CANARY` | öffentlich (erfundener Kanarienwert) | nur CI | Build-Scan `scripts/scan-build.sh` | – |
| `DEMO_SEED` | öffentlich | nur Testumgebung | Test-Kunde | in Produktion nie `true` |
| Netlify-Variablen (`APP_ENCRYPTION_KEY`, `SETUP_TOKEN`, `CRON_SECRET`) | geheim | Netlify-Dashboard | Testumgebung | eigene Werte, nie die der Produktion |

## Festlegungen A–K

**A Passwörter & Login.** scrypt, 12–200 Zeichen, HIBP-Prüfung, gleiche Antwort und Antwortzeit bei unbekannter E-Mail (`DUMMY_HASH`), vorübergehende Sperre statt Dauersperre. Ersteinrichtung nur mit `SETUP_TOKEN` und nur ohne bestehenden Plattform-Admin. 2FA siehe Projektwerte.

**B Sitzungen.** Zufällige 256-Bit-Tokens, in der DB nur SHA-256, neue ID nach Login und 2. Faktor, Inaktivitäts- und Absolutgrenze je Rolle, „alle Sitzungen beenden“, Sperren beendet Sitzungen, Reset beendet alle Sitzungen.

**C Zugriffskontrolle.** Matrix in `12-berechtigungen.md`. Mandant aus Sitzung, `404` für fremde Daten, Rollenprüfung je Route, Re-Auth für sensible Aktionen, Plattform-Admin nur nach Wechsel im Mandanten, Audit-Log. Keine RLS (E-004).

**D Secrets.** Tabelle oben. Keine Geheimnisse im Frontend (alle Anbieteraufrufe serverseitig; Build-Scan mit Kanarienwerten in der CI, Commit `33c0708`), gitleaks in CI, Geheimnisse in der DB verschlüsselt, maskierte Anzeige. Offen: Rotationsdatum je Schlüssel festhalten, Repository privat stellen (OP-13-02).

**E Missbrauchsschutz.** Rate-Limits und Kostenschutz oben, Alarm bei nicht zugestellten Notfall-Alarmen, Kontingent-Warnungen. Behoben in Commit `0e0efc5`: SMS nur in freigegebene Länder, Limit 5 je Vorgang/24 h für „Benachrichtigung erneut senden“. Offen: `transfer_call` beim Anbieter auf feste Ziele (BD-03), Budget-Grenzen in den Anbieter-Konten (nicht prüfbar, OP-15-08).

**F Eingaben & Ausgaben.** zod für alle Eingaben inklusive KI-Argumenten (unbekannte Enum-Werte → `undefined`), Prisma (keine SQL-Strings), React-Escaping, `xmlEscape` in E-Mails und TwiML, Allowlist für Aufnahme-Hosts, auch für Weiterleitungen (Commit `0e0efc5`).

**G Transport & Browser.** HTTPS über Caddy mit HSTS, Cookies Secure/HttpOnly/SameSite=Lax, CSP mit Nonce für Skripte, `unsafe-inline` nur für Styles (E-001), kein CORS, Origin-Prüfung gegen CSRF.

**H Daten.** Klassifizierung und Fristen in `11-daten.md`. Löschung zuerst beim Anbieter. Geheime Felder verschlüsselt (TOTP, Refresh-Token, UI-Schlüssel). Inhaltsdaten (Transkripte) sind **nicht** feldverschlüsselt – bei Stufe 3 prüfen. Backups verschlüsselt.

**I Webhooks & KI-Funktionen.** Signaturen und Geheimnisse je Absender, Zeitfenster gegen Replay (Retell, ElevenLabs), Idempotenz (ein Vorgang je Anruf, `upsert` auf CallSid). KI: Argumente sind Daten, keine Befehle; Mandant und Anrufernummer nie aus Argumenten; der KI nur Daten zur verifizierten Nummer; Kostenlimits; Anrufer werden über KI und Aufzeichnung informiert. **Frühere Lücken, behoben in Commit `0e0efc5`:** (1) Retell-Signatur ohne Zeitstempel wird abgelehnt (`src/lib/security.ts`); (2) bei Retell/Vapi ohne eigene Anrufzeile gilt die Anrufernummer aus dem Body als unverifiziert – keine Kundendaten, keine Terminänderungen (`src/lib/voice/context.ts`).

**J Lieferkette, Logging, Fehler.** Lockfile, CI mit `npm audit --omit=dev --audit-level=high` (seit `859b8e0`), Build-Scan (`33c0708`), gitleaks, Actions per SHA, Dependabot (Sicherheitsupdates im Repository aus, OP-14-10), Migrationen beim Start (`prisma migrate deploy`). Fehlermeldungen allgemein, Details im Log. Alarme per E-Mail/SMS/Webhook. Keine SBOM (Stufe 3: erzeugen).

**K Verifikation.** ASVS-Abgleich unten, Tests in `19-tests.md`, Launch-Checkliste `23-launch.md`, Testanruf-Protokoll `docs/testanrufe.md`. Zweitprüfung und externe Prüfung siehe unten (offene Entscheidung E-021).

## OWASP ASVS Level 1 – Abgleich

Grundlage: Kapitelstruktur von ASVS 4.0.3 (V1–V14), auf Ebene der Level-1-Anforderungsgruppen. Abgleich mit ASVS 5.0 offen `[PRÜFEN]`. „erfüllt“ heißt: im Code vorhanden; ob ein Test es belegt, steht in der letzten Spalte.

| Bereich | Anforderung (Kurzform) | Stand | Nachweis / Lücke |
|---|---|---|---|
| V1 Architektur | Vertrauensgrenzen und Datenflüsse dokumentiert | erfüllt | `13-architektur.md`, `11-daten.md` |
| V2.1 Passwörter | Länge ≥ 12, lange Passwörter, keine Kompositionsregeln, Leak-Prüfung | erfüllt | `src/lib/auth/crypto.ts`, `tests/pwned.test.ts` |
| V2.2 Anti-Automatisierung | Brute-Force-Schutz ohne Dauersperre | erfüllt | `tests/rate-limit.test.ts`, Integrationstest „zählt sicherheitsrelevante Limits gemeinsam in der Datenbank“; HTTP-Test des Login-Limits offen |
| V2.4 Speicherung | Passwort-Hash mit Salt (scrypt) | erfüllt | `src/lib/auth/crypto.ts` |
| V2.5 Wiederherstellung | Reset-Token zufällig, einmalig, kurz, keine Enumeration | erfüllt, getestet | per HTTP: Login ohne Enumeration (T-SEC-HTTP-09), Reset-Link einmalig/befristet, beendet alle Sitzungen (T-SEC-HTTP-12), „Passwort vergessen“ ohne Enumeration (T-SEC-HTTP-13) – Commit `33c0708` |
| V2.7/2.8 Zweiter Faktor | TOTP, kein Wiederverwenden, Wiederherstellungscodes | erfüllt | `tests/totp.test.ts` |
| V3 Sitzungen | neue ID nach Login, Timeouts, Logout, Cookie-Attribute, Re-Auth | erfüllt, teilweise getestet | `src/lib/auth/session.ts`; Re-Auth per HTTP (T-SEC-HTTP-06); Timeouts und Cookie-Attribute ungetestet |
| V4.1 Zugriffskontrolle | serverseitig, deny by default | erfüllt | `requireTenant`/`requirePlatformAdmin` je Route |
| V4.2 Objektzugriff (IDOR) | fremde IDs abgewiesen | erfüllt, teilweise belegt | Integrationstest „Mandantentrennung“; HTTP: Vorgang lesen (T-SEC-HTTP-02), Vorgang/Kunde ändern und Kunde löschen (T-SEC-HTTP-10); Lesen von Kunde, Anruf, Aufnahme per HTTP offen |
| V4.3 Admin | Admin-Oberfläche mit 2FA | erfüllt | `mfaRequiredFor` |
| V4 (frühere Lücke) | Kollegen-Reset/Einladung nur mit Re-Auth | behoben | `src/app/api/users/[id]/route.ts` (Commit `0e0efc5`), T-SEC-HTTP-14 (Commit `33c0708`) |
| V5.1 Eingabevalidierung | Allowlist-Validierung | erfüllt | zod in allen Routen und Tools |
| V5.2 Sanitizing / SSRF | SSRF-Schutz für ausgehende URLs | erfüllt | Allowlist getestet; Weiterleitungen nur auf erlaubte Hosts (`fetchRecording`, Commit `0e0efc5`; `tests/recording-fetch.test.ts`) |
| V5.3 Ausgabe-Encoding, Injection | Escaping, parametrisierte Abfragen | erfüllt, getestet | React, `xmlEscape`, Prisma; T-SEC-11: E-Mail-Maskierung (`tests/emails.test.ts`), HTML-Eingaben nur als Text + Längenlimit (T-SEC-HTTP-19) |
| V6 Kryptografie | bewährte Verfahren, Schlüsselverwaltung | erfüllt / teilweise | AES-256-GCM (`tests/totp.test.ts`, `tests/secret-box.test.ts`), Rotation mit Schlüssel-ID |
| V7 Fehler & Protokoll | keine sensiblen Daten in Logs, Sicherheitsereignisse protokolliert | erfüllt | Audit-Log (2 Jahre), Alarm bei gehäuften Fehlanmeldungen; Server-Logs aller Dienste rotiert (5 × 20 MB, `docker-compose.yml`), Rufnummern maskiert |
| V8 Datenschutz | sensible Daten nicht gecacht, Löschung | erfüllt | API-Antworten `Cache-Control: no-store` (`next.config.ts`, T-SEC-HTTP-19), Aufnahmen `no-store`; Löschfristen und Anbieter-Löschung (`retention.ts`) |
| V9 Kommunikation | TLS überall, HSTS | erfüllt | Caddy; ausgehend nur HTTPS |
| V10 Schadcode / Abhängigkeiten | aktuelle Komponenten | erfüllt (Produktion) | `npm audit --omit=dev` ohne Befund, CI bricht ab „high“ ab (Commit `859b8e0`); Restfunde nur in Entwicklungswerkzeugen (E-003) |
| V11 Geschäftslogik | Missbrauch von Abläufen begrenzt | teilweise | Kostenschutz getestet; SMS-Zielländer und Limit je Vorgang (Commit `0e0efc5`); `transfer_call` beim Anbieter offen (BD-03) |
| V12 Dateien | Uploads | entfällt | keine Uploads; Aufnahmen nur durchgereicht |
| V13 API / Webhooks | Authentifizierung, Größenlimits, Methoden | erfüllt | Signaturtests; Retell-Altformat ohne Zeitstempel wird abgelehnt (Commit `0e0efc5`, `tests/security.test.ts`) |
| V14.1 Build | keine Geheimnisse im Repo/Build | erfüllt | gitleaks in CI; Build-Scan `scripts/scan-build.sh` mit Kanarienwerten in der CI (Commit `33c0708`) |
| V14.4 Header | CSP, nosniff, Frame-Schutz, HSTS | weitgehend | Skripte nur mit Nonce, `unsafe-inline` nur für Styles (E-001); Header per HTTP getestet (T-SEC-HTTP-08); HSTS kommt von Caddy und ist dort nicht getestet |
| V14.5 Herkunft | Origin-Prüfung, kein CORS | erfüllt | `src/middleware.ts`; per HTTP getestet (T-SEC-HTTP-04) |

**Ehrliches Fazit:** Level 1 ist im Code weitgehend umgesetzt. Seit Commit `7404f55` gibt es HTTP-Tests gegen den echten Build (`tests/e2e/http.test.ts`, in der CI über `scripts/e2e.sh`), seit `33c0708` auch für fremde Datensätze ändern/löschen, Rollen im Body, Reset-Links und Kollegen-Reset (T-SEC-HTTP-10…14); sie decken aber weiterhin nur je einen Vertreter pro Regel ab. Level 2 (nötig bei Stufe 3) ist **nicht** abgeglichen.

## Bewusst akzeptierte Risiken

Die Einträge stehen mit Begründung in `docs/sicherheit.md` und werden nach `ENTSCHEIDUNGEN.md` übernommen (Agent A).

| ID | Bezug | Risiko | Warum akzeptiert | Neu bewerten bis |
|---|---|---|---|---|
| E-001 | BD-14 | CSP `unsafe-inline` nur noch für Styles (Skripte mit Nonce seit 2026-10-24) | style-Attribute der Diagramme, kein Nutzer-HTML | bei Bedarf |
| E-002 | BD-04, BD-05 | Webhook- und API-Zähler im Prozessspeicher | eine Instanz auf dem VPS; Sicherheitslimits sind in Postgres | bei Skalierung |
| E-003 | BD-18 | `npm audit`-Befunde nur noch in Entwicklungswerkzeugen (vitest, tailwind); Produktion ohne Befund seit `859b8e0` | laufen nicht in Produktion | 2026-11-15 |
| E-004 | BD-07 | keine Postgres-RLS | Trennung im Code + Integrationstest | vor 10 Kunden |

**Nicht akzeptiert, sondern offen** (brauchen Aufgabe in `21-roadmap.md`): BD-03 `transfer_call` beim Anbieter auf feste Ziele (Anbieter-Konfiguration), BD-06 Adresse vorlesen, BD-11 Schlüssel auf dem Server (Entscheidung nötig: akzeptieren oder Restore-Test auf getrennter Maschine), BD-19 Inhalte in Kalender/E-Mail (T-SEC-32), `CallTicket.summary`/`notes` ohne automatische Frist (Entscheidung nötig, `11-daten.md`).

**Seit dem ersten Stand behoben:** BD-03 SMS-Zielländer und Limit je Vorgang, BD-09 Kollegen-Reset, BD-13 Weiterleitungen, Retell-Altsignatur, Retell/Vapi-Rückgriff ohne eigene Anrufzeile (alle Commit `0e0efc5`); BD-18 Produktionsabhängigkeiten (`859b8e0`); Build-Scan T-SEC-13 (`33c0708`).

## Pflicht-Sicherheitstests (für Phase 19)

„vorhanden“ = automatischer Test im Repository (Name in `19-tests.md`), „offen“ = noch zu schreiben bzw. manuell durchzuführen.

| Test | Sichert ab | Erwartung |
|---|---|---|
| T-SEC-01 | BD-07 | fremder Datensatz per ID → `404`, keine Daten (Service: vorhanden; HTTP: Vorgang lesen vorhanden, Kunde/Anruf/Aufnahme lesen offen) |
| T-SEC-02 | BD-07 | fremden Datensatz ändern/löschen → `404`, unverändert (vorhanden für Vorgang und Kunde: T-SEC-HTTP-10; Benutzer offen) |
| T-SEC-03 | BD-09 | `role`, `tenantId`, fremde `employeeId` im Body/Argument werden ignoriert (KI-Argumente: vorhanden; HTTP: vorhanden, T-SEC-HTTP-11) |
| T-SEC-04 | BD-07 | Listen und Exporte enthalten nur den eigenen Mandanten (Export und Startseite: vorhanden; weitere Listen: offen) |
| T-SEC-05 | BD-08 | Login-Limit je Konto und IP, gemeinsam für alle Instanzen (vorhanden) |
| T-SEC-06 | BD-08 | Reset-Token zweimal bzw. nach Ablauf → abgelehnt, Sitzungen beendet (vorhanden, T-SEC-HTTP-12) |
| T-SEC-07 | BD-03, BD-04 | gleichzeitige Anrufe, Notschalter, Tagesbudget, Höchstdauer, Kontingent (vorhanden) |
| T-SEC-08 | BD-07, BD-08 | geschützte Endpunkte ohne Anmeldung → `401` (vorhanden, Stichprobe) |
| T-SEC-09 | BD-08 | Reset/Login mit bekannter vs. unbekannter E-Mail → gleiche Antwort (vorhanden: T-SEC-HTTP-09, T-SEC-HTTP-13) |
| T-SEC-10 | BD-13, BD-07 | Aufnahme nur nach Berechtigung, nur erlaubte HTTPS-Hosts, auch nach Weiterleitung (Allowlist und Weiterleitung: vorhanden, `tests/recording-fetch.test.ts`; fremder Mandant HTTP: offen) |
| T-SEC-11 | BD-14 | `<script>`, sehr lange Strings, SQL-Fragmente in Transkript/Notiz/Name → escaped bzw. abgelehnt (offen) |
| T-SEC-12 | BD-14 | Security-Header (vorhanden für `/login`) |
| T-SEC-13 | BD-10 | keine Geheimnisse im Repository/Build (gitleaks in CI: vorhanden; Build-Scan `scripts/scan-build.sh` in CI: vorhanden, Commit `33c0708`) |
| T-SEC-14 | BD-09 | Mitarbeiter auf Admin-Endpunkten → `403` (vorhanden, Stichprobe) |
| T-SEC-15 | BD-16 | Kunde/Mandant löschen → danach keine Daten, Anbieter-Löschung zuerst (Mandant: vorhanden; Kunde: Anonymisierung und Monatsabschluss vorhanden (Integration, Commit `48e363a`), HTTP-Ablauf mit Anbieter-Löschung offen) |
| T-SEC-16 | BD-09 | Paketfunktion per Client-Parameter freischalten → keine Freischaltung (vorhanden) |
| T-SEC-17 | BD-01, BD-02 | Telefon-KI liefert keine Kundendaten/Termine zu genannter Nummer oder Vorgangsnummer (vorhanden) |
| T-SEC-18 | BD-05 | Funktionen nur für laufende, selbst angelegte Anrufe; Format passt zum Anbieter (vorhanden für ElevenLabs/SIP und für den Retell/Vapi-Rückgriff ohne eigene Anrufzeile) |
| T-SEC-19 | BD-05 | Twilio-/Retell-/ElevenLabs-Signatur, Retell-Altformat ohne Zeitstempel abgelehnt, Geheimnis je Anbieter, Abschalten nur außerhalb Produktion, Webhooks/Cron ohne Ausweis abgelehnt (vorhanden) |
| T-SEC-20 | BD-01 | fremde Mitarbeiter-ID und alte Enum-Werte aus KI-Argumenten werden ignoriert bzw. umgesetzt (vorhanden) |
| T-SEC-21 | BD-12 | sensible Aktion mit alter Bestätigung → `403 REAUTH_REQUIRED` (vorhanden für Zugangslink des Plattform-Admins und Kollegen-Reset; Mandantenwechsel, Export, DSGVO-Löschung, Rollen offen) |
| T-SEC-22 | BD-08, BD-12 | Pflicht-2FA nicht eingerichtet → `403 MFA_SETUP_REQUIRED`; TOTP-Wiederverwendung abgelehnt (vorhanden) |
| T-SEC-23 | BD-01 | Testanruf Prompt-Injection (Szenario 13 in `docs/testanrufe.md`) bleibt in der Rolle, keine Daten (offen, manuell) |
| T-SEC-24 | BD-03 | Bestätigungs-SMS nur an erlaubte Länder (vorhanden, Integrationstest, Commit `0e0efc5`); keine Durchstellung an vom Anrufer genannte Nummern (offen, Anbieter-Konfiguration `transfer_call`) |
| T-SEC-25 | BD-11 | Backup ist verschlüsselt, liegt extern, Restore gelingt; Alarm bei fehlendem Backup (Alarm: vorhanden; Restore-Nachweis mit Datum: offen) |
| T-SEC-26 | BD-10 | Geheimnisse verschlüsselt, als geheim markiert, nach Schlüsselwechsel umgeschlüsselt (vorhanden) |
| T-SEC-28 | BD-15 | schreibende Anfrage mit fremdem `Origin` → `403` (vorhanden) |
| T-SEC-29 | BD-09 | Reset-/Einladungslink für Kollegen nur mit Re-Auth, Link nicht angezeigt (vorhanden, T-SEC-HTTP-14; Lücke behoben in `0e0efc5`) |
| T-SEC-30 | BD-06 | Testanruf mit gefälschter/bekannter Nummer: KI liest Adresse nicht vor (offen, manuell) |
| T-SEC-31 | BD-17 | Ersatzziel bei Twilio unabhängig vom Server, Überwachung erkennt fehlendes Ersatzziel (vorhanden; Testanruf Szenario 18: offen) |
| T-SEC-32 | BD-19 | Benachrichtigungen und Kalendereinträge enthalten keine Freitext-Zusammenfassung, wenn so eingestellt (offen) |
| T-SEC-33 | BD-20 | nie Aufzeichnung ohne Hinweis; bei Variante C ohne Zustimmung Löschung der Aufnahme (vorhanden) |

## Zweitprüfung

Bericht: noch nicht erstellt. Bei Stufe 3 Pflicht, bei Stufe 2 empfohlen. Vorschlag: separater Agent mit `templates/pruefauftrag-zweitpruefung.md`, Dateien `11-daten.md`, `12-berechtigungen.md`, `13-architektur.md`, `14-sicherheit.md` und Zugriff auf den Code; Ablage unter `pruefungen/zweitpruefung-14-<datum>.md`.

## Externe Fachprüfung (nur Stufe 3)

Geplant: noch nicht. Empfehlung vor dem ersten zahlenden Kunden: Penetrationstest bzw. Code-Review durch eine Fachperson mit Schwerpunkt Telefon-KI-Schnittstellen (`/api/voice/*`), Mandantentrennung und Eigenbau-Auth; Bericht nach `pruefungen/externe-pruefung-<datum>.md`. Alternative: bewusst akzeptiertes Risiko mit Stichwort „extern“ in `ENTSCHEIDUNGEN.md`. Das Prüfskript (`--launch`) stuft ein Stufe-3-Projekt ohne eines von beidem als „Nicht freigabefähig“ ein. Eine zweite KI ersetzt diese Prüfung nicht. Die Entscheidung dazu steht als offen in E-021.
