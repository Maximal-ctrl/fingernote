import { useEffect, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { Modal, Button, toast } from '../ui/ui';
import { importPdf, PdfImportError } from '../lib/importPdf';
import { navigate, pagePath } from '../lib/router';

export function PdfImportModal({ notebookId, onClose }: { notebookId?: string; onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    input.current?.click();
  }, []);

  const run = async (file: File) => {
    setError('');
    setProgress({ done: 0, total: 0 });
    try {
      const r = await importPdf(file, { notebookId }, (done, total) => setProgress({ done, total }));
      toast(`${r.pages} ${r.pages === 1 ? 'Seite' : 'Seiten'} importiert.`);
      onClose();
      navigate(pagePath(r.notebookId, r.pageId));
    } catch (e) {
      setProgress(null);
      setError(e instanceof PdfImportError ? e.message : 'Beim Import ist etwas schiefgelaufen.');
    }
  };

  return (
    <Modal title="PDF importieren" onClose={onClose} size="sm">
      <div
        className={`dropzone ${drag ? 'is-drag' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) void run(f);
        }}
      >
        <FileUp size={28} aria-hidden />
        {progress ? (
          <>
            <p><strong>Seiten werden angelegt …</strong></p>
            <progress max={progress.total || 1} value={progress.done} aria-label="Fortschritt" />
            <p className="muted small">{progress.total ? `${progress.done} von ${progress.total}` : 'PDF wird gelesen'}</p>
          </>
        ) : (
          <>
            <p>PDF hierher ziehen oder auswählen.<br /><span className="muted small">{notebookId ? 'Wird als neuer Abschnitt in diesem Notizbuch angelegt.' : 'Wird als neues Notizbuch angelegt.'} Die Datei bleibt auf deinem Gerät.</span></p>
            <Button variant="primary" onClick={() => input.current?.click()}>Datei auswählen</Button>
          </>
        )}
        {error && <p className="error-text" role="alert">{error}</p>}
      </div>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void run(f);
        }}
      />
    </Modal>
  );
}
