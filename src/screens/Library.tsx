import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, FileUp, Star, Ellipsis, Pencil, Trash2, Palette } from 'lucide-react';
import { db, type Notebook } from '../db/db';
import { deleteNotebook, updateNotebook } from '../db/repo';
import { AppHeader } from '../ui/AppHeader';
import { Button, ConfirmDialog, IconButton, InlineEdit, useMenu, toast } from '../ui/ui';
import { NewNotebookModal } from './NewNotebookModal';
import { PdfImportModal } from './PdfImportModal';
import { COVER_COLORS } from '../lib/palette';
import { shortDateFmt } from '../lib/text';
import { LogoMark } from '../ui/Logo';
import { seedExample } from '../db/seed';
import { navigate, pagePath } from '../lib/router';

export function Library() {
  const notebooks = useLiveQuery(() => db.notebooks.orderBy('sortOrder').toArray(), []);
  const counts = useLiveQuery(async () => {
    const m = new Map<string, number>();
    (await db.pages.toArray()).forEach((p) => !p.deletedAt && m.set(p.notebookId, (m.get(p.notebookId) ?? 0) + 1));
    return m;
  }, []);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Notebook | null>(null);
  const menu = useMenu();

  const open = (nb: Notebook) => (window.location.hash = `/nb/${nb.id}`);

  const openMenu = (e: { clientX: number; clientY: number; preventDefault?: () => void }, nb: Notebook) =>
    menu.open(e, [
      { label: 'Umbenennen', icon: <Pencil size={16} />, onSelect: () => setRenaming(nb.id) },
      { label: nb.favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten', icon: <Star size={16} />, onSelect: () => updateNotebook(nb.id, { favorite: !nb.favorite }) },
      { label: 'Coverfarbe', icon: <Palette size={16} />, colors: COVER_COLORS.map((c) => ({ value: c.id, label: c.name, selected: nb.color === c.id, onSelect: () => updateNotebook(nb.id, { color: c.id }) })) },
      { separator: true, label: '' },
      { label: 'Löschen …', icon: <Trash2 size={16} />, danger: true, onSelect: () => setDeleting(nb) },
    ]);

  const favorites = (notebooks ?? []).filter((n) => n.favorite);
  const recent = [...(notebooks ?? [])].sort((a, b) => (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt));

  const grid = (list: Notebook[]) => (
    <ul className="cover-grid">
      {list.map((nb) => (
        <li key={nb.id} className="cover-item">
          <button
            type="button"
            className="cover"
            style={{ ['--cover' as string]: nb.color }}
            onClick={() => open(nb)}
            onContextMenu={(e) => openMenu(e, nb)}
            aria-label={`${nb.title} öffnen`}
          >
            <span className="cover-spine" aria-hidden />
            <span className="cover-label" aria-hidden>{nb.title}</span>
            {nb.favorite && <Star className="cover-star" size={16} aria-label="Favorit" fill="currentColor" />}
          </button>
          <div className="cover-meta">
            {renaming === nb.id ? (
              <InlineEdit label="Notizbuchname" value={nb.title} onCommit={(t) => { void updateNotebook(nb.id, { title: t }); setRenaming(null); }} onCancel={() => setRenaming(null)} />
            ) : (
              <div className="cover-title" title={nb.title}>{nb.title}</div>
            )}
            <div className="cover-sub">
              <span>{counts?.get(nb.id) ?? 0} {(counts?.get(nb.id) ?? 0) === 1 ? 'Seite' : 'Seiten'} · {shortDateFmt.format(nb.updatedAt)}</span>
              <IconButton label={`Optionen für ${nb.title}`} className="cover-more" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); openMenu({ clientX: r.left, clientY: r.bottom }, nb); }}>
                <Ellipsis size={16} />
              </IconButton>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="screen library">
      <AppHeader />
      <main className="library-main">
        <div className="library-head">
          <h1>Bibliothek</h1>
          <div className="row gap-8">
            <Button onClick={() => setImporting(true)}><FileUp size={16} aria-hidden /> PDF importieren</Button>
            <Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} aria-hidden /> Neues Notizbuch</Button>
          </div>
        </div>

        {notebooks === undefined ? (
          <ul className="cover-grid" aria-hidden>{[0, 1, 2].map((i) => <li key={i} className="cover-item"><div className="cover skeleton" /></li>)}</ul>
        ) : notebooks.length === 0 ? (
          <section className="empty-state">
            <LogoMark size={56} />
            <h2>Noch keine Notizbücher</h2>
            <p className="muted">Leg dein erstes an. Tippen, schreiben, zeichnen: alles auf derselben Seite, gespeichert nur auf diesem Gerät.</p>
            <div className="row gap-8 center">
              <Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} aria-hidden /> Notizbuch anlegen</Button>
              <Button onClick={() => setImporting(true)}><FileUp size={16} aria-hidden /> PDF öffnen</Button>
            </div>
            <Button variant="ghost" size="sm" onClick={async () => { const r = await seedExample(); navigate(pagePath(r.notebookId, r.pageId)); }}>Beispiel-Notizbuch ansehen</Button>
          </section>
        ) : (
          <>
            {favorites.length > 0 && (
              <section aria-labelledby="fav-h">
                <h2 id="fav-h" className="group-title">Favoriten</h2>
                {grid(favorites)}
              </section>
            )}
            <section aria-labelledby="all-h">
              <h2 id="all-h" className="group-title">Zuletzt benutzt</h2>
              {grid(recent)}
            </section>
          </>
        )}
      </main>
      {creating && <NewNotebookModal onClose={() => setCreating(false)} />}
      {importing && <PdfImportModal onClose={() => setImporting(false)} />}
      {deleting && (
        <ConfirmDialog
          title="Notizbuch löschen?"
          text={<>„{deleting.title}“ wird mit allen Abschnitten und Seiten endgültig gelöscht. Das lässt sich nicht rückgängig machen. Tipp: vorher in den Einstellungen ein Backup sichern.</>}
          confirmLabel="Endgültig löschen"
          danger
          onConfirm={() => deleteNotebook(deleting.id).then(() => toast('Notizbuch gelöscht.'))}
          onClose={() => setDeleting(null)}
        />
      )}
      {menu.node}
    </div>
  );
}
