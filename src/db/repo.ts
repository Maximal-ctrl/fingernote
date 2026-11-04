import { db, type Notebook, type Section, type Page, type Paper, type Block, type Stroke } from './db';
import { uid } from '../lib/ids';
import { SECTION_COLORS } from '../lib/palette';
import { htmlToText, normalize, pageTitle } from '../lib/text';

const now = () => Date.now();

/* ---------- Notizbücher ---------- */

export async function createNotebook(title: string, color: string, paper: Paper): Promise<{ notebook: Notebook; page: Page }> {
  const t = now();
  const last = await db.notebooks.orderBy('sortOrder').last();
  const notebook: Notebook = {
    id: uid(), title: title.trim(), color, favorite: false, paper,
    sortOrder: (last?.sortOrder ?? 0) + 1, createdAt: t, updatedAt: t, lastOpenedAt: t,
  };
  const section: Section = {
    id: uid(), notebookId: notebook.id, title: 'Notizen', color: SECTION_COLORS[0],
    sortOrder: 1, createdAt: t, updatedAt: t, deletedAt: null,
  };
  const page = newPageRecord(notebook.id, section.id, paper, 1, 0);
  await db.transaction('rw', db.notebooks, db.sections, db.pages, async () => {
    await db.notebooks.add(notebook);
    await db.sections.add(section);
    await db.pages.add(page);
  });
  return { notebook, page };
}

export const updateNotebook = (id: string, patch: Partial<Notebook>) =>
  db.notebooks.update(id, { ...patch, updatedAt: now() });

export const touchNotebook = (id: string) => db.notebooks.update(id, { lastOpenedAt: now() });

export async function deleteNotebook(id: string) {
  await db.transaction('rw', [db.notebooks, db.sections, db.pages, db.blocks, db.strokes, db.assets], async () => {
    const pages = await db.pages.where('notebookId').equals(id).toArray();
    for (const p of pages) await purgePageInTx(p.id);
    await db.sections.where('notebookId').equals(id).delete();
    await db.notebooks.delete(id);
  });
  await removeOrphanAssets();
}

/* ---------- Abschnitte ---------- */

export async function createSection(notebookId: string, title?: string): Promise<{ section: Section; page: Page }> {
  const t = now();
  const all = await db.sections.where('notebookId').equals(notebookId).toArray();
  const live = all.filter((s) => !s.deletedAt);
  const nb = await db.notebooks.get(notebookId);
  const section: Section = {
    id: uid(), notebookId,
    title: title || `Abschnitt ${live.length + 1}`,
    color: SECTION_COLORS[all.length % SECTION_COLORS.length],
    sortOrder: Math.max(0, ...all.map((s) => s.sortOrder)) + 1,
    createdAt: t, updatedAt: t, deletedAt: null,
  };
  const page = newPageRecord(notebookId, section.id, nb?.paper ?? { type: 'lined', color: 'white' }, 1, 0);
  await db.transaction('rw', db.sections, db.pages, async () => {
    await db.sections.add(section);
    await db.pages.add(page);
  });
  return { section, page };
}

export const updateSection = (id: string, patch: Partial<Section>) =>
  db.sections.update(id, { ...patch, updatedAt: now() });

/** Abschnitt samt Seiten in den Papierkorb. */
export async function trashSection(id: string) {
  const t = now();
  await db.transaction('rw', db.sections, db.pages, async () => {
    await db.sections.update(id, { deletedAt: t });
    await db.pages.where('sectionId').equals(id).modify((p) => {
      if (!p.deletedAt) p.deletedAt = t;
    });
  });
}

export async function reorderSections(ids: string[]) {
  await db.transaction('rw', db.sections, async () => {
    for (let i = 0; i < ids.length; i++) await db.sections.update(ids[i], { sortOrder: i + 1 });
  });
}

/* ---------- Seiten ---------- */

function newPageRecord(notebookId: string, sectionId: string, paper: Paper, sortOrder: number, level: number): Page {
  const t = now();
  return {
    id: uid(), notebookId, sectionId, title: '', level, sortOrder, paper: { ...paper },
    createdAt: t, updatedAt: t, deletedAt: null,
  };
}

