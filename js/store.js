// Datenmodell: Ordner, Notizbücher, Seiten, Papierkorb, Backup, Suche.

import * as db from './db.js';
import { uid, arrayBufferToBase64, base64ToArrayBuffer, APP_VERSION } from './util.js';
import { FORMATS } from './ink.js';

export const COVER_COLORS = ['#0d8f80', '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#475569', '#1f2937'];

export function newPage(nbId, { template = 'lined', paper = 'white', format = 'portrait' } = {}) {
  const f = FORMATS[format] || FORMATS.portrait;
  return {
    id: uid(), nb: nbId, w: f.w, h: f.h, endless: !!f.endless,
    template, paper, bg: null, bm: false, strokes: [], texts: [], images: [],
  };
}

export const listItems = () => db.getAll('items');
export const getItem = (id) => db.get('items', id);
export const saveItem = (item) => db.put('items', item);

export async function createFolder(name, parent = null, color = '#0d8f80') {
  const now = Date.now();
  const f = { id: uid(), kind: 'folder', name: name || 'Neuer Ordner', parent, color, created: now, updated: now, deleted: null, fav: false };
  await db.put('items', f);
  return f;
}

export async function createNotebook({ name, parent = null, color = COVER_COLORS[0], template = 'lined', paper = 'white', format = 'portrait', pages = null }) {
  const now = Date.now();
  const nb = {
    id: uid(), kind: 'notebook', name: name || 'Unbenannt', parent, color,
    created: now, updated: now, deleted: null, fav: false,
    defaults: { template, paper, format }, pages: [], thumb: null, idx: [],
  };
  const pageObjs = pages || [newPage(nb.id, { template, paper, format })];
  for (const p of pageObjs) p.nb = nb.id;
  nb.pages = pageObjs.map((p) => p.id);
  await db.batch([{ store: 'items', put: nb }, ...pageObjs.map((p) => ({ store: 'pages', put: p }))]);
  return nb;
}

export async function loadNotebook(id) {
  const nb = await db.get('items', id);
  if (!nb) return null;
  const all = await db.getByIndex('pages', 'nb', id);
  const byId = new Map(all.map((p) => [p.id, p]));
  const pages = [];
  for (const pid of nb.pages) {
    const p = byId.get(pid);
    if (p) { normalizePage(p); pages.push(p); }
  }
  if (!pages.length) {
    const p = newPage(id, nb.defaults || {});
    pages.push(p);
    nb.pages = [p.id];
    await db.batch([{ store: 'items', put: nb }, { store: 'pages', put: p }]);
  }
  return { nb, pages };
}

function normalizePage(p) {
  p.strokes = p.strokes || [];
  p.texts = p.texts || [];
  p.images = p.images || [];
  p.template = p.template || 'blank';
  p.paper = p.paper || 'white';
}

/** Textinhalt für die Suche im Notizbuch-Eintrag ablegen. */
export function buildIndex(pages) {
  const idx = [];
  pages.forEach((p) => {
    const txt = p.texts.map((t) => t.text).join('\n').trim();
    if (txt) idx.push([p.id, txt.slice(0, 4000)]);
  });
  return idx;
}

export async function savePages(nb, pages, removedIds = []) {
  const ops = pages.map((p) => ({ store: 'pages', put: p }));
  for (const id of removedIds) ops.push({ store: 'pages', del: id });
  ops.push({ store: 'items', put: nb });
  await db.batch(ops);
}

// ---------------------------------------------------------------- Blobs (Bilder, PDF-Seiten)
export async function putBlob(blob) {
  const id = 'b' + uid();
  const data = await blob.arrayBuffer();
  await db.put('blobs', { id, type: blob.type || 'image/jpeg', data });
  return id;
}

export async function gcBlobs() {
  const [pages, keys] = await Promise.all([db.getAll('pages'), db.getAllKeys('blobs')]);
  const used = new Set();
  for (const p of pages) {
    if (p.bg) used.add(p.bg);
    for (const im of p.images || []) used.add(im.blob);
  }
  const unused = keys.filter((k) => !used.has(k));
  if (unused.length) await db.delMany('blobs', unused);
}

// ---------------------------------------------------------------- Papierkorb & Verwaltung
export async function trashItem(id) {
  const it = await db.get('items', id);
  if (!it) return;
  it.deleted = Date.now();
  await db.put('items', it);
}

export async function restoreItem(id) {
  const items = await db.getAll('items');
  const it = items.find((i) => i.id === id);
  if (!it) return;
  it.deleted = null;
  const parent = it.parent && items.find((i) => i.id === it.parent);
  if (it.parent && (!parent || parent.deleted)) it.parent = null;
  await db.put('items', it);
}

