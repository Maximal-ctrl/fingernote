# Bugs: Fingernote

Gefunden durch die e2e-Suite (Build ab 286e626, Chromium 1440 px und Pixel 7). Alle behoben, mit Test.

### BUG-001: Neuer Abschnitt springt sofort zur alten Seite zurück
- Severity: S2 · Flow F03 / F03-H1 · Screen S03
- Steps: Notizbuch öffnen → „+ Abschnitt“
- Expected: neuer Abschnitt ist aktiv, seine erste Seite offen
- Actual: URL wechselt zurück auf die vorige Seite, alter Abschnitt bleibt aktiv
- Cause: Weiterleitung „Seite fehlt → erste Seite“ lief, bevor die Live-Abfrage die neue Seite kannte
- Status: fixed in 27b38a5 (Weiterleitung prüft erst die Datenbank), Test F03-H1

### BUG-002: Getipptes kann beim sofortigen Schließen/Neuladen verloren gehen
- Severity: S1 (Datenverlust) · Flow F01 / F01-E6 · Screen S04
- Steps: Text tippen → innerhalb ~0,3 s Tab neu laden oder schließen
- Expected: Text ist nach dem Laden da
- Actual: letzte Änderung fehlte (asynchrones IndexedDB-Speichern lief beim Entladen nicht zu Ende)
- Status: fixed in 27b38a5: sofort speichern beim Verlassen eines Textfelds und nach jedem Strich; beim Entladen
  synchrone Notfall-Kopie in localStorage, die beim nächsten Start nachgeholt wird. Test F01-E6

### BUG-003: Zwei offene Dialoge haben dieselbe Titel-ID
- Severity: S3 · Flow F09 / F09-H2 · Screen S12
- Actual: Bestätigungsdialog über dem Papierkorb wurde von Screenreadern mit dem falschen Titel angesagt; Esc schloss beide
- Status: fixed in 27b38a5 (useId, Esc nur für den obersten Dialog), Test F09-H2

### BUG-004: Abgehaktes To-Do verschwindet sofort aus der Tag-Übersicht
- Severity: S3 · Flow F07 / F07-H1 · Screen S09
- Actual: bei „Erledigte ausblenden“ verschwand der Eintrag beim Abhaken, Versehen war nicht rückgängig zu machen
- Status: fixed in 27b38a5: bleibt durchgestrichen sichtbar bis zum nächsten Öffnen. Test F07-H1

### BUG-005: axe – Suchknopf-Name passt nicht zum sichtbaren Text; Seitenliste mit ungültigen ARIA-Rollen
- Severity: S4 · Screens S01, S03
- Status: fixed in 27b38a5, axe-Scan in F01-H1, F07-H1, M-H1

## To check (nicht reproduziert / bekannte Grenzen)

- Zwei Tabs auf derselben Seite: der zuletzt speichernde Tab gewinnt pro Block/Strich (kein Live-Abgleich zwischen Tabs).
- Stiftdruck und Handballenerkennung nur mit echter Hardware prüfbar (Code: Pointer Events, Stift erkannt → Finger scrollt).
- Safari < 17.2 und Firefox < 140 zeigen Suchtreffer auf der Seite nicht farbig (CSS Highlight API fehlt), Suche selbst funktioniert.
