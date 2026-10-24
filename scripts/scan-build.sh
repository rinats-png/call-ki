#!/usr/bin/env bash
# Prüft den Frontend-Build (.next/static = was der Browser lädt) auf geheime Schlüssel (T-SEC-13).
#   1. Bekannte Schlüsselmuster (private Schlüssel, AWS, Twilio, Stripe/OpenAI-artige Tokens)
#   2. Kanarienwerte: in der CI wird mit erfundenen Werten für Server-Geheimnisse gebaut
#      (BUILD_CANARY=…); taucht einer im Browser-Code auf, wurde ein Geheimnis eingebettet.
set -euo pipefail
DIR=${1:-.next/static}
[ -d "$DIR" ] || { echo "Kein Build unter $DIR – zuerst npm run build"; exit 1; }
found=0
patterns='-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|SK[0-9a-f]{32}|sk_live_[0-9A-Za-z]{16,}|sk-[A-Za-z0-9_-]{32,}|xox[baprs]-[0-9A-Za-z-]{10,}'
if grep -rEl "$patterns" "$DIR" >/dev/null 2>&1; then
  echo "Schlüsselmuster im Browser-Code gefunden:"; grep -rEl "$patterns" "$DIR"; found=1
fi
if [ -n "${BUILD_CANARY:-}" ] && grep -rl "$BUILD_CANARY" "$DIR" >/dev/null 2>&1; then
  echo "Server-Geheimnis (Kanarienwert) im Browser-Code:"; grep -rl "$BUILD_CANARY" "$DIR"; found=1
fi
[ "$found" = 0 ] && echo "Build-Scan: keine Geheimnisse in $DIR"
exit "$found"
