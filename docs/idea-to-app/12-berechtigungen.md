# Rollen & Berechtigungen

> Phase 12 im Modus „Bestehende App“. Abgeleitet aus `src/lib/auth/session.ts` (`requireAuth`, `requireTenant`, `requireTenant({ adminOnly: true })`, `requirePlatformAdmin`, `requireRecentAuth`), `src/middleware.ts` und jeder Route unter `src/app/api/**/route.ts`. Für die Telefon-KI: `src/lib/voice/handle-tools.ts`, `src/lib/voice/context.ts`, `src/lib/voice/tools.ts`, `src/lib/security.ts`. Stand: 2026-10-24 (Commit `33c0708`; Änderungen aus `0e0efc5` sind gekennzeichnet).

## Rollen

| Rolle | Beschreibung | Wie bekommt man sie? |
|---|---|---|
| Gast | Nicht angemeldet. Sieht nur Login, Passwort vergessen, Einladung/Reset per Link, Ersteinrichtung, `/api/health` | – |
| TENANT_USER (Kunden-Mitarbeiter) | Arbeitet im Portal seines Mandanten: Vorgänge, Anrufe, Kunden. Keine Einstellungen, keine Benutzerverwaltung, keine DSGVO-Löschung | Einladung durch Kunden-Admin oder Plattform-Admin (Einmal-Link, 7 Tage) |
| TENANT_ADMIN (Kunden-Admin) | Alles im eigenen Mandanten, inklusive Team, KI-Texte, Integrationen, Benutzer, Protokoll, Export, DSGVO-Löschung | Einladung mit Rolle `TENANT_ADMIN`; Hochstufung durch anderen Kunden-Admin (mit Re-Auth) |
| PLATFORM_ADMIN (Betreiber) | Verwaltung aller Mandanten, Pakete, Abrechnung, Plattform-Einstellungen und Anbieter-Schlüssel. **Keine** Mandantendaten ohne ausdrücklichen Wechsel in den Mandanten („Portal öffnen“, Re-Auth, Audit-Eintrag `platform.enter_tenant`); danach Rechte wie Kunden-Admin. 2FA Pflicht | Nur Ersteinrichtung mit `SETUP_TOKEN` (solange kein Plattform-Admin existiert); keine Vergabe über die Oberfläche |
| Telefon-KI (technische Rolle) | Sprach-KI-Anbieter (Retell, Vapi, ElevenLabs, SIP) ruft während eines Gesprächs Funktionen auf. Kein Konto, keine Sitzung. Ausweis: Anbieter-Geheimnis bzw. Retell-Signatur. Mandant und Anrufernummer kommen **nur aus der eigenen Anrufzeile** bzw. der von Twilio/dem Anbieter gemeldeten Nummer, nie aus KI-Argumenten | Konfiguration der Tool-URL und des Geheimnisses beim Anbieter |
| Twilio (technisch) | Ruft Anruf-, Status-, Fallback- und Aufnahme-Webhooks auf | Signatur `X-Twilio-Signature` mit `TWILIO_AUTH_TOKEN` |
| Cron (technisch) | Zeitgesteuerte Aufgaben im Container `cron` | `Authorization: Bearer CRON_SECRET` |

## Berechtigungsmatrix

Legende: ✅ erlaubt · ❌ verweigert · **eigener M.** = nur Datensätze mit `tenantId` des eigenen (bzw. beim Plattform-Admin: des gewählten) Mandanten · **RA** = Re-Auth nötig (Bestätigung höchstens 15 min alt, sonst `403 REAUTH_REQUIRED`) · **Paket** = zusätzlich Paket-Feature nötig. Fremde Datensätze antworten mit `404`, fehlende Rolle mit `403`, fehlende Anmeldung mit `401` (Strategie in `14-sicherheit.md`).

Spalte „PA“ = Plattform-Admin **ohne** Mandantenwechsel, „PA im M.“ = nach „Portal öffnen“.

