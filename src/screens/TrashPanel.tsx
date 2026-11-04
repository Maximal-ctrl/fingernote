import { useLiveQuery } from 'dexie-react-hooks';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { db } from '../db/db';
import { emptyTrash, purgePage, restorePage } from '../db/repo';
import { Button, ConfirmDialog, IconButton, Modal, toast } from '../ui/ui';
import { pageTitle, shortDateFmt } from '../lib/text';

export function TrashPanel({ onClose }: { onClose: () => void }) {
  const data = useLiveQuery(async () => {
    const [pages, sections, notebooks] = await Promise.all([db.pages.toArray(), db.sections.toArray(), db.notebooks.toArray()]);
    const sec = new Map(sections.map((s) => [s.id, s]));
    const nb = new Map(notebooks.map((n) => [n.id, n]));
    return pages
      .filter((p) => p.deletedAt)
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
      .map((p) => ({ page: p, section: sec.get(p.sectionId)?.title ?? '', notebook: nb.get(p.notebookId)?.title ?? '' }));
  }, []);
  const [confirm, setConfirm] = useState(false);

  return (
    <Modal
      title="Papierkorb"
      onClose={onClose}
      size="lg"
      footer={data?.length ? <Button variant="danger" onClick={() => setConfirm(true)}><Trash2 size={16} aria-hidden /> Papierkorb leeren</Button> : undefined}
    >
      {!data ? (
        <p className="muted pad">Lädt …</p>
      ) : data.length === 0 ? (
        <p className="muted pad">Der Papierkorb ist leer. Gelöschte Seiten landen hier, bis du sie wiederherstellst oder endgültig löschst.</p>
      ) : (
        <ul className="trash-list">
          {data.map(({ page, section, notebook }) => (
            <li key={page.id} className="trash-row">
              <div>
                <div className="strong">{pageTitle(page.title)}</div>
                <div className="muted small">{notebook} › {section} · gelöscht am {shortDateFmt.format(page.deletedAt!)}</div>
              </div>
              <div className="row gap-4">
                <Button size="sm" onClick={async () => { await restorePage(page.id); toast('Seite wiederhergestellt.'); }}><RotateCcw size={15} aria-hidden /> Wiederherstellen</Button>
                <IconButton label={`„${pageTitle(page.title)}“ endgültig löschen`} onClick={() => purgePage(page.id)}><Trash2 size={16} /></IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}
      {confirm && (
        <ConfirmDialog title="Papierkorb leeren?" text="Alle Seiten im Papierkorb werden endgültig gelöscht." confirmLabel="Endgültig löschen" danger onConfirm={() => emptyTrash().then(() => toast('Papierkorb geleert.'))} onClose={() => setConfirm(false)} />
      )}
    </Modal>
  );
}
