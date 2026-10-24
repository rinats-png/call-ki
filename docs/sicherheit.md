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
Einladungs- und Passwort-Links für andere Nutzer (ohne SMTP werden sie direkt angezeigt) verlangen eine frische Bestätigung (Re-Auth), ebenso Rollenwechsel und Sperren.

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
| Unterdrückte Nummern | 30/h je angerufener Nummer → Fallback | Kostenschutz |
| Benachrichtigungen erneut auslösen | 5 je Vorgang in 24 h | 429 (SMS-Kosten) |
| SMS-Zielländer | nur `SMS_ALLOWED_PREFIXES` (Standard +49, +43, +41) | Nachricht „SKIPPED“ (SMS-Pumping) |

Sicherheitsrelevante Grenzen (Login, Reset, 2FA, Re-Auth, Ersteinrichtung, Anrufe, Benachrichtigungen) zählen gemeinsam in PostgreSQL (`RateLimitHit`, Schlüssel gehasht) und gelten damit auch über mehrere Instanzen; die übrigen zählen im Prozess.

## Größenlimits
JSON-Anfragen 100 KB (`readJson`), Tool-Webhooks 256 KB, Gesprächs-Events 2 MB (lange Transkripte), Listen max. 100–200 Einträge, Freitextfelder per zod begrenzt.

