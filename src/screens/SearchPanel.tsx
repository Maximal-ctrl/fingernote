import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Modal } from '../ui/ui';
import { search, type SearchHit } from '../db/repo';
import { ui } from '../lib/store';
import { navigate, pagePath } from '../lib/router';
import { pageTitle, shortDateFmt } from '../lib/text';
import { flushAll } from '../canvas/PageEditor';

export function SearchPanel({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState(ui.get().searchQuery);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      ui.set({ searchQuery: q });
      if (!q.trim()) { setHits(null); return; }
      await flushAll();
      const r = await search(q);
      if (live) { setHits(r); setActive(0); }
    }, 120);
    return () => { live = false; clearTimeout(t); };
  }, [q]);

  const open = (h: SearchHit) => {
    onClose();
    navigate(pagePath(h.page.notebookId, h.page.id, q.trim()));
  };

  return (
    <Modal title="Suchen" onClose={onClose} size="lg">
      <div className="search-box">
        <Search size={18} aria-hidden />
        <input
          autoFocus
          type="search"
          value={q}
          placeholder="In allen Notizbüchern suchen"
          aria-label="Suchbegriff"
          aria-controls="search-results"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (!hits?.length) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(hits.length - 1, a + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
            if (e.key === 'Enter') open(hits[active]);
          }}
        />
      </div>
      <div id="search-results" className="results" role="listbox" aria-label="Treffer">
        {hits === null ? (
          <p className="muted small pad">Durchsucht Seitentitel und getippten Text. Handschrift wird nicht erkannt.</p>
        ) : hits.length === 0 ? (
          <p className="muted pad">Nichts gefunden für „{q}“.</p>
        ) : (
          hits.map((h, i) => (
            <button
              key={h.page.id}
              type="button"
              role="option"
              aria-selected={i === active}
              className={`result ${i === active ? 'is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => open(h)}
            >
              <span className="result-title">{pageTitle(h.page.title)}</span>
              <span className="result-path">
                <span className="dot" style={{ background: h.sectionColor }} aria-hidden />
                {h.notebookTitle} › {h.sectionTitle} · {shortDateFmt.format(h.page.updatedAt)}
              </span>
              {h.snippet && (
                <span className="result-snippet">{h.snippet.before}<mark>{h.snippet.match}</mark>{h.snippet.after}</span>
              )}
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}
