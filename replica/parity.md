# Parität: Fingernote gegenüber OneNote + GoodNotes (Kernfunktionen)

**Gesamt: 95,9 / 100 (nur Feature-Score, siehe unten). Must-haves: 20 von 20. Offene S1/S2-Bugs: 0.**
Urteil: **shippable** (für die lokale Nutzung). „Besser als das Original“ entscheidet sich nach replica-entrepreneur.

## Feature-Score

95,9 (42 gewertete Features; 6 bewusst ausgelassen: Cloud-Sync/Konto, Echtzeit-Zusammenarbeit, Handschrifterkennung,
KI, Marketplace, Office-Integration). Details: `parity-features.md`.

Schwächste Bereiche: media 0 (Audio-Aufnahme fehlt), export 66,7 (PNG-Export nur als Drucken/PDF), organize 93,8 (Abschnittsgruppen fehlen).

## Layout-Score

**Nicht gemessen.** Es gibt keine Referenz-Screenshots der Originale in `replica/screens/`: Die Hersteller-Seiten waren aus
der Build-Umgebung gesperrt, und ohne dein eigenes Konto werden keine Screenshots der Apps gemacht. Wenn du eigene
Screenshots (1440×900 oder 390×844) dort ablegst, rechnet `imgdiff.py` den Wert nach. Die Screenshots des Klons liegen
in `clone-screens/`. Hinweis der Skill: Pixelgleichheit ist kein Ziel, der Look der Originale ist deren Trade Dress.

## Verhalten (Flows)

| Flow | Fingernote | Bemerkung |
| --- | --- | --- |
| F01 erste Notiz | 3 Klicks: Neues Notizbuch → Erstellen → auf Papier klicken | Abschnitt + Seite werden automatisch angelegt |
| F02 Handschrift | 1 Taste (P) oder 1 Klick, sofort schreiben | Stift erkannt → Finger scrollt automatisch |
| F04 PDF | 2 Klicks + Dateiauswahl, auch per Drag & Drop auf die Seite | Datei bleibt lokal |
| F05 Suche | Strg F von überall, Treffer werden auf der Seite markiert | Handschrift wird nicht durchsucht (OCR ausgelassen) |
| Speichern | automatisch, auch beim sofortigen Schließen (Notfall-Kopie) | kein Konto, kein Sync |
| Backup | eine JSON-Datei, Import führt zusammen | im Original so nicht vorhanden |

Klickzahlen der Originale wurden nicht gemessen (kein Zugriff), deshalb steht hier kein Vergleich.

## Als Nächstes (Top 5)

1. Audio-Aufnahme auf der Seite (could, media 0)
2. Seite als PNG exportieren (should, partial)
3. Kritzeln zum Radieren (could)
4. Abschnittsgruppen (could)
5. Fixes aus replica-entrepreneur (folgt)
