# FingerNote

Handschriftliche Notizen auf dem iPad – mit dem **Finger** oder dem **Apple Pencil**.
Eine eigene, schlichte Alternative zu GoodNotes und OneNote: kein Konto, kein Abo, keine Werbung,
alles läuft offline und bleibt auf dem Gerät.

## Installation auf dem iPad
1. Die GitHub-Pages-Adresse dieses Repos in **Safari** öffnen (z. B. `https://maximal-ctrl.github.io/fingernote/`).
2. **Teilen → Zum Home-Bildschirm → Hinzufügen**.
3. FingerNote über das neue Symbol starten – im Vollbild und auch ohne Internet.

## Funktionen
- **Bibliothek:** Ordner (auch verschachtelt), Notizbücher mit Vorschau, Favoriten, „Zuletzt“, Sortierung,
  Suche in Namen **und** getippten Texten, Papierkorb (30 Tage)
- **Notizbücher:** Vorlagen Blanko, Liniert, Kariert, Punktiert, Cornell, Notenpapier · Papier Weiß, Creme, Grau, Dunkel ·
  A4 hoch, A4 quer oder **Endlos** (die Seite wächst beim Schreiben mit)
- **Stift:** Füller (druckempfindlich mit Apple Pencil, mit dem Finger über die Geschwindigkeit), Fineliner, Regenbogen-Stift
- **Textmarker** liegt immer *unter* der Schrift, optional mit geraden Linien
- **Zeichnen & halten** → saubere Linie, Kreis, Ellipse, Rechteck, Dreieck, Vieleck; eigenes Formen-Werkzeug
- **Radierer:** ganze Striche oder teilweise, optional nur Textmarker
- **Lasso:** einkreisen oder antippen, verschieben, skalieren, kopieren, ausschneiden, einfügen, duplizieren, umfärben, löschen
- **Text** mit Markdown: Überschriften, **fett**, *kursiv*, ~~durchgestrichen~~, ==markiert==, Listen und
  **abhakbare Checklisten**; Apple-Pencil-Scribble funktioniert in Textfeldern
- **Lernband** zum Abdecken und Lernen (antippen zum Aufdecken), im Export ausblendbar
- **Lineal** (verschieben/drehen, Striche rasten an der Kante ein), **Laserpointer** zum Präsentieren
- **Bilder** einfügen, **PDFs importieren** und beschriften
- **Export:** Notizbuch oder Seite als PDF, Seite als Bild, FingerNote-Datei zum Weitergeben
- **Seiten:** Seitenleiste mit Vorschaubildern, Lesezeichen, duplizieren, verschieben, Vorlage ändern
- **Gesten:** 2 Finger tippen = Rückgängig, 3 Finger = Wiederholen, 2 Finger = scrollen/zoomen (rastet bei Seitenbreite ein)
- Hell/Dunkel, Vollbild-Schreiben, Tastaturkürzel für Magic Keyboard

## Was aus Rezensionen eingeflossen ist
| Kritik an anderen Apps | Lösung in FingerNote |
|---|---|
| Abo-Zwang, Login, Funktionen hinter Bezahlschranke | komplett kostenlos, kein Konto |
| Datenverlust nach Updates | Autospeichern, Papierkorb, Backup-Erinnerung, Backup als Datei |
| Werkzeuge in Untermenüs versteckt, Leiste ändert sich ständig | feste Werkzeugleiste, Optionen immer sichtbar darunter |
| „Farbleiste oben“ gewünscht | sechs Lieblingsfarben direkt sichtbar, antippen zum Anpassen |
| Handballen löst Zoomen/Scrollen aus | Pencil-Erkennung: Finger scrollt, Handballen wird ignoriert |
| Stift verzögert / Tinte flackert | eigene Zeichen-Engine mit Zwischenspeicher pro Seite |
| Markdown in Texten gewünscht | Markdown inklusive Checklisten |
| Regenbogen-/Effektstift gewünscht | Regenbogen-Stift |
| Lernband soll im Export ausblendbar sein | Schalter beim Export |
| Textmarker überdeckt Schrift | Textmarker liegt immer darunter |

## Datenschutz
Dieses Repo enthält nur das Programm. **Alle Notizen werden ausschließlich auf dem Gerät gespeichert**
(App-Speicher/IndexedDB) und nie an einen Server übertragen. Sichern: Einstellungen → „Backup sichern“ →
im Teilen-Menü „In Dateien sichern“ (z. B. iCloud Drive).

## Aktualisieren
Neue Programmversion in dieses Repo hochladen und in `sw.js` die `VERSION` erhöhen (siehe `CLAUDE.md`).
Die App lädt die neue Version beim nächsten Start im Hintergrund und verwendet sie ab dem darauffolgenden Start.

## Technik
Reines HTML/CSS/JavaScript ohne Build-Schritt. PDF-Import über [pdf.js](https://mozilla.github.io/pdf.js/)
(Apache-2.0, im Ordner `lib/`). Einige Symbolformen sind an [Lucide](https://lucide.dev) angelehnt (ISC).
