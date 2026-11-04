#!/usr/bin/env sh
# Fingernote starten (macOS/Linux): installiert beim ersten Mal, baut und öffnet http://localhost:5173
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then echo "Bitte zuerst Node.js 22 (LTS) oder neuer installieren: https://nodejs.org"; exit 1; fi
[ -d node_modules ] || npm install
npm start
