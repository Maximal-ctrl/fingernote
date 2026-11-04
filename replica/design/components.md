# Fingernote Komponenten (aus Recon S01–S12)

Icons: Lucide (ISC-Lizenz). Schrift: Inter (SIL OFL, lokal gebündelt über @fontsource-variable/inter).
Keine Logos, Icons, Vorlagen oder Texte der Originale. Alle Labels sind neu auf Deutsch geschrieben.

Button
  variants  primary, secondary, ghost, danger, icon
  sizes     sm 28px, md 36px, icon 34x34
  states    default, hover (surface-2), active, focus-visible (2px Ring accent, 2px Abstand), disabled (50 % Deckkraft)
  tokens    primary: bg accent / text on-accent; radius sm; font sm/600
  a11y      echtes <button>, Icon-Buttons mit aria-label + title (Tooltip)
  used on   alle

Notizbuch-Cover
  variants  8 Coverfarben, Favorit-Stern
  states    default, hover (leicht angehoben, shadow pop), focus-visible, Kontextmenü (Rechtsklick / ⋯)
  tokens    radius md (Rücken links radius sm), shadow card
  a11y      <button> mit Notizbuchnamen, Enter öffnet
  used on   S01

Abschnitts-Tab
  variants  Farbe pro Abschnitt (8 Farben)
  states    default, aktiv (Farbbalken links 4px + surface-2), umbenennen (Inline-Input), drag
  a11y      role=tab innerhalb role=tablist (vertikal), Doppelklick/F2 = umbenennen
  used on   S03

Seitenlisten-Eintrag
  variants  Ebene 0, 1, 2 (Einrückung 16px je Ebene)
  states    default, aktiv (accent-soft), hover, drag (Einfügelinie accent), umbenennen
  a11y      <button>, Pfeiltasten ↑/↓ wechseln Seite
  used on   S03

Toolbar-Werkzeug
  variants  Auswählen/Tippen, Stift, Marker, Radierer, Lasso, Form, Bild, Papier
  states    aktiv (accent-soft + Text accent), inaktiv, focus-visible
  a11y      aria-pressed, Tastenkürzel im Tooltip (T, P, H, E, L, S)
  used on   S04/S05

Farbpunkt
  variants  8 Stiftfarben, 6 Markerfarben
  states    gewählt (Ring 2px text), hover
  a11y      aria-label mit Farbnamen, aria-pressed
  used on   S05

Textcontainer
  states    leer (Platzhalter beim Fokus), fokussiert (dünner Rahmen + Ziehleiste oben, Griff rechts für Breite), Lasso-ausgewählt
  behaviour Klick auf leere Leinwand im Tipp-Modus legt einen Container an; leer + Fokus verloren = wird entfernt
  a11y      contenteditable mit role=textbox aria-multiline
  used on   S04

Papierhintergrund
  variants  leer, liniert (32px), kariert (24px), gepunktet (24px), Cornell
  colors    weiß, creme, grau, dunkel
  used on   S04, S06

Modal       Overlay 40 % schwarz, Fokus gefangen, Esc schließt, Titel als h2     S02, S08, S10
Popover     an Button verankert, Klick außerhalb/Esc schließt                     S06, S05
Kontextmenü Rechtsklick oder ⋯-Button, Pfeiltasten, Esc                           S11
Toast       unten mittig, 3 s, Varianten info/fehler, role=status                 alle
Suchfeld    Strg+F fokussiert, Esc leert, Treffer live                             S07
Tag-Symbol  To-Do (Checkbox, abhakbar), Wichtig (Stern), Frage (?), Idee (Glühbirne) – als Absatz-Präfix, Strg+1..4   S04, S09
