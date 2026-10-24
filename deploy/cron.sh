#!/bin/sh
# Zeitgesteuerte Aufgaben der App (Dienst "cron" in docker-compose.yml):
#  - jede Minute:   fehlgeschlagene E-Mails/SMS erneut senden (/api/cron/notify)
#  - jede Minute:   Gespräche über der Höchstdauer beenden (/api/cron/calls)
#  - alle 5 Minuten: Überwachung und Alarme (/api/cron/monitor)
#  - alle 15 Minuten: Kontingent-Warnungen und Tagesbudget (/api/cron/usage), Terminerinnerungen (/api/cron/reminders)
#  - täglich 03 Uhr: Löschfristen und Aufräumen (/api/cron/retention)
set -u
call() {
  curl -fsS -m 55 -X POST -H "Authorization: Bearer $CRON_SECRET" "http://app:3000/api/cron/$1" >/dev/null \
    || echo "$(date -Iseconds) cron $1 fehlgeschlagen"
}
last_retention=""
while true; do
  call notify
  minute=$(date +%M | sed 's/^0//')
  call calls
  [ $((minute % 5)) -eq 0 ] && call monitor
  if [ $((minute % 15)) -eq 0 ]; then call usage; call reminders; fi
  today=$(date +%Y%m%d)
  if [ "$(date +%H)" = "03" ] && [ "$today" != "$last_retention" ]; then
    call retention
    last_retention=$today
  fi
  sleep 60
done
