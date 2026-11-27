// Import aus anderen Apps:
// • OneNote: alle Notizbücher, Abschnittsgruppen und Abschnitte über Microsoft Graph (Notes.Read) –
//   Notizbücher/Gruppen → Ordner, Abschnitte → Bücher, Seiten mit Text, Bildern und Handschrift (InkML).
// • GoodNotes & Co.: PDF-Exporte, Bilder, ZIP-Archive (Ordnerstruktur bleibt erhalten) und .goodnotes-Dateien
//   (darin enthaltene PDFs und Bilder).
import { uid, round2 } from './util.js';
import * as store from './store.js';
import { importPdfPages } from './pdfio.js';
import { MM } from './ink.js';
import { notesFetch } from './onedrive.js';

// ================================================================ ZIP lesen (ohne Bibliothek)
export async function readZip(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Keine gültige ZIP-Datei.');
  let count = dv.getUint16(eocd + 10, true);
  let cdOff = dv.getUint32(eocd + 16, true);
  if (cdOff === 0xffffffff || count === 0xffff) {
    // ZIP64
    const loc = eocd - 20;
    if (dv.getUint32(loc, true) !== 0x07064b50) throw new Error('ZIP64-Archiv wird nicht unterstützt.');
    const z = Number(dv.getBigUint64(loc + 8, true));
    count = Number(dv.getBigUint64(z + 32, true));
    cdOff = Number(dv.getBigUint64(z + 48, true));
  }
  const dec = new TextDecoder();
  const entries = [];
  let p = cdOff;
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    let csize = dv.getUint32(p + 20, true);
    let usize = dv.getUint32(p + 24, true);
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    let off = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nl));
    // ZIP64-Zusatzfeld
    let x = p + 46 + nl;
    const xe = x + xl;
    while (x + 4 <= xe) {
      const id = dv.getUint16(x, true), sz = dv.getUint16(x + 2, true);
      if (id === 1) {
        let q = x + 4;
        if (usize === 0xffffffff) { usize = Number(dv.getBigUint64(q, true)); q += 8; }
        if (csize === 0xffffffff) { csize = Number(dv.getBigUint64(q, true)); q += 8; }
        if (off === 0xffffffff) { off = Number(dv.getBigUint64(q, true)); }
      }
      x += 4 + sz;
    }
    p = xe + cl;
    if (name.endsWith('/')) continue;
    entries.push({
      name, size: usize,
      async bytes() {
        const ln = dv.getUint16(off + 26, true), lx = dv.getUint16(off + 28, true);
        const start = off + 30 + ln + lx;
        const raw = buf.subarray(start, start + csize);
        if (method === 0) return raw;
        if (method !== 8) throw new Error('Unbekannte Kompression in ' + name);
        const ds = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(ds).arrayBuffer());
      },
    });
  }
  return entries;
}

function sniff(b) {
  if (!b || b.length < 4) return '';
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4) return 'application/zip';
  return '';
}

// ================================================================ Bilder → Seiten
async function imageToPage(blob) {
  const bmp = await createImageBitmap(blob);
  const w = bmp.width > bmp.height * 1.15 ? 1414 : 1000;
  const h = Math.round((w * bmp.height) / bmp.width);
  bmp.close && bmp.close();
  const id = await store.putBlob(blob);
  return { w, h, bg: id };
}

