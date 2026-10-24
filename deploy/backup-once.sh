#!/bin/sh
# Ein Backup-Lauf: pg_dump → mit age verschlüsseln → lokal ablegen → extern kopieren (S3 per rclone)
# → Lebenszeichen an die App. Ohne Verschlüsselung oder ohne externe Kopie gilt der Lauf als
# fehlgeschlagen (die Überwachung alarmiert), der lokale Dump bleibt trotzdem erhalten.
#
# Umgebung: PGHOST, PGUSER, PGDATABASE, PGPASSWORD · BACKUP_DIR (/backups) · BACKUP_KEEP_DAYS (14)
#           BACKUP_AGE_RECIPIENT (öffentlicher age-Schlüssel) · BACKUP_S3_BUCKET + RCLONE_CONFIG_REMOTE_*
#           BACKUP_REMOTE_KEEP_DAYS (30) · APP_URL (http://app:3000) · CRON_SECRET
set -u
DIR=${BACKUP_DIR:-/backups}
KEEP=${BACKUP_KEEP_DAYS:-14}
stamp=$(date +%Y%m%d-%H%M)
raw="$DIR/.callki-$stamp.raw"
tmp=""

report() {
  echo "$(date -Iseconds) backup ok=$1 $2"
  [ -n "${CRON_SECRET:-}" ] || return 0
  note=$(printf '%s' "$2" | sed 's/%/%25/g; s/ /%20/g; s/&/%26/g')
  wget -q -O /dev/null --header "Authorization: Bearer $CRON_SECRET" --post-data "" \
    "${APP_URL:-http://app:3000}/api/cron/heartbeat?job=backup&ok=$1&note=$note" || echo "Lebenszeichen an die App nicht gesendet"
}
fail() { rm -f "$raw" ${tmp:+"$tmp"}; report 0 "$1"; exit 1; }

mkdir -p "$DIR"
pg_dump -Fc -f "$raw" || fail "pg_dump fehlgeschlagen"
[ -s "$raw" ] || fail "Dump ist leer"

if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
  out="$DIR/callki-$stamp.dump.age"; tmp="$out.tmp"
  age -r "$BACKUP_AGE_RECIPIENT" -o "$tmp" "$raw" || fail "Verschlüsselung fehlgeschlagen"
  rm -f "$raw"
else
  out="$DIR/callki-$stamp.dump"; tmp="$out.tmp"
  mv "$raw" "$tmp"
fi
mv "$tmp" "$out"; tmp=""
chmod 600 "$out"
find "$DIR" -maxdepth 1 -name 'callki-*.dump*' -mtime +"$KEEP" -delete
size=$(du -k "$out" | cut -f1)

[ -n "${BACKUP_AGE_RECIPIENT:-}" ] || { report 0 "unverschlüsselt und nur lokal – BACKUP_AGE_RECIPIENT fehlt"; exit 1; }
[ -n "${BACKUP_S3_BUCKET:-}" ] || { report 0 "nur lokal gesichert – BACKUP_S3_BUCKET fehlt"; exit 1; }

remote="remote:$BACKUP_S3_BUCKET/callki"
rclone copyto "$out" "$remote/$(basename "$out")" || { report 0 "Upload nach S3 fehlgeschlagen"; exit 1; }
rclone delete "$remote" --min-age "${BACKUP_REMOTE_KEEP_DAYS:-30}d" --include 'callki-*' || echo "Alte externe Backups nicht gelöscht"
report 1 "$(basename "$out") ${size} KB verschlüsselt, extern gesichert"
