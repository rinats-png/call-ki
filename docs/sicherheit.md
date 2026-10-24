# Sicherheit – festgelegte Werte und akzeptierte Risiken

> Phase 14 nach [idea-to-app](https://github.com/rinats-png/idea-to-app). Ausgangswerte: `security/standardwerte.md` (OWASP, NIST SP 800-63B).
> Risikostufe: **2** (Konten, personenbezogene Daten Dritter, Sprachaufnahmen; Gesundheitsangaben in Transkripten möglich → DSFA-Schwellwertprüfung offen, siehe B1 BF-07/BF-16).
> Stand: 2026-10-23. Jede Abweichung von den Standardwerten ist begründet.

## Zugriffs-Antwortstrategie
| Fall | Antwort |
|---|---|
| Nicht angemeldet | `401` |
| Datensatz eines anderen Mandanten (Vorgang, Kunde, Anruf, Aufnahme, Mitarbeiter) | `404` – identisch zu „nicht vorhanden“ |
| Rolle reicht nicht (Mitarbeiter → Einstellungen, Kunde → Verwaltung) | `403` ohne Inhalte |
| Pflicht-2FA nicht eingerichtet | `403` mit `code: MFA_SETUP_REQUIRED` |
| Sensible Aktion ohne frische Bestätigung | `403` mit `code: REAUTH_REQUIRED` |

Umsetzung: `src/lib/auth/session.ts` (`requireTenant`, `requirePlatformAdmin`, `requireRecentAuth`); jede Abfrage enthält `tenantId`. Nachweis: `tests/integration/tenancy.test.ts`.

## Passwörter
| Punkt | Wert | Fundstelle |
|---|---|---|
| Hashing | scrypt N=2^17, r=8, p=1, 64 Byte (Argon2id wäre bevorzugt, braucht aber eine native Abhängigkeit – scrypt ist die zulässige Alternative) | `src/lib/auth/crypto.ts` |
| Mindestlänge / Maximum | 12 / 200 Zeichen, alle Zeichen erlaubt, keine Kompositionsregeln | `passwordProblem` |
| Leak-Prüfung | HIBP-Range-API (k-Anonymität), fail-open bei Ausfall | `src/lib/auth/pwned.ts` |
| Zwangswechsel | nein | – |

## Tokens und Links
| Art | Zufall | Speicherung | Laufzeit | Nutzung |
|---|---|---|---|---|
| Sitzung | 256 Bit | SHA-256 | siehe unten | Cookie `ck_session`: HttpOnly, Secure (Produktion), SameSite=Lax; neue ID nach Login und nach 2. Faktor |
| Passwort-Reset | 256 Bit | SHA-256 | 30 min | einmalig; alle Sitzungen enden |
| Einladung | 256 Bit | SHA-256 | 7 Tage | einmalig; erneutes Senden entwertet alte Links |
| TOTP-Secret | 160 Bit | AES-256-GCM (`APP_ENCRYPTION_KEY`) | bis Deaktivierung | Zeitschritt nicht wiederverwendbar |
| Wiederherstellungscodes | 10 × ~40 Bit | SHA-256 | bis Neuerzeugung | je einmal |

## Sitzungen
| Rolle | Inaktivität | Absolut | Erneute Bestätigung |
|---|---|---|---|
| Plattform-Admin | 30 min | 12 h | 15 min für Support-Zugriff, Zugangslinks |
| Kunden-Admin / Mitarbeiter | 14 Tage (gleitend) | 90 Tage | 15 min für DSGVO-Löschung/-Auskunft, Rollen, Sperren, 2FA-Änderungen, Passwortwechsel |
| 2. Faktor ausstehend | 10 min | – | – |

## Zwei-Faktor-Anmeldung
| Wer | Festlegung |
|---|---|
| Plattform-Admin | **Pflicht** (`REQUIRE_PLATFORM_ADMIN_2FA=true`), Zugriff erst nach Einrichtung |
| Kunden-Admin | angeboten; Pflicht per `REQUIRE_TENANT_ADMIN_2FA=true` möglich |
| Mitarbeiter | angeboten |
| Verfahren | TOTP (RFC 6238, Authenticator-App); Passkeys als Erweiterung |

## Rate-Limits (`src/lib/rate-limit.ts`)
| Endpunkt | Grenze | Reaktion |
|---|---|---|
| Login | 5 Fehlversuche/Konto → 15 min Pause; 20 Versuche/IP in 15 min | 429 + Retry-After |
| Passwort-Reset | 10/IP/h; 3 E-Mails/Konto/h (still) | 429 bzw. gleiche Antwort ohne Versand |
| Ersteinrichtung | 5/IP/h | 429 |
| 2. Faktor | 5/Sitzung in 10 min (danach neu anmelden), 20/IP in 15 min | 429 |
| Re-Auth | 5/Nutzer in 15 min | 429 |
| API (angemeldet) | 120/Nutzer/min | 429 |
| Webhooks (Retell/Vapi) | 600/IP/min | 429 |
| Anrufe derselben Nummer | 10/h je Kundennummer → Fallback statt KI | Kostenschutz |
| Minuten je Kunde | Monatslimit je Mandant → Fallback | Kostenschutz |

Speicher im Prozess – gültig, solange die App als **eine** Instanz läuft (Docker auf dem VPS). Für mehrere Instanzen: Redis.

## Größenlimits
JSON-Anfragen 100 KB (`readJson`), Tool-Webhooks 256 KB, Gesprächs-Events 2 MB (lange Transkripte), Listen max. 100–200 Einträge, Freitextfelder per zod begrenzt.

## Security-Header
`next.config.ts`: CSP (`default-src 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, `base-uri 'self'`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. Caddy: HSTS 1 Jahr. Kein CORS (nur gleiche Herkunft); CSRF über Origin-Prüfung (`src/middleware.ts`).

## Protokollierung
Audit-Log (`AuditLog`, 2 Jahre): Logins und Fehlversuche, 2FA-Änderungen, Passwortwechsel, Sitzungen beendet, Support-Zugriffe, Admin-Aktionen, DSGVO-Auskunft/-Löschung, Abspielen von Aufnahmen. Server-Log: JSON, Rufnummern maskiert, keine Passwörter, Tokens oder Transkripte.

## Daten bei Anbietern
Löschfrist je Kunde (Standard 365 Tage): Transkripte/Aufnahmen in der Datenbank **und** bei Retell (`DELETE /v2/delete-call`) und Twilio (Recording + Call) werden gelöscht. DSGVO-Löschung eines Anrufers löscht ebenfalls bei den Anbietern. Aufnahmen werden nur über `/api/calls/[id]/recording` nach Berechtigungsprüfung ausgeliefert (SSRF-Allowlist `RECORDING_HOSTS`). Abschalten der Aufzeichnung → Agent ohne Speicherung (`RETELL_AGENT_ID_NO_STORAGE`); fehlt er, wird aufgezeichnet **und angesagt** – nie still.

## Sprach-KI-Schnittstellen (Tools & Ereignisse)

- **Ein Geheimnis je Anbieter** (`VOICE_TOOL_SECRET_RETELL` / `_VAPI` / `_ELEVENLABS` / `_SIP`, Retell zusätzlich per Signatur). Wer sich mit dem Geheimnis eines Anbieters ausweist, darf nur Anfragen im Format dieses Anbieters schicken (`voiceAuthAllows`). Das gemeinsame `VOICE_TOOL_SECRET` gilt nur als Übergang, solange kein Anbieter-Geheimnis gesetzt ist.
- **Nur laufende Anrufe:** Funktionen werden nur ausgeführt, wenn sie einem Anruf zugeordnet sind, der höchstens 3 Stunden alt und nicht länger als 2 Minuten beendet ist.
- **ElevenLabs und SIP-Anbieter:** Ihre Anrufkennungen (`call_sid`, `call_ref`) stehen im selben Body wie die Argumente der KI. Deshalb zählt dort nur eine Anrufzeile, die die Plattform beim Twilio-Eingang selbst angelegt hat; ein Rückgriff auf die angerufene Nummer findet nicht statt. Anrufernummer und Mandant kommen dann aus dieser Zeile, nie aus dem Body.
- **Kundendaten nur zur verifizierten Anrufernummer:** `identify_caller` und die Zuständigkeitsprüfung nutzen ausschließlich die von Twilio bzw. dem Anbieter gemeldete Nummer. Nennt ein Anrufer eine andere Rückrufnummer, wird sie gespeichert, aber bestehende Angaben zu dieser Nummer werden nicht überschrieben (nur Lücken gefüllt) und nicht zurückgemeldet.
- **Termine verschieben/absagen per Telefon** (`find_appointments`, `reschedule_appointment`, `cancel_appointment`) nur für Termine des Kunden mit der verifizierten Anrufernummer; eine genannte Vorgangsnummer allein berechtigt nicht.

## Geheimnisse
Nur serverseitig in `.env` (nicht im Repository, `.env.example` mit Platzhaltern). Pflicht in Produktion: `APP_ENCRYPTION_KEY`, `SETUP_TOKEN` (nur bis zur Einrichtung), `CRON_SECRET`, je genutztem Sprach-KI-Anbieter `VOICE_TOOL_SECRET_RETELL` / `_VAPI` / `_ELEVENLABS` / `_SIP` (das gemeinsame `VOICE_TOOL_SECRET` gilt nur noch, solange keines davon gesetzt ist), Datenbank-Passwort. Rotation: Twilio-/Retell-/SMTP-/Microsoft-Schlüssel jährlich oder bei Verdacht; `APP_ENCRYPTION_KEY` nicht ändern (sonst müssen alle Nutzer 2FA neu einrichten). Secret-Scan (gitleaks) in der CI.

## Bewusst akzeptierte Risiken
| ID | Risiko | Begründung | Neu prüfen |
|---|---|---|---|
| E-001 | CSP erlaubt `'unsafe-inline'` für Skripte und Styles | Next.js-Inline-Bootstrap und Theme-Skript; keine Ausgabe von Nutzer-HTML. Umstellung auf Nonces geplant. Bei Stufe 2 zulässig. | vor Launch |
| E-002 | Rate-Limits im Prozessspeicher | Ein Server, eine Instanz; Neustart setzt Zähler zurück (Kontosperre bleibt in der DB) | bei Skalierung |
| E-003 | `npm audit`: hoch bei prisma 6 (CLI) und next 15 (postcss) | Behebung nur per Major-Update (Prisma 7, Next 16); CI blockiert ab „critical“. Update als eigene Aufgabe | 2026-11-15 |
| E-004 | Keine zweite Schutzschicht per Postgres-RLS | Mandantentrennung im Code + Integrationstest; RLS als Erweiterung | vor 10 Kunden |