async function pagesFromFile(name, blob, progress, label) {
  const type = blob.type || sniff(new Uint8Array(await blob.slice(0, 8).arrayBuffer()));
  if (type === 'application/pdf' || /\.pdf$/i.test(name)) return importPdfPages(blob, (f, t) => progress && progress(f, `${label}: ${t}`));
  if (/^image\//.test(type) || /\.(png|jpe?g|heic|webp|gif)$/i.test(name)) return [await imageToPage(blob)];
  return null;
}

const baseName = (n) => n.split('/').pop().replace(/\.(pdf|png|jpe?g|webp|gif|heic|goodnotes|zip)$/i, '');

async function makeBook(name, parent, pages, color = '#2f6bff') {
  const pageObjs = pages.map((p) => ({ ...store.newPage(null, { template: 'blank' }), ...p }));
  return store.createNotebook({ name, parent, color, template: 'blank', pages: pageObjs });
}

/** Ordnerpfad (a/b/c) unter parent anlegen bzw. wiederverwenden. */
function folderMaker(rootParent) {
  const cache = new Map();
  const get = async (path) => {
    if (!path) return rootParent;
    if (cache.has(path)) return cache.get(path);
    const parts = path.split('/');
    const parent = await get(parts.slice(0, -1).join('/'));
    const f = await store.createFolder(parts[parts.length - 1], parent, '#0d8f80');
    cache.set(path, f.id);
    return f.id;
  };
  return get;
}

/** .goodnotes-Datei: enthaltene PDFs und Bilder als ein Buch. */
async function importGoodnotes(name, blob, parent, progress) {
  const entries = await readZip(blob);
  const pages = [];
  let skipped = 0;
  for (const e of entries) {
    if (/thumbnail|preview/i.test(e.name) || e.size < 200) continue;
    const b = await e.bytes();
    const t = sniff(b);
    if (t === 'application/pdf') pages.push(...await importPdfPages(new Blob([b], { type: t }), (f, s) => progress && progress(f, `${baseName(name)}: ${s}`)));
    else if (t === 'image/png' || t === 'image/jpeg') { if (b.length > 20000) pages.push(await imageToPage(new Blob([b], { type: t }))); }
    else skipped++;
  }
  if (!pages.length) return { book: null, inkOnly: true };
  const book = await makeBook(baseName(name), parent, pages, '#f08c00');
  return { book, inkOnly: skipped > 0 };
}

/**
 * Dateien importieren (PDF, Bilder, ZIP mit Ordnern, .goodnotes).
 * Rückgabe: { books, folders, warnings: [] }
 */
export async function importFiles(files, parent, progress) {
  const res = { books: 0, folders: 0, warnings: [] };
  const mk = folderMaker(parent);
  const before = (await store.listItems()).filter((i) => i.kind === 'folder').length;
  let i = 0;
  for (const f of files) {
    i++;
    const label = `${f.name} (${i}/${files.length})`;
    progress && progress(0, label);
    try {
      if (/\.goodnotes$/i.test(f.name)) {
        const r = await importGoodnotes(f.name, f, parent, progress);
        if (r.book) res.books++;
        if (r.inkOnly) res.warnings.push(`„${baseName(f.name)}“: Handschrift aus .goodnotes-Dateien kann nicht gelesen werden – bitte in GoodNotes als PDF exportieren.`);
        continue;
      }
      if (/\.zip$/i.test(f.name) || sniff(new Uint8Array(await f.slice(0, 4).arrayBuffer())) === 'application/zip') {
        const entries = (await readZip(f)).filter((e) => !/(^|\/)(__MACOSX|\.)/.test(e.name));
        // Wurzelordner des Archivs als Ordner anlegen
        const zroot = await mk(baseName(f.name));
        const mkz = folderMaker(zroot);
        let n = 0;
        for (const e of entries) {
          n++;
          progress && progress(n / entries.length, `${f.name}: ${e.name}`);
          const dir = e.name.split('/').slice(0, -1).join('/');
          const b = await e.bytes();
          const blob = new Blob([b], { type: sniff(b) });
          try {
            if (/\.goodnotes$/i.test(e.name)) {
              const r = await importGoodnotes(e.name, blob, await mkz(dir), null);
              if (r.book) res.books++;
              if (r.inkOnly) res.warnings.push(`„${baseName(e.name)}“: Handschrift nur über den PDF-Export aus GoodNotes.`);
              continue;
            }
            const pages = await pagesFromFile(e.name, blob, null, e.name);
            if (!pages || !pages.length) continue;
            await makeBook(baseName(e.name), await mkz(dir), pages);
            res.books++;
          } catch (err) { res.warnings.push(`${e.name}: ${err.message}`); }
        }
        continue;
      }
      const pages = await pagesFromFile(f.name, f, progress, label);
      if (!pages) { res.warnings.push(`${f.name}: Dateityp wird nicht unterstützt.`); continue; }
      await makeBook(baseName(f.name), parent, pages);
      res.books++;
    } catch (e) {
      console.error(e);
      res.warnings.push(`${f.name}: ${e.message || 'konnte nicht gelesen werden'}`);
    }
  }
  res.folders = (await store.listItems()).filter((i) => i.kind === 'folder').length - before;
  return res;
}

// ================================================================ OneNote
const PX = 0.2646 * MM; // CSS-Pixel (96 dpi) → Seiten-Einheiten

async function getJson(path) {
  const r = await notesFetch(path);
  if (!r.ok) {
    let msg = `OneNote antwortet mit Fehler ${r.status}`;
    try { const j = await r.json(); if (j.error && j.error.message) msg += ': ' + j.error.message; } catch (e) { /* */ }
    throw new Error(msg);
  }
  return r.json();
}
async function getAll(path) {
  const out = [];
  let url = path;
  while (url) {
    const j = await getJson(url);
    out.push(...(j.value || []));
    url = j['@odata.nextLink'] || null;
  }
  return out;
}

/** Struktur laden: Notizbücher mit Abschnittsgruppen und Abschnitten. */
export async function oneNoteTree() {
  const nbs = await getAll('/me/onenote/notebooks?$select=id,displayName,lastModifiedDateTime&$orderby=displayName');
  const loadGroup = async (kind, id) => {
    const base = kind === 'nb' ? `/me/onenote/notebooks/${id}` : `/me/onenote/sectionGroups/${id}`;
    const sections = await getAll(`${base}/sections?$select=id,displayName`);
    const groups = await getAll(`${base}/sectionGroups?$select=id,displayName`);
    for (const g of groups) Object.assign(g, await loadGroup('sg', g.id));
    return { sections, groups };
  };
  for (const nb of nbs) Object.assign(nb, await loadGroup('nb', nb.id));
  return nbs;
}

/** Ausgewählte Notizbücher importieren. */
export async function importOneNote(notebooks, parent, progress) {
  const res = { books: 0, folders: 0, pages: 0, warnings: [] };
  const count = (g) => g.sections.length + g.groups.reduce((s, x) => s + count(x), 0);
  const total = notebooks.reduce((s, nb) => s + count(nb), 0) || 1;
  let done = 0;
  const root = await store.createFolder('OneNote', parent, '#7719aa');
  res.folders++;
  const walk = async (g, folderId) => {
    for (const sec of g.sections) {
      progress(done / total, `${sec.displayName} – Seiten werden geladen`);
      try {
        const pages = await importSection(sec, (k, n) => progress((done + k / Math.max(1, n)) / total, `${sec.displayName}: Seite ${k + 1} von ${n}`), res);
        const pageObjs = pages.length ? pages : [store.newPage(null, { template: 'blank', format: 'endless' })];
        await store.createNotebook({ name: sec.displayName, parent: folderId, color: '#7719aa', template: 'blank', format: 'endless', pages: pageObjs });
        res.books++;
        res.pages += pages.length;
      } catch (e) {
        if (e.needLogin) throw e;
        res.warnings.push(`${sec.displayName}: ${e.message}`);
      }
      done++;
    }
    for (const sg of g.groups) {
      const f = await store.createFolder(sg.displayName, folderId, '#9b4dca');
      res.folders++;
      await walk(sg, f.id);
    }
  };
  for (const nb of notebooks) {
    const f = await store.createFolder(nb.displayName, root.id, '#7719aa');
    res.folders++;
    await walk(nb, f.id);
  }
  return res;
}

async function importSection(sec, onPage, res) {
  const list = await getAll(`/me/onenote/sections/${sec.id}/pages?$select=id,title,level,order,createdDateTime&$top=100`);
  list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const out = [];
  for (let k = 0; k < list.length; k++) {
    onPage(k, list.length);
    try { out.push(await importPage(list[k])); }
    catch (e) { if (e.needLogin) throw e; res.warnings.push(`${sec.displayName} / ${list[k].title || 'Seite'}: ${e.message}`); }
  }
  return out;
}

/** Eine OneNote-Seite in eine FingerNote-Seite umwandeln. */
async function importPage(meta) {
  const r = await notesFetch(`/me/onenote/pages/${meta.id}/content?includeInkML=true`);
  if (!r.ok) throw new Error(`Seite konnte nicht geladen werden (${r.status})`);
  const ct = r.headers.get('Content-Type') || '';
  let html = '', inkml = '';
  if (/multipart/i.test(ct)) {
    const raw = await r.text();
    const bm = ct.match(/boundary="?([^";]+)"?/i);
    const parts = bm ? raw.split('--' + bm[1]) : [raw];
    for (const part of parts) {
      const sep = part.indexOf('\r\n\r\n') >= 0 ? part.indexOf('\r\n\r\n') : part.indexOf('\n\n');
      if (sep < 0) continue;
      const head = part.slice(0, sep).toLowerCase();
      const body = part.slice(sep).replace(/^\s+/, '');
      if (head.includes('text/html')) html = body;
      else if (head.includes('inkml')) inkml = body;
    }
  } else html = await r.text();

  const page = store.newPage(null, { template: 'blank', format: 'endless' });
  page.title = meta.title || '';
  const texts = [], images = [], strokes = [];
  let maxX = 0, maxY = 0;
  const doc = new DOMParser().parseFromString(html || '<html><body></body></html>', 'text/html');
  const title = (doc.querySelector('title') || {}).textContent || meta.title || '';
  if (title.trim()) {
    texts.push({ id: uid(), x: 60, y: 40, w: 880, size: 30, text: '# ' + title.trim() });
    maxY = 110;
  }
  const px = (v) => (parseFloat(v) || 0) * PX;
  const styleOf = (n) => {
    const s = (n.getAttribute && n.getAttribute('style')) || '';
    const g = (k) => { const m = s.match(new RegExp(`(?:^|;)\\s*${k}\\s*:\\s*([^;]+)`, 'i')); return m ? m[1].trim() : ''; };
    return { left: g('left'), top: g('top'), width: g('width'), fontSize: g('font-size') };
  };
  const body = doc.body;
  let flowY = maxY + 20; // Elemente ohne Position untereinander
  for (const n of [...body.children]) {
    const st = styleOf(n);
    const hasPos = st.left || st.top;
    let x = hasPos ? px(st.left) + 40 : 60;
    let y = hasPos ? px(st.top) + 40 : flowY;
    if (n.tagName === 'IMG') {
      const im = await imageItem(n, x, y);
      if (im) { images.push(im); maxX = Math.max(maxX, im.x + im.w); maxY = Math.max(maxY, im.y + im.h); flowY = Math.max(flowY, im.y + im.h + 20); }
      continue;
    }
    if (n.tagName === 'OBJECT') {
      const nm = n.getAttribute('data-attachment') || 'Anhang';
      texts.push({ id: uid(), x, y, w: 520, size: 18, text: `📎 ${nm} (Anhang – in OneNote öffnen)` });
      flowY = Math.max(flowY, y + 40);
      continue;
    }
    // Textblock (div, p, ul, table …) – Bilder darin werden darunter gesetzt
    const w = st.width ? Math.max(200, px(st.width)) : 760;
    const lines = [];
    const inner = [];
    blockText(n, lines, inner);
    const text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const fs = st.fontSize || ((n.querySelector && n.querySelector('[style*="font-size"]')) ? styleOf(n.querySelector('[style*="font-size"]')).fontSize : '');
    const size = fs ? Math.max(12, Math.min(48, (parseFloat(fs) * (/pt/i.test(fs) ? 1.333 : 1)) * PX)) : 18.5;
    if (text) {
      texts.push({ id: uid(), x: round2(x), y: round2(y), w: round2(w), size: round2(size), text });
      const h = text.split('\n').length * size * 1.4;
      y += h + 10;
      maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y);
    }
    for (const imgEl of inner) {
      const im = await imageItem(imgEl, x, y);
      if (im) { images.push(im); y = im.y + im.h + 12; maxX = Math.max(maxX, im.x + im.w); maxY = Math.max(maxY, y); }
    }
    flowY = Math.max(flowY, y + 16);
  }
  if (inkml) {
    try { strokes.push(...parseInkML(inkml)); } catch (e) { console.warn('InkML', e); }
    for (const s of strokes) for (let i = 0; i < s.pts.length; i += 3) { maxX = Math.max(maxX, s.pts[i]); maxY = Math.max(maxY, s.pts[i + 1]); }
  }
  page.texts = texts; page.images = images; page.strokes = strokes;
  page.w = Math.max(1000, Math.ceil((maxX + 60) / 50) * 50);
  page.h = Math.max(1414, Math.ceil((maxY + 300) / 100) * 100);
  return page;
}

