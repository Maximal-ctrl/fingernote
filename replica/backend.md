# Backend: Fingernote

Entscheidung (aus architecture.md, Vorgabe des Nutzers): **local-first, kein Server.** Alles läuft im Browser,
Daten liegen in IndexedDB (Dexie). Damit entfallen Auth, Payments, E-Mail und Jobs. Was die Skill sonst
fordert, ist unten Punkt für Punkt eingeordnet.

| Bereich | Status | Wie |
| --- | --- | --- |
| Auth | entfällt | Einzelnutzer, Daten sind per Same-Origin-Policy an localhost:5173 gebunden |
| Datenbank | erledigt | `src/db/db.ts` (Schema v1), Migrationen über `this.version(n).stores()` von Dexie |
| Zugriffsregeln | entfällt | kein zweiter Nutzer; Referenzschema mit `user_id` für einen späteren Server in `replica/schema.sql` |
| Seed | erledigt | `src/db/seed.ts`, Button „Beispiel-Notizbuch ansehen" im Leerzustand, erfundener Inhalt |
| Backups | erledigt | Einstellungen → Backup exportieren/importieren (eine JSON-Datei inkl. Bilder und PDFs) |
| Payments | entfällt | privat genutzt, siehe replica-launch |
| E-Mail / Jobs | entfällt | — |
| Integrationen | keine | keine Drittanbieter-APIs; zur Laufzeit keine Netzwerkzugriffe |
| `.env.example` | nicht nötig | es gibt keine Secrets |

Später, falls Sync gewünscht: Supabase (Postgres + Auth + Storage) mit `replica/schema.sql`, RLS auf `user_id`,
Konfliktauflösung pro Block/Strich (last-writer-wins pro Objekt-ID funktioniert, weil Inhalte schon so zerlegt sind).

## Security checklist

- [x] secrets only in env vars: es gibt keine
- [x] input validated: Backup-Import prüft Format und Version, Text-HTML wird beim Einfügen, Ablegen und Import bereinigt (`src/lib/sanitize.ts`, Allowlist ohne Skripte/Event-Handler)
- [n/a] authorisation per record: ein Nutzer
- [n/a] rate limits: kein Server
- [n/a] webhooks
- [x] uploads: Typ geprüft (Bild/PDF), Limits 25 MB pro Bild, 300 MB pro PDF, alles bleibt lokal; pdf.js rendert in einem Worker
- [x] no user data in URLs or logs: der Suchbegriff steht nur im Hash (`#…?q=`), der nie an einen Server geht
- [x] dependencies audited: `npm audit` → 0 vulnerabilities (2026-11-04)
- [x] privacy: keine Auftragsverarbeiter, keine Analytics, keine Cookies
