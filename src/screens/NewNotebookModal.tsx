import { useState } from 'react';
import { Modal, Button } from '../ui/ui';
import { createNotebook } from '../db/repo';
import { COVER_COLORS } from '../lib/palette';
import type { PaperType } from '../db/db';
import { navigate, pagePath } from '../lib/router';
import { PAPER_TYPES } from '../canvas/paper';

export function NewNotebookModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState(COVER_COLORS[0].id);
  const [paper, setPaper] = useState<PaperType>('lined');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const t = title.trim();
    if (!t) {
      setError('Gib dem Notizbuch einen Namen.');
      return;
    }
    setBusy(true);
    const { notebook, page } = await createNotebook(t, color, { type: paper, color: 'white' });
    onClose();
    navigate(pagePath(notebook.id, page.id));
  };

  return (
    <Modal
      title="Neues Notizbuch"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={submit} disabled={busy}>Erstellen</Button>
        </>
      }
    >
      <form className="form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <label className="field">
          <span>Name</span>
          <input
            autoFocus
            value={title}
            maxLength={80}
            placeholder="z. B. Studium, Projekt Garten, Ideen"
            onChange={(e) => { setTitle(e.target.value); setError(''); }}
            aria-invalid={!!error}
            aria-describedby={error ? 'nb-err' : undefined}
          />
          {error && <span id="nb-err" className="error-text" role="alert">{error}</span>}
        </label>
        <fieldset className="field">
          <legend>Cover</legend>
          <div className="swatches">
            {COVER_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`swatch swatch-lg ${color === c.id ? 'is-selected' : ''}`}
                style={{ background: c.id }}
                aria-label={c.name}
                aria-pressed={color === c.id}
                title={c.name}
                onClick={() => setColor(c.id)}
              />
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend>Papier für neue Seiten</legend>
          <div className="paper-options">
            {PAPER_TYPES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`paper-option ${paper === p.id ? 'is-selected' : ''}`}
                aria-pressed={paper === p.id}
                onClick={() => setPaper(p.id)}
              >
                <span className={`paper-thumb paper-${p.id} paper-c-white`} aria-hidden />
                {p.label}
              </button>
            ))}
          </div>
        </fieldset>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
