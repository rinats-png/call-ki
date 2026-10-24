# Sicherheit – Projektwerte für das Coding-Tool

> Phase 14, Stand 2026-10-24 (Code `5279652`). **Maßgeblich** sind `docs/sicherheit.md` (festgelegte Werte, E-001…E-004) und `docs/idea-to-app/14-sicherheit.md` (Bedrohungsmodell, vollständige Schlüsseltabelle, ASVS-Abgleich, Testzuordnung). Diese Datei bündelt die Werte, auf die die Regeln in `AGENTS.md` Abschnitt 5 verweisen. Ändert sich ein Wert, zuerst die beiden Quellen anpassen, dann hier.
> Risikostufe 2, Tendenz 3 (E-017). Keine Sicherheitsgarantie.

## Zugriffs-Antwortstrategie (Regel 2.4)

| Fall | Antwort |
|---|---|
| Nicht angemeldet | `401` (Seiten: Weiterleitung zum Login) |
| Datensatz eines anderen Mandanten (Vorgang, Kunde, Anruf, Aufnahme, Mitarbeiter, Benutzer) | `404` – identisch zu „nicht vorhanden“, keine Inhalte oder Metadaten |
| Rolle reicht nicht (Mitarbeiter → Einstellungen/Zugänge, Kunde → Verwaltung) | `403` ohne Inhalte |
| Pflicht-2FA nicht eingerichtet | `403` mit `code: MFA_SETUP_REQUIRED` |
| Sensible Aktion ohne frische Bestätigung | `403` mit `code: REAUTH_REQUIRED` |
| Telefon-KI ohne gültigen Ausweis (Anbieter-Geheimnis, Retell-Signatur) / Twilio ohne Signatur / Cron ohne `CRON_SECRET` | `401` bzw. `403` |

Umsetzung: `src/lib/auth/session.ts` (`requireAuth`, `requireTenant`, `requireTenant({ adminOnly: true })`, `requirePlatformAdmin`, `requireRecentAuth`), `src/middleware.ts` (CSRF über Origin). Jede Abfrage enthält `tenantId` aus der Sitzung bzw. aus der eigenen Anrufzeile – nie aus Body, Query oder KI-Argumenten. Berechtigungsmatrix: `docs/idea-to-app/12-berechtigungen.md`. Nachweise: `tests/integration/tenancy.test.ts`, `tests/e2e/http.test.ts` (T-SEC-HTTP-01…16).

## Login, Passwörter, Tokens (Regeln 3.1–3.5)

| Punkt | Wert |
|---|---|
| Login | Eigenbau (E-018): E-Mail + Passwort + TOTP, `src/lib/auth/*`; keine öffentliche Registrierung (Einladung bzw. Ersteinrichtung mit `SETUP_TOKEN`) |
| Hashing | scrypt N=2^17, r=8, p=1, 64 Byte (`src/lib/auth/crypto.ts`) |
| Länge | mindestens 12, höchstens 200 Zeichen, alle Zeichen, Einfügen erlaubt, keine Kompositionsregeln, kein Zwangswechsel |
| Leak-Prüfung | HIBP-Range-API (k-Anonymität), fail-open (`src/lib/auth/pwned.ts`, Schalter `PWNED_CHECK`) |
| Enumeration | gleiche Antwort und Antwortzeit (Dummy-Hash) bei Login, „Passwort vergessen“ |
| Passwort-Reset | 256 Bit, SHA-256 gespeichert, 30 min, einmalig, danach alle Sitzungen beendet |
| Einladung | 256 Bit, SHA-256, 7 Tage, einmalig, erneutes Senden entwertet alte Links |
| Links für Kollegen | Einladungs-/Reset-Link für andere Nutzer nur nach Re-Auth, Link nicht im Klartext außer ohne SMTP |
| TOTP-Secret | 160 Bit, AES-256-GCM mit `APP_ENCRYPTION_KEY`, Zeitschritt nicht wiederverwendbar |
| Wiederherstellungscodes | 10 × ~40 Bit, SHA-256, je einmal |

## Sitzungen und 2FA (Regeln 3.6, 3.7)

Cookie `ck_session`: HttpOnly, Secure (Produktion, `COOKIE_SECURE`), SameSite=Lax; 256-Bit-Token, in der DB nur SHA-256; neue ID nach Login und nach dem 2. Faktor; Logout beendet die Sitzung serverseitig (T-SEC-HTTP-16).

| Rolle | Inaktivität | Absolut | Re-Auth-Fenster | 2FA |
|---|---|---|---|---|
| Plattform-Admin | 30 min | 12 h | 15 min (Support-Zugriff, Zugangslinks, Schlüssel ändern) | **Pflicht** (`REQUIRE_PLATFORM_ADMIN_2FA=true`) |
| Kunden-Admin | 14 Tage gleitend | 90 Tage | 15 min (DSGVO-Löschung/-Auskunft, Rollen, Sperren, 2FA, Passwort) | angeboten; Pflicht per `REQUIRE_TENANT_ADMIN_2FA=true` (bei Stufe 3 empfohlen) |
| Mitarbeiter | 14 Tage gleitend | 90 Tage | 15 min | angeboten |
| 2. Faktor ausstehend | 10 min | – | – | – |

