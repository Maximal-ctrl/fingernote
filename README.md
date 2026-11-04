# Fingernote

Notizen mit Stift und Tastatur, nur auf deinem Gerät. Tippen und von Hand schreiben auf derselben Seite,
Notizbücher mit Abschnitten und Unterseiten, PDFs beschriften, Tags, Suche. Läuft im Browser über localhost,
ohne Konto und ohne Cloud.

## Starten

Voraussetzung: [Node.js](https://nodejs.org) 22 LTS (mindestens 20.19).

**Einfach:** Doppelklick auf `start.command` (macOS), `start.bat` (Windows) oder `./start.sh` (Linux).
Beim ersten Mal werden die Pakete installiert (1–2 Minuten), danach öffnet sich http://localhost:5173.

**Im Terminal:**

```bash
npm install
npm start
```

`npm start` baut die App und startet sie unter http://localhost:5173. Zum Weiterentwickeln mit Live-Neuladen: `npm run dev`
(gleiche Adresse, gleiche Notizen).

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
