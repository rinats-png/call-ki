# Notfall- und Datenpannen-Plan

> Arbeitshilfe nach `idea-to-app/templates/incident-plan.md`, **keine Rechtsberatung**. **Ausdrucken oder offline speichern.** Stand: 2026-10-24 (Schlüsselrotation korrigiert, Anbieter ergänzt) · Verantwortlich: `<Name>` · Nächste Übung: `<Datum>`

## 1. Rollen und Kontakte

| Rolle | Person | Erreichbar |
|---|---|---|
| Incident-Leitung (entscheidet, dokumentiert) | `<…>` | `<Telefon>` |
| Technik | `<…>` | `<…>` |
| Datenschutz (berät zur Meldung) | `<DSB / Kanzlei>` | `<…>` |
| Vertretung | `<…>` | `<…>` |

| Dienst | Notfallweg |
|---|---|
| IONOS | Kundenportal / Support `<Nummer>` |
| Twilio | Konsole → Support; Schlüssel rotieren: Console → API Keys |
| Retell | Dashboard → API Keys; Support `<E-Mail>` |
| Vapi | Dashboard → API Keys; Support `<E-Mail>` |
| ElevenLabs | Einstellungen → API Keys, Webhook-Geheimnis; Support `<E-Mail>` |
| Google Cloud (OAuth-App) | Console → APIs & Services → Credentials (Client-Secret erneuern) |
| Microsoft Entra (App-Registrierung) | Entra Admin Center → App-Registrierungen → Zertifikate & Geheimnisse |
| S3-Backup-Speicher (IONOS Object Storage) | Cloud Panel → Object Storage → Zugangsschlüssel |
| Domain/DNS | `<Registrar>` |
| Aufsichtsbehörde Betreiber | `<Landesbehörde am Sitz des Betreibers>` – Online-Meldeformular `<URL>` |

## 2. Ablauf

| Schritt | Was | Zeit |
|---|---|---|
| 1. Erkennen | Meldung (Alarm, Kunde, Anbieter, Forscher) → Ticket anlegen, **Zeitpunkt der Kenntnis notieren** (startet Fristen) | sofort |
| 2. Eindämmen | je nach Lage: App stoppen (`docker compose stop app`) – „Primary handler fails“ ist je Nummer eine TwiML Bin bei Twilio (Weiterleitung auf die Fallback-Nummer des Kunden), die Anrufannahme bleibt also auch bei gestoppter App erhalten – die Überwachung prüft das stündlich. Wer keine Fallback-Nummer hat, hört eine Störungsansage; Konto sperren (`disabled`), Sitzungen löschen, Schlüssel rotieren (Abschnitt 3) | < 1 h |
| 3. Beweise sichern | Logs (`docker compose logs > …`), Audit-Log-Auszug, DB-Snapshot **vor** Bereinigung | < 2 h |
| 4. Bewerten | Welche Mandanten, welche Daten, wie viele Betroffene, Risiko (Abschnitt 4) | < 12 h |
| 5. Kunden informieren (wir = Auftragsverarbeiter) | betroffene Kunden **unverzüglich, spätestens 24 h** (AVV § 6) mit Art.-33-Abs.-3-Angaben, soweit bekannt; Nachträge laufend | < 24 h |
| 6. Behörde (nur eigene Daten, z. B. Portal-Konten) | Meldung nach Art. 33 binnen **72 h**, außer voraussichtlich kein Risiko (Begründung dokumentieren) | < 72 h |
| 7. Betroffene | bei hohem Risiko (Art. 34) – für Anrufer entscheidet der Kunde; wir liefern Textvorschlag | nach Bewertung |
| 8. Beheben & wiederherstellen | Ursache beseitigen, ggf. Backup (danach Löschungen erneut anwenden, `loeschkonzept.md` 2) | |
| 9. Nachbereiten | schuldfreie Auswertung, Maßnahmen ins Backlog, Plan aktualisieren | < 14 Tage |

> Für Daten der **Anrufer** ist der **Kunde** verantwortlich und meldet selbst an seine Behörde. Wir melden **an den Kunden**, nicht an dessen Behörde.

## 3. Geheimnisse rotieren (Reihenfolge)