## Rate-Limits (Regeln 4.1–4.3, 4.5)

Umsetzung `src/lib/rate-limit.ts`. Sicherheitsrelevante Zähler gemeinsam in PostgreSQL (`RateLimitHit`, Schlüssel gehasht, E-012); Webhook- und API-Zähler im Prozessspeicher (E-002). Überschreitung → `429` + `Retry-After`, sofern nicht anders angegeben. Keine Dauersperre.

| Endpunkt | Pro Konto / Nutzer | Pro IP | Reaktion |
|---|---|---|---|
| `POST /api/auth/login` | 5 Fehlversuche → 15 min Pause | 20 / 15 min | 429 |
| `POST /api/auth/forgot` | 3 E-Mails / h (still) | 10 / h | gleiche Antwort ohne Versand bzw. 429 |
| `POST /api/auth/setup` | – | 5 / h | 429 |
| `POST /api/auth/2fa/verify` | 5 / Sitzung in 10 min, danach neu anmelden | 20 / 15 min | 429 |
| `POST /api/auth/reauth` | 5 / Nutzer in 15 min | – | 429 |
| `POST /api/admin/settings/test` | 30 / Nutzer in 10 min | – | 429 |
| alle Routen mit `requireAuth` | 120 / Nutzer / min | – | 429 |
| `/api/voice/*` (Tools, Ereignisse, Vapi) | – | 600 / min | 429 |
| `POST /api/twilio/voice` | 10 Anrufe / h je Anrufernummer; unterdrückte Nummern zusammen 30 / h je angerufener Nummer | – | Fallback statt KI |
| Kostenschutz Anrufe | Minutenlimit je Mandant, 5 gleichzeitige Anrufe je Mandant, 50 gesamt, Höchstdauer 20 min, Tagesbudget der Plattform (Standard aus), Notschalter `AI_KILL_SWITCH` | – | Fallback-Nummer bzw. Mailbox |
| `POST /api/tickets/[id]/notify` | 5 / Vorgang in 24 h | – | 429 |
| SMS-Versand (alle Anlässe) | nur Zielländer aus `SMS_ALLOWED_PREFIXES` (Standard +49, +43, +41) | – | Status `SKIPPED` |
| Kontingent | Warnung bei 80 % / 100 %, Betreiber-Alarm ab 200 % bei Kunden ohne Grenze | – | E-Mail/Alarm |
| Fehlanmeldungen gehäuft | Überwachung zählt `auth.login_failed`, `auth.locked`, `auth.mfa_failed` je Stunde | – | Betreiber-Alarm (Commit `0098ab2`) |

Offen: Budget-Grenzen in den Anbieter-Konten (TASK-024), `transfer_call` beim Anbieter auf feste Ziele (TASK-065).

## Größenlimits (Regel 4.4)

JSON-Anfragen 100 KB (`readJson` in `src/lib/http.ts`), Tool-Webhooks 256 KB, Gesprächs-Ereignisse/Vapi 2 MB, Listen höchstens 100–200 Einträge, Freitextfelder per zod begrenzt. Keine Datei-Uploads durch Nutzer; Aufnahmen werden nur über `/api/calls/[id]/recording` nach Berechtigungsprüfung durchgereicht (SSRF-Allowlist `RECORDING_HOSTS`, auch für Weiterleitungen; Twilio-Zugangsdaten nur an Twilio).

## Security-Header, Transport (Regeln 6.1–6.3)

