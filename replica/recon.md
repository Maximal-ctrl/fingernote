# Recon map: OneNote + GoodNotes (Web, Desktop-Browser + Tablet mit Stift)

Scope: Der Kern beider Apps, gemischt. Von OneNote: Hierarchie Notizbuch → Abschnitt → Seite (+ Unterseite),
freie Leinwand ("überall hinklicken und tippen"), Notiz-Tags, Suche. Von GoodNotes: Handschrift mit Stift/Marker/
Radierer/Lasso/Formen, Papiervorlagen, PDF importieren und beschriften, Bibliothek mit Notizbuch-Covern, Favoriten.
For: den Nutzer selbst, lokal im Browser über localhost, ohne Konto und ohne Cloud.
Date: 2026-11-03

Hinweis: support.microsoft.com und apps.apple.com waren aus der Build-Umgebung nicht erreichbar (Netzwerkrichtlinie).
Die Recon stützt sich auf Suchergebnisse, öffentliche Anleitungen und Release Notes. Kein Login, kein Code, keine privaten APIs.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | help center (OneNote) | https://support.microsoft.com/en-au/onenote/basic-tasks-in-onenote-for-windows-10 | "+ Section" unten in der Abschnittsliste, Notizbuchliste ein-/ausblendbar (nur Suchsnippet) |
| 2 | Kursgliederung (OneNote) | https://oreilly.com/library/view/microsoft-onenote-step/9780735699632 | Freihand: Tinte auswählen, ansehen, radieren; Ink → Text |
| 3 | Kurs (OneNote) | https://www.knowledgecity.com/en/library/CMP1315M2/creating-and-organizing-notebooks-in-onenote/ | Abschnitte/Seiten anlegen, umbenennen, Seiten verschieben/kopieren |
| 4 | Tutorial (OneNote) | https://www.tpointtech.com/onenote | Hierarchie Notizbuch/Abschnitt/Seite, Tags, "Find Tags" |
| 5 | app store listing (GoodNotes) | https://apps.apple.com/gb/app/goodnotes-6/id1444383602 | digitale Notizbücher mit anpassbaren Papiervorlagen |
| 6 | release notes (GoodNotes Android) | https://www.apkmirror.com/apk/goodnotes/goodnotes-for-android/goodnotes-for-android-1-0-36-0-v191402-release/ | PDF importieren → neues Notizbuch; Lasso färbt Striche um; Kreis-zum-Lasso |
| 7 | Anleitung (GoodNotes 6) | https://brandenbodendorfer.com/how-to-use-goodnotes-6/ | Radierer-Modi (Präzision/Standard/Strich), Marker-Radierer, Kritzeln-zum-Radieren |
| 8 | Feature-Board (GoodNotes) | https://feedback.goodnotes.com/forums/191274-goodnotes-ideas | Wünsche: Vorlagen-Import, PDF-Skalierung |

## Core loop

