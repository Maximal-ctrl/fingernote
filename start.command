#!/usr/bin/env sh
# Fingernote starten (macOS/Linux). Braucht nur Node.js, keine Installation von Paketen.
cd "$(dirname "$0")" || exit 1
echo ""
echo "  Fingernote wird gestartet ..."
echo ""
if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js wurde nicht gefunden. Bitte Node.js 22 LTS installieren: https://nodejs.org"
  printf "  Enter druecken zum Schliessen ... "; read -r _
  exit 1
fi
if [ ! -f dist/index.html ]; then
  echo "  Der Ordner dist fehlt. Bitte das ZIP zuerst vollstaendig entpacken."
  printf "  Enter druecken zum Schliessen ... "; read -r _
  exit 1
fi
node serve.mjs || { printf "\n  Enter druecken zum Schliessen ... "; read -r _; }