/** HTML-Block in Text mit Markdown (Überschriften, Listen, Checklisten, Tabellen). */
function blockText(node, out, imgs, depth = 0) {
  const inline = (n) => {
    let s = '';
    for (const c of n.childNodes) {
      if (c.nodeType === 3) s += c.textContent.replace(/\s+/g, ' ');
      else if (c.nodeType === 1) {
        if (c.tagName === 'BR') s += '\n';
        else if (c.tagName === 'IMG') imgs.push(c);
        else if (['P', 'DIV', 'UL', 'OL', 'TABLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(c.tagName)) { /* Block im Inline-Kontext */ const sub = []; blockText(c, sub, imgs, depth); s += (s ? '\n' : '') + sub.join('\n'); }
        else {
          let t = inline(c);
          if ((c.tagName === 'B' || c.tagName === 'STRONG' || /font-weight:\s*bold/i.test(c.getAttribute('style') || '')) && t.trim()) t = `**${t.trim()}** `;
          else if ((c.tagName === 'I' || c.tagName === 'EM') && t.trim()) t = `*${t.trim()}* `;
          s += t;
        }
      }
    }
    return s;
  };
  const tag = node.tagName;
  const todo = (n) => { const d = n.getAttribute && n.getAttribute('data-tag'); return d && /to-do/.test(d) ? (/completed/.test(d) ? '- [x] ' : '- [ ] ') : ''; };
  if (/^H[1-6]$/.test(tag)) { out.push('#'.repeat(Math.min(3, +tag[1])) + ' ' + inline(node).trim()); return; }
  if (tag === 'P') { const t = inline(node).trim(); out.push(todo(node) + t); return; }
  if (tag === 'UL' || tag === 'OL') {
    let i = 0;
    for (const li of node.children) {
      if (li.tagName !== 'LI') continue;
      i++;
      const ind = '  '.repeat(depth);
      const mark = todo(li) || (tag === 'OL' ? `${i}. ` : '- ');
      const own = [];
      const kids = [...li.childNodes].filter((c) => !(c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL')));
      const tmp = document.createElement('span'); kids.forEach((c) => tmp.append(c.cloneNode(true)));
      out.push(ind + mark + inline(tmp).trim());
      for (const sub of li.children) if (sub.tagName === 'UL' || sub.tagName === 'OL') blockText(sub, own, imgs, depth + 1);
      out.push(...own);
    }
    return;
  }
  if (tag === 'TABLE') {
    for (const tr of node.querySelectorAll('tr')) out.push([...tr.children].map((td) => inline(td).trim()).join(' | '));
    out.push('');
    return;
  }
  if (tag === 'IMG') { imgs.push(node); return; }
  // DIV & Co.
  let had = false;
  for (const c of node.childNodes) {
    if (c.nodeType === 1 && ['P', 'UL', 'OL', 'TABLE', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'IMG'].includes(c.tagName)) { blockText(c, out, imgs, depth); had = true; }
    else if (c.nodeType === 3 && c.textContent.trim()) { out.push(c.textContent.trim()); had = true; }
    else if (c.nodeType === 1) { const t = inline(c).trim(); if (t) { out.push(t); had = true; } }
  }
  if (!had && node.textContent.trim()) out.push(node.textContent.trim());
}

async function imageItem(n, x, y) {
  const src = n.getAttribute('data-fullres-src') || n.getAttribute('src');
  if (!src) return null;
  try {
    let blob;
    if (src.startsWith('data:')) blob = await (await fetch(src)).blob();
    else { const r = await notesFetch(src); if (!r.ok) return null; blob = await r.blob(); }
    const id = await store.putBlob(blob);
    let w = parseFloat(n.getAttribute('width')) * PX, h = parseFloat(n.getAttribute('height')) * PX;
    if (!w || !h) {
      const bmp = await createImageBitmap(blob);
      w = bmp.width * PX; h = bmp.height * PX;
      bmp.close && bmp.close();
    }
    if (w > 1600) { h *= 1600 / w; w = 1600; }
    return { id: uid(), blob: id, x: round2(x), y: round2(y), w: round2(w), h: round2(h) };
  } catch (e) { return null; }
}

/** InkML (Handschrift aus OneNote) → Striche in Seiten-Einheiten. */
export function parseInkML(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const q = (n, tag) => [...n.getElementsByTagNameNS('*', tag)];
  // Einheiten der Kanäle (Standard: HIMETRIC = 0,01 mm)
  const unitMm = { himetric: 0.01, mm: 1, cm: 10, in: 25.4, inch: 25.4, pt: 25.4 / 72, px: 0.2646, dev: 0.01 };
  const ctxs = new Map();
  for (const c of q(doc, 'context')) {
    const id = c.getAttribute('xml:id') || c.getAttribute('id');
    const chans = q(c, 'channel').map((ch) => ({ name: ch.getAttribute('name'), units: (ch.getAttribute('units') || 'himetric').toLowerCase(), max: parseFloat(ch.getAttribute('max')) || 0 }));
    const res = {};
    for (const cp of q(c, 'channelProperty')) if (cp.getAttribute('name') === 'resolution') res[cp.getAttribute('channel')] = { v: parseFloat(cp.getAttribute('value')) || 1, u: (cp.getAttribute('units') || '').toLowerCase() };
    ctxs.set('#' + id, { chans, res });
  }
  const brushes = new Map();
  for (const b of q(doc, 'brush')) {
    const id = b.getAttribute('xml:id') || b.getAttribute('id');
    const props = {};
    for (const p of q(b, 'brushProperty')) props[p.getAttribute('name')] = { v: p.getAttribute('value'), u: (p.getAttribute('units') || '').toLowerCase() };
    brushes.set('#' + id, props);
  }
  const defCtx = ctxs.values().next().value || { chans: [{ name: 'X', units: 'himetric' }, { name: 'Y', units: 'himetric' }], res: {} };
  const out = [];
  for (const tr of q(doc, 'trace')) {
    const cx = ctxs.get(tr.getAttribute('contextRef')) || defCtx;
    const br = brushes.get(tr.getAttribute('brushRef')) || {};
    const ix = cx.chans.findIndex((c) => c.name === 'X'), iy = cx.chans.findIndex((c) => c.name === 'Y'), iF = cx.chans.findIndex((c) => c.name === 'F');
    const scale = (ch, i) => {
      const r = cx.res[ch];
      const c = cx.chans[i] || {};
      if (r && r.u.startsWith('1/')) return (unitMm[r.u.slice(2)] || 0.01) / r.v;
      return unitMm[c.units] || 0.01;
    };
    const sx = scale('X', ix) * MM, sy = scale('Y', iy) * MM;
    const fmax = iF >= 0 ? (cx.chans[iF].max || 32767) : 0;
    // Werte mit InkML-Differenzkodierung (' = erste, " = zweite Differenz, ! = absolut)
    const nCh = cx.chans.length || 2;
    const vals = new Array(nCh).fill(0), vel = new Array(nCh).fill(0), mode = new Array(nCh).fill('!');
    const pts = [];
    for (const pt of tr.textContent.trim().split(',')) {
      const toks = pt.trim().match(/[!'"]|[-+]?[\d.]+(?:[eE][-+]?\d+)?|[TF*?]/g) || [];
      let ch = 0;
      for (let t = 0; t < toks.length && ch < nCh; t++) {
        const tk = toks[t];
        if (tk === '!' || tk === "'" || tk === '"') { mode[ch] = tk; continue; }
        const v = parseFloat(tk);
        if (!isFinite(v)) { ch++; continue; }
        if (mode[ch] === '!') { vel[ch] = v - vals[ch]; vals[ch] = v; }
        else if (mode[ch] === "'") { vel[ch] = v; vals[ch] += v; }
        else { vel[ch] += v; vals[ch] += vel[ch]; }
        ch++;
      }
      const p = iF >= 0 && fmax ? Math.max(0.05, Math.min(1, vals[iF] / fmax)) : 0.5;
      pts.push(round2(vals[ix] * sx), round2(vals[iy] * sy), round2(p));
    }
    if (pts.length < 3) continue;
    const color = (br.color && br.color.v) || '#000000';
    const wv = br.width ? parseFloat(br.width.v) : 50;
    const wmm = br.width ? wv * (unitMm[br.width.u] || 0.01) : 0.5;
    const transp = br.transparency ? parseFloat(br.transparency.v) : 0;
    const marker = transp > 0 || (br.tip && /rect/i.test(br.tip.v) && wmm > 2);
    out.push({ id: uid(), t: marker ? 'marker' : 'pen', c: color, w: round2(Math.max(0.8, Math.min(marker ? 40 : 12, wmm * MM))), pts, sim: true });
  }
  return out;
}