`next.config.ts`: CSP `default-src 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, `base-uri 'self'` (mit `'unsafe-inline'` für Skripte/Styles = E-001), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. HTTPS und HSTS (1 Jahr) über Caddy (`deploy/Caddyfile`). Kein CORS (nur gleiche Herkunft), CSRF über Origin-Prüfung (`src/middleware.ts`). Nachweis: T-SEC-HTTP-04, T-SEC-HTTP-08.

## Webhooks und Telefon-KI (Regeln 8.2, 8.4)

Twilio-Signatur (`X-Twilio-Signature`, in Produktion nicht abschaltbar, E-013); ein Tool-Geheimnis je Sprach-KI-Anbieter (E-005), Retell-Signatur nur mit Zeitstempel ≤ 5 min; Tool-Aufrufe nur für laufende Anrufe (≤ 3 h, ≤ 2 min nach Ende); Kundendaten nur zur verifizierten Anrufernummer (E-009); Idempotenz über CallSid. Details: `docs/sicherheit.md` → „Sprach-KI-Schnittstellen“, `docs/idea-to-app/14-sicherheit.md` → Festlegung I.

## Protokollierung (Regeln 2.10, 7.2, 9.4)

Audit-Log (`AuditLog`, 730 Tage): Logins und Fehlversuche, 2FA, Passwort, Sitzungen, Support-Zugriffe, Admin-Aktionen, DSGVO-Auskunft/-Löschung, Abspielen von Aufnahmen. Server-Log (`src/lib/logger.ts`): JSON, Rufnummern maskiert, keine Passwörter, Tokens, Transkripte oder Nachrichtentexte.

## Schlüsselliste (nur Namen – NIE Werte)

Werte stehen ausschließlich in der `.env` auf dem Server (Rechte 600), in der Oberfläche (Verwaltung → Verbindungen, Tabelle `PlatformSetting`, verschlüsselt mit `APP_ENCRYPTION_KEY`) bzw. in CI/Netlify. **Oberflächenwerte überlagern gleichnamige Umgebungsvariablen** (`setting()` in `src/lib/platform/config.ts`); ausgenommen `DATABASE_URL`, `NODE_ENV`, `APP_ENCRYPTION_KEY`. Vollständige Tabelle mit Ort, Nutzer und Rotation: `docs/idea-to-app/14-sicherheit.md` → „Schlüssel“. Platzhalter: `.env.example`.

| Name | Art | Ort |
|---|---|---|
| `APP_ENCRYPTION_KEY`, `APP_ENCRYPTION_KEYS_OLD` | geheim (kritisch) | nur .env + Tresor; Wechsel nach `docs/betrieb.md` → „Schlüsselwechsel“ (`/api/cron/rekey`) |
| `POSTGRES_PASSWORD`, `DATABASE_URL` | geheim | .env |
| `SETUP_TOKEN` | geheim | .env, nach Einrichtung entfernen |
| `CRON_SECRET` | geheim | .env |
| `VOICE_TOOL_SECRET_RETELL`, `VOICE_TOOL_SECRET_VAPI`, `VOICE_TOOL_SECRET_ELEVENLABS`, `VOICE_TOOL_SECRET_SIP` (Übergang: `VOICE_TOOL_SECRET`) | geheim | .env oder Oberfläche |
| `TWILIO_AUTH_TOKEN` | geheim | .env oder Oberfläche |
| `RETELL_API_KEY`, `VAPI_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_WEBHOOK_SECRET`, `SIP_<ID>_API_KEY` | geheim | .env oder Oberfläche |
| `MS_CLIENT_SECRET`, `GOOGLE_CLIENT_SECRET` | geheim | .env oder Oberfläche |
| `SMTP_PASS` | geheim | .env oder Oberfläche |
| `ALERT_WEBHOOK_URL`, `HEALTHCHECK_PING_URL` | geheim (URL ist Zugang) | Oberfläche oder .env |
| `BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY`; privater age-Schlüssel `secrets/backup-age.key` | geheim | .env bzw. Datei auf dem Server (600) + Tresor |
| `TWILIO_ACCOUNT_SID`, `TWILIO_SMS_FROM`, `RETELL_AGENT_ID`, `RETELL_AGENT_ID_NO_STORAGE`, `RETELL_SIP_DOMAIN`, `VAPI_ASSISTANT_ID`, `VAPI_SIP_HOST`, `VAPI_API_BASE`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_API_BASE`, `SIP_<ID>_URI`, `MS_CLIENT_ID`, `GOOGLE_CLIENT_ID`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_FROM`, `ALERT_EMAIL`, `ALERT_SMS`, `BACKUP_AGE_RECIPIENT`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION`, `BACKUP_S3_BUCKET`, `DOMAIN`, `ACME_EMAIL`, `PUBLIC_BASE_URL` | öffentlich (Kennungen, Konfiguration) | .env oder Oberfläche |
| `TWILIO_VALIDATE_SIGNATURE`, `REQUIRE_PLATFORM_ADMIN_2FA`, `REQUIRE_TENANT_ADMIN_2FA`, `COOKIE_SECURE`, `PWNED_CHECK`, `RECORDING_HOSTS` | Sicherheitsschalter | nur .env, in Produktion nie abschwächen |
| `AI_KILL_SWITCH`, `MAX_CALL_MINUTES`, `MAX_CONCURRENT_CALLS_*`, `PLATFORM_DAILY_MINUTE_LIMIT`, `SMS_ALLOWED_PREFIXES` | Kostenschutz | Oberfläche oder .env |
| `BUILD_CANARY` (erfundener Kanarienwert), `DEMO_SEED` | öffentlich | nur CI bzw. Testumgebung; `DEMO_SEED` in Produktion nie `true` |

Regeln für neue Schlüssel: nur serverseitig, kein `NEXT_PUBLIC_`-Präfix, Name in `.env.example` (Test `tests/env-example.test.ts`), als `secret` in `src/lib/platform/registry.ts` führen, Werte nie in Logs, Tests, Fixtures oder Doku. CI: gitleaks und Build-Scan mit Kanarienwerten (`scripts/scan-build.sh`). Netlify-Testumgebung hat eigene Werte, nie die der Produktion.

## Bewusst akzeptierte Risiken

E-001 CSP `'unsafe-inline'` (neu prüfen vor Launch, TASK-044) · E-002 Webhook-/API-Zähler im Prozess (bei Skalierung) · E-003 `npm audit`-Funde nur in Entwicklungswerkzeugen (bis 2026-11-15; Produktionsabhängigkeiten seit `859b8e0` ohne Befund) · E-004 keine Postgres-RLS (vor 10 Kunden, TASK-057). Details: Paket-`docs/entscheidungen.md`.