export async function sectionPages(sectionId: string) {
  const pages = await db.pages.where('sectionId').equals(sectionId).toArray();
  return pages.filter((p) => !p.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Neue Seite, optional direkt nach `afterId` (als Unterseite mit gleicher Ebene). */
export async function createPage(sectionId: string, opts: { afterId?: string; level?: number; paper?: Paper } = {}): Promise<Page> {
  const section = await db.sections.get(sectionId);
  if (!section) throw new Error('Abschnitt fehlt');
  const nb = await db.notebooks.get(section.notebookId);
  const pages = await sectionPages(sectionId);
  let sortOrder = (pages.at(-1)?.sortOrder ?? 0) + 1;
  if (opts.afterId) {
    const i = pages.findIndex((p) => p.id === opts.afterId);
    if (i >= 0) {
      const next = pages[i + 1];
      sortOrder = next ? (pages[i].sortOrder + next.sortOrder) / 2 : pages[i].sortOrder + 1;
    }
  }
  const page = newPageRecord(section.notebookId, sectionId, opts.paper ?? nb?.paper ?? { type: 'lined', color: 'white' }, sortOrder, opts.level ?? 0);
  await db.pages.add(page);
  return page;
}

export const updatePage = (id: string, patch: Partial<Page>) => db.pages.update(id, { ...patch, updatedAt: now() });

export async function reorderPages(ids: string[]) {
  await db.transaction('rw', db.pages, async () => {
    for (let i = 0; i < ids.length; i++) await db.pages.update(ids[i], { sortOrder: i + 1 });
  });
}

export async function movePageToSection(pageId: string, sectionId: string) {
  const section = await db.sections.get(sectionId);
  if (!section) return;
  const pages = await sectionPages(sectionId);
  await db.pages.update(pageId, {
    sectionId, notebookId: section.notebookId, level: 0,
    sortOrder: (pages.at(-1)?.sortOrder ?? 0) + 1, updatedAt: now(),
  });
}

export const trashPage = (id: string) => db.pages.update(id, { deletedAt: now() });

export async function restorePage(id: string) {
  const page = await db.pages.get(id);
  if (!page) return;
  await db.transaction('rw', db.pages, db.sections, async () => {
    const section = await db.sections.get(page.sectionId);
    if (section?.deletedAt) await db.sections.update(section.id, { deletedAt: null });
    await db.pages.update(id, { deletedAt: null });
  });
}

async function purgePageInTx(id: string) {
  await db.blocks.where('pageId').equals(id).delete();
  await db.strokes.where('pageId').equals(id).delete();
  await db.pages.delete(id);
}

export async function purgePage(id: string) {
  await db.transaction('rw', db.pages, db.blocks, db.strokes, () => purgePageInTx(id));
  await removeOrphanAssets();
}

export async function emptyTrash() {
  const trashed = (await db.pages.toArray()).filter((p) => p.deletedAt);
  await db.transaction('rw', [db.pages, db.blocks, db.strokes, db.sections], async () => {
    for (const p of trashed) await purgePageInTx(p.id);
    const sections = (await db.sections.toArray()).filter((s) => s.deletedAt);
    for (const s of sections) {
      const left = await db.pages.where('sectionId').equals(s.id).count();
      if (left === 0) await db.sections.delete(s.id);
    }
  });
  await removeOrphanAssets();
}

async function removeOrphanAssets() {
  const used = new Set((await db.blocks.toArray()).map((b) => b.assetId).filter(Boolean));
  const ids = await db.assets.toCollection().primaryKeys();
  const orphans = ids.filter((id) => !used.has(id));
  if (orphans.length) await db.assets.bulkDelete(orphans);
}

/* ---------- Seiteninhalt ---------- */

export async function loadPageContent(pageId: string) {
  const [blocks, strokes] = await Promise.all([
    db.blocks.where('pageId').equals(pageId).toArray(),
    db.strokes.where('pageId').equals(pageId).toArray(),
  ]);
  return { blocks, strokes };
}

/** Schreibt nur Geändertes: `put` und `remove` kommen aus dem Referenzvergleich im Editor. */
export async function savePageContent(
  pageId: string,
  change: { putBlocks: Block[]; delBlocks: string[]; putStrokes: Stroke[]; delStrokes: string[] },
) {
  const t = now();
  await db.transaction('rw', [db.blocks, db.strokes, db.pages, db.notebooks], async () => {
    if (change.putBlocks.length) await db.blocks.bulkPut(change.putBlocks);
    if (change.delBlocks.length) await db.blocks.bulkDelete(change.delBlocks);
    if (change.putStrokes.length) await db.strokes.bulkPut(change.putStrokes);
    if (change.delStrokes.length) await db.strokes.bulkDelete(change.delStrokes);
    const page = await db.pages.get(pageId);
    if (page) {
      await db.pages.update(pageId, { updatedAt: t });
      await db.notebooks.update(page.notebookId, { updatedAt: t });
    }
  });
}

export async function addAsset(blob: Blob, name?: string) {
  const id = uid();
  await db.assets.add({ id, mime: blob.type || 'application/octet-stream', name, blob });
  return id;
}

/* ---------- Suche & Tags ---------- */

export interface SearchHit {
  page: Page;
  notebookTitle: string;
  sectionTitle: string;
  sectionColor: string;
  snippet: { before: string; match: string; after: string } | null;
  inTitle: boolean;
  score: number;
}

export async function search(query: string): Promise<SearchHit[]> {
  const q = normalize(query.trim());
  if (!q) return [];
  const [notebooks, sections, pages, blocks] = await Promise.all([
    db.notebooks.toArray(), db.sections.toArray(), db.pages.toArray(), db.blocks.toArray(),
  ]);
  const nbMap = new Map(notebooks.map((n) => [n.id, n]));
  const secMap = new Map(sections.map((s) => [s.id, s]));
  const textByPage = new Map<string, string>();
  for (const b of blocks) {
    if (b.kind !== 'text') continue;
    textByPage.set(b.pageId, (textByPage.get(b.pageId) ?? '') + ' ' + htmlToText(b.html));
  }
  const hits: SearchHit[] = [];
  for (const page of pages) {
    if (page.deletedAt) continue;
    const sec = secMap.get(page.sectionId);
    if (!sec || sec.deletedAt) continue;
    const title = pageTitle(page.title);
    const inTitle = normalize(title).includes(q);
    const body = (textByPage.get(page.id) ?? '').trim();
    const idx = normalize(body).indexOf(q);
    if (!inTitle && idx < 0) continue;
    let snippet: SearchHit['snippet'] = null;
    if (idx >= 0) {
      const start = Math.max(0, idx - 40);
      snippet = {
        before: (start > 0 ? '…' : '') + body.slice(start, idx),
        match: body.slice(idx, idx + q.length),
        after: body.slice(idx + q.length, idx + q.length + 60) + (idx + q.length + 60 < body.length ? '…' : ''),
      };
    }
    const count = idx >= 0 ? normalize(body).split(q).length - 1 : 0;
    hits.push({
      page, inTitle, snippet,
      notebookTitle: nbMap.get(page.notebookId)?.title ?? '',
      sectionTitle: sec.title, sectionColor: sec.color,
      score: (inTitle ? 100 : 0) + Math.min(count, 20) + page.updatedAt / 1e14,
    });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 100);
}

export type TagKind = 'todo' | 'important' | 'question' | 'idea';
export interface TagHit {
  tag: TagKind;
  text: string;
  done: boolean;
  index: number; // n-tes getaggtes Element im Block
  block: Block;
  page: Page;
  notebookTitle: string;
  sectionTitle: string;
}

export async function listTags(): Promise<TagHit[]> {
  const [notebooks, sections, pages, blocks] = await Promise.all([
    db.notebooks.toArray(), db.sections.toArray(), db.pages.toArray(), db.blocks.toArray(),
  ]);
  const nbMap = new Map(notebooks.map((n) => [n.id, n]));
  const secMap = new Map(sections.map((s) => [s.id, s]));
  const pageMap = new Map(pages.map((p) => [p.id, p]));
  const out: TagHit[] = [];
  const parser = new DOMParser();
  for (const block of blocks) {
    if (block.kind !== 'text' || !block.html?.includes('data-tag')) continue;
    const page = pageMap.get(block.pageId);
    if (!page || page.deletedAt) continue;
    const doc = parser.parseFromString(`<div>${block.html}</div>`, 'text/html');
    doc.querySelectorAll('[data-tag]').forEach((el, index) => {
      out.push({
        tag: el.getAttribute('data-tag') as TagKind,
        text: (el.textContent || '').trim() || '(leer)',
        done: el.getAttribute('data-done') === '1',
        index, block, page,
        notebookTitle: nbMap.get(page.notebookId)?.title ?? '',
        sectionTitle: secMap.get(page.sectionId)?.title ?? '',
      });
    });
  }
  return out;
}

/** Hakt ein To-Do direkt in der Datenbank ab (aus der Tag-Übersicht). */
export async function toggleTagDone(blockId: string, index: number) {
  const block = await db.blocks.get(blockId);
  if (!block?.html) return;
  const doc = new DOMParser().parseFromString(`<div>${block.html}</div>`, 'text/html');
  const root = doc.body.firstElementChild!;
  const el = root.querySelectorAll('[data-tag]')[index];
  if (!el) return;
  if (el.getAttribute('data-done') === '1') el.removeAttribute('data-done');
  else el.setAttribute('data-done', '1');
  await db.blocks.update(blockId, { html: root.innerHTML });
  window.dispatchEvent(new CustomEvent('fn:external-change', { detail: { pageId: block.pageId } }));
}

/* ---------- Notfall-Kopie beim Schließen ---------- */

export type ContentChange = { putBlocks: Block[]; delBlocks: string[]; putStrokes: Stroke[]; delStrokes: string[] };
const PENDING = 'fingernote:pending:';

/** Synchron (localStorage), damit es auch beim Schließen des Tabs sicher geschrieben ist. */
export function stashPending(pageId: string, changes: ContentChange[]) {
  try {
    if (changes.length) localStorage.setItem(PENDING + pageId, JSON.stringify(changes));
    else localStorage.removeItem(PENDING + pageId);
  } catch { /* Speicher voll oder gesperrt */ }
}

/** Beim Start: nicht fertig gespeicherte Änderungen nachholen (idempotent, ganze Objekte). */
export async function recoverPending() {
  let keys: string[] = [];
  try { keys = Object.keys(localStorage).filter((k) => k.startsWith(PENDING)); } catch { return; }
  for (const key of keys) {
    try {
      const changes = JSON.parse(localStorage.getItem(key) || '[]') as ContentChange[];
      const pageId = key.slice(PENDING.length);
      if (await db.pages.get(pageId)) for (const c of changes) await savePageContent(pageId, c);
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('Wiederherstellung fehlgeschlagen', e);
    }
  }
}
