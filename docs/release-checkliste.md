# Release-Checkliste – KI-Telefonzentrale

> Nach `idea-to-app/templates/release-checkliste.md`, angepasst an den Betrieb mit `docker-compose.yml` auf dem IONOS-VPS (`/opt/call-ki`, Benutzer `betrieb`). Hintergrund: `docs/betrieb.md`. Stand: 2026-10-24.
> **Für jedes Release kopieren** nach `docs/releases/<version>.md` und abhaken. Nicht Zutreffendes nicht löschen, sondern „entfällt – Grund“ eintragen. Ein Haken zählt nur mit Nachweis (Link zum CI-Lauf, Befehlsausgabe, Datum/Uhrzeit, Anruf-ID).
> **Verbindlichkeit:** Pflicht bei jedem Release in Produktion, auch bei kleinen Änderungen (Kurzfassung A3–A6, B, C1–C4 erlaubt, wenn keine Migration, keine neue Abhängigkeit und keine Rechte-Änderung enthalten ist).

**Version / Tag:** `vJJJJ.MM.TT-n` (z. B. `v2026.10.24-1`) · **Commit:** `<sha>` · **Datum/Uhrzeit (UTC + Berlin):** `<…>`
**Verantwortlich:** `<Name>` · **Zweite Person erreichbar:** `<Name/Telefon>`
**Art:** ☐ normales Release ☐ Hotfix ☐ enthält Datenbank-Migration (`prisma/migrations/`) ☐ neue Abhängigkeiten ☐ Rechte/Zugriff geändert ☐ Sprach-KI-Prompt/Tools (`voice-agent/`) geändert

**Release-Fenster:** werktags 09–16 Uhr Berlin, nicht vor Wochenenden/Feiertagen, nicht während bekannter Störungen bei Twilio oder dem KI-Anbieter. Anrufe laufen während des Neustarts (≈ 30–60 s) über das Twilio-Ersatzziel (TwiML Bin, `docs/betrieb.md`) – das ist der Grund, warum es vor dem Release geprüft sein muss.

## A. Vorher

- [ ] **A1** Änderungen beschrieben (Commit-Liste `git log --oneline <letzter-tag>..HEAD`, für Kunden relevante Punkte als Kurztext) – Nachweis: …
- [ ] **A2** CI auf dem Release-Commit grün: Lint, Typprüfung, Tests inkl. Postgres-Integration, `npm audit` (Schwelle laut `docs/sicherheit.md`, E-003), gitleaks, Docker-Build – Link zum Lauf: …
- [ ] **A3** Lokal bzw. in der Testumgebung durchgeklickt: Anmeldung mit 2FA, Anrufliste, ein Vorgang, Einstellungen speichern – Nachweis: …
- [ ] **A4** Migration vorhanden? Wenn ja: **rückwärtskompatibel** (expand: nur hinzufügen; Löschen/Umbenennen von Spalten erst in einem späteren Release, contract). Grund: Ein Rollback auf das alte Image muss mit dem neuen Schema laufen. – Nachweis: Migrationsdatei geprüft
- [ ] **A5** Neue Umgebungsvariablen in `.env.example` und auf dem Server in `.env` eingetragen (Test `tests/env-example.test.ts` grün) – Nachweis: …
- [ ] **A6** Sprach-KI betroffen (Prompt, `voice-agent/tools.json`, Tool-Schemas)? Dann Agent beim Anbieter **gleichzeitig** aktualisieren und Testanruf in C einplanen.
- [ ] **A7** Twilio-Ersatzziel aktiv (Überwachung meldet keine „Rufnummern … unvollständig“-Warnung in den letzten 24 h) – Nachweis: Verwaltung → Plattform → Überwachung
- [ ] **A8** Rollback-Ziel notiert: vorheriger Tag `<…>` / Commit `<…>`

## B. Durchführung (auf dem Server)

`deploy/deploy.sh` erledigt B1–B4 in einem Lauf: merkt die laufende Version (`deploy/.previous-version`), legt das Backup vor der Migration an (bricht ohne `ok=1` ab), baut das Image `callki-app:<commit>`, setzt `APP_VERSION` in der `.env`, startet die App, wartet auf `/api/health` und geht bei einem fehlgeschlagenen Smoke-Test automatisch auf die vorherige Version zurück.

```bash
cd /opt/call-ki
bash deploy/deploy.sh v2026.10.24-1      # nur getaggte Commits ausliefern
docker compose logs --since 5m app       # Migration ohne Fehler, "ready"
```

- [ ] **B1** Vorherige Version notiert (`cat deploy/.previous-version`): …
- [ ] **B2** Backup vor Migration erfolgreich (Ausgabe des Skripts `ok=1`, Dateiname): …
- [ ] **B3** Ausgelieferter Stand = geplanter Tag (`grep APP_VERSION .env`, `git describe --tags`): …
- [ ] **B4** Skript endet ohne automatischen Rückweg; Container `app` „healthy“ (`docker compose ps`): …
- [ ] **B5** `cron` und `backup` laufen weiter (`docker compose ps`); bei Änderungen an `deploy/` auch diese Dienste neu starten.

Tags anlegen (lokal, vor dem Release): `git tag -a v2026.10.24-1 -m "Release …" && git push origin v2026.10.24-1`.

