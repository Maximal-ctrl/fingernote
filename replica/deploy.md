# Deploy: Fingernote

Ziel laut Nutzer: **nur localhost auf dem eigenen Rechner**, keine Domain, kein Hosting. Damit entfallen Schritte 2 bis 5 der
Skill (Produktionsdatenbank, Stripe, OAuth, E-Mail, DNS, Monitoring, App Stores). Sie sind unten nur kurz eingeordnet.

## Preflight (2026-11-04)

| Check | Ergebnis |
| --- | --- |
| `npx playwright test` (Dev-Server) | **41 passed** (desktop 1440×900 + Pixel 7) |
| `BASE_URL=… npx playwright test` gegen den Produktions-Build | **41 passed** |
| `parity.py replica/features.csv` | **95,9 / 100**, Must-haves **20 von 20** |
| `sweep.py . --config replica/brand.json` | **Clean**, exit 0 |
| `listing.py replica/launch/listing.json` | 0 Fehler, 0 Warnungen |
| `npm run build` | erfolgreich |
| `npm audit --omit=dev` | 0 vulnerabilities |
| offene S1/S2-Bugs | **0** (7 gefunden, alle behoben, siehe bugs.md) |
| Kontrast (hell, dunkel, Papier) | 0 AA-Fehler |
| Favicon, Titel, Logo eigene | ja |
| Datenschutz/Impressum | nicht nötig für private lokale Nutzung; vor Veröffentlichung nötig |

Ergebnis: **bereit für den lokalen Start.**

## Lokaler Start

- `npm start` (= Build + `vite preview`) oder `start.command` / `start.bat` / `start.sh`, öffnet http://localhost:5173.
- Dev- und Produktionsstart nutzen bewusst **denselben Port 5173**: IndexedDB hängt am Origin, sonst sähe man je nach Startart andere Notizen.
- Laufzeit ohne Netzwerk: Schrift, Icons und PDF-Worker sind gebündelt.

## Nachtrag: Startproblem unter Windows (BUG-008)

- Severity S1 (Start blockiert) · gemeldet vom Nutzer: „die Kommandozeile schließt sich direkt wieder“
- Ursache: `start.bat` enthielt „(LTS)“ innerhalb eines geklammerten Befehlsblocks. Die schließende Klammer beendete den Block
  vorzeitig → Syntaxfehler → cmd bricht ab, bevor `pause` erreicht wird.
- Fix: Startskripte ohne Klammerblöcke (Sprungmarken), jede Fehlermeldung endet mit `pause`. Außerdem liegt jetzt der fertige
  Build (`dist/`) im ZIP und `serve.mjs` (nur Node, keine Pakete) liefert ihn aus: kein `npm install`, kein Build beim Nutzer.
- Geprüft: 41/41 e2e-Tests gegen `node serve.mjs`; Pfad-Traversal abgewiesen. Unter echtem Windows nicht ausgeführt
  (keine Windows-Umgebung hier), Skript auf Klammern und CRLF geprüft.

## Hosting auf GitHub Pages (2026-11-05)

- Wunsch des Nutzers: dauerhaft, von überall erreichbar. Fingernote ist rein statisch → GitHub Pages, kostenlos für öffentliche Repos.
- URL: https://maximal-ctrl.github.io/fingernote/ · Workflow `.github/workflows/pages.yml` (npm ci, tsc + vite build mit `BASE_PATH=/fingernote/`, deploy-pages).
- Geprüft vor dem Push: Build unter `/fingernote/` lokal ausgeliefert, Notiz anlegen, tippen, zeichnen, neu laden, PDF-Import (Worker-Pfad),
  Bild auf `#/about`: keine 4xx/5xx, keine Konsolenfehler.
- Grenzen: Daten pro Browser und Gerät (IndexedDB), kein Sync. Origin `maximal-ctrl.github.io` teilen sich alle Pages-Projekte dieses Kontos.

## Nicht gemacht (bewusst)

| Skill-Schritt | warum nicht |
| --- | --- |
| Produktions-DB, Env-Vars | keine Server-Datenbank, keine Secrets |
| Stripe live | kostenlos, kein Bezahlen |
| OAuth / E-Mail-DNS | kein Konto, keine E-Mails |
| Host + Domain + DNS | Wunsch: nur localhost |
| Monitoring | lokal; Fehler erscheinen als Hinweis in der App |
| Mobile Builds | Browser-App; auf dem Tablet im Browser nutzbar, solange der Rechner im selben Netz `npm start` mit `--host` laufen lässt (bewusst nicht voreingestellt) |

## Erste Woche: worauf achten

1. Echtes Tablet mit Stift: Druck, Handballen, Zwei-Finger-Zoom (nur per Emulation getestet).
2. Ein Backup exportieren und in einem zweiten Browser importieren, einmal zur Probe.
3. Große PDFs (100+ Seiten) importieren und durchblättern.
