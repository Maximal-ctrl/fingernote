import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus, FileUp, Pencil, Trash2, IndentIncrease, IndentDecrease, ArrowUp, ArrowDown, FolderInput, PanelLeft,
  ChevronLeft, FilePlus2, CornerDownRight,
} from 'lucide-react';
import { db, type Page, type Section } from '../db/db';
import {
  createPage, createSection, movePageToSection, reorderPages, reorderSections, touchNotebook, trashPage,
  trashSection, updatePage, updateSection, restorePage,
} from '../db/repo';
import { AppHeader } from '../ui/AppHeader';
import { Button, ConfirmDialog, IconButton, InlineEdit, toast, useMenu, type MenuItem } from '../ui/ui';
import { navigate, pagePath } from '../lib/router';
import { SECTION_COLORS } from '../lib/palette';
import { pageTitle, shortDateFmt } from '../lib/text';
import { settings } from '../lib/store';
import { PageEditor } from '../canvas/PageEditor';
import { PdfImportModal } from './PdfImportModal';

const lastPageOfSection = new Map<string, string>();

export function NotebookView({ notebookId, pageId, q }: { notebookId: string; pageId?: string; q?: string }) {
  const notebook = useLiveQuery(async () => (await db.notebooks.get(notebookId)) ?? null, [notebookId]);
  const sections = useLiveQuery(
    async () => (await db.sections.where('notebookId').equals(notebookId).toArray()).filter((s) => !s.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder),
    [notebookId],
  );
  const allPages = useLiveQuery(
    async () => (await db.pages.where('notebookId').equals(notebookId).toArray()).filter((p) => !p.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder),
    [notebookId],
  );
  const sidebar = settings.use((s) => s.sidebar);
  const [narrow, setNarrow] = useState(() => window.innerWidth < 900);
  const [drawer, setDrawer] = useState(false);
  const [importing, setImporting] = useState(false);
  const [renamingSection, setRenamingSection] = useState<string | null>(null);
  const [renamingPage, setRenamingPage] = useState<string | null>(null);
  const [confirmSection, setConfirmSection] = useState<Section | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const menu = useMenu();

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => { void touchNotebook(notebookId); }, [notebookId]);

  const page = allPages?.find((p) => p.id === pageId);
  const sectionId = page?.sectionId ?? selectedSection ?? sections?.[0]?.id;
  const section = sections?.find((s) => s.id === sectionId);
  const pages = useMemo(() => (allPages ?? []).filter((p) => p.sectionId === sectionId), [allPages, sectionId]);

  // Ungültige oder fehlende Seite → erste Seite des Abschnitts.
  // Eine gerade angelegte Seite fehlt evtl. noch in der Live-Abfrage, deshalb erst in der DB nachsehen.
  useEffect(() => {
    if (!allPages || !sections) return;
    if (page) {
      lastPageOfSection.set(page.sectionId, page.id);
      return;
    }
    let live = true;
    void (async () => {
      if (pageId) {
        const p = await db.pages.get(pageId);
        if (p && !p.deletedAt && p.notebookId === notebookId) return;
      }
      const target = pages[0];
      if (live && target) navigate(pagePath(notebookId, target.id), true);
    })();
    return () => { live = false; };
  }, [allPages, sections, page, pages, pageId, notebookId]);

  // Alt+N: neue Seite
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'n' && sectionId) {
        e.preventDefault();
        void addPage();
      }
      if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && page) {
        e.preventDefault();
        const i = pages.findIndex((p) => p.id === page.id);
        const next = pages[i + (e.key === 'ArrowDown' ? 1 : -1)];
        if (next) openPage(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (notebook === null) {
    return (
      <div className="screen">
        <AppHeader />
        <section className="empty-state">
          <h2>Notizbuch nicht gefunden</h2>
          <p className="muted">Vielleicht wurde es gelöscht.</p>
          <Button variant="primary" onClick={() => navigate('/')}>Zur Bibliothek</Button>
        </section>
      </div>
    );
  }

  const openPage = (p: Page) => {
    navigate(pagePath(notebookId, p.id));
    if (narrow) setDrawer(false);
  };

  const openSection = (s: Section) => {
    setSelectedSection(s.id);
    const remembered = lastPageOfSection.get(s.id);
    const target = (allPages ?? []).find((p) => p.id === remembered) ?? (allPages ?? []).find((p) => p.sectionId === s.id);
    if (target) navigate(pagePath(notebookId, target.id));
    else navigate(`/nb/${notebookId}`);
  };

  async function addPage(opts: { afterId?: string; level?: number } = {}) {
    if (!sectionId) return;
    const p = await createPage(sectionId, opts);
    openPage(p);
  }

  const addSection = async () => {
    const { section: s, page: p } = await createSection(notebookId);
    setSelectedSection(s.id);
    navigate(pagePath(notebookId, p.id));
    setRenamingSection(s.id);
  };

  const sectionMenu = (e: { clientX: number; clientY: number; preventDefault?: () => void }, s: Section) =>
    menu.open(e, [
      { label: 'Umbenennen', icon: <Pencil size={16} />, onSelect: () => setRenamingSection(s.id) },
      { label: 'Farbe', colors: SECTION_COLORS.map((c) => ({ value: c, label: `Farbe ${c}`, selected: s.color === c, onSelect: () => updateSection(s.id, { color: c }) })) },
      { label: 'Neue Seite', icon: <FilePlus2 size={16} />, onSelect: async () => { const p = await createPage(s.id); openPage(p); } },
      { separator: true, label: '' },
      { label: 'In den Papierkorb …', icon: <Trash2 size={16} />, danger: true, onSelect: () => setConfirmSection(s) },
    ]);

  const pageMenu = (e: { clientX: number; clientY: number; preventDefault?: () => void }, p: Page) => {
    const i = pages.findIndex((x) => x.id === p.id);
    const others = (sections ?? []).filter((s) => s.id !== p.sectionId);
    const items: MenuItem[] = [
      { label: 'Umbenennen', icon: <Pencil size={16} />, onSelect: () => setRenamingPage(p.id) },
      { label: 'Unterseite hinzufügen', icon: <CornerDownRight size={16} />, onSelect: () => addPage({ afterId: p.id, level: Math.min(2, p.level + 1) }) },
      { label: 'Einrücken (Unterseite)', icon: <IndentIncrease size={16} />, disabled: p.level >= 2 || i === 0, onSelect: () => updatePage(p.id, { level: p.level + 1 }) },
      { label: 'Ausrücken', icon: <IndentDecrease size={16} />, disabled: p.level === 0, onSelect: () => updatePage(p.id, { level: p.level - 1 }) },
      { label: 'Nach oben', icon: <ArrowUp size={16} />, disabled: i === 0, onSelect: () => movePage(p.id, i - 1) },
      { label: 'Nach unten', icon: <ArrowDown size={16} />, disabled: i === pages.length - 1, onSelect: () => movePage(p.id, i + 1) },
    ];
    if (others.length) {
      items.push({ separator: true, label: '' });
      for (const s of others) {
        items.push({ label: `Verschieben nach „${s.title}“`, icon: <FolderInput size={16} />, onSelect: async () => { await movePageToSection(p.id, s.id); toast(`Seite nach „${s.title}“ verschoben.`); } });
      }
    }
    items.push({ separator: true, label: '' });
    items.push({ label: 'In den Papierkorb', icon: <Trash2 size={16} />, danger: true, onSelect: () => removePage(p) });
    menu.open(e, items);
  };

  const removePage = async (p: Page) => {
    const i = pages.findIndex((x) => x.id === p.id);
    await trashPage(p.id);
    toast('Seite liegt im Papierkorb.', 'info', { label: 'Rückgängig', run: () => void restorePage(p.id) });
    if (p.id === pageId) {
      const next = pages[i + 1] ?? pages[i - 1];
      if (next) navigate(pagePath(notebookId, next.id), true);
      else navigate(`/nb/${notebookId}`, true);
    }
  };

  const movePage = (id: string, to: number) => {
    const ids = pages.map((p) => p.id).filter((x) => x !== id);
    ids.splice(Math.max(0, Math.min(to, ids.length)), 0, id);
    void reorderPages(ids);
  };

  const showSidebar = narrow ? drawer : sidebar;

  return (
    <div className="screen notebook">
      <AppHeader
        left={
          <div className="nb-head">
            <IconButton label="Zur Bibliothek" onClick={() => navigate('/')}><ChevronLeft size={20} /></IconButton>
            <IconButton label={showSidebar ? 'Seitenleiste ausblenden' : 'Seitenleiste einblenden'} onClick={() => (narrow ? setDrawer(!drawer) : settings.set({ sidebar: !sidebar }))}>
              <PanelLeft size={18} />
            </IconButton>
            <span className="nb-dot" style={{ background: notebook?.color }} aria-hidden />
            <h1 className="nb-title" title={notebook?.title}>{notebook?.title ?? ''}</h1>
          </div>
        }
      />
      <div className="nb-body">
        {showSidebar && narrow && <div className="drawer-scrim" onClick={() => setDrawer(false)} />}
        {showSidebar && (
          <nav className={`sidebar ${narrow ? 'is-drawer' : ''}`} aria-label="Abschnitte und Seiten">
            <div className="sections-col">
              <div className="col-head">Abschnitte</div>
              <SortableList
                items={sections ?? []}
                onReorder={(ids) => reorderSections(ids)}
                render={(s) => (
                  <div
                    className={`section-tab ${s.id === sectionId ? 'is-active' : ''}`}
                    style={{ ['--sec' as string]: s.color }}
                    role="tab"
                    aria-selected={s.id === sectionId}
                    tabIndex={0}
                    onClick={() => openSection(s)}
                    onDoubleClick={() => setRenamingSection(s.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') openSection(s); if (e.key === 'F2') setRenamingSection(s.id); }}
                    onContextMenu={(e) => sectionMenu(e, s)}
                  >
                    {renamingSection === s.id ? (
                      <InlineEdit label="Abschnittsname" value={s.title} onCommit={(t) => { void updateSection(s.id, { title: t }); setRenamingSection(null); }} onCancel={() => setRenamingSection(null)} />
                    ) : (
                      <span className="tab-label">{s.title}</span>
                    )}
                  </div>
                )}
              />
              <div className="col-foot">
                <Button variant="ghost" size="sm" onClick={addSection}><Plus size={15} aria-hidden /> Abschnitt</Button>
                <Button variant="ghost" size="sm" onClick={() => setImporting(true)}><FileUp size={15} aria-hidden /> PDF</Button>
              </div>
            </div>
            <div className="pages-col">
              <div className="col-head row between">
                <span className="truncate">{section?.title ?? ''}</span>
                <IconButton label="Neue Seite" shortcut="Alt N" onClick={() => addPage()} disabled={!sectionId}><Plus size={17} /></IconButton>
              </div>
              {pages.length === 0 ? (
                <div className="col-empty muted small">Keine Seiten in diesem Abschnitt.</div>
              ) : (
                <SortableList
                  items={pages}
                  dragType="page"
                  onReorder={(ids) => reorderPages(ids)}
                  onDropPage={async (pid, sid) => { if (sid === sectionId) return; await movePageToSection(pid, sid); toast('Seite verschoben.'); }}
                  render={(p) => (
                    <div
                      className={`page-item level-${p.level} ${p.id === pageId ? 'is-active' : ''}`}
                      role="button"
                      tabIndex={0}
                      aria-current={p.id === pageId ? 'page' : undefined}
                      onClick={() => openPage(p)}
                      onDoubleClick={() => setRenamingPage(p.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') openPage(p); if (e.key === 'F2') setRenamingPage(p.id); }}
                      onContextMenu={(e) => pageMenu(e, p)}
                    >
                      {renamingPage === p.id ? (
                        <InlineEdit label="Seitentitel" value={p.title} onCommit={(t) => { void updatePage(p.id, { title: t }); setRenamingPage(null); }} onCancel={() => setRenamingPage(null)} />
                      ) : (
                        <>
                          <span className="page-name">{pageTitle(p.title)}</span>
                          <span className="page-meta">{shortDateFmt.format(p.createdAt)}</span>
                        </>
                      )}
                    </div>
                  )}
                />
              )}
              <div className="col-foot">
                <Button variant="ghost" size="sm" onClick={() => addPage()} disabled={!sectionId}><Plus size={15} aria-hidden /> Seite</Button>
              </div>
            </div>
          </nav>
        )}
        <main className="nb-main">
          {page && notebook ? (
            <PageEditor key={page.id} page={page} notebook={notebook} q={q} />
          ) : allPages && sections && pages.length === 0 && section ? (
            <section className="empty-state">
              <h2>Dieser Abschnitt ist leer</h2>
              <p className="muted">Leg eine Seite an, um loszulegen.</p>
              <Button variant="primary" onClick={() => addPage()}><Plus size={16} aria-hidden /> Seite hinzufügen</Button>
            </section>
          ) : allPages && sections && !sections.length ? (
            <section className="empty-state">
              <h2>Keine Abschnitte</h2>
              <p className="muted">Alle Abschnitte liegen im Papierkorb.</p>
              <Button variant="primary" onClick={addSection}><Plus size={16} aria-hidden /> Abschnitt anlegen</Button>
            </section>
          ) : (
            <div className="stage-loading">Lädt …</div>
          )}
        </main>
      </div>
      {importing && <PdfImportModal notebookId={notebookId} onClose={() => setImporting(false)} />}
      {confirmSection && (
        <ConfirmDialog
          title="Abschnitt in den Papierkorb?"
          text={<>„{confirmSection.title}“ und alle Seiten darin kommen in den Papierkorb. Dort kannst du sie wiederherstellen.</>}
          confirmLabel="In den Papierkorb"
          danger
          onConfirm={async () => {
            await trashSection(confirmSection.id);
            const rest = (sections ?? []).filter((s) => s.id !== confirmSection.id);
            if (confirmSection.id === sectionId) {
              setSelectedSection(rest[0]?.id ?? null);
              navigate(`/nb/${notebookId}`, true);
            }
          }}
          onClose={() => setConfirmSection(null)}
        />
      )}
      {menu.node}
    </div>
  );
}

/* ---------- Sortierbare Liste (Pointer Events: Maus, Finger per Lang-Drücken, Stift) ---------- */

let suppressClick = false;

function SortableList<T extends { id: string }>({ items, render, onReorder, onDropPage, dragType = 'section' }: {
  items: T[];
  render: (item: T) => React.ReactNode;
  onReorder: (ids: string[]) => void;
  /** Seiten-Liste: Seite auf einen Abschnitt ziehen */
  onDropPage?: (pageId: string, sectionId: string) => void;
  dragType?: 'section' | 'page';
}) {
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; over: { id: string; pos: 'before' | 'after' | 'into' } | null } | null>(null);
  const [hot, setHot] = useState<string | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLLIElement>, id: string) => {
    if ((e.pointerType === 'mouse' && e.button !== 0) || (e.target as HTMLElement).closest('input')) return;
    const sx = e.clientX, sy = e.clientY, pid = e.pointerId;
    let active = false;
    let over: { id: string; pos: 'before' | 'after' | 'into' } | null = null;
    const start = () => {
      active = true;
      setHot(null);
      setDrag({ id, x: sx, y: sy, over: null });
      navigator.vibrate?.(10);
    };
    const timer = e.pointerType === 'mouse' ? 0 : window.setTimeout(() => { setHot(id); start(); }, 350);
    const blockScroll = (ev: TouchEvent) => { if (active) ev.preventDefault(); };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      const dist = Math.hypot(ev.clientX - sx, ev.clientY - sy);
      if (!active) {
        if (e.pointerType === 'mouse' && dist > 6) start();
        else if (e.pointerType !== 'mouse' && dist > 10) return cleanup(); // normales Scrollen
        if (!active) return;
      }
      ev.preventDefault();
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const target = el?.closest<HTMLElement>('[data-sort-id]');
      over = null;
      if (target) {
        const tType = target.dataset.sortType, tId = target.dataset.sortId!;
        const r = target.getBoundingClientRect();
        if (tType === dragType && tId !== id) over = { id: tId, pos: ev.clientY < r.top + r.height / 2 ? 'before' : 'after' };
        else if (dragType === 'page' && tType === 'section' && onDropPage) over = { id: tId, pos: 'into' };
      }
      setDrag({ id, x: ev.clientX, y: ev.clientY, over });
      window.dispatchEvent(new CustomEvent('fn:sort-over', { detail: over?.pos === 'into' ? over.id : null }));
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      if (active) {
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 50);
        if (over?.pos === 'into') onDropPage?.(id, over.id);
        else if (over) {
          const ids = items.map((x) => x.id).filter((x) => x !== id);
          ids.splice(ids.indexOf(over.id) + (over.pos === 'after' ? 1 : 0), 0, id);
          onReorder(ids);
        }
      }
      cleanup();
    };
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('touchmove', blockScroll);
      window.dispatchEvent(new CustomEvent('fn:sort-over', { detail: null }));
      setDrag(null);
      setHot(null);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('touchmove', blockScroll, { passive: false });
  };

  // Abschnitte leuchten auf, wenn eine Seite über sie gezogen wird
  const [into, setInto] = useState<string | null>(null);
  useEffect(() => {
    if (dragType !== 'section') return;
    const f = (e: Event) => setInto((e as CustomEvent).detail);
    window.addEventListener('fn:sort-over', f);
    return () => window.removeEventListener('fn:sort-over', f);
  }, [dragType]);

  const dragged = drag && items.find((x) => x.id === drag.id);
  return (
    <ul className={`sortable ${drag ? 'is-sorting' : ''}`} role={dragType === 'section' ? 'tablist' : undefined} aria-orientation={dragType === 'section' ? 'vertical' : undefined}>
      {items.map((item) => {
        const cls = drag?.over?.id === item.id && drag.over.pos !== 'into' ? `drop-${drag.over.pos}` : into === item.id ? 'drop-into' : '';
        return (
          <li
            key={item.id}
            role={dragType === 'section' ? 'presentation' : undefined}
            data-sort-id={item.id}
            data-sort-type={dragType}
            className={`${cls} ${drag?.id === item.id ? 'is-dragging' : ''} ${hot === item.id ? 'is-hot' : ''}`}
            onPointerDown={(e) => onPointerDown(e, item.id)}
            onClickCapture={(e) => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); } }}
            onContextMenu={(e) => { if (drag) e.preventDefault(); }}
          >
            {render(item)}
          </li>
        );
      })}
      {drag && dragged && createPortal(
        <div className="drag-ghost" style={{ left: drag.x + 12, top: drag.y + 8 }} aria-hidden>
          {'title' in dragged ? String((dragged as { title?: string }).title || 'Unbenannte Seite') : ''}
        </div>,
        document.body,
      )}
    </ul>
  );
}