### Mandantendaten (Portal)

| Objekt / Aktion | Gast | Telefon-KI | TENANT_USER | TENANT_ADMIN | PA | PA im M. | Route |
|---|---|---|---|---|---|---|---|
| Startseite/Kennzahlen lesen | ❌ | ❌ | eigener M. | eigener M. | ❌ (403) | eigener M. | `GET /api/dashboard` |
| Vorgang manuell anlegen | ❌ | über `book_appointment`/`escalate_emergency` | eigener M. | eigener M. | ❌ | eigener M. | `POST /api/tickets` |
| Vorgang lesen | ❌ | ❌ (nur eigene Termine des Anrufers, siehe unten) | eigener M. | eigener M. | ❌ | eigener M. | `GET /api/tickets/[id]` |
| Vorgang ändern (Status, Zuweisung, Notiz) | ❌ | ❌ | eigener M.; Mitarbeiter-ID muss zum M. gehören | eigener M. | ❌ | eigener M. | `PATCH /api/tickets/[id]` |
| Termin setzen / Benachrichtigung erneut senden | ❌ | ❌ | eigener M. (löst E-Mail/SMS aus; höchstens 5× je Vorgang in 24 h, Commit `0e0efc5`) | eigener M. (wie Mitarbeiter) | ❌ | eigener M. | `POST /api/tickets/[id]/notify` |
| Anrufliste, Kennzahlen, Anruf mit Transkript lesen | ❌ | ❌ | eigener M. | eigener M. | ❌ | eigener M. | `GET /api/calls`, `/api/calls/stats`, `/api/calls/[id]` |
| Aufnahme abspielen | ❌ | ❌ | eigener M. (Audit `call.recording_played`) | eigener M. | ❌ | eigener M. | `GET /api/calls/[id]/recording` |
| Kunden suchen / lesen | ❌ | nur Datensatz zur verifizierten Anrufernummer | eigener M. | eigener M. | ❌ | eigener M. | `GET /api/customers`, `/api/customers/[id]` |
| Kunde ändern | ❌ | nur Lücken füllen bei nicht verifizierter Nummer | eigener M. | eigener M. | ❌ | eigener M. | `PATCH /api/customers/[id]` |
| DSGVO-Auskunft eines Kunden (Export) | ❌ | ❌ | eigener M. + RA | eigener M. + RA | ❌ | eigener M. + RA | `GET /api/customers/[id]/export` |
| DSGVO-Löschung eines Kunden (inkl. Anbieter) | ❌ | ❌ | ❌ (403) | eigener M. + RA | ❌ | eigener M. + RA | `DELETE /api/customers/[id]` |
| Team (Mitarbeiter) lesen | ❌ | indirekt: Name und Direktnummer des zuständigen Mitarbeiters | eigener M. | eigener M. | ❌ | eigener M. | `GET /api/employees` |
| Mitarbeiter anlegen / ändern / deaktivieren | ❌ | ❌ | ❌ (403) | eigener M. | ❌ | eigener M. | `POST /api/employees` |
| Zuständigkeit testen | ❌ | über `find_technician` | eigener M. | eigener M. | ❌ | eigener M. | `GET /api/routing/preview` |
| Nachrichtenprotokoll lesen | ❌ | ❌ | eigener M. (ohne Inhalt) | eigener M. | ❌ | eigener M. | `GET /api/messages` |
| Einstellungen (KI-Texte, Zeiten, Notfall) lesen | ❌ | indirekt als Prompt-Variablen | eigener M. | eigener M. | ❌ | eigener M. | `GET /api/settings` |
| Einstellungen ändern | ❌ | ❌ | ❌ (403) | eigener M. | ❌ | eigener M. | `PUT /api/settings` |
| Gesamtexport des Mandanten | ❌ | ❌ | ❌ (403) | eigener M. + RA | Mandant wählen + RA | eigener M. + RA | `GET /api/settings/export`, `GET /api/admin/tenants/[id]/export` |
| Integrationen lesen | ❌ | ❌ | eigener M. | eigener M. | ❌ | eigener M. | `GET /api/integrations` |
| Microsoft/Google verbinden, trennen | ❌ | ❌ | ❌ (403) | eigener M. + Paket `calendar_external` | ❌ | eigener M. + Paket | `POST/PUT/DELETE /api/integrations/microsoft`, `/google` |
| OAuth-Rücksprung | ❌ (Sitzung nötig) | ❌ | nur mit gültigem `state` (Nonce vom Admin) | Sitzung + `state` passt zum M. | ❌ | Sitzung + `state` | `GET /api/integrations/*/callback` |
| Benutzer lesen / einladen | ❌ | ❌ | ❌ (403) | eigener M. (Paketgrenze `maxUsers`) | über Verwaltung | eigener M. | `GET/POST /api/users` |
| Benutzer-Rolle ändern, sperren | ❌ | ❌ | ❌ | eigener M. + RA; nicht sich selbst | über Verwaltung | eigener M. + RA | `PATCH /api/users/[id]` |
| Einladung erneut senden / Passwort-Reset für Kollegen | ❌ | ❌ | ❌ | eigener M. + RA (seit Commit `0e0efc5`); ohne SMTP wird der Link nach der Bestätigung angezeigt | über Verwaltung + RA | eigener M. + RA | `PATCH /api/users/[id]` (`action`) |
| Aktivitätsprotokoll lesen | ❌ | ❌ | ❌ (403) | eigener M. | ❌ | eigener M. | `GET /api/audit` |
| Tarif und Verbrauch lesen | ❌ | ❌ | eigener M. ohne Preise | eigener M. mit Preisen | ❌ | eigener M. | `GET /api/billing` |