Ein Notizbuch öffnen, eine Seite anlegen und darauf frei tippen **und** mit dem Stift schreiben, alles wird sofort gespeichert und ist später per Suche wiederzufinden.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Bibliothek | Start (`#/`) | alle Notizbücher als Cover, Favoriten, zuletzt benutzt | Cover-Kachel, Neu-Button, Suche | empty (erster Start), filled |
| S02 | Notizbuch erstellen | S01 → "Neues Notizbuch" | Name, Coverfarbe, Standardpapier | Modal, Farbauswahl, Papier-Auswahl | default, validation error (leerer Name) |
| S03 | Notizbuch-Ansicht | S01 → Cover (`#/nb/:id`) | drei Spalten: Abschnitte, Seitenliste, Leinwand | Abschnitts-Tabs (farbig), Seitenliste mit Einrückung, Leinwand | empty section, filled, Seitenliste eingeklappt, mobil |
| S04 | Seitenleinwand | S03 → Seite | frei tippen, Freihand, Bilder, PDF-Seiten | Textcontainer, Tintenschicht, Papierhintergrund, Seitentitel+Datum | leere Seite (Hinweis), gefüllt, Zoom |
| S05 | Werkzeugleiste | S04 oben | Modus: Tippen / Stift / Marker / Radierer / Lasso / Form; Farbe, Stärke | Toolbar, Farbpunkte, Stärke-Slider | aktiv/inaktiv je Werkzeug |
| S06 | Papier & Seite | S04 → "Papier" | Vorlage (leer, liniert, kariert, gepunktet, Cornell), Papierfarbe | Popover mit Vorschauen | default |
| S07 | Suche | Strg+F / Lupe | Volltext über alle Notizbücher, Treffer mit Kontext | Suchfeld, Trefferliste | leer, keine Treffer, Treffer |
| S08 | PDF importieren | S01/S03 → "PDF importieren" | PDF → Seiten mit PDF als Hintergrund | Datei-Auswahl, Fortschritt | lädt, Fehler (kein PDF / defekt), fertig |
| S09 | Tags | Seitenleiste → "Tags" | alle getaggten Zeilen (To-Do, Wichtig, Frage, Idee) | gruppierte Liste, Checkbox | leer, gefüllt |
| S10 | Einstellungen | Zahnrad | Theme, Backup exportieren/importieren, Standardstift | Modal, Schalter | default, Import-Fehler |
| S11 | Kontextmenü | Rechtsklick auf Abschnitt/Seite/Notizbuch | umbenennen, Farbe, löschen, verschieben, Unterseite | Menü | default |
| S12 | Papierkorb | Seitenleiste → "Papierkorb" | gelöschte Seiten wiederherstellen/endgültig löschen | Liste | leer, gefüllt |

## Flows

```
F01 Erste Notiz tippen
    S01 -> S02 -> S03/S04 (Abschnitt + Seite werden automatisch angelegt) -> Klick auf Leinwand -> tippen
    happy path clicks: 3 (Neues Notizbuch, Erstellen, Klick auf Leinwand)
    edge: leerer Name, Tippen bei Zoom != 100 %, Container an den Rand ziehen

F02 Handschrift
    S04 -> S05 Stift -> zeichnen -> Radierer -> Rückgängig
    happy path clicks: 1 (Stift) + zeichnen
    edge: Stiftdruck fehlt (Maus), Handballen (Touch während Stift), sehr lange Striche, Zoom

F03 Organisieren
    S03 -> "+ Abschnitt" -> Farbe -> "+ Seite" -> Unterseite (Einrücken) -> Seite per Drag umsortieren -> in anderen Abschnitt verschieben
    happy path clicks: 2 für Abschnitt+Seite
    edge: letzter Abschnitt gelöscht, Seite mit Unterseiten verschieben

F04 PDF beschriften
    S01 -> S08 -> Notizbuch mit PDF-Seiten -> Marker -> schreiben -> als PNG/PDF exportieren
    happy path clicks: 3
    edge: großes PDF (100+ Seiten), passwortgeschütztes PDF, kein PDF

F05 Suchen
    beliebig -> Strg+F -> Begriff -> Treffer -> Seite öffnet sich
    happy path clicks: 1 + tippen
    edge: keine Treffer, Treffer in Seitentitel vs. Text, Umlaute/Groß-klein

F06 Lasso
    S04 -> Lasso -> Bereich umkreisen -> verschieben / umfärben / löschen / duplizieren
    edge: Auswahl leer, Auswahl über Textcontainer

F07 Tags
    S04 -> Zeile -> Tag "To-Do" (Strg+1) -> abhaken -> S09 zeigt offene To-Dos
    edge: Tag entfernen, Seite gelöscht

F08 Backup
    S10 -> Exportieren (Datei) -> anderer Browser -> Importieren
    edge: kaputte Datei, doppelter Import

F09 Löschen & Wiederherstellen
    S11 Seite löschen -> S12 -> Wiederherstellen
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger, icon | default, hover, focus, active, disabled | alle |
| Notizbuch-Cover | 8 Farben, Favorit | default, hover, Kontextmenü | S01 |
| Abschnitts-Tab | farbig | default, aktiv, umbenennen | S03 |
| Seitenlisten-Eintrag | Ebene 0/1/2 | default, aktiv, drag, umbenennen | S03 |
| Toolbar-Werkzeug | Tippen, Stift, Marker, Radierer, Lasso, Form, Bild | aktiv, inaktiv | S04 |
| Farbpunkt | 8 Stiftfarben | gewählt | S05 |
| Textcontainer | — | leer, fokussiert, Ziehgriff | S04 |
| Papierhintergrund | leer, liniert, kariert, gepunktet, Cornell | Papierfarben | S04, S06 |
| Modal | klein, mittel | offen | S02, S08, S10 |
| Popover / Kontextmenü | — | offen | S06, S11 |
| Toast | info, Fehler | sichtbar | alle |
| Suchfeld | — | leer, mit Text | S07 |
| Tag-Symbol | To-Do (Checkbox), Wichtig, Frage, Idee | an/aus | S04, S09 |

## Inferred data model

```
Notebook  id, title, color, favorite, defaultPaper, createdAt, updatedAt, sortOrder
          evidence: S01 Cover, S02 Formular, Quelle 4/5
          confidence: high

