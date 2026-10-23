#!/bin/sh
# Tägliches pg_dump um ca. 02:00 Uhr (Container-Zeit), Aufbewahrung 14 Tage.
set -eu
while true; do
  if [ "$(date +%H)" = "02" ]; then
    f="/backups/callki-$(date +%Y%m%d-%H%M).sql.gz"
    pg_dump -h db -U callki -d callki | gzip > "$f.tmp" && mv "$f.tmp" "$f" && echo "Backup: $f"
    find /backups -name 'callki-*.sql.gz' -mtime +14 -delete
    sleep 3600
  fi
  sleep 600
done
