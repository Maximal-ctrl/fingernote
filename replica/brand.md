# Marke: Fingernote

## Name

Vom Nutzer vorgegeben: **Fingernote**. Keine 20 Kandidaten generiert, weil die Entscheidung steht.
Bezug zum Angle (fixes.md, A): „mit dem Finger (und Stift) notieren, auf dem eigenen Gerät“.

Filter der Skill, ehrlich angewendet:

- **Ähnlichkeit zum Original:** teilt das Wort „note“ mit OneNote. „Note“ ist in der Kategorie ein beschreibendes Allerweltswort
  (Evernote, Notability, Simplenote …), der unterscheidende Teil „Finger“ hat keinen Bezug zu „One“ oder „Good“. Kein Wortspiel auf
  die Originalnamen. Einschätzung: geringes Risiko gegenüber den Originalen.
- **Ähnlichkeit zu anderen Apps derselben Kategorie: Treffer.** Im App Store existiert **„Fingernotez“** (iPad-Notiz-App,
  [Listing](https://apps.apple.com/id/app/fingernotez/id6448929177)). Klang und Schreibweise sind fast identisch, gleiche Kategorie.
  Für eine Veröffentlichung ist das ein echtes Risiko. Für die private, lokale Nutzung unerheblich.
  Ähnlich, aber deutlich verschieden: „Finger Memo“, „FiiNote“.
- Kurz, nach einmal Hören schreibbar, im Deutschen und Englischen ohne schräge Bedeutung.

## Checks

| Check | Ergebnis |
| --- | --- |
| Web „Fingernote app“ | **gelaufen 2026-11-04**: keine App exakt „Fingernote“; ähnliche: Fingernotez (App Store), Finger Memo, FiiNote |
| App Store / Play exakte Suche | to run (App Store war aus der Build-Umgebung gesperrt; Fingernotez nur über Websuche gefunden) |
| US-Marke (USPTO, Klassen 9 und 42) | to run |
| EU-Marke (EUIPO eSearch / TMview) | to run |
| DPMA (Deutschland) | to run |
| WIPO Global Brand Database | to run |
| Domain fingernote.app / .de / .com | to run (`whois fingernote.de`) |
| Handles X, Instagram, TikTok, GitHub | to run |

Das sind Vorab-Prüfungen, keine rechtliche Freigabe. Vor Geld oder Veröffentlichung: Markenanwalt.

## Farben

Originale: OneNote arbeitet mit Violett, GoodNotes' Markenfarbe wurde hier nicht verifiziert und deshalb nicht in `brand.json`
eingetragen. Fingernote nimmt bewusst eine andere Farbfamilie: **Terrakotta**, warm wie Tinte auf Papier.

| Rolle | Hell | Dunkel |
| --- | --- | --- |
| accent | `#b5472a` | `#ff9d7e` |
| accent-soft | `#fbebe5` | `#3a231b` |
| on-accent | `#ffffff` | `#1c0d07` |

Kontrastprüfung (`contrast.py`): hell 16 Paare, dunkel 15 Paare, Papierfarben 4 Paare, **0 AA-Fehler**.
Alle anderen Rollen unverändert (neutral). Platzhalter-Blau ist aus der UI raus; Blau bleibt nur als wählbare Stiftfarbe.

## Logo-Brief

- **Idee:** Ein Fingerabdruck-Bogen, der unten in eine Schreiblinie ausläuft: der Finger wird zur Notiz.
- **Typ:** Symbol + Wortmarke („Fingernote“, Inter Bold, normale Laufweite). Das Symbol funktioniert allein als App-Icon.
- **Größen:** muss bei 16 px (Favicon, 2 Bögen + Linie reichen) und 1024 px (App-Icon) lesbar sein.
- **Lieferumfang:** SVG, App-Icon 1024×1024 ohne Transparenz, Favicon-Set (16/32/180/512), Social-Bild 1200×630.
- **Darf nicht ähneln:** keinem Original-Logo: kein Buchstabe im Quadrat, kein Violett, kein Notizbuch-Symbol mit Ringbindung.
- **Stand:** Eine erste eigene Zeichnung ist in der App (`src/ui/Logo.tsx`, `public/favicon.svg`): drei Linien auf Terrakotta-Quadrat.
  Für eine Veröffentlichung von einer Designerin oder einem Designer ausarbeiten lassen.

## Stimme

| Wort | heißt nicht |
| --- | --- |
| direkt | nicht knapp oder kalt |
| ruhig | nicht verschlafen |
| ehrlich | nicht belehrend |

| Tun | Lassen |
| --- | --- |
| „Seite liegt im Papierkorb.“ + Rückgängig | „Sind Sie sicher? Diese Aktion …“ bei Harmlosem |
| du, kurze Sätze | Sie, Behördendeutsch |
| sagen, wo die Daten liegen | „in der Cloud gesichert“, wenn es nicht stimmt |
| Fehler mit Ausweg: „Bilder bis 25 MB, bitte verkleinern.“ | „Ein Fehler ist aufgetreten.“ |
| ein Verb pro Knopf: „Erstellen“, „Wiederherstellen“ | „OK“, „Weiter“ ohne Inhalt |

Die 10 meistgesehenen Texte (alle neu geschrieben, keiner nach Vorlage der Originale):

1. Leere Bibliothek: „Noch keine Notizbücher. Leg dein erstes an. Tippen, schreiben, zeichnen: alles auf derselben Seite, gespeichert nur auf diesem Gerät.“
2. Hauptknopf: „Neues Notizbuch“
3. Leere Seite: „Klick irgendwo hin und tipp los, oder nimm den Stift (P) und schreib frei.“
4. Erstellen-Dialog Fehler: „Gib dem Notizbuch einen Namen.“
5. Seite gelöscht: „Seite liegt im Papierkorb.“ · Rückgängig
6. Stift erkannt: „Stift erkannt: Ab jetzt zeichnet nur der Stift, mit dem Finger scrollst du. Änderbar in den Einstellungen.“
7. Suche ohne Treffer: „Nichts gefunden für „…“.“
8. Backup-Hinweis: „Deine Notizen liegen nur in diesem Browser. Noch kein Backup.“
9. PDF-Fehler: „Die Datei ließ sich nicht als PDF lesen.“
10. Leerer Papierkorb: „Der Papierkorb ist leer. Gelöschte Seiten landen hier, bis du sie wiederherstellst oder endgültig löschst.“

## Sweep

`python3 sweep.py . --config replica/brand.json` → **Clean** (2026-11-04). Geprüft: Namen OneNote/GoodNotes/Microsoft, deren Domains,
OneNote-Violett. Per Auge geprüft: Favicon, Seitentitel („Fingernote“), App-Kopf, Leerzustände. Keine E-Mails, kein OG-Bild (lokale App).