export async function purgeItem(id, gc = true) {
  const items = await db.getAll('items');
  const ops = [];
  const kill = (iid) => {
    const it = items.find((i) => i.id === iid);
    if (!it) return;
    ops.push({ store: 'items', del: iid });
    if (it.kind === 'notebook') for (const pid of it.pages || []) ops.push({ store: 'pages', del: pid });
    for (const ch of items.filter((i) => i.parent === iid)) kill(ch.id);
  };
  kill(id);
  // auch verwaiste Seiten des Notizbuchs entfernen
  const orphan = await db.getByIndex('pages', 'nb', id);
  for (const p of orphan) ops.push({ store: 'pages', del: p.id });
  await db.batch(ops);
  if (gc) await gcBlobs();
}

export async function emptyTrash() {
  const items = await db.getAll('items');
  for (const it of items.filter((i) => i.deleted)) await purgeItem(it.id, false);
  await gcBlobs();
}

export async function purgeOldTrash(days = 30) {
  const items = await db.getAll('items');
  const limit = Date.now() - days * 86400000;
  const old = items.filter((i) => i.deleted && i.deleted < limit);
  for (const it of old) await purgeItem(it.id, false);
  if (old.length) await gcBlobs();
}

export async function moveItem(id, parent) {
  const it = await db.get('items', id);
  if (!it || it.id === parent) return;
  it.parent = parent || null;
  it.updated = Date.now();
  await db.put('items', it);
}

export async function duplicateNotebook(id) {
  const data = await loadNotebook(id);
  if (!data) return null;
  const { nb, pages } = data;
  const now = Date.now();
  const copy = { ...nb, id: uid(), name: nb.name + ' (Kopie)', created: now, updated: now, fav: false, deleted: null };
  const newPages = pages.map((p) => ({ ...p, id: uid(), nb: copy.id }));
  copy.pages = newPages.map((p) => p.id);
  copy.idx = buildIndex(newPages);
  await db.batch([{ store: 'items', put: copy }, ...newPages.map((p) => ({ store: 'pages', put: p }))]);
  return copy;
}

// ---------------------------------------------------------------- Suche
export async function search(q) {
  const items = (await db.getAll('items')).filter((i) => !i.deleted);
  const s = q.trim().toLowerCase();
  if (!s) return { items: [], hits: [] };
  const byName = items.filter((i) => i.name.toLowerCase().includes(s));
  const hits = [];
  for (const nb of items.filter((i) => i.kind === 'notebook')) {
    for (const [pid, txt] of nb.idx || []) {
      const low = txt.toLowerCase();
      const at = low.indexOf(s);
      if (at < 0) continue;
      const from = Math.max(0, at - 30);
      const snip = (from ? '…' : '') + txt.slice(from, at + s.length + 50).replace(/\s+/g, ' ') + '…';
      hits.push({ nb, pageId: pid, pageIndex: (nb.pages || []).indexOf(pid), snippet: snip });
      if (hits.length > 60) break;
    }
  }
  return { items: byName, hits };
}

