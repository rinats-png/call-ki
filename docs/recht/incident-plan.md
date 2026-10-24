# Notfall- und Datenpannen-Plan

> Arbeitshilfe nach `idea-to-app/templates/incident-plan.md`, **keine Rechtsberatung**. **Ausdrucken oder offline speichern.** Stand: 2026-10-23 · Verantwortlich: `<Name>` · Nächste Übung: `<Datum>`

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
3. `TWILIO_AUTH_TOKEN`, `RETELL_API_KEY`, `MS_CLIENT_SECRET`, SMTP-Passwort: beim Anbieter widerrufen und neu erzeugen.
4. `APP_ENCRYPTION_KEY`: **nur** bei Verdacht auf Abfluss – dann werden alle 2FA-Einrichtungen ungültig; Nutzer müssen 2FA neu einrichten (`totpSecretEnc`/`totpEnabledAt` leeren).
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
