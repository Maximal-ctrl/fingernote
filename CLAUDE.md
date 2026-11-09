# FingerNote – Hinweise für Claude

## Versionsnummer (Pflicht bei jedem Update)
Die Version steht in `js/util.js` (`APP_VERSION`) und wird in den Einstellungen angezeigt.

- **Kleines Update** (Standard, wenn nichts anderes gesagt wird): zweistellige Nachkommazahl um 1 erhöhen,
  z. B. 1.0 → 1.01 → 1.02 → … → 1.09 → 1.10.
- **Großes Update** (nur wenn der Nutzer "großes Update" sagt): erste Zahl erhöhen und hinten zurücksetzen,
  z. B. 1.07 → 2.0, danach 2.01, 2.02 …
- Bei jedem Update zusätzlich `VERSION` in `sw.js` ändern (z. B. `fingernote-v1.01`), damit Geräte die neue Version laden.
- Neue Dateien in die `FILES`-Liste in `sw.js` aufnehmen.
- Nach dem Update in der Antwort die neue Versionsnummer nennen.

## Sonstiges
- Sprache in der App und in Antworten: Deutsch.
- Eigenständiges Werk – keine Namen, Logos oder Grafiken von GoodNotes, OneNote o. Ä.
- Kein Build-Schritt: reine ES-Module im Ordner `js/`.
- Datenformat (IndexedDB `fingernote`, Stores `items`, `pages`, `blobs`) nur abwärtskompatibel ändern –
  Nutzer haben Notizen auf dem Gerät.
- Änderungen direkt auf `main` committen und pushen (GitHub Pages veröffentlicht von `main`).
