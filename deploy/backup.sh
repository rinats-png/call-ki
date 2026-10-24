#!/bin/sh
# Zeitplan des Backup-Dienstes (docker-compose: "backup"):
#  - täglich ca. 02:00 Uhr: Backup (deploy/backup-once.sh)
#  - am 1. jedes Monats ca. 04:00 Uhr: Wiederherstellungstest (deploy/restore-test.sh)
set -u
last_backup=""
last_test=""
while true; do
  hour=$(date +%H); today=$(date +%Y%m%d)
  if [ "$hour" = "02" ] && [ "$today" != "$last_backup" ]; then
    sh /deploy/backup-once.sh
    last_backup=$today
  fi
  if [ "$(date +%d)" = "01" ] && [ "$hour" = "04" ] && [ "$today" != "$last_test" ]; then
    sh /deploy/restore-test.sh
    last_test=$today
  fi
  sleep 300
done
