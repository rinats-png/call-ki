# Storm GmbH · KI-Telefonzentrale

Autonome KI-Telefonzentrale für die Schädlingsbekämpfung der Storm GmbH (https://storm.gmbh/).
Eingehende Anrufe laufen über **Twilio** zur Sprach-KI (**Retell AI** oder **Vapi**). Die KI unterscheidet Neu- und Bestandskunden, ermittelt per **Smart Routing** den passenden Techniker, legt über die **Microsoft Graph API** echte **Outlook-Termine und E-Mail-Entwürfe** an und spielt alles live in ein **Interactive Hub Dashboard (Dark Mode)**.

```
Anrufer ──▶ Twilio ──▶ /api/twilio/voice ──▶ Retell (SIP) / Vapi
                             │ Kundenerkennung (Dynamic Variables)
                             ▼
             Sprach-KI ──Function Calls──▶ /api/voice/tools/*
                                              │ identify_caller · save_customer
                                              │ find_technician (Routing + freie Slots aus Outlook)
                                              │ book_appointment (Ticket + Termin + E-Mail-Entwurf)
                                              │ escalate_emergency (Notdienst + Durchstellung)
                                              ▼
                              Prisma (SQLite/PostgreSQL) ◀──▶ Microsoft Graph
             Gesprächsende ──▶ /api/voice/events (Transkript + Zusammenfassung)
                                              ▼
                                   Hub-Dashboard (Live, 5 s)
```

## Schnellstart

```bash
npm install
cp .env.example .env          # Werte eintragen (siehe unten)
npm run setup                 # Datenbank anlegen + Mitarbeiter seeden
SEED_DEMO_DATA=true npm run db:seed   # optional: Demo-Tickets
npm run dev                   # http://localhost:3000
```

Ohne Microsoft-Zugangsdaten läuft der Graph-Client im **Dry-Run** (Termine/Entwürfe werden simuliert und im Hub als „Simuliert“ markiert). Lokal ohne Secrets sind die Webhooks offen. In Produktion (`NODE_ENV=production`) sind `DASHBOARD_PASSWORD` und `VOICE_TOOL_SECRET` bzw. `RETELL_API_KEY` Pflicht.

Für lokale Tests mit echten Anrufen: Tunnel (z. B. `ngrok http 3000`) starten und `PUBLIC_BASE_URL` auf die Tunnel-URL setzen.

## Integrationen einrichten

Alle Webhook-URLs zum Kopieren stehen auch im Hub unter **Setup**.

### 1. Twilio
| Feld (Phone Number → Voice) | URL |
|---|---|
| A call comes in (POST) | `{PUBLIC_BASE_URL}/api/twilio/voice` |
| Primary handler fails | `{PUBLIC_BASE_URL}/api/twilio/fallback` |

Jede Anfrage wird über `X-Twilio-Signature` geprüft (`TWILIO_AUTH_TOKEN`). Ist die KI nicht erreichbar, wird an `BACKOFFICE_FALLBACK_NUMBER` weitergeleitet, sonst nimmt eine Mailbox die Nachricht auf und legt ein Rückruf-Ticket mit Link zur Aufnahme an.

### 2. Sprach-KI
- **Retell AI** (`VOICE_PROVIDER=retell`): Agent anlegen, Prompt aus `voice-agent/system-prompt.md` übernehmen, Custom Functions aus `voice-agent/tools.json` anlegen (URL `…/api/voice/tools/{name}`, Header `x-tool-secret: VOICE_TOOL_SECRET`), Agent-Webhook auf `…/api/voice/events`. `RETELL_API_KEY` + `RETELL_AGENT_ID` setzen. Den eingebauten `transfer_call` für Notfälle aktivieren. Der Twilio-Webhook registriert jeden Anruf per `register-phone-call` und leitet ihn per SIP weiter. Die Kundendaten gehen als Dynamic Variables (`{{customer_status}}`, `{{customer_name}}` …) mit.
- **Vapi** (`VOICE_PROVIDER=vapi`): Twilio-Nummer in Vapi importieren, Server URL `…/api/voice/tools` bzw. `…/api/voice/events`, Server URL Secret = `VOICE_TOOL_SECRET`. Tools aus `voice-agent/tools.json` übernehmen.

### 3. Microsoft Graph (Outlook)
1. Entra ID → App-Registrierung → Client Secret erzeugen.
2. **Application Permissions**: `Calendars.ReadWrite`, `Mail.ReadWrite` → Admin Consent.
3. Zugriff per *Application Access Policy* / *RBAC for Applications* auf die Postfächer der Storm GmbH beschränken.
4. `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_DRAFT_MAILBOX` setzen.

Ablauf: Freie Slots kommen aus `calendarView` des Technikers (Geschäftszeiten Mo–Fr, konfigurierbar). Termine landen im Kalender des Technikers (idempotent über `transactionId`). Der E-Mail-Entwurf ist eine Kundenbestätigung (wenn eine E-Mail bekannt ist, Techniker in CC), sonst ein Briefing an den Techniker. Entwürfe werden **nicht automatisch versendet**, sondern vom Büro geprüft. Fehlgeschlagene Synchronisierungen lassen sich im Ticket-Detail erneut auslösen. Token-Caching sowie Retries bei 429/5xx sind eingebaut.

## Smart Routing
`src/lib/routing.ts`:
1. **Rolle bestimmen**: Notfall (CRITICAL) → `EMERGENCY_TECH`, HACCP/Hausverwaltung → `B2B_SPECIALIST`, HIGH → `EMERGENCY_TECH`, sonst `PEST_EXPERT`.
2. **Gebiet**: `servicePostalCodes` unterstützt exakte PLZ (`20095`), Präfixe (`20`), Bereiche (`20000-25999`) und `*`. Der genaueste Treffer gewinnt.
3. **Fallback-Kette**: passende Rolle im Gebiet → anderer Außendienst im Gebiet → passende Rolle überregional → Backoffice.
4. **Lastverteilung** über die Anzahl offener Tickets.

Die Dringlichkeit (`src/lib/urgency.ts`) kombiniert die KI-Einschätzung mit Regeln (Allergie, Kita/Klinik, Gastronomie/HACCP …). Es gilt immer die höhere Stufe. Den Routing-Simulator gibt es live im Hub.

## Hinweise zum Datenmodell
Das Prisma-Schema entspricht exakt der Vorgabe. Da `CallTicket` keine Call-ID hat, werden Transkripte nach Gesprächsende über die Rufnummer zugeordnet: Sie gehen an das jüngste Ticket des Anrufers der letzten 3 Stunden ohne Transkript. Gibt es keins, entsteht ein Rückruf-Ticket, damit kein Lead verloren geht.

Für PostgreSQL in `prisma/schema.prisma` `provider = "postgresql"` und `url = env("DATABASE_URL")` setzen.

**Vor dem Livebetrieb** die Beispiel-Mitarbeiter (Namen, UPNs, PLZ-Gebiete, Direktwahlen) unter **Team** durch die echten Daten ersetzen.

## Skripte
| Befehl | Zweck |
|---|---|
| `npm run dev` / `build` / `start` | Entwicklung / Produktion |
| `npm test` | Unit-Tests (Routing, PLZ, Dringlichkeit, Signaturen, Payloads, Zeitzonen/Slots) |
| `npm run typecheck` · `npm run lint` | Qualitätschecks |
| `npm run db:studio` | Daten im Browser bearbeiten |

## Sicherheit
- Dashboard & interne APIs: HTTP Basic Auth (`src/middleware.ts`)
- Twilio: HMAC-SHA1-Signaturprüfung · Retell: HMAC-SHA256 · Vapi/generisch: Shared Secret (Konstantzeit-Vergleich)
- Logs maskieren Rufnummern (DSGVO), strukturiertes JSON-Logging
- Health-Check: `GET /api/health`