## Security-Header
`src/middleware.ts`: CSP mit Nonce je Anfrage für Skripte (`script-src 'self' 'nonce-…' 'strict-dynamic'`), `default-src 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, `base-uri 'self'`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. Caddy: HSTS 1 Jahr. Kein CORS (nur gleiche Herkunft); CSRF über Origin-Prüfung (`src/middleware.ts`).

## Protokollierung
Audit-Log (`AuditLog`, 2 Jahre): Logins und Fehlversuche, 2FA-Änderungen, Passwortwechsel, Sitzungen beendet, Support-Zugriffe, Admin-Aktionen, DSGVO-Auskunft/-Löschung, Abspielen von Aufnahmen. Server-Log: JSON, Rufnummern maskiert, keine Passwörter, Tokens oder Transkripte; je Dienst rotiert (höchstens 5 × 20 MB, `docker-compose.yml`). API-Antworten mit `Cache-Control: no-store`.

## Daten bei Anbietern
Löschfrist je Kunde (Standard 365 Tage): Transkripte/Aufnahmen in der Datenbank **und** bei Retell (`DELETE /v2/delete-call`) und Twilio (Recording + Call) werden gelöscht. DSGVO-Löschung eines Anrufers löscht ebenfalls bei den Anbietern. Aufnahmen werden nur über `/api/calls/[id]/recording` nach Berechtigungsprüfung ausgeliefert (SSRF-Allowlist `RECORDING_HOSTS`, auch für jede Weiterleitung; Twilio-Zugangsdaten nur an Twilio). Abschalten der Aufzeichnung → Agent ohne Speicherung (`RETELL_AGENT_ID_NO_STORAGE`); fehlt er, wird aufgezeichnet **und angesagt** – nie still.

## Sprach-KI-Schnittstellen (Tools & Ereignisse)

- **Ein Geheimnis je Anbieter** (`VOICE_TOOL_SECRET_RETELL` / `_VAPI` / `_ELEVENLABS` / `_SIP`, Retell zusätzlich per Signatur). Wer sich mit dem Geheimnis eines Anbieters ausweist, darf nur Anfragen im Format dieses Anbieters schicken (`voiceAuthAllows`). Das gemeinsame `VOICE_TOOL_SECRET` gilt nur als Übergang, solange kein Anbieter-Geheimnis gesetzt ist.
- **Notfall-Durchstellung über den Server:** Kam der Anruf über Twilio, leitet der Server ihn selbst um (Twilio-REST, Ziel nur Direktnummer des Notdienstes bzw. Notfallnummer des Kunden, nur freigegebene Länder). Das `transfer_call` des Anbieters wird dann nicht benutzt – die KI kann kein Ziel wählen.
- **Retell-Signatur nur mit Zeitstempel** (`v=<ts>,d=<hmac>`, höchstens 5 Minuten alt); die alte Variante ohne Zeitstempel wird abgelehnt (Wiederholungsschutz).
- **Retell/Vapi ohne eigene Anrufzeile:** Der Mandant kann dann über die angerufene Nummer ermittelt werden, die Anrufernummer aus dem Body gilt aber nicht als verifiziert – keine Kundendaten und keine Terminänderungen.
- **Nur laufende Anrufe:** Funktionen werden nur ausgeführt, wenn sie einem Anruf zugeordnet sind, der höchstens 3 Stunden alt und nicht länger als 2 Minuten beendet ist.
- **ElevenLabs und SIP-Anbieter:** Ihre Anrufkennungen (`call_sid`, `call_ref`) stehen im selben Body wie die Argumente der KI. Deshalb zählt dort nur eine Anrufzeile, die die Plattform beim Twilio-Eingang selbst angelegt hat; ein Rückgriff auf die angerufene Nummer findet nicht statt. Anrufernummer und Mandant kommen dann aus dieser Zeile, nie aus dem Body.
- **Kundendaten nur zur verifizierten Anrufernummer:** `identify_caller` und die Zuständigkeitsprüfung nutzen ausschließlich die von Twilio bzw. dem Anbieter gemeldete Nummer. Nennt ein Anrufer eine andere Rückrufnummer, wird sie gespeichert, aber bestehende Angaben zu dieser Nummer werden nicht überschrieben (nur Lücken gefüllt) und nicht zurückgemeldet.
- **Termine verschieben/absagen per Telefon** (`find_appointments`, `reschedule_appointment`, `cancel_appointment`) nur für Termine des Kunden mit der verifizierten Anrufernummer; eine genannte Vorgangsnummer allein berechtigt nicht.

## Webhooks für Kunden (`src/lib/services/webhooks.ts`)
Kunden-Admins können Vorgänge und beendete Anrufe an eigene Systeme senden lassen (Paketfunktion „webhooks“). Nur `https`, keine Zugangsdaten in der URL, Ziel wird bei Anlage **und bei jeder Zustellung** per DNS geprüft – private, lokale und reservierte Adressen werden abgewiesen (SSRF), Weiterleitungen werden nicht verfolgt. Signatur `X-CallKI-Signature: t=<unix>,v1=<HMAC-SHA256("<t>.<body>")>` mit einem Geheimnis je Endpunkt (verschlüsselt gespeichert, nur bei Anlage einmal angezeigt, im Schlüsselwechsel enthalten). Höchstens 5 Endpunkte je Kunde, 6 Zustellversuche mit wachsender Pause, Zustellprotokoll 30 Tage. Anlegen nur mit frischer Bestätigung.

## Geheimnisse
Nur serverseitig in `.env` (nicht im Repository, `.env.example` mit Platzhaltern). Pflicht in Produktion: `APP_ENCRYPTION_KEY`, `SETUP_TOKEN` (nur bis zur Einrichtung), `CRON_SECRET`, je genutztem Sprach-KI-Anbieter `VOICE_TOOL_SECRET_RETELL` / `_VAPI` / `_ELEVENLABS` / `_SIP` (das gemeinsame `VOICE_TOOL_SECRET` gilt nur noch, solange keines davon gesetzt ist), Datenbank-Passwort. Rotation: Twilio-/Retell-/SMTP-/Microsoft-Schlüssel jährlich oder bei Verdacht; `APP_ENCRYPTION_KEY` nur nach Verfahren wechseln (`docs/betrieb.md` → „Schlüsselwechsel“: neuer Schlüssel, alter in `APP_ENCRYPTION_KEYS_OLD`, Umschlüsseln über `/api/cron/rekey`). Secret-Scan (gitleaks) in der CI.

## Bewusst akzeptierte Risiken
| ID | Risiko | Begründung | Neu prüfen |
|---|---|---|---|
| E-001 | (Skripte erledigt 2026-10-24) CSP erlaubt `'unsafe-inline'` nur noch für Styles | Skripte nur mit Nonce je Anfrage (`src/middleware.ts`, `'strict-dynamic'`), getestet (T-SEC-HTTP-08, E2E-04). Styles brauchen `unsafe-inline` für style-Attribute (Diagramme); kein Nutzer-HTML | bei Bedarf |
| E-002 | Rate-Limits für Webhooks und API-Aufrufe je Nutzer im Prozessspeicher (sicherheitsrelevante Limits – Anmeldung, 2FA, Passwort-Reset, Re-Auth, Einrichtung, Anrufer – seit 2026-10-24 gemeinsam in PostgreSQL) | Hohe Frequenz, kein Sicherheitsgewinn durch Teilen; Neustart setzt nur diese Zähler zurück | bei Skalierung |
| E-003 | (erledigt 2026-10-24) `npm audit` | Keine bekannten Schwachstellen mehr: zod 4, vitest 5, Overrides für postcss/deepmerge-ts/postcss-selector-parser (erzeugte CSS unverändert). CI bricht bei Produktionsabhängigkeiten ab „high“ ab | – |
| E-004 | Keine zweite Schutzschicht per Postgres-RLS | Mandantentrennung im Code + Integrationstest; RLS als Erweiterung | vor 10 Kunden |
