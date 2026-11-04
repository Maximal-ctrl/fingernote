# Testplan: Fingernote

Automatisiert: Playwright (`npx playwright test`), Projekte `desktop` (1440×900) und `mobile` (Pixel 7).
Jeder Test schlägt fehl bei Konsolenfehlern, Seitenfehlern oder 5xx; axe-Scan (serious/critical) auf S01, S04, S07, S09 und mobil.

| Fall | Beschreibung | Automatisiert |
| --- | --- | --- |
| F01-H1 | Notizbuch anlegen, Titel + Text (Umlaute, Emoji), Reload, alles da | e2e/f01-type |
| F01-E1 | leerer Name → Fehlermeldung | e2e/f01-type |
| F01-E2 | leeres Textfeld verschwindet beim Verlassen | e2e/f01-type |
| F01-E3 | sehr langer Name (70 Zeichen) | e2e/f01-type |
| F01-E4 | Fett über Werkzeugleiste | e2e/f01-type |
| F01-E5 | Textfeld löschen + Strg Z | e2e/f01-type |
| F01-E6 | sofort neu laden nach dem Tippen, nichts geht verloren | e2e/f01-type |
| F02-H1 | Stift, Marker, Ellipse, Reload | e2e/f02-ink |
| F02-H2 | Radierer, Rückgängig, Wiederholen | e2e/f02-ink |
| F02-E1 | Radierer „nur Marker“ | e2e/f02-ink |
| F02-E2 | Punkt ohne Bewegung | e2e/f02-ink |
| F02-E3 | Zoom + Zeichnen/Radieren trifft | e2e/f02-ink |
| F02-E4 | echter Stift mit Druck, Handballen auf dem Display | manuell (Tablet) |
| F02-E5 | Zwei-Finger-Zoom/-Scrollen auf Touch | manuell (Tablet) |
| F03-H1 | Abschnitt anlegen + benennen, Seite, Unterseite, in anderen Abschnitt verschieben | e2e/f03-organize |
| F03-H2 | Seiten umsortieren (Menü) | e2e/f03-organize |
| F03-H3 | Umbenennen Abschnitt/Notizbuch | e2e/f03-organize |
| F03-E1 | Notizbuch löschen mit Rückfrage | e2e/f03-organize |
| F03-E2 | Favorit (auch mobil) | e2e/f03-organize |
| F03-E3 | Drag & Drop von Seiten/Abschnitten | manuell (Maus) |
| F04-H1 | PDF (3 Seiten) → Notizbuch, markieren | e2e/f04-pdf |
| F04-H2 | PDF als Abschnitt in vorhandenes Notizbuch | e2e/f04-pdf |
| F04-N1 | kaputte Datei → klare Meldung | e2e/f04-pdf |
| F04-E1 | großes PDF (100+ Seiten), passwortgeschütztes PDF | manuell |
| F05-H1 | Suche, Groß/klein, Umlaute, Enter öffnet Seite, Treffer markiert | e2e/f05-search |
| F05-E1 | keine Treffer | e2e/f05-search |
| F05-E2 | Seite im Papierkorb wird nicht gefunden | e2e/f05-search |
| F06-H1 | Lasso: auswählen, verschieben, duplizieren, löschen | e2e/f06-lasso |
| F06-E1 | leeres Lasso | e2e/f06-lasso |
| F06-E2 | Auswahl umfärben | e2e/f06-lasso |
| F07-H1 | To-Do taggen, in Übersicht abhaken, Seite aktualisiert | e2e/f07-tags |
| F07-E1 | Enter in leerer To-Do-Zeile beendet die Liste | e2e/f07-tags |
| F08-H1 | Backup exportieren, löschen, importieren | e2e/f08-backup |
| F08-N1 | falsche Datei abgelehnt | e2e/f08-backup |
| F09-H1 | Seite in Papierkorb und zurück | e2e/f09-trash |
| F09-H2 | Abschnitt in Papierkorb, Papierkorb leeren | e2e/f09-trash |
| M-H1 | 390 px: Bibliothek, Editor, Seitenleiste als Schublade, kein horizontales Scrollen | e2e/mobile |
| X-1 | Drucken / als PDF sichern | manuell (Druckvorschau) |
| X-2 | zwei Tabs gleichzeitig auf derselben Seite | bekannte Grenze, siehe bugs.md |

Nicht zutreffend (kein Server/Konto): abgelaufene Sitzung, Daten eines zweiten Nutzers, Zahlungen, langsames Netz (die App lädt nichts nach).
