#!/usr/bin/env sh
# Fingernote starten (macOS/Linux). Mit fertigem Build (ZIP) braucht es nur Node.js;
# nach einem git clone wird beim ersten Start einmal installiert und gebaut.
cd "$(dirname "$0")" || exit 1
pause_exit() { printf "\n  Enter druecken zum Schliessen ... "; read -r _; exit 1; }
echo ""
echo "  Fingernote wird gestartet ..."
echo ""
if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js wurde nicht gefunden. Bitte Node.js 22 LTS installieren: https://nodejs.org"
  pause_exit
fi
if [ ! -f dist/index.html ]; then
  if [ ! -f package.json ]; then
    echo "  Dateien fehlen. Bitte das ZIP zuerst vollstaendig entpacken."
    pause_exit
  fi
  echo "  Erster Start: Fingernote wird eingerichtet. Das dauert 1 bis 2 Minuten ..."
  [ -d node_modules ] || npm install --no-audit --no-fund || pause_exit
  npm run build:app || pause_exit
fi
node serve.mjs || pause_exit