## C. Smoke-Test (direkt danach, in Produktion)

- [ ] **C1** `curl -fsS https://DOMAIN/api/health` → `{"ok":true,"db":"up",…}` – Ausgabe: …
- [ ] **C2** Anmeldung als Plattform-Admin mit 2FA, Verwaltung öffnet, Plattform → Überwachung ohne neue kritische Befunde – Uhrzeit: …
- [ ] **C3** **Testanruf** auf die Test-Rufnummer (eigener Test-Mandant, nie eine Kundennummer): KI-Begrüßung mit KI-Hinweis, ein Anliegen aufnehmen, auflegen. Danach in der Anrufliste: Status `ENDED`, Dauer laut Twilio gesetzt, Vorgang angelegt, Bestätigungs-E-Mail im Nachrichtenprotokoll `SENT` – Anruf-ID: …
- [ ] **C4** Bei Änderungen an Terminen/Kalender: Testtermin buchen und wieder absagen (interner Kalender und, falls betroffen, Google/Microsoft-Testkonto) – Nachweis: …
- [ ] **C5** Bei Änderungen an Notfall-Logik: Notfall-Testanruf mit Stichwort, Notfall-SMS/E-Mail an die Test-Bereitschaft zugestellt – Nachweis: …
- [ ] **C6** Cron läuft: im Log von `cron` keine „fehlgeschlagen“-Zeilen nach dem Neustart (`docker compose logs --since 10m cron`).

**Rollback-Kriterium (vorab festgelegt):** sofort zurückrollen, wenn C1 oder C3 fehlschlägt, wenn Anrufe nicht mehr bei der KI ankommen, wenn Migrationsfehler im Log stehen oder wenn in den ersten 60 Minuten ein kritischer Alarm kommt, der vorher nicht da war. **Entscheidet:** die verantwortliche Person; nicht erst „schnell reparieren“.

## D. Rollback

**Fall 1 – Release ohne Migration oder mit rückwärtskompatibler Migration (Normalfall):**
```bash
cd /opt/call-ki
bash deploy/deploy.sh --rollback        # startet das vorherige Image (liegt lokal, kein Neubau)
curl -fsS https://DOMAIN/api/health
```
Ist das vorherige Image nicht mehr vorhanden (das Skript behält die letzten 5): `bash deploy/deploy.sh <vorheriger-tag>` baut es neu (dauert länger, das Ersatzziel bei Twilio übernimmt solange).

**Fall 2 – Migration war nicht rückwärtskompatibel und das alte Image läuft nicht:**
1. `docker compose stop app cron`
2. Backup aus B2 einspielen (Anleitung `docs/betrieb.md` → „Wiederherstellen“; derselbe `APP_ENCRYPTION_KEY`).
3. Altes Image starten wie Fall 1.
4. Danach `POST /api/cron/retention` ausführen und Löschungen seit dem Backup erneut anwenden (`docs/recht/loeschkonzept.md` Abschnitt 2). Daten, die zwischen Backup und Rollback entstanden sind (Anrufe, Vorgänge), sind verloren → betroffene Kunden informieren, Twilio-Anrufliste als Abgleich nutzen.

- [ ] **D1** Rollback nötig? ☐ nein ☐ ja, Grund: … · Uhrzeit: … · Smoke-Test C1/C3 danach ok: …
- [ ] **D2** Bei Sprach-KI-Änderung auch den Agenten beim Anbieter auf die vorherige Version zurücksetzen.

**Rollback geübt am:** `<Datum>` (Pflicht einmal vor dem Launch, auf einem Testserver oder in einem Wartungsfenster).

## E. Nachher

- [ ] **E1** 60 Minuten beobachten: Überwachung, `docker compose logs app`, Anrufliste (Anrufe enden normal, keine hängenden `IN_PROGRESS`).
- [ ] **E2** Nach 24 h: Backup-Lauf der Nacht erfolgreich, keine neuen Warnungen.
- [ ] **E3** Alte Rollback-Images aufräumen, die letzten **zwei** behalten (`docker image ls call-ki-app`).
- [ ] **E4** Release in `docs/releases/<version>.md` abgelegt; bei kundenrelevanten Änderungen Info an die Kunden (Textbaustein im Support-Playbook).

## F. Hotfix (Sicherheit oder schwerer Fehler)

Verkürzt erlaubt: A2 (CI grün ist Pflicht), B1, B2 bei Migration, B3–B4, C1, C3. Nachträglich innerhalb von 2 Werktagen die übrigen Punkte und ggf. ein Postmortem (`docs/recht/incident-plan.md`).

## G. Freigabe

| Rolle | Name | Datum/Uhrzeit | Ergebnis |
|---|---|---|---|
| Verantwortlich | | | ☐ veröffentlicht ☐ zurückgerollt |

## Was noch fehlt (OP-20-07)

- Image-Registry mit Versions-Tags (z. B. GitHub Container Registry, Build in der CI) statt Bauen auf dem Produktionsserver; dann Rollback per `image: …:<tag>` in `docker-compose.yml`.
- Staging-Server mit eigener Datenbank, eigenen Schlüsseln und eigener Test-Rufnummer.
- Automatischer Smoke-Test (Skript für C1 + C2) nach `docker compose up`.
