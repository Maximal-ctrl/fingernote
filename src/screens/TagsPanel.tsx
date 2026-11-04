import { useEffect, useState } from 'react';
import { SquareCheck, Star, CircleHelp, Lightbulb } from 'lucide-react';
import { Modal } from '../ui/ui';
import { listTags, toggleTagDone, type TagHit, type TagKind } from '../db/repo';
import { navigate, pagePath } from '../lib/router';
import { pageTitle } from '../lib/text';
import { flushAll } from '../canvas/PageEditor';

const GROUPS: { id: TagKind; label: string; icon: React.ReactNode }[] = [
  { id: 'todo', label: 'To-Dos', icon: <SquareCheck size={16} /> },
  { id: 'important', label: 'Wichtig', icon: <Star size={16} /> },
  { id: 'question', label: 'Fragen', icon: <CircleHelp size={16} /> },
  { id: 'idea', label: 'Ideen', icon: <Lightbulb size={16} /> },
];

export function TagsPanel({ onClose }: { onClose: () => void }) {
  const [tags, setTags] = useState<TagHit[] | null>(null);
  const [openOnly, setOpenOnly] = useState(true);

  const reload = async () => {
    await flushAll();
    setTags(await listTags());
  };
  useEffect(() => { void reload(); }, []);

  const shown = (tags ?? []).filter((t) => !(openOnly && t.tag === 'todo' && t.done));

  return (
    <Modal title="Tags" onClose={onClose} size="lg">
      <label className="check pad-x">
        <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
        Erledigte To-Dos ausblenden
      </label>
      {tags === null ? (
        <p className="muted pad">Lädt …</p>
      ) : shown.length === 0 ? (
        <p className="muted pad">Noch keine Tags. Markiere eine Zeile im Text mit Strg 1 (To-Do), Strg 2 (Wichtig), Strg 3 (Frage) oder Strg 4 (Idee).</p>
      ) : (
        GROUPS.map((g) => {
          const list = shown.filter((t) => t.tag === g.id);
          if (!list.length) return null;
          return (
            <section key={g.id} className="tag-group">
              <h3 className="tag-head">{g.icon} {g.label} <span className="muted">({list.length})</span></h3>
              <ul>
                {list.map((t) => (
                  <li key={`${t.block.id}-${t.index}`} className="tag-row">
                    {t.tag === 'todo' && (
                      <input
                        type="checkbox"
                        checked={t.done}
                        aria-label={`${t.text} erledigt`}
                        onChange={async () => { await toggleTagDone(t.block.id, t.index); await reload(); }}
                      />
                    )}
                    <button type="button" className={`tag-link ${t.done ? 'is-done' : ''}`} onClick={() => { onClose(); navigate(pagePath(t.page.notebookId, t.page.id)); }}>
                      <span className="tag-text">{t.text}</span>
                      <span className="muted small">{t.notebookTitle} › {t.sectionTitle} › {pageTitle(t.page.title)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </Modal>
  );
}
