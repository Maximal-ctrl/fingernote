# Fixes & Positionierung: Fingernote

## Stichprobe (ehrlich)

**34 Nutzerstimmen aus 9 Quellen** (Microsoft Q&A, Microsoft Tech Community, GoodNotes-Feature-Board, Reddit, Samsung Community,
Windows Central, Lemmy, dev.to, change.org). Keine Sternebewertungen.
Einschränkung: Die Review-Seiten und offiziellen Feeds (App Store RSS, HN-API, Reddit-API, learn.microsoft.com,
feedback.goodnotes.com) waren aus der Build-Umgebung gesperrt. Die Zeilen in `reviews.csv` stammen aus Suchergebnissen:
33 sind die **Titel der Threads**, die Nutzer selbst geschrieben haben, eine ist ein im Suchergebnis zitierter Satz. Die Zeilen
sind wörtlich übernommen und verlinkt, aber nicht auf der Seite selbst gegengeprüft. Das ist **unter** den 100+ Stimmen, die die
Skill anstrebt. Die Reihenfolge ist ein Hinweis, kein Beweis.

## 1. Was sie hassen

| # | Problem | Stimmen | Quellen | Belege |
| --- | --- | --- | --- | --- |
| 1 | Tinte hängt hinterher, App wird langsam | 10 | 4 | „OneNote for Windows lags using pen“ ([Tech Community](https://techcommunity.microsoft.com/t5/onenote/onenote-for-windows-lags-using-pen/td-p/1971578)); „It took on average 20 to 25 seconds to erase, write, or zoom and have the page focus in ANDROID“ ([Samsung Community](https://r2.community.samsung.com/t5/Tech-Talk/Worthless-goodnotes-5-android-app/m-p/15621757)) |
| 2 | Export/Backup klemmt, man kommt nicht raus | 7 | 4 | „cant export notebook anymore“ ([MS Q&A](https://learn.microsoft.com/en-us/answers/questions/5333703/cant-export-notebook-anymore)); „The only thing keeping me tied to Microsoft is OneNote.“ ([Lemmy](https://lemmy.federate.cc/post/4978215)) |
| 3 | Sync bricht, Notizen weg | 7 | 4 | „OneNote won't sync and when it does my notes disappear“ ([Tech Community](https://techcommunity.microsoft.com/t5/onenote/onenote-won-t-sync-and-when-it-does-my-notes-disappear/td-p/1265331)); „all notes gone“ ([r/OneNote](https://www.reddit.com/r/OneNote/comments/1f5o7he/all_notes_gone)) |
| 4 | Abo statt Einmalkauf | 3 | 2 | „Goodnotes 6 paid but freemium only“ ([Feature-Board](https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes/suggestions/47295083-goodnotes-6-paid-but-freemium-only)) |
| 5 | Tippen/Textfelder schwach (**thin**, 1 Quelle) | 3 | 1 | „Text improvement“, „TEXT BOX UPDATE“ (GoodNotes-Board) |

## 2. Was fehlt

| # | Wunsch | Stimmen | Quellen | Beleg |
| --- | --- | --- | --- | --- |
| 1 | Tags und Unterordner (**thin**, 1 Quelle) | 4 | 1 | „Add sub folders and tags“ ([Feature-Board](https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes/suggestions/4329300-add-sub-folders-and-tags)) |

## 3. Was ungelöst ist

- **Wer Handschrift und Tippen auf derselben Seite will, ohne Konto und Cloud.** Die eine App ist stark beim Tippen
  und Ordnen, die andere beim Schreiben und bei PDFs, beide hängen am Konto des Herstellers. Belegt nur indirekt
  (Themen 2 und 3 zusammen: 14 Stimmen, 6 Quellen); als Positionierung eine Hypothese, die man prüfen sollte.

## 4. Fix-Plan

| # | Fix | Größe | Skill | Evidenz | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Tinte flüssig auch auf vollen Seiten: Viewport-Rendering, Zwischenspeicher, nur aktiver Strich pro Frame. Gemessen: 3000 Striche, p95 16,8 ms/Frame (Headless-Chromium, nicht auf einem Tablet gemessen) | S | build | Thema 1 | erledigt |
| 2 | Raus kommen ist einfach: Markdown-Export pro Notizbuch (Text, To-Dos als Checklisten), komplettes Backup als JSON, Drucken/PDF | S | build | Thema 2 | erledigt, Tests F08-H1/H2 |
| 3 | Nichts geht verloren: local-first, kein Sync, Speichern beim Verlassen jedes Felds, Notfall-Kopie beim Schließen, Papierkorb | S | build | Thema 3 | erledigt, Tests F01-E6, F09 |
| 4 | Backup-Erinnerung nach 14 Tagen (da es keine Cloud gibt) | S | build | Thema 3 | erledigt, Test F08-H3 |
| 5 | Kein Abo: lokal und kostenlos; Preisfrage für später an replica-launch | — | launch | Thema 4 | siehe launch.md |
| 6 | Tippen ist gleichwertig: Rich Text, Überschriften, Listen, Tastenkürzel, Leiste verdeckt den Text nicht | — | build | Thema 5 (thin) | vorhanden |
| 7 | Ordnen: Abschnitte, Unterseiten, Tags mit Übersicht | — | build | Wunsch 1 (thin) | vorhanden |

## 5. Der Angle

```
A) Für alle, die mit Stift UND Tastatur notieren und keinem Sync mehr trauen,
   ist Fingernote ein Notizbuch, das nur auf dem eigenen Gerät lebt, nichts verliert
   und sich jederzeit als Datei mitnehmen lässt.
   Evidenz: Sync/Verlust 7 + Export/Lock-in 7 Stimmen, zusammen 6 Quellen.

B) Für alle, deren Stift-App ruckelt,
   ist Fingernote die Notiz-App, die auch auf vollen Seiten flüssig bleibt.
   Evidenz: Lag 10 Stimmen, 4 Quellen.

C) Für alle, die kein Abo für ihre Notizen zahlen wollen,
   ist Fingernote kostenlos und lokal, ohne Konto.
   Evidenz: Abo 3 Stimmen, 2 Quellen (thin).
```

**Empfehlung: A.** Das stärkste und quellenübergreifende Signal (Datenverlust + Lock-in), und es ist das, was Fingernote
strukturell anders macht. B als zweite Botschaft, sobald auf echter Tablet-Hardware gemessen.