// ---------------------------------------------------------------- Backup / Teilen
/** ids = null → alles; sonst nur diese Notizbücher/Ordner (inkl. Inhalt). */
export async function exportData(ids = null) {
  const allItems = await db.getAll('items');
  let items;
  if (!ids) items = allItems.filter((i) => !i.deleted);
  else {
    const set = new Set();
    const add = (id) => {
      const it = allItems.find((i) => i.id === id);
      if (!it || set.has(id)) return;
      set.add(id);
      for (const ch of allItems.filter((i) => i.parent === id && !i.deleted)) add(ch.id);
    };
    ids.forEach(add);
    items = allItems.filter((i) => set.has(i.id)).map((i) => (ids.includes(i.id) ? { ...i, parent: null } : i));
  }
  const pages = [];
  const blobIds = new Set();
  for (const nb of items.filter((i) => i.kind === 'notebook')) {
    const ps = await db.getByIndex('pages', 'nb', nb.id);
    const keep = new Set(nb.pages);
    for (const p of ps) {
      if (!keep.has(p.id)) continue;
      pages.push(p);
      if (p.bg) blobIds.add(p.bg);
      for (const im of p.images || []) blobIds.add(im.blob);
    }
  }
  const blobs = [];
  for (const id of blobIds) {
    const b = await db.get('blobs', id);
    if (b) blobs.push({ id, type: b.type, data: arrayBufferToBase64(b.data) });
  }
  const payload = { app: 'FingerNote', format: 1, version: APP_VERSION, exported: Date.now(), items, pages, blobs };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

export async function importData(file) {
  const text = await file.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('Die Datei ist keine gültige FingerNote-Datei.'); }
  if (!data || data.app !== 'FingerNote' || !Array.isArray(data.items)) throw new Error('Die Datei ist keine FingerNote-Datei.');
  const existing = new Map((await db.getAll('items')).map((i) => [i.id, i]));
  const existingBlobs = new Set(await db.getAllKeys('blobs'));
  let nNb = 0, nFolder = 0, skipped = 0;
  const ops = [];
  const pagesByNb = new Map();
  for (const p of data.pages || []) {
    if (!pagesByNb.has(p.nb)) pagesByNb.set(p.nb, []);
    pagesByNb.get(p.nb).push(p);
  }
  const ids = new Set(data.items.map((i) => i.id));
  for (const it of data.items) {
    const old = existing.get(it.id);
    if (old && !old.deleted && (old.updated || 0) >= (it.updated || 0)) { skipped++; continue; }
    if (it.parent && !ids.has(it.parent) && !existing.has(it.parent)) it.parent = null;
    if (old && old.kind === 'notebook') {
      const oldPages = await db.getByIndex('pages', 'nb', it.id);
      for (const p of oldPages) ops.push({ store: 'pages', del: p.id });
    }
    it.deleted = null;
    ops.push({ store: 'items', put: it });
    if (it.kind === 'notebook') {
      nNb++;
      for (const p of pagesByNb.get(it.id) || []) ops.push({ store: 'pages', put: p });
    } else nFolder++;
  }
  for (const b of data.blobs || []) {
    if (existingBlobs.has(b.id)) continue;
    ops.push({ store: 'blobs', put: { id: b.id, type: b.type, data: base64ToArrayBuffer(b.data) } });
  }
  await db.batch(ops);
  return { notebooks: nNb, folders: nFolder, skipped };
}

// ---------------------------------------------------------------- Speicher
export async function storageInfo() {
  const out = { usage: null, quota: null, persisted: null };
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      out.usage = e.usage; out.quota = e.quota;
    }
    if (navigator.storage && navigator.storage.persisted) out.persisted = await navigator.storage.persisted();
  } catch (e) { /* nicht unterstützt */ }
  return out;
}

export async function requestPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch (e) { /* */ }
  return false;
}

// ---------------------------------------------------------------- Willkommens-Notizbuch
export async function createWelcome() {
  const nb = await createNotebook({ name: 'Erste Schritte', color: '#0d8f80', template: 'dots', paper: 'white' });
  const { pages } = await loadNotebook(nb.id);
  const p = pages[0];
  p.texts = [
    {
      id: uid(), x: 80, y: 90, w: 840, size: 22, c: null,
      text: '# Willkommen bei FingerNote\nSchreib einfach los – mit dem **Finger** oder dem **Apple Pencil**. Alles wird automatisch gespeichert und bleibt auf diesem Gerät.',
    },
    {
      id: uid(), x: 80, y: 300, w: 840, size: 20, c: null,
      text: '## Gesten\n- Zwei Finger tippen: **Rückgängig**\n- Drei Finger tippen: **Wiederholen**\n- Zwei Finger ziehen oder spreizen: Seite bewegen und zoomen\n- Zeichnen und kurz halten: wird zur **sauberen Form** (Linie, Kreis, Rechteck …)\n- Sobald ein Apple Pencil erkannt wird, scrollt der Finger. Umschalten über das Hand-Symbol oben rechts.',
    },
    {
      id: uid(), x: 80, y: 720, w: 840, size: 20, c: null,
      text: '## Probier es aus\n- [ ] Mit dem ==Textmarker== diese Zeile markieren\n- [ ] Mit dem Lasso etwas einkreisen und verschieben\n- [ ] Lernband über ein Wort kleben und antippen\n- [x] FingerNote zum Home-Bildschirm hinzufügen',
    },
    {
      id: uid(), x: 80, y: 1040, w: 840, size: 18, c: '#6b6b70',
      text: '**Tipp:** Unter *Einstellungen → Backup sichern* kannst du alle Notizen als Datei in iCloud Drive oder „Dateien“ ablegen. Texte unterstützen Markdown: **fett**, *kursiv*, ~~durchgestrichen~~, ==markiert==, Listen und Checklisten.',
    },
  ];
  nb.idx = buildIndex([p]);
  await savePages(nb, [p]);
  return nb;
}
