# Architecture: Fingernote (Neuaufbau der Kernfunktionen von OneNote + GoodNotes)

Vorgabe des Nutzers: läuft lokal im Browser über localhost, ohne Konto. Deshalb weicht der Stack bewusst vom
Server-Standard der Skill ab: **local-first**, die "Datenbank" ist IndexedDB im Browser.

## Stack

| layer | choice | why |
| --- | --- | --- |
| web | Vite + React 18 + TypeScript | schneller Dev-Server auf localhost, kein Server-Code nötig |
| styling | eigenes CSS mit Design-Tokens (CSS-Variablen aus `replica/design/tokens.json`) | keine Build-Abhängigkeit, Dunkelmodus über Variablen |
| database | IndexedDB über Dexie 4 | lokal, transaktional, speichert auch Blobs (PDF, Bilder), überlebt Neustarts |
| ink | perfect-freehand (MIT) | druckabhängige Strichkontur, eigene Rendering-Pipeline auf Canvas |
| pdf | pdfjs-dist (Apache-2.0) | PDF-Seiten lokal zu Bildern rendern, kein Upload |
| auth | keine | Einzelnutzer, lokal. Später: Supabase Auth, falls Sync kommt |
| payments | keine | privat genutzt. Siehe replica-launch für ein mögliches Modell |
| email | keine | — |
| jobs | keine | — |
| hosting | `npm run dev` (localhost:5173) bzw. `npm run build && npm run preview` | Wunsch des Nutzers |

## Schema

Tabellen (Object Stores): 6. Access rules: keine nötig (eine Person, ein Browser-Profil, Same-Origin-Policy schützt die Daten).
Die SQL-Fassung in `replica/schema.sql` beschreibt dasselbe Modell für einen späteren Server (Postgres) und dient als Referenz.

Dexie-Schema (Version 1):

```ts
notebooks: 'id, sortOrder, updatedAt, favorite'
sections:  'id, notebookId, sortOrder'
pages:     'id, sectionId, sortOrder, updatedAt, deletedAt'
blocks:    'id, pageId'            // text | image | pdf
strokes:   'id, pageId'
assets:    'id'                    // Blob
```

Hart-Constraints im Datenlayer (IndexedDB hat keine FKs):
- Löschen eines Notizbuchs löscht Abschnitte, Seiten, Blöcke, Striche in **einer** Transaktion.
- Seiten werden weich gelöscht (`deletedAt`) → Papierkorb. Endgültig löschen räumt Blöcke/Striche/verwaiste Assets ab.
- Ein Notizbuch hat immer mindestens einen Abschnitt, ein Abschnitt zeigt bei 0 Seiten einen Leerzustand.

## API (Datenlayer `src/db/repo.ts`, keine HTTP-Routen)

| function | does | input | output | flow |
| --- | --- | --- | --- | --- |
| createNotebook | Notizbuch + Abschnitt + erste Seite | title, color, paper | Notebook | F01 |
| renameNotebook / setFavorite / deleteNotebook | Bibliothek pflegen | id, … | — | F03 |
| createSection / renameSection / recolorSection / deleteSection / moveSection | Abschnitte | … | Section | F03 |
| createPage / renamePage / indentPage / movePage / reorderPages | Seiten | … | Page | F03 |
| trashPage / restorePage / purgePage | Papierkorb | id | — | F09 |
| savePageContent | Blöcke + Striche einer Seite schreiben (debounced, eine Transaktion) | pageId, blocks, strokes | — | F01 F02 |
| importPdf | PDF als Asset speichern, je PDF-Seite einen pdf-Block anlegen | File, ziel | Notebook/Page | F04 |
| search | Volltext über Titel + Textblöcke, Treffer mit Kontext | query | Hit[] | F05 |
| listTags | alle getaggten Absätze | — | TagHit[] | F07 |
| exportBackup / importBackup | alles als eine JSON-Datei (Blobs als base64) | — / File | Blob / Report | F08 |

Webhooks: keine. Jobs: keine. Netzwerkzugriffe zur Laufzeit: keine (pdf.js-Worker wird mitgebündelt).

## The parts that bite

- Zeit: Datumsanzeige im Seitentitel mit `Intl.DateTimeFormat('de-DE')`, gespeichert als epoch ms (UTC).
- Races: schnelles Tippen + Zeichnen erzeugt viele Saves → pro Seite debounced (400 ms) und beim Seitenwechsel/`visibilitychange` sofort flushen.
- Performance Tinte: fertige Striche in ein Basis-Canvas cachen, nur der aktive Strich wird pro Frame neu gezeichnet; `getCoalescedEvents` für glatte Linien.
- Palm Rejection: wenn ein Stift (`pointerType==='pen'`) aktiv ist, Touch nicht zum Zeichnen verwenden (Touch scrollt).
- Dateigrößen: PDFs als Blob in IndexedDB; Seiten werden lazy gerendert (nur sichtbare), Render-Cache pro Seite.
- Speicherplatz: `navigator.storage.persist()` anfragen, damit der Browser die Daten nicht räumt; Backup-Export anbieten.
- Suche: Text aus HTML extrahieren, normalisieren (Kleinschreibung, Umlaute bleiben), Treffer ranken: Titel vor Inhalt.
- Sicherheit: eingefügtes HTML (Zwischenablage) wird bereinigt (nur erlaubte Tags), keine Skripte.
- Datenverlust: Backup-Datei + Papierkorb; nichts wird ohne Rückfrage endgültig gelöscht.

## Build order

1. Vertical slice: S01 → S03/S04, Tabellen notebooks/sections/pages/blocks, createNotebook + savePageContent. Tippen auf freier Leinwand, Reload, alles noch da.
2. Must-haves: Tinte (Stift, Marker, Radierer, Lasso), Papiervorlagen, Undo/Redo, Suche, PDF-Import, Organisieren (S03 vollständig).
3. Should-haves: Unterseiten, Tags + S09, Bilder, Formen, Zoom, Favoriten, Papierkorb (S12), Dunkelmodus, Kürzel, PNG-Export.
4. Fixes aus replica-entrepreneur (nach deren Lauf).
