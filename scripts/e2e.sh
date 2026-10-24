#!/usr/bin/env bash
# HTTP- und Browser-Tests (tests/e2e) gegen einen echten Produktions-Build.
#   TEST_DATABASE_URL=postgresql://… bash scripts/e2e.sh
# Die Datenbank wird geleert und mit Testdaten gefüllt – nie gegen Produktion laufen lassen!
# E2E_SKIP_BUILD=1 nutzt einen vorhandenen Build (.next).
set -euo pipefail
: "${TEST_DATABASE_URL:?TEST_DATABASE_URL fehlt (eigene Test-Datenbank)}"
PORT=${E2E_PORT:-3100}
export DATABASE_URL="$TEST_DATABASE_URL"
export APP_ENCRYPTION_KEY="${APP_ENCRYPTION_KEY:-$(printf '%064d' 7)}"
export COOKIE_SECURE=false PWNED_CHECK=false REQUIRE_PLATFORM_ADMIN_2FA=true
export CRON_SECRET=e2e-cron-secret-0123456789 VOICE_TOOL_SECRET_SIP=e2e-tool-secret-0123456789 TWILIO_AUTH_TOKEN=e2e-twilio-token-0123456789
npx prisma migrate deploy >/dev/null
if [ "${E2E_SKIP_BUILD:-}" != "1" ] || [ ! -d .next ]; then npm run build >/dev/null; fi
if curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
  echo "Port $PORT ist schon belegt – alten Server beenden (sonst wird gegen einen alten Build getestet)"
  exit 1
fi
NODE_ENV=production node node_modules/next/dist/bin/next start -p "$PORT" > "${E2E_LOG:-/tmp/e2e-server.log}" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null; pkill -P $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1 && break; sleep 1; done
E2E_BASE_URL="http://localhost:$PORT" npx vitest run tests/e2e --no-file-parallelism
