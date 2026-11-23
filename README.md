# FingerNote 2.2

Handschriftliche Notizen auf dem iPad – mit dem **Finger** oder dem **Apple Pencil**.
Schlicht, modern, offline. Kein Abo, keine Werbung.

## Installation auf dem iPad
1. **https://maximal-ctrl.github.io/fingernote/** in **Safari** öffnen.
2. **Teilen → Zum Home-Bildschirm → Hinzufügen**.
3. Beim ersten Start **Konto erstellen**: Name und eigenes Passwort wählen, dazu den **Anmeldecode `1111`**.
   Danach meldest du dich nur noch mit **Name + Passwort** an.

## Funktionen
- **Konten:** Anmelden mit Name + Passwort; neue Konten nur mit dem zentralen Anmeldecode (`js/config.js`, `REGISTER_CODE`).
  Mehrere Personen pro Gerät, jede mit eigenen Büchern. Mit OneDrive auf jedem Gerät abrufbar.
- **Meine Welt:** alle Ordner und Bücher als Netzwerk rund um dich – antippen, bewegen, zoomen
- **Ordner** (beliebig verschachtelt) und **Bücher** – wahlweise **mit Seiten** oder als **unendliche Leinwand**
- **Kapitel** in jedem Buch (wie Abschnitte in OneNote), Seiten zwischen Kapiteln verschiebbar
- **Stromlaufplan-Editor** (neue Buchart): Symbole nach IEC 60617 (Kontakte, Taster, Schütze, Zeitrelais,
  Sicherungen, Motoren, Leuchten, Halbleiter, Quellen …), Blätter A4/A3 mit Spalten und Schriftfeld,
  Verdrahtung im 5-mm-Raster (antippen oder mit dem Stift ziehen), Leitungen bleiben beim Verschieben verbunden,
  Verbindungspunkte nur an T-Abzweigen, **automatische BMK** (-K1, -S2 …), **Kontaktspiegel** und **Querverweise**
  (/Blatt.Spalte), Potentiale (L1, N, PE, +24V – auch über Blätter), **Planprüfung**,
  Export als PDF, SVG, PNG, **Stückliste**, **Netzliste** und **Klemmenplan** (CSV).
  Über 100 Symbole (Umfang wie im Fachkunde-Elektrotechnik-Buch), **eigene Bauteile** im Baukasten,
  Bauteile **sperren** (Schloss), **Lasso**, **Stift & Radierer** zum Hineinzeichnen, Kontaktnummern frei änderbar,
  Schriftfeld per Antippen bearbeiten, 2/3-Finger-Tippen = Rückgängig/Wiederholen
- **Installationsplan** (neue Buchart): Wände, Türen, Fenster, Installationssymbole nach DIN EN 60617-11
  (Steckdosen, Aus-/Serien-/Wechsel-/Kreuzschalter, Leuchten, Verteiler, Rauchmelder, LAN/TV/TAE …),
  Leitungen mit Aderzahl und Bezeichnung (z. B. NYM-J 3×1,5), Maßstab im Schriftfeld
- **PDFs** als Buch importieren oder in ein Buch einfügen – jede Seite direkt beschreibbar
- **Bilder** einfügen, **sperren**, **vor oder hinter den Text** legen
- Stift (druckempfindlich), Fineliner, Regenbogen, **Lieblingsstifte**, **Pipette**
- Textmarker unter der Schrift, Formerkennung durch Halten, **Wegkritzeln zum Löschen**
- Radierer (ganz/teilweise/nur Textmarker, springt auf Wunsch zum Stift zurück)
- Lasso mit Filter (Schrift/Text/Bilder), Text mit Markdown und Checklisten, Lernband, Lineal, Laserpointer
- **Dunkle Seiten** im Dunkelmodus, Vollbild-Schreiben, Gesten (2/3 Finger tippen = Rückgängig/Wiederholen)
- **OneDrive-Sicherung** (automatisch, sobald online) und Sicherung als Datei
- Export als PDF, Bild oder FingerNote-Datei

## OneDrive einrichten (einmalig, kostenlos)
Damit sich FingerNote mit OneDrive verbinden darf, braucht es eine eigene „App-Registrierung“ bei Microsoft:

1. https://portal.azure.com öffnen und mit dem Microsoft-Konto anmelden
   (ein normales Outlook-/Hotmail-Konto reicht).
2. **App-Registrierungen → Neue Registrierung**
   - Name: `FingerNote`
   - Unterstützte Kontotypen: **„Konten in einem beliebigen Organisationsverzeichnis und persönliche Microsoft-Konten“**
   - Umleitungs-URI: Plattform **„Single-Page-Anwendung (SPA)“**, Adresse
     `https://maximal-ctrl.github.io/fingernote/`
3. **Registrieren** → die **Anwendungs-ID (Client-ID)** kopieren.
4. In FingerNote: **Einstellungen → OneDrive** → ID einfügen → **Speichern** → **Mit OneDrive verbinden**.
   (Alternativ die ID in `js/config.js` eintragen, dann gilt sie für alle Geräte.)

Die Sicherung landet in OneDrive unter **Apps/FingerNote** – eine Datei pro FingerNote-Konto.

**Konto auf einem anderen Gerät öffnen:** Damit das geht, muss die App-ID in `js/config.js`
(`ONEDRIVE_CLIENT_ID`) stehen. Dann auf dem neuen Gerät einfach mit Name + Passwort anmelden →
„Konto aus OneDrive holen“ → mit Microsoft anmelden. FingerNote sucht die Sicherung, prüft das
Passwort und holt Konto und Bücher aufs Gerät.
Microsoft lässt Anmeldungen von Web-Apps nach etwa 24 Stunden ablaufen; dann zeigt FingerNote
„OneDrive neu verbinden“ – einmal tippen genügt.

## Datenschutz
Alle Notizen liegen im App-Speicher des Geräts (pro Konto getrennt) und – wenn verbunden – in deiner
eigenen OneDrive. Passwörter werden nur als Hash gespeichert (PBKDF2). Passwort und Anmeldecode schützen den Zugang in der App;
die Daten selbst sind nicht verschlüsselt. Der Anmeldecode steht im öffentlichen Quelltext.

## Aktualisieren
Neue Version hochladen und in `sw.js` die `VERSION` erhöhen (siehe `CLAUDE.md`).

## Technik
Reines HTML/CSS/JavaScript ohne Build-Schritt. PDF-Import über [pdf.js](https://mozilla.github.io/pdf.js/)
(Apache-2.0, im Ordner `lib/`). Einige Symbolformen sind an [Lucide](https://lucide.dev) angelehnt (ISC).