### Eigenes Konto

| Objekt / Aktion | Gast | Telefon-KI | TENANT_USER | TENANT_ADMIN | PA | Route |
|---|---|---|---|---|---|---|
| Anmelden | ✅ (Rate-Limit) | ❌ | ✅ | ✅ | ✅ + 2FA | `POST /api/auth/login`, `/api/auth/2fa/verify` |
| Passwort vergessen / zurücksetzen | ✅ (gleiche Antwort für alle E-Mails) | ❌ | ✅ | ✅ | ✅ | `POST /api/auth/forgot`, `/api/auth/reset` |
| Ersteinrichtung | nur mit `SETUP_TOKEN` und solange kein PA existiert | ❌ | ❌ | ❌ | ❌ | `POST /api/auth/setup` |
| Eigenes Profil lesen | ❌ | ❌ | ✅ | ✅ | ✅ | `GET /api/auth/me` |
| Passwort ändern | ❌ | ❌ | ✅ + RA + altes Passwort | ✅ + RA | ✅ + RA | `POST /api/auth/password` |
| 2FA einrichten | ❌ | ❌ | ✅ | ✅ | ✅ (Pflicht) | `POST /api/auth/2fa/setup`, `/enable` |
| 2FA abschalten / Wiederherstellungscodes neu | ❌ | ❌ | ✅ + RA | ✅ + RA (nicht, wenn Pflicht) | ❌ wenn Pflicht | `POST /api/auth/2fa/disable`, `/recovery` |
| Re-Auth (Passwort + ggf. Code) | ❌ | ❌ | ✅ (5/15 min) | ✅ | ✅ | `POST /api/auth/reauth` |
| Eigene Sitzungen sehen / alle beenden | ❌ | ❌ | ✅ | ✅ | ✅ | `GET/DELETE /api/auth/sessions` |

### Plattform-Verwaltung