Section   id, notebookId, title, color, sortOrder
          evidence: Abschnitts-Tabs, "+ Section" (Quelle 1)
          confidence: high

Page      id, sectionId, title, level (0..2 Unterseite), sortOrder, paper {type, color},
          createdAt, updatedAt, deletedAt (Papierkorb)
          evidence: Seitenliste, Unterseiten-Einrückung, Quelle 3
          confidence: high (level als Einrückung: medium)

Block     id, pageId, kind (text | image | pdf), x, y, w, h, html | assetId, pdfPage
          evidence: Textcontainer auf freier Leinwand, Bild einfügen, PDF-Seiten als Hintergrund
          confidence: medium

Stroke    id, pageId, tool (pen | highlighter | shape), color, width, points [[x,y,pressure]...]
          evidence: Quelle 2, 6, 7
          confidence: medium (Speicherform ist unsere Wahl)

Asset     id, mime, blob (Bilder, PDF-Dateien)
          confidence: guess
```

Relationships: Notebook 1-n Section, Section 1-n Page, Page 1-n Block, Page 1-n Stroke, Block n-1 Asset.
Tags leben als Attribut an Absätzen im Text-HTML und werden für S09 indiziert (guess).

## Feature matrix

See `features.csv`. Must: 20, should: 15, could: 8, skip: 6.

## Out of scope (cannot or should not be cloned)

- Microsoft-Konto, OneDrive-Sync, Zusammenarbeit in Echtzeit: das ist deren Cloud und Netzwerk.
- GoodNotes Marketplace (Vorlagen/Sticker von Dritten): fremde lizenzierte Inhalte.
- Handschrifterkennung/OCR und KI-Funktionen: brauchen ein Modell oder einen Dienst, nicht lokal ohne Weiteres.
- Office-Integration (Outlook-Aufgaben, Teams, Class Notebook).
- Original-Logos, Icons, Vorlagen-Designs, Texte: alles wird neu gestaltet.

## Size

Screens 12, flows 9, entities 6. Hard parts: (1) flüssige Tinte mit Druck, Radierer und Lasso auf großer Leinwand,
(2) frei positionierbare Rich-Text-Container mit Tags, (3) PDF rendern und lokal große Dateien speichern (IndexedDB).
Size: M (ein paar Wochen für ein ausgereiftes Produkt). Ein solider, benutzbarer Kern ist in einer Sitzung machbar.