1. `SESSION`: alle Sitzungen löschen (`DELETE FROM "Session";`) – alle Nutzer werden abgemeldet.
2. `CRON_SECRET`, `SETUP_TOKEN` und das Webhook-Geheimnis des betroffenen Sprach-KI-Anbieters (`VOICE_TOOL_SECRET_RETELL` / `_VAPI` / `_ELEVENLABS` / `_SIP`): neu erzeugen (`openssl rand -hex 32`, oder in der Oberfläche „Erzeugen“), Neustart; das neue Geheimnis beim Anbieter in den Tools bzw. der Server-URL eintragen. Die Geheimnisse der anderen Anbieter bleiben gültig.
3. `TWILIO_AUTH_TOKEN`, `RETELL_API_KEY`, `VAPI_API_KEY`, `ELEVENLABS_API_KEY` (+ `ELEVENLABS_WEBHOOK_SECRET`), `MS_CLIENT_SECRET`, `GOOGLE_CLIENT_SECRET`, SMTP-Passwort, `BACKUP_S3_SECRET_KEY`: beim Anbieter widerrufen und neu erzeugen; neuen Wert in `.env` **oder** in Verwaltung → Plattform eintragen (dort gespeicherte Werte überschreiben die `.env`).
4. `APP_ENCRYPTION_KEY`: Der Schlüssel verschlüsselt **drei** Arten von Geheimnissen in der Datenbank: (a) 2FA-Geheimnisse der Portal-Nutzer (`User.totpSecretEnc`), (b) die in der Oberfläche gespeicherten **Anbieter-Schlüssel** (`PlatformSetting` mit `secret = true`, z. B. Twilio-Token, Retell-/Vapi-/ElevenLabs-Schlüssel, SMTP-Passwort, Microsoft-/Google-Client-Secret) und (c) die **Google-Refresh-Tokens** der Kunden-Kalender (`Integration.secretEnc`).
   - **Geordneter Wechsel** (z. B. Person mit Zugriff verlässt das Team, kein Verdacht auf Abfluss der Datenbank): Verfahren „Schlüsselwechsel“ in `docs/betrieb.md` – neuer Schlüssel in `APP_ENCRYPTION_KEY`, alter in `APP_ENCRYPTION_KEYS_OLD`, `/api/cron/rekey` bis `remaining: 0`, dann alten Schlüssel entfernen. Kein Nutzer verliert 2FA, keine Verbindung bricht ab. Alten Schlüssel im Tresor behalten, solange Backups von vor dem Wechsel existieren (30 Tage).
   - **Verdacht, dass Schlüssel und Datenbank (oder ein Backup samt Schlüssel) abgeflossen sind:** Umschlüsseln allein genügt nicht, weil die Klartexte bereits als bekannt gelten müssen. Zusätzlich: alle unter (b) gespeicherten Anbieter-Schlüssel beim Anbieter widerrufen und neu eintragen (Schritt 3); alle Google-Verbindungen trennen und die Kunden um Neuverbindung bitten (beim Trennen widerruft die Plattform den Refresh-Token per `oauth2.googleapis.com/revoke`, `src/lib/google.ts`; schlägt das fehl, widerruft der Kunde den Zugriff selbst in seinem Google-Konto); 2FA aller Nutzer zurücksetzen (`totpSecretEnc`/`totpEnabledAt` leeren, `recoveryCodes` leeren) – Nutzer richten 2FA neu ein.
   - **Schlüssel verloren** (kein Abfluss, aber kein Wert mehr vorhanden): Die verschlüsselten Werte sind unlesbar. Folgen: 2FA aller Nutzer neu einrichten, alle Anbieter-Schlüssel aus der Oberfläche neu eintragen (sonst fallen Telefonie, Sprach-KI, E-Mail aus, soweit sie nicht zusätzlich in der `.env` stehen), alle Google-Kalender neu verbinden. Deshalb Schlüssel immer im Tresor (`docs/betreiber-konten.md`).
5. `POSTGRES_PASSWORD`: im Container ändern (`ALTER USER`) und `.env`.

## 4. Bewertungshilfe

| Frage | Hinweis |
|---|---|
| Vertraulichkeit, Integrität oder Verfügbarkeit verletzt? | Auch ein längerer Ausfall ohne Datenabfluss kann eine Datenpanne sein (Verfügbarkeit). |
| Inhaltsdaten (Transkripte, Aufnahmen, Gesundheitsangaben) betroffen? | erhöht das Risiko deutlich |
| Mehrere Mandanten betroffen? | jeden Kunden einzeln informieren |
| Daten verschlüsselt und Schlüssel sicher? | senkt das Risiko |

## 5. Protokoll (je Vorfall)

| Zeit | Wer | Was / Entscheidung | Begründung |
|---|---|---|---|
| | | | |

## 6. Übungen

| Datum | Szenario | Ergebnis |
|---|---|---|
| `<…>` | z. B. Retell-API-Key in Log gefunden | |