| Objekt / Aktion | Gast | Telefon-KI | TENANT_USER | TENANT_ADMIN | PA | Route |
|---|---|---|---|---|---|---|
| Übersicht, Mandantenliste, Mandant lesen | ❌ | ❌ | ❌ (403) | ❌ (403) | ✅ | `GET /api/admin/overview`, `/api/admin/tenants`, `/api/admin/tenants/[id]` |
| Mandant anlegen, ändern, pausieren | ❌ | ❌ | ❌ | ❌ | ✅ (ACTIVE nur mit AVV-Nachweis) | `POST /api/admin/tenants`, `PATCH /api/admin/tenants/[id]` |
| Mandant löschen (inkl. Anbieter) | ❌ | ❌ | ❌ | ❌ | ✅ + RA | `DELETE /api/admin/tenants/[id]` |
| In Mandanten wechseln („Portal öffnen“) | ❌ | ❌ | ❌ | ❌ | ✅ + RA, Audit | `POST /api/admin/switch` |
| Rufnummer zuordnen / entfernen | ❌ | ❌ | ❌ | ❌ | ✅ (Paketgrenze `maxNumbers`) | `POST/DELETE /api/admin/tenants/[id]/numbers` |
| Zugang für Mandant anlegen | ❌ | ❌ | ❌ | ❌ | ✅ | `POST /api/admin/tenants/[id]/users` |
| Zugangslink für bestehendes Konto erzeugen | ❌ | ❌ | ❌ | ❌ | ✅ + RA | `POST /api/admin/tenants/[id]/users` (`userId`) |
| Pakete verwalten | ❌ | ❌ | ❌ | ❌ | ✅ | `GET/POST /api/admin/plans`, `PATCH/DELETE /api/admin/plans/[id]` |
| Abrechnung aller Mandanten, CSV | ❌ | ❌ | ❌ | ❌ | ✅ | `GET /api/admin/billing` |
| Plattform-Einstellungen lesen (Geheimnisse nur maskiert) | ❌ | ❌ | ❌ | ❌ | ✅ | `GET /api/admin/settings` |
| Plattform-Einstellung ändern | ❌ | ❌ | ❌ | ❌ | ✅; Geheimnisse + RA | `PUT /api/admin/settings` |
| Verbindung testen | ❌ | ❌ | ❌ | ❌ | ✅ (30/10 min) | `POST /api/admin/settings/test` |
| Test-Kunde anlegen | ❌ | ❌ | ❌ | ❌ | ✅ nur in Testumgebung (`DEMO_SEED`) | `POST /api/admin/demo` |

### Telefon-KI (Funktionsaufrufe)

Endpunkte: `POST /api/voice/tools`, `POST /api/voice/tools/[tool]`, Vapi `POST /api/voice/vapi` (`tool-calls`). Ablauf je Aufruf (`processToolBody`):
1. Ausweis: Anbieter-Geheimnis (`VOICE_TOOL_SECRET_<ANBIETER>`) oder Retell-Signatur. Ein Anbieter darf nur Anfragen in **seinem** Format schicken (`voiceAuthAllows`).
2. Anrufbindung: `resolveVoiceContext(..., { activeOnly: true, requireCall: provider === "generic" })`. Treffer über Anbieter-Call-ID, Twilio-CallSid oder eigene Call-Referenz, nur wenn der Anruf läuft (höchstens 3 h alt, höchstens 2 min beendet). Bei ElevenLabs/SIP (`generic`) **nur** über eine selbst angelegte Anrufzeile.
3. Mandant = Mandant der Anrufzeile. Anrufernummer = `Call.fromNumber` bzw. vom Anbieter gemeldete Nummer.
4. Retell/Vapi **ohne eigene Anrufzeile** (Rückgriff über die angerufene Nummer): Mandant über die Nummer, die Anrufernummer aus dem Body gilt aber als **unverifiziert** (`callerNumber = null`, Log `voice.context_unverified_caller`) – keine Kundendaten, keine Terminänderungen (`src/lib/voice/context.ts`, Commit `0e0efc5`).

