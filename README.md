# Fingernote

Notizen mit Stift und Tastatur, nur auf deinem Gerät. Tippen und von Hand schreiben auf derselben Seite,
Notizbücher mit Abschnitten und Unterseiten, PDFs beschriften, Tags, Suche. Läuft im Browser über localhost,
ohne Konto und ohne Cloud.

## Starten

Voraussetzung: [Node.js](https://nodejs.org) (Version 22 LTS empfohlen, mindestens 20).

1. Herunterladen, eine von beiden Varianten:
   - auf GitHub **Code → Download ZIP**, dann **vollständig entpacken** (Windows: Rechtsklick → „Alle extrahieren“), oder
   - `git clone https://github.com/Maximal-ctrl/fingernote.git`
2. Im Ordner doppelklicken:
   - Windows: `start.bat`
   - macOS: `start.command` (beim ersten Mal ggf. Rechtsklick → „Öffnen“)
   - Linux: `./start.sh`
3. **Beim ersten Start** wird Fingernote einmal eingerichtet (Pakete laden und bauen, 1–2 Minuten, braucht Internet).
   Danach startet es in Sekunden. Der Browser öffnet http://localhost:5173.
4. **Das schwarze Fenster offen lassen**, solange du Fingernote benutzt.

Geht der Browser nicht von selbst auf: http://localhost:5173 von Hand öffnen.

**Im Terminal** geht es auch: `npm install`, `npm run build:app`, dann `node serve.mjs`.

**Zum Weiterentwickeln** (braucht `npm install`): `npm run dev` (Live-Neuladen) oder `npm start` (neu bauen und starten).
Alle Wege nutzen dieselbe Adresse, also dieselben Notizen.

## Wenn es nicht startet

| Meldung im Fenster | Lösung |
| --- | --- |
| „Node.js wurde nicht gefunden“ | Node.js 22 LTS von nodejs.org installieren, Fenster schließen, neu doppelklicken |
| „Dateien fehlen“ | ZIP erst entpacken, dann im entpackten Ordner starten |
| Fehler bei `npm install` | Internetverbindung prüfen und `start.bat` noch einmal starten |
| „Port 5173 ist schon belegt“ | Fingernote läuft schon in einem anderen Fenster: einfach http://localhost:5173 öffnen |

## Wo sind meine Notizen?

Im Browser, in dem du Fingernote öffnest (IndexedDB), gebunden an die Adresse `http://localhost:5173`.

- Anderer Browser oder andere Adresse (z. B. `127.0.0.1:5173`) = andere, leere Notizen.
- Browserdaten löschen = Notizen weg. Deshalb: **Einstellungen → Backup exportieren**. Die App erinnert dich nach 14 Tagen.
- Mitnehmen in einen anderen Browser: dort **Backup importieren**.

## Bedienung in Kürze

| Taste | Werkzeug |
| --- | --- |
| T | Tippen & Auswählen: irgendwo klicken und schreiben |
| P / H / E | Stift / Marker / Radierer |
| L | Lasso: umkreisen, ziehen, umfärben, Entf löscht |
| S | Formen (Umschalt = gerade/quadratisch) |
| Strg Z / Strg Y | Rückgängig / Wiederholen |
| Strg F | Suchen |
| Strg 1–4 | Tag: To-Do, Wichtig, Frage, Idee |
| Alt N | Neue Seite |

Auf dem Tablet: Mit dem Finger schreiben, zwei Finger zoomen und verschieben. Sobald ein Stift erkannt wird,
schreibt nur noch der Stift und der Finger scrollt (umstellbar in den Einstellungen).

## Entwicklung

```bash
npm run dev        # Dev-Server
npm test           # 41 End-to-End-Tests (Playwright)
npm run build      # Produktions-Build nach dist/
```

Entstanden mit dem Replica-Skill-Pack: Recon, Architektur, Design, Build, Tests, Parität, Nutzerforschung,
Marke und Launch liegen in `replica/`.
