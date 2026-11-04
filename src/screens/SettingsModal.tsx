import { useEffect, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button, Modal, toast } from '../ui/ui';
import { settings, type Theme } from '../lib/store';
import { downloadBlob, exportBackup, importBackup } from '../lib/backup';
import { flushAll } from '../canvas/PageEditor';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const s = settings.use();
  const fileRef = useRef<HTMLInputElement>(null);
  const [usage, setUsage] = useState<string>('');
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => {
      if (e.usage !== undefined) setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB belegt`);
    });
    navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  const doExport = async () => {
    setBusy(true);
    try {
      await flushAll();
      const blob = await exportBackup();
      downloadBlob(blob, `fingernote-backup-${new Date().toISOString().slice(0, 10)}.json`);
      toast('Backup gespeichert.');
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (f: File) => {
    setBusy(true);
    try {
      const r = await importBackup(f);
      toast(`${r.notebooks} Notizbücher mit ${r.pages} Seiten importiert.`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Einstellungen" onClose={onClose}>
      <div className="form">
        <fieldset className="field">
          <legend>Darstellung</legend>
          <div className="segmented" role="radiogroup" aria-label="Farbschema">
            {([['system', 'System'], ['light', 'Hell'], ['dark', 'Dunkel']] as [Theme, string][]).map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={s.theme === id} className={s.theme === id ? 'is-selected' : ''} onClick={() => settings.set({ theme: id })}>{label}</button>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend>Zeichnen</legend>
          <label className="check">
            <input type="checkbox" checked={s.penOnly} onChange={(e) => settings.set({ penOnly: e.target.checked })} />
            Nur der Stift zeichnet, mit dem Finger wird gescrollt
          </label>
          <p className="muted small">Aus: Du kannst mit dem Finger schreiben, zwei Finger zoomen und verschieben. Wird automatisch eingeschaltet, sobald ein Stift erkannt wird.</p>
        </fieldset>
        <fieldset className="field">
          <legend>Daten</legend>
          <p className="muted small">
            Alle Notizen liegen nur in diesem Browser auf diesem Gerät. {usage}
            {persisted === false && ' Der Browser darf den Speicher bei Platzmangel räumen, also regelmäßig ein Backup sichern.'}
            {persisted && ' Der Speicher ist als dauerhaft markiert.'}
          </p>
          <div className="row gap-8 wrap">
            <Button onClick={doExport} disabled={busy}><Download size={16} aria-hidden /> Backup exportieren</Button>
            <Button onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={16} aria-hidden /> Backup importieren</Button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void doImport(f); }} />
        </fieldset>
        <fieldset className="field">
          <legend>Tastenkürzel</legend>
          <dl className="shortcuts">
            <dt>T P H E L S</dt><dd>Tippen, Stift, Marker, Radierer, Lasso, Formen</dd>
            <dt>Strg Z / Strg Y</dt><dd>Rückgängig / Wiederholen</dd>
            <dt>Strg F</dt><dd>Suchen</dd>
            <dt>Alt N</dt><dd>Neue Seite</dd>
            <dt>Alt ↑ / ↓</dt><dd>Vorherige / nächste Seite</dd>
            <dt>Strg 1 – 4</dt><dd>To-Do, Wichtig, Frage, Idee</dd>
            <dt>Strg + / − / 0</dt><dd>Zoom</dd>
            <dt>Strg A, C, X, V, D</dt><dd>Alles auswählen, kopieren, ausschneiden, einfügen, duplizieren</dd>
            <dt>Umschalt beim Zeichnen</dt><dd>Formen gerade bzw. quadratisch</dd>
          </dl>
        </fieldset>
      </div>
    </Modal>
  );
}