| Funktion | Liest | Schreibt | Einschränkung |
|---|---|---|---|
| `identify_caller` | Kunde zur **verifizierten** Anrufernummer: Name, Firma, Typ, Adresse, PLZ, „E-Mail vorhanden“, letzte Vorgänge (Datum, Kategorie, Status, Mitarbeiter) | – | Argument `phone` wird ignoriert; unterdrückte Nummer → keine Daten |
| `save_customer` | – | Kunde des Mandanten (`upsert` per Nummer), Verknüpfung Anruf ↔ Kunde | Genannte, nicht verifizierte Nummer: nur leere Felder füllen, keine Rückmeldung gespeicherter Daten |
| `find_technician` | Mitarbeiter (Name, ID), freie Termine aus Kalender, bei Notfall Direktnummer bzw. Notfallnummer (Paket `emergency_forwarding`) | – | PLZ/Kundentyp aus Kundendatensatz der verifizierten Nummer oder aus Argumenten |
| `book_appointment` | Kalender (Slot-Prüfung) | Kunde, Vorgang, Termin, Kalendereintrag, Benachrichtigungen (nach der Antwort) | Mitarbeiter-ID aus Argumenten nur, wenn aktiv und im selben Mandanten; ohne Paket `calendar_internal` kein Termin; je Anruf höchstens ein Vorgang |
| `escalate_emergency` | Zuständiger Mitarbeiter | Vorgang `CRITICAL`, Notfall-Alarm (SMS/E-Mail) | Durchstellnummer nur mit Paket `emergency_forwarding` |
| `find_appointments` | Kommende Termine **nur** des Kunden mit verifizierter Anrufernummer (max. 5) | – | ohne verifizierte Nummer keine Daten |
| `reschedule_appointment` | wie oben | Termin, Kalender, Benachrichtigungen | nur Termine der verifizierten Nummer; Vorgangsnummer allein berechtigt nicht |
| `cancel_appointment` | wie oben | Termin entfernen, Benachrichtigung | wie oben |
| `recording_consent` | – | `Call.recordingConsent` (GRANTED/DENIED) mit Zeitpunkt an der eigenen Anrufzeile | nur wenn der Mandant „ausdrücklich fragen“ eingestellt hat; ohne Zustimmung wird die Aufnahme nach dem Gespräch beim Anbieter gelöscht |

Festgelegt in E-009 (Daten nur zur verifizierten Anrufernummer) und E-005 (Geheimnis je Anbieter).

**Die Telefon-KI darf nicht:** fremde Mandanten erreichen, Kunden über eine genannte Nummer oder Vorgangsnummer nachschlagen, Benutzer/Einstellungen/Integrationen lesen oder ändern, Transkripte oder Aufnahmen lesen, Daten löschen, Exporte auslösen.

### Technische Absender

| Objekt / Aktion | Ausweis | Darf | Route |
|---|---|---|---|
| Anruf annehmen, Kostenschutz, Übergabe an Sprach-KI | Twilio-Signatur | Anrufzeile anlegen, Mandant über angerufene Nummer | `POST /api/twilio/voice` |
| Gesprächsende, Dauer | Twilio-Signatur | Anruf beenden, `twilioDurationSec` | `POST /api/twilio/status` |
| Fallback, Mailbox-Aufnahme | Twilio-Signatur | Status `FALLBACK`/`VOICEMAIL`, Rückruf-Vorgang | `POST /api/twilio/fallback`, `/api/twilio/recording` |
| Gesprächsereignisse (Transkript, Zusammenfassung) | Anbieter-Geheimnis/Retell-Signatur; ElevenLabs HMAC | Anruf aktualisieren, Rückruf-Vorgang; Anbieter nur im eigenen Format | `POST /api/voice/events`, `/api/voice/events/elevenlabs`, Vapi `end-of-call-report` |
| Vapi `assistant-request` | Vapi-Geheimnis | Variablen des Mandanten zur angerufenen Nummer zurückgeben | `POST /api/voice/vapi` |
| Zeitgesteuerte Aufgaben | `CRON_SECRET` | Nachrichten wiederholen, Anrufe beenden/schließen, Überwachung, Kontingent-Warnungen, Erinnerungen, Löschfristen, Lebenszeichen, Umschlüsselung nach Schlüsselwechsel | `POST /api/cron/*` |
| Lebendcheck | keiner | nur `ok`/`db` | `GET /api/health` |

