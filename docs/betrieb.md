# Betriebshandbuch

Wie die Plattform in Produktion (IONOS-VPS, `docker-compose.yml`) betrieben, gesichert und überwacht wird. Ergänzt `README.md` (Installation) und `docs/sicherheit.md` (Sicherheitswerte).

## Dienste

| Dienst | Aufgabe |
|---|---|
| `app` | Next.js-Anwendung, wendet beim Start die Datenbank-Migrationen an |
| `db` | PostgreSQL 16, kein Port nach außen |
| `caddy` | HTTPS (Let's Encrypt), einziger Dienst mit offenen Ports (80/443) |
| `cron` | `deploy/cron.sh`: jede Minute Wiederholung fehlgeschlagener E-Mails/SMS, alle 5 Minuten Überwachung, täglich 03 Uhr Löschfristen |
| `backup` | `deploy/backup.sh`: täglich 02 Uhr Backup, am 1. des Monats 04 Uhr Wiederherstellungstest |

## Backups

Ein Backup ist erst dann ein Backup, wenn es **verschlüsselt außerhalb des Servers** liegt und sich **nachweislich wiederherstellen** lässt. Beides prüft die Überwachung: Fehlt eins davon, kommt ein kritischer Alarm.

### Einrichten (einmalig)

1. **Schlüsselpaar erzeugen** (auf dem Server, im Projektordner):
   ```bash
   mkdir -p secrets && chmod 700 secrets
   docker run --rm -v "$PWD/secrets:/s" alpine sh -c "apk add -q age && age-keygen -o /s/backup-age.key"
   chmod 600 secrets/backup-age.key
   grep 'public key' secrets/backup-age.key     # → age1…  in .env als BACKUP_AGE_RECIPIENT
   ```
2. **Privaten Schlüssel getrennt sichern:** Inhalt von `secrets/backup-age.key` in den Passwort-Manager bzw. Tresor der Firma – zusammen mit der kompletten `.env` (vor allem `APP_ENCRYPTION_KEY`: ohne ihn sind 2FA-Geheimnisse, Anbieter-Schlüssel und Kalender-Verbindungen aus einem Backup nicht mehr lesbar). Geht der Server verloren, sind die Backups ohne diese beiden Werte wertlos.
3. **Externen Speicher anlegen:** z. B. IONOS Cloud → Object Storage → Bucket (Region Deutschland), Zugangsschlüssel nur für diesen Bucket. In `.env`: `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY`. Wenn möglich Versionierung bzw. Object Lock aktivieren (Schutz gegen Löschen durch Angreifer).
4. `docker compose up -d backup` und ersten Lauf sofort prüfen:
   ```bash
   docker compose exec backup sh /deploy/backup-once.sh
   docker compose exec backup sh /deploy/restore-test.sh
   ```
   Beide müssen mit `ok=1` enden.

### Was automatisch passiert

- Täglich: `pg_dump` → mit age verschlüsselt → `./backups` (14 Tage) → Kopie in den Bucket (30 Tage) → Meldung an die App.
- Monatlich: das neueste Backup wird entschlüsselt, in eine Wegwerf-Datenbank eingespielt, auf Inhalt geprüft und wieder gelöscht → Meldung an die App.
- Ohne Verschlüsselungsschlüssel oder ohne Bucket bleibt der lokale Dump erhalten, der Lauf gilt aber als fehlgeschlagen (Alarm).

### Wiederherstellen (Ernstfall)

```bash
docker compose stop app cron
# 1) Backup holen (lokal oder aus dem Bucket) und entschlüsseln
age -d -i secrets/backup-age.key -o /tmp/callki.dump backups/callki-JJJJMMTT-HHMM.dump.age
# 2) Einspielen (ersetzt den aktuellen Stand!)
docker compose cp /tmp/callki.dump db:/tmp/callki.dump
docker compose exec db pg_restore --clean --if-exists --no-owner -U callki -d callki /tmp/callki.dump
docker compose exec db rm /tmp/callki.dump && rm /tmp/callki.dump
# 3) Starten – .env mit demselben APP_ENCRYPTION_KEY wie zum Zeitpunkt des Backups
docker compose up -d
```

Neuer Server: Installation laut README, `.env` und `secrets/backup-age.key` aus dem Tresor zurückkopieren, Backup aus dem Bucket laden, dann wie oben.

**Nachweis:** Jeden erfolgreichen Wiederherstellungstest (automatisch oder von Hand) mit Datum in der Launch-Checkliste bzw. im Betriebsprotokoll festhalten.

## Überwachung und Alarme

Alle 5 Minuten prüft `/api/cron/monitor`:

| Befund | Stufe |
|---|---|
| Notfall-Alarm nach allen Versuchen nicht zugestellt oder gar nicht versendbar (SMS/E-Mail nicht eingerichtet) | kritisch |
| Kein erfolgreiches Backup seit 26 Stunden, Backup oder Wiederherstellungstest fehlgeschlagen | kritisch |
| Speicherplatz unter 5 % | kritisch |
| Andere Nachrichten endgültig nicht zugestellt, ≥ 10 Fehlschläge pro Stunde | Warnung |
| Anrufe seit über 2 Stunden ohne Gesprächsende (fehlt Abrechnung und Löschung beim Anbieter) | Warnung |
| Wiederherstellungstest älter als 35 Tage, Speicherplatz unter 10 % | Warnung |

Alarme gehen an `ALERT_EMAIL` (sonst alle Plattform-Admins), kritische zusätzlich per SMS an `ALERT_SMS` und an `ALERT_WEBHOOK_URL`. Derselbe Befund wird höchstens stündlich (kritisch) bzw. alle 6 Stunden wiederholt. Einstellungen: Verwaltung → Plattform → „Überwachung & Alarme“.

**Serverausfall:** Fällt der ganze Server aus, kann er selbst nicht alarmieren. Deshalb zwingend:

1. Externer Lebenszeichen-Dienst (z. B. healthchecks.io): Check mit 5 Minuten Intervall und 10 Minuten Kulanz, Ping-URL als `HEALTHCHECK_PING_URL`. Bleibt der Ping aus, alarmiert der Dienst per E-Mail/SMS/App.
2. Uptime-Check von außen auf `https://DOMAIN/api/health` (z. B. UptimeRobot, Better Stack), Intervall 1–5 Minuten.

## Wiederholung von Nachrichten

E-Mails und SMS werden bei Fehlern bis zu 5-mal versucht: Notfall-Alarme nach 1, 2, 5 und 10 Minuten, alle anderen nach 2, 10, 30 und 120 Minuten. Der Status steht im Nachrichtenprotokoll (`Message.status`, `attempts`, `error`). Die Sprach-KI wartet nie auf den Versand.
