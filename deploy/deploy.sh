#!/usr/bin/env bash
# Auslieferung auf dem Produktionsserver mit Versions-Tag, Backup vor der Migration,
# Smoke-Test und automatischem Rückweg.
#
#   bash deploy/deploy.sh                 # neuesten Stand des Standard-Branches ausliefern (DEPLOY_REF überschreibt)
#   bash deploy/deploy.sh <commit|tag>    # bestimmten Stand ausliefern
#   bash deploy/deploy.sh --rollback      # zur vorherigen Version zurück (Image liegt noch lokal)
#
# Jede Version wird als Image callki-app:<commit> gebaut; die laufende steht als APP_VERSION in
# der .env, die vorherige in deploy/.previous-version. Migrationen laufen beim Start der App –
# sie sind nur vorwärts gerichtet. Ist eine neue Migration nicht rückwärtskompatibel, gehört
# zum Rückweg das Backup, das dieses Skript vor dem Update anlegt (docs/betrieb.md → Backups).
set -euo pipefail
cd "$(dirname "$0")/.."
PREV_FILE=deploy/.previous-version
current() { grep -E '^APP_VERSION=' .env 2>/dev/null | cut -d= -f2 || true; }
set_version() {
  if grep -qE '^APP_VERSION=' .env; then sed -i "s/^APP_VERSION=.*/APP_VERSION=$1/" .env; else echo "APP_VERSION=$1" >> .env; fi
}
smoke() {
  for _ in $(seq 1 60); do
    if docker compose exec -T app wget -qO- http://127.0.0.1:3000/api/health 2>/dev/null | grep -q '"ok":true'; then return 0; fi
    sleep 2
  done
  return 1
}
start() {
  set_version "$1"
  APP_VERSION="$1" docker compose up -d app
  smoke
}

if [ "${1:-}" = "--rollback" ]; then
  prev=$(cat "$PREV_FILE" 2>/dev/null || true)
  [ -n "$prev" ] || { echo "Keine vorherige Version bekannt ($PREV_FILE)"; exit 1; }
  docker image inspect "callki-app:$prev" >/dev/null || { echo "Image callki-app:$prev nicht mehr vorhanden"; exit 1; }
  echo "Rückweg auf $prev …"
  git checkout -q "$prev"
  start "$prev" && echo "Version $prev läuft." || { echo "Rückweg fehlgeschlagen – Logs: docker compose logs app"; exit 1; }
  exit 0
fi

was=$(current)
git fetch -q origin
# Ohne Angabe: Standard-Branch des Repositorys (origin/HEAD) bzw. DEPLOY_REF
target=$(git rev-parse --short=12 "${1:-${DEPLOY_REF:-origin/HEAD}}")
[ "$target" != "$was" ] || { echo "Version $target läuft bereits."; exit 0; }
echo "Ausliefern: ${was:-unbekannt} → $target"

echo "1/4 Backup vor dem Update …"
docker compose exec -T backup sh /deploy/backup-once.sh || { echo "Backup fehlgeschlagen – Abbruch (mit FORCE=1 trotzdem fortfahren)"; [ "${FORCE:-}" = "1" ] || exit 1; }

echo "2/4 Image bauen …"
git checkout -q "$target"
APP_VERSION="$target" docker compose build app

echo "3/4 Starten (Migrationen laufen beim Start) …"
[ -n "$was" ] && echo "$was" > "$PREV_FILE"
if start "$target"; then
  echo "4/4 Smoke-Test bestanden: /api/health ok. Version $target läuft."
  echo "Jetzt einen Testanruf machen (docs/testanrufe.md, Szenario 1 und 2)."
else
  echo "Smoke-Test fehlgeschlagen – automatischer Rückweg auf ${was:-?}"
  docker compose logs --tail 50 app || true
  if [ -n "$was" ]; then git checkout -q "$was"; start "$was" && echo "Version $was läuft wieder."; fi
  exit 1
fi
# Alte Images aufräumen (die letzten 5 Versionen bleiben)
docker images callki-app --format '{{.CreatedAt}}\t{{.Tag}}' | sort -r | tail -n +6 | cut -f2 | xargs -r -I{} docker rmi "callki-app:{}" >/dev/null 2>&1 || true