## Grundsätze

- **Deny by default:** Die Middleware lässt ohne Sitzungs-Cookie nur die öffentlichen Seiten und `/api/auth/`, `/api/twilio/`, `/api/voice/`, `/api/cron/`, `/api/health` durch. Jede Route prüft selbst (`requireTenant` usw.); die Middleware ist nur die erste Schicht.
- **Serverseitig bei jeder Anfrage:** Sitzung (gehashte ID), Ablauf (Inaktivität und absolut), 2FA-Status, gesperrtes Konto, Rate-Limit `120/min` je Nutzer.
- **Mandant immer aus der Sitzung**, nie aus URL oder Body. Jede Abfrage enthält `tenantId`; fremde IDs ergeben `404`. Für die Telefon-KI aus der Anrufzeile.
- **Allowlist der Felder:** zod-Schemas je Route; `role` nur `TENANT_ADMIN`/`TENANT_USER`, `tenantId` nie aus dem Body.
- **Re-Auth** für: DSGVO-Auskunft und -Löschung, Gesamtexport, Rollen- und Sperränderungen, Einladungs-/Reset-Links für Kollegen, 2FA-Änderungen, Passwortwechsel, Plattform-Geheimnisse, Mandantenwechsel, Mandanten-Löschung, Zugangslinks durch den Plattform-Admin.
- **Plattform-Admin sieht Mandantendaten nur nach bewusstem Wechsel** (Audit im Protokoll des Kunden). Zustimmung oder Benachrichtigung des Kunden ist nicht geregelt (OP-12-02).
- **Paketgrenzen serverseitig** (`hasFeature`, `assertUserSlot`, Nummernlimit); Oberfläche zeigt nur an.
- **Keine Selbstregistrierung** von Mandanten.
- **Zweite Schicht (Postgres-RLS) fehlt** – bewusst akzeptiert als E-004.

## Teilen

Es gibt kein Teilen von Datensätzen zwischen Mandanten und keine öffentlichen Links. Einzige Links: Einladung und Passwort-Reset (Einmal-Token, gehasht, 7 Tage bzw. 30 min). Aufnahmen werden nie als Anbieter-URL an den Browser gegeben.

## Gefundene Lücken in der Rechteprüfung

| Stelle | Befund | Vorschlag / Stand |
|---|---|---|
| `src/app/api/users/[id]/route.ts:19,26-27` | Kunden-Admin konnte für einen anderen Kunden-Admin „Passwort zurücksetzen“ bzw. „Einladung erneut senden“ **ohne Re-Auth** auslösen. Ohne SMTP wird der Link direkt angezeigt. | **behoben** in Commit `0e0efc5`: `requireRecentAuth` auch für `action`; Test T-SEC-HTTP-14 (Commit `33c0708`). Offen als Verbesserung: Link nur anzeigen, wenn das Ziel noch nie angemeldet war |
| `src/app/api/customers/[id]/export/route.ts:10` | DSGVO-Auskunft ist für jeden Mitarbeiter möglich (mit Re-Auth). Kann so gewollt sein (Büro beantwortet Anfragen), ist aber ein Massen-Export-Pfad. | bewusst entscheiden; ggf. `adminOnly` |
| `src/lib/voice/context.ts:171` | Bei Retell/Vapi fiel die Zuordnung ohne passende Anrufzeile auf die **angerufene Nummer aus dem Body** zurück, ohne die Prüfung „Anruf läuft“; mit frei gewählter `from_number` ließ sich z. B. `identify_caller` für beliebige Nummern eines Mandanten ausführen. | **behoben** in Commit `0e0efc5`: ohne eigene Anrufzeile gilt die Anrufernummer als unverifiziert (keine Kundendaten, keine Terminänderungen); Integrationstest „vertraut bei Retell/Vapi ohne eigene Anrufzeile nicht der Anrufernummer aus dem Body“ |
| `src/app/api/tickets/[id]/notify/route.ts` | Jeder Mitarbeiter konnte Benachrichtigungen beliebig oft neu auslösen (SMS-Kosten), begrenzt nur durch 120 Anfragen/min. | **behoben** in Commit `0e0efc5`: höchstens 5× je Vorgang in 24 h (`LIMITS.notifyPerTicket`, gemeinsam in Postgres); dazu SMS nur in freigegebene Länder (`SMS_ALLOWED_PREFIXES`) |

