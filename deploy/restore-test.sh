#!/bin/sh
# Wiederherstellungstest: spielt das neueste Backup in eine Wegwerf-Datenbank ein, prüft den
# Inhalt und löscht sie wieder. Meldet das Ergebnis an die App (Überwachung).
# Läuft monatlich automatisch (deploy/backup.sh) – oder von Hand:
#   docker compose exec backup sh /deploy/restore-test.sh
# Umgebung wie backup-once.sh, zusätzlich BACKUP_AGE_IDENTITY (privater age-Schlüssel, Datei).
set -u
export PGOPTIONS="-c client_min_messages=warning"
DIR=${BACKUP_DIR:-/backups}
TESTDB=${RESTORE_TEST_DB:-callki_restoretest}
raw="$DIR/.restore-test.raw"

report() {
  echo "$(date -Iseconds) restore-test ok=$1 $2"
  [ -n "${CRON_SECRET:-}" ] || return 0
  note=$(printf '%s' "$2" | sed 's/%/%25/g; s/ /%20/g; s/&/%26/g')
  wget -q -O /dev/null --header "Authorization: Bearer $CRON_SECRET" --post-data "" \
    "${APP_URL:-http://app:3000}/api/cron/heartbeat?job=restore-test&ok=$1&note=$note" || echo "Lebenszeichen an die App nicht gesendet"
}
cleanup() { rm -f "$raw"; psql -q -d postgres -c "DROP DATABASE IF EXISTS \"$TESTDB\"" >/dev/null 2>&1; }
fail() { cleanup; report 0 "$1"; exit 1; }

latest=$(ls -t "$DIR"/callki-*.dump "$DIR"/callki-*.dump.age 2>/dev/null | head -1)
[ -n "$latest" ] || fail "kein Backup gefunden"
case "$latest" in
  *.age)
    [ -r "${BACKUP_AGE_IDENTITY:-}" ] || fail "privater Schlüssel fehlt (BACKUP_AGE_IDENTITY)"
    age -d -i "$BACKUP_AGE_IDENTITY" -o "$raw" "$latest" || fail "Entschlüsselung fehlgeschlagen" ;;
  *) cp "$latest" "$raw" ;;
esac

cleanup_db() { psql -q -d postgres -c "DROP DATABASE IF EXISTS \"$TESTDB\"" >/dev/null; }
cleanup_db || fail "Testdatenbank nicht löschbar"
psql -q -d postgres -c "CREATE DATABASE \"$TESTDB\"" >/dev/null || fail "Testdatenbank nicht anlegbar"
pg_restore --no-owner --no-privileges -d "$TESTDB" "$raw" || fail "pg_restore fehlgeschlagen"

migrations=$(psql -tA -d "$TESTDB" -c 'SELECT count(*) FROM "_prisma_migrations"' 2>/dev/null)
tenants=$(psql -tA -d "$TESTDB" -c 'SELECT count(*) FROM "Tenant"' 2>/dev/null)
calls=$(psql -tA -d "$TESTDB" -c 'SELECT count(*) FROM "Call"' 2>/dev/null)
[ "${migrations:-0}" -gt 0 ] 2>/dev/null || fail "Wiederhergestellte Datenbank unvollständig (keine Migrationen)"
cleanup
report 1 "$(basename "$latest"): $tenants Kunden, $calls Anrufe wiederhergestellt"