## Pflicht-Testfälle (für Phase 19)

| Test | Fall | Erwartung | Stand |
|---|---|---|---|
| T-SEC-01 | Nutzer aus Mandant A ruft Vorgang, Kunde, Anruf, Aufnahme von B per ID ab | `404`, keine Daten | Vorgang per HTTP vorhanden (T-SEC-HTTP-02); Kunde, Anruf, Aufnahme offen |
| T-SEC-02 | Nutzer aus A ändert/löscht Datensatz von B | `404`, Datensatz unverändert | vorhanden für Vorgang ändern, Kunde ändern und löschen (T-SEC-HTTP-10); Benutzer offen |
| T-SEC-03 | Body enthält `tenantId`, `role: "PLATFORM_ADMIN"`, fremde `employeeId` | Felder ignoriert bzw. abgelehnt | KI-Argumente: vorhanden; HTTP vorhanden (T-SEC-HTTP-11) |
| T-SEC-04 | Listen (`/api/calls`, `/api/customers`, `/api/messages`, `/api/dashboard`) | nur eigener Mandant | `/api/dashboard` per HTTP vorhanden (T-SEC-HTTP-02), Export auf Service-Ebene; übrige Listen offen |
| T-SEC-08 | Geschützte Endpunkte ohne Anmeldung | `401`, keine Daten | vorhanden für `/api/dashboard` und Seiten (T-SEC-HTTP-01) |
| T-SEC-10 | Aufnahme eines anderen Mandanten über `/api/calls/[id]/recording` | `404`, kein Abruf beim Anbieter | offen (SSRF-Allowlist getestet) |
| T-SEC-14 | Mitarbeiter ruft Admin-Endpunkte (Einstellungen, Benutzer, Löschung, `/api/admin/*`) | `403`, keine Daten | vorhanden für Einstellungen, Benutzer, `/api/admin/tenants` (T-SEC-HTTP-03); DSGVO-Löschung offen |
| T-SEC-17 | Telefon-KI fragt Kundendaten/Termine über genannte Nummer oder Vorgangsnummer ab | keine Daten Dritter | vorhanden |
| T-SEC-18 | Funktionsaufruf ohne laufenden Anruf, mit Kennungen im Body, im Format eines anderen Anbieters | abgelehnt bzw. ohne Mandant bzw. ohne verifizierte Anrufernummer | vorhanden (inkl. Retell/Vapi-Rückgriff, Commit `0e0efc5`) |
| T-SEC-21 | Sensible Aktion mit Bestätigung älter als 15 min | `403 REAUTH_REQUIRED` | vorhanden für Zugangslink des Plattform-Admins (T-SEC-HTTP-06) und Kollegen-Reset (T-SEC-HTTP-14); übrige Aktionen offen |
| T-SEC-22 | Plattform-Admin ohne eingerichtete 2FA | `403 MFA_SETUP_REQUIRED` | vorhanden (T-SEC-HTTP-05) |
| T-SEC-29 | Kunden-Admin löst Reset-Link für anderen Admin aus | nur mit Re-Auth, Link nicht angezeigt | vorhanden (T-SEC-HTTP-14; Lücke behoben in `0e0efc5`) |

Die konkreten Testnamen stehen in `19-tests.md`.
