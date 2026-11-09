// Bibliothek: Ordner und Notizbücher, Suche, Favoriten, Zuletzt, Papierkorb, Einstellungen.
import { el, relTime, debounce, getSettings, saveSettings, applyTheme, pickFile, dateStamp, safeFileName, fmtBytes, APP_VERSION } from './util.js';
import { icon } from './icons.js';
import { toast, dialog, menu, prompt, confirm, progress, segmented, toggle } from './ui.js';
import * as store from './store.js';
import { templatePicker, paperPicker, formatPicker, colorRow, field } from './pickers.js';
import { importPdfPages, exportPdf } from './pdfio.js';
import { offerFile, showHelp } from './editor-ui.js';
import { renderPageToCanvas, ensureImages } from './ink.js';

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const isStandalone = () => window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

export class Library {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('library');
    this.folder = null;
    this.tab = 'all';
    this.query = '';
    this.items = [];
    this.build();
  }

  build() {
    this.root.innerHTML = `
      <header class="lib-head">
        <div class="lib-top">
          <div class="lib-brand">
            <button class="ib lib-back" hidden aria-label="Zurück">${icon('back')}</button>
            <div>
              <div class="lib-crumb" hidden></div>
              <h1 class="lib-h1">FingerNote</h1>
            </div>
          </div>
          <div class="lib-actions">
            <label class="search">${icon('search')}<input type="search" placeholder="Suchen – auch in Texten" autocomplete="off" aria-label="Suchen"></label>
            <button class="ib" data-a="sort" title="Sortieren" aria-label="Sortieren">${icon('sort')}</button>
            <button class="ib" data-a="settings" title="Einstellungen" aria-label="Einstellungen">${icon('settings')}</button>
            <button class="btn primary new-btn" data-a="new">${icon('plus')}<span>Neu</span></button>
          </div>
        </div>
        <nav class="lib-tabs" role="tablist">
          <button data-tab="all" class="on">${icon('grid')}<span>Alle</span></button>
          <button data-tab="fav">${icon('star')}<span>Favoriten</span></button>
          <button data-tab="recent">${icon('clock')}<span>Zuletzt</span></button>
          <button data-tab="trash">${icon('trash')}<span>Papierkorb</span></button>
        </nav>
      </header>
      <div class="lib-banners"></div>
      <main class="lib-main"><div class="lib-content"></div></main>`;
    this.content = this.root.querySelector('.lib-content');
    this.h1 = this.root.querySelector('.lib-h1');
    this.crumb = this.root.querySelector('.lib-crumb');
    this.backBtn = this.root.querySelector('.lib-back');
    this.banners = this.root.querySelector('.lib-banners');
    const search = this.root.querySelector('.search input');
    const doSearch = debounce(() => { this.query = search.value.trim(); this.render(); }, 180);
    search.addEventListener('input', doSearch);
    this.backBtn.addEventListener('click', () => this.goUp());
    this.root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      this.tab = b.dataset.tab;
      this.root.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
      if (this.tab !== 'all') this.folder = null;
      this.render();
    }));
    this.root.querySelector('.lib-actions').addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'new') this.newMenu(b);
      if (b.dataset.a === 'settings') this.settings();
      if (b.dataset.a === 'sort') this.sortMenu(b);
    });
  }

  async refresh() {
    this.items = await store.listItems();
    if (this.folder && !this.items.find((i) => i.id === this.folder && !i.deleted)) this.folder = null;
    this.render();
  }

  get(id) { return this.items.find((i) => i.id === id); }

  goUp() {
    const f = this.get(this.folder);
    this.folder = f ? f.parent : null;
    this.render();
  }

  sorted(list) {
    const s = getSettings().sort;
    return list.slice().sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      if (s === 'name') return a.name.localeCompare(b.name, 'de', { numeric: true });
      return (b.updated || 0) - (a.updated || 0);
    });
  }

  async render() {
    const live = this.items.filter((i) => !i.deleted);
    this.renderBanners(live);
    const f = this.folder && this.get(this.folder);
    this.backBtn.hidden = !f || this.tab !== 'all' || !!this.query;
    this.crumb.hidden = !f || this.tab !== 'all' || !!this.query;
    const titles = { fav: 'Favoriten', recent: 'Zuletzt bearbeitet', trash: 'Papierkorb' };
    this.h1.textContent = this.query ? 'Suche' : this.tab === 'all' ? (f ? f.name : 'FingerNote') : titles[this.tab];
    if (f) this.crumb.textContent = this.path(f).join(' › ');
    const c = this.content;
    c.innerHTML = '';

    if (this.query) { await this.renderSearch(c); return; }

    let list;
    if (this.tab === 'all') list = this.sorted(live.filter((i) => (i.parent || null) === (this.folder || null)));
    else if (this.tab === 'fav') list = this.sorted(live.filter((i) => i.fav));
    else if (this.tab === 'recent') list = live.filter((i) => i.kind === 'notebook').sort((a, b) => b.updated - a.updated).slice(0, 40);
    else list = this.items.filter((i) => i.deleted && !(i.parent && this.get(i.parent) && this.get(i.parent).deleted)).sort((a, b) => b.deleted - a.deleted);

    if (this.tab === 'trash' && list.length) {
      c.append(el('div', { class: 'trash-bar' },
        el('span', { class: 'muted' }, 'Gelöschtes bleibt 30 Tage hier und wird dann endgültig entfernt.'),
        el('button', { class: 'btn danger sm', onclick: () => this.emptyTrash() }, 'Papierkorb leeren')));
    }
    if (!list.length) { c.append(this.empty()); return; }
    const grid = el('div', { class: 'grid' });
    for (const it of list) grid.append(it.kind === 'folder' ? this.folderCard(it) : this.notebookCard(it));
    c.append(grid);
    this.fillThumbs(list);
  }

  /** Fehlende Vorschaubilder im Hintergrund erzeugen. */
  async fillThumbs(list) {
    for (const nb of list) {
      if (nb.kind !== 'notebook' || nb.thumb || nb.deleted) continue;
      try {
        const data = await store.loadNotebook(nb.id);
        if (!data) continue;
        const p = data.pages[0];
        await ensureImages(p);
        const cv = document.createElement('canvas');
        renderPageToCanvas(cv, p, 300 / p.w);
        nb.thumb = cv.toDataURL('image/jpeg', 0.72);
        cv.width = cv.height = 0;
        const fresh = await store.getItem(nb.id);
        if (fresh) { fresh.thumb = nb.thumb; await store.saveItem(fresh); }
        const card = [...this.content.querySelectorAll('.card.nb')].find((c) => c.dataset.id === nb.id);
        const cover = card && card.querySelector('.cover');
        if (cover) { cover.querySelector('.cover-blank')?.remove(); cover.prepend(el('img', { src: nb.thumb, alt: '', draggable: 'false' })); }
      } catch (e) { console.warn('Vorschau', e); }
    }
  }

  path(f) {
    const out = [];
    let cur = f;
    while (cur) { out.unshift(cur.name); cur = cur.parent && this.get(cur.parent); }
    out.unshift('Bibliothek');
    return out;
  }

  empty() {
    const msgs = {
      all: this.folder ? ['Dieser Ordner ist leer', 'Lege hier ein Notizbuch an oder verschiebe eines hierher.'] : ['Noch keine Notizbücher', 'Erstelle dein erstes Notizbuch oder importiere ein PDF.'],
      fav: ['Noch keine Favoriten', 'Markiere Notizbücher oder Ordner mit dem Stern, um sie hier schnell zu finden.'],
      recent: ['Noch nichts bearbeitet', 'Zuletzt geöffnete Notizbücher erscheinen hier.'],
      trash: ['Der Papierkorb ist leer', 'Gelöschte Notizbücher bleiben hier 30 Tage, bevor sie endgültig verschwinden.'],
    };
    const [h, p] = msgs[this.tab];
    const box = el('div', { class: 'empty' },
      el('div', { class: 'empty-art', html: emptyArt() }),
      el('h2', null, h), el('p', null, p));
    if (this.tab === 'all') {
      box.append(el('div', { class: 'empty-btns' },
        el('button', { class: 'btn primary', onclick: () => this.newNotebook() }, 'Notizbuch erstellen'),
        el('button', { class: 'btn', onclick: () => this.importPdf() }, 'PDF importieren')));
    }
    return box;
  }

  folderCard(f) {
    const count = this.items.filter((i) => i.parent === f.id && !i.deleted).length;
    const card = el('div', { class: 'card folder', tabindex: '0' },
      el('div', { class: 'folder-art', style: { '--c': f.color || '#0d8f80' }, html: folderSvg() }),
      el('div', { class: 'card-meta' },
        el('div', { class: 'card-name' }, f.fav ? el('span', { class: 'fav', html: icon('star') }) : null, f.name),
        el('div', { class: 'card-sub' }, this.tab === 'trash' ? `gelöscht ${relTime(f.deleted)}` : `${count} ${count === 1 ? 'Element' : 'Elemente'}`)),
      this.moreBtn(f));
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-more')) return;
      if (this.tab === 'trash') { this.cardMenu(card.querySelector('.card-more'), f); return; }
      this.tab = 'all';
      this.root.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x.dataset.tab === 'all'));
      this.folder = f.id;
      this.render();
    });
    return card;
  }

  notebookCard(nb) {
    const cover = el('div', { class: 'cover', style: { '--c': nb.color || '#0d8f80' } });
    if (nb.thumb) cover.append(el('img', { src: nb.thumb, alt: '', draggable: 'false' }));
    else cover.append(el('div', { class: 'cover-blank' }));
    cover.append(el('span', { class: 'spine' }));
    const n = (nb.pages || []).length;
    const sub = this.tab === 'trash' ? `gelöscht ${relTime(nb.deleted)}` : `${relTime(nb.updated)} · ${n} ${n === 1 ? 'Seite' : 'Seiten'}`;
    const card = el('div', { class: 'card nb', tabindex: '0', dataset: { id: nb.id } }, cover,
      el('div', { class: 'card-meta' },
        el('div', { class: 'card-name' }, nb.fav ? el('span', { class: 'fav', html: icon('star') }) : null, nb.name),
        el('div', { class: 'card-sub' }, sub)),
      this.moreBtn(nb));
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-more')) return;
      if (this.tab === 'trash') { this.cardMenu(card.querySelector('.card-more'), nb); return; }
      this.app.openNotebook(nb.id);
    });
    return card;
  }

  moreBtn(it) {
    const b = el('button', { class: 'card-more', 'aria-label': 'Optionen', html: icon('more') });
    b.addEventListener('click', (e) => { e.stopPropagation(); this.cardMenu(b, it); });
    return b;
  }

  cardMenu(anchor, it) {
    if (it.deleted) {
      menu(anchor, [
        { label: 'Wiederherstellen', icon: 'restore', run: async () => { await store.restoreItem(it.id); await this.refresh(); toast('Wiederhergestellt'); } },
        { label: 'Endgültig löschen', icon: 'trash', danger: true, run: async () => {
          if (await confirm('Endgültig löschen?', `„${it.name}“ wird unwiderruflich entfernt.`, 'Löschen', true)) { await store.purgeItem(it.id); await this.refresh(); }
        } },
      ]);
      return;
    }
    const nb = it.kind === 'notebook';
    menu(anchor, [
      nb ? { label: 'Öffnen', icon: 'notebook', run: () => this.app.openNotebook(it.id) } : null,
      { label: 'Umbenennen', icon: 'pencil', run: () => this.rename(it) },
      { label: it.fav ? 'Aus Favoriten entfernen' : 'Zu Favoriten', icon: 'star', run: () => this.update(it, { fav: !it.fav }) },
      { label: 'Farbe ändern', icon: 'palette', run: () => this.recolor(it) },
      { label: 'Verschieben …', icon: 'move', run: () => this.move(it) },
      nb ? { label: 'Duplizieren', icon: 'duplicate', run: async () => { await store.duplicateNotebook(it.id); await this.refresh(); toast('Kopie erstellt'); } } : null,
      { sep: true },
      nb ? { label: 'Als PDF exportieren', icon: 'pdf', run: () => this.exportPdf(it) } : null,
      { label: 'Als FingerNote-Datei teilen', icon: 'share', run: () => this.exportFile(it) },
      { sep: true },
      { label: 'In den Papierkorb', icon: 'trash', danger: true, run: async () => {
        await store.trashItem(it.id);
        await this.refresh();
        toast(`„${it.name}“ im Papierkorb`, { action: { label: 'Rückgängig', run: async () => { await store.restoreItem(it.id); await this.refresh(); } } });
      } },
    ]);
  }

  async update(it, patch) {
    Object.assign(it, patch);
    await store.saveItem(it);
    this.render();
  }

  async rename(it) {
    const v = await prompt('Umbenennen', it.name, { okLabel: 'Umbenennen' });
    if (v) await this.update(it, { name: v });
  }

  async recolor(it) {
    let c = it.color;
    const r = await dialog({
      title: 'Farbe',
      body: colorRow(store.COVER_COLORS, c, (v) => { c = v; }),
      buttons: [{ label: 'Abbrechen', value: null }, { label: 'Übernehmen', value: true, primary: true }],
    });
    if (r) await this.update(it, { color: c });
  }

  async move(it) {
    const folders = this.items.filter((i) => i.kind === 'folder' && !i.deleted);
    const blocked = new Set();
    if (it.kind === 'folder') {
      const mark = (id) => { blocked.add(id); folders.filter((f) => f.parent === id).forEach((f) => mark(f.id)); };
      mark(it.id);
    }
    const list = el('div', { class: 'move-list' });
    const add = (parent, depth) => {
      for (const f of this.sorted(folders.filter((x) => (x.parent || null) === parent))) {
        if (blocked.has(f.id)) continue;
        list.append(el('button', { class: `move-item ${it.parent === f.id ? 'on' : ''}`, dataset: { id: f.id }, style: { paddingLeft: 14 + depth * 22 + 'px' }, html: icon('folder') + `<span></span>` }));
        list.lastChild.querySelector('span').textContent = f.name;
        add(f.id, depth + 1);
      }
    };
    list.append(el('button', { class: `move-item ${!it.parent ? 'on' : ''}`, dataset: { id: '' }, html: icon('grid') + '<span>Bibliothek (oberste Ebene)</span>' }));
    add(null, 1);
    const r = await dialog({
      title: `„${it.name}“ verschieben`,
      body: list,
      buttons: [{ label: 'Abbrechen', value: null }],
      onOpen: (box, close) => list.addEventListener('click', (e) => { const b = e.target.closest('.move-item'); if (b) close({ id: b.dataset.id }); }),
    });
    if (!r) return;
    await store.moveItem(it.id, r.id || null);
    await this.refresh();
    toast('Verschoben');
  }

  // ------------------------------------------------------------ Neu
  newMenu(btn) {
    menu(btn, [
      { label: 'Notizbuch', icon: 'notebook', run: () => this.newNotebook() },
      { label: 'Ordner', icon: 'folderPlus', run: () => this.newFolder() },
      { sep: true },
      { label: 'PDF importieren', icon: 'pdf', run: () => this.importPdf() },
      { label: 'FingerNote-Datei öffnen', icon: 'upload', run: () => this.importFile() },
    ]);
  }

  async newFolder() {
    const name = await prompt('Neuer Ordner', '', { placeholder: 'z. B. Uni, Arbeit, Ideen', okLabel: 'Erstellen' });
    if (name == null) return;
    await store.createFolder(name || 'Neuer Ordner', this.tab === 'all' ? this.folder : null);
    await this.refresh();
  }

  async newNotebook() {
    const last = getSettings().lastNew || {};
    const o = { name: '', color: last.color || store.COVER_COLORS[0], template: last.template || 'lined', paper: last.paper || 'white', format: last.format || 'portrait' };
    const name = el('input', { class: 'inp', type: 'text', placeholder: 'Notizbuch', autocomplete: 'off', autocapitalize: 'sentences' });
    const tpl = templatePicker(o.template, o.paper, (v) => { o.template = v; });
    const body = el('div', { class: 'new-nb' },
      field('Name', name),
      field('Farbe', colorRow(store.COVER_COLORS, o.color, (v) => { o.color = v; })),
      field('Vorlage', tpl),
      field('Papier', paperPicker(o.paper, (v) => { o.paper = v; tpl.setPaper(v); })),
      field('Format', formatPicker(o.format, (v) => { o.format = v; }), 'Endlos: Die Seite wächst beim Schreiben nach unten – wie ein unendliches Blatt.'));
    const r = await dialog({
      title: 'Neues Notizbuch', body, wide: true,
      buttons: [{ label: 'Abbrechen', value: null }, { label: 'Erstellen', value: true, primary: true }],
      onOpen: () => setTimeout(() => name.focus(), 80),
    });
    if (!r) return;
    o.name = name.value.trim() || `Notizbuch ${new Date().toLocaleDateString('de-DE')}`;
    saveSettings({ lastNew: { color: o.color, template: o.template, paper: o.paper, format: o.format } });
    const nb = await store.createNotebook({ ...o, parent: this.tab === 'all' ? this.folder : null });
    await this.app.openNotebook(nb.id);
  }

  async importPdf() {
    const f = await pickFile('application/pdf,.pdf');
    if (!f) return;
    const prog = progress('PDF wird importiert');
    try {
      const pages = await importPdfPages(f, (fr, t) => prog.set(fr, t));
      const pageObjs = pages.map((p) => ({ ...store.newPage(null, { template: 'blank' }), ...p }));
      const nb = await store.createNotebook({ name: f.name.replace(/\.pdf$/i, ''), parent: this.tab === 'all' ? this.folder : null, color: '#2563eb', template: 'blank', pages: pageObjs });
      prog.close();
      await this.app.openNotebook(nb.id);
    } catch (e) {
      console.error(e);
      prog.close();
      toast('Das PDF konnte nicht gelesen werden.');
    }
  }

  async importFile() {
    const f = await pickFile('application/json,.json,.fingernote');
    if (!f) return;
    try {
      const r = await store.importData(f);
      await this.refresh();
      const parts = [];
      if (r.notebooks) parts.push(`${r.notebooks} Notizbuch${r.notebooks === 1 ? '' : 'bücher'}`);
      if (r.folders) parts.push(`${r.folders} Ordner`);
      toast(parts.length ? `Importiert: ${parts.join(', ')}` : 'Alles war schon aktuell vorhanden.');
    } catch (e) {
      toast(e.message || 'Import fehlgeschlagen');
    }
  }

  async exportPdf(nb) {
    const prog = progress('PDF wird erstellt');
    try {
      const data = await store.loadNotebook(nb.id);
      const blob = await exportPdf(nb.name, data.pages, {}, (f, t) => prog.set(f, t));
      prog.close();
      await offerFile(blob, safeFileName(nb.name) + '.pdf', 'PDF ist fertig');
    } catch (e) {
      console.error(e);
      prog.close();
      toast('Export fehlgeschlagen.');
    }
  }

  async exportFile(it) {
    const blob = await store.exportData([it.id]);
    await offerFile(blob, safeFileName(it.name) + '.fingernote.json');
  }

  async emptyTrash() {
    if (!(await confirm('Papierkorb leeren?', 'Alle Elemente im Papierkorb werden endgültig gelöscht.', 'Leeren', true))) return;
    await store.emptyTrash();
    await this.refresh();
  }

  sortMenu(btn) {
    const s = getSettings().sort;
    menu(btn, [
      { title: 'Sortieren nach' },
      { label: 'Zuletzt bearbeitet', icon: 'clock', checked: s === 'updated', run: () => { saveSettings({ sort: 'updated' }); this.render(); } },
      { label: 'Name', icon: 'sort', checked: s === 'name', run: () => { saveSettings({ sort: 'name' }); this.render(); } },
    ]);
  }

  // ------------------------------------------------------------ Suche
  async renderSearch(c) {
    const { items, hits } = await store.search(this.query);
    if (!items.length && !hits.length) {
      c.append(el('div', { class: 'empty small' }, el('h2', null, 'Nichts gefunden'), el('p', null, 'Gesucht wird in Namen und getippten Texten.')));
      return;
    }
    if (items.length) {
      c.append(el('h3', { class: 'sec-h' }, 'Notizbücher & Ordner'));
      const grid = el('div', { class: 'grid' });
      for (const it of this.sorted(items)) grid.append(it.kind === 'folder' ? this.folderCard(it) : this.notebookCard(it));
      c.append(grid);
    }
    if (hits.length) {
      c.append(el('h3', { class: 'sec-h' }, 'In Notizen'));
      const list = el('div', { class: 'hits' });
      for (const h of hits) {
        const row = el('button', { class: 'hit' },
          el('span', { class: 'hit-ic', style: { background: h.nb.color }, html: icon('notebook') }),
          el('span', { class: 'hit-txt' }, el('b', null, `${h.nb.name} · Seite ${h.pageIndex + 1}`), el('small', null, h.snippet)));
        row.addEventListener('click', () => this.app.openNotebook(h.nb.id, h.pageId));
        list.append(row);
      }
      c.append(list);
    }
  }

  // ------------------------------------------------------------ Hinweise
  renderBanners(live) {
    const b = this.banners;
    b.innerHTML = '';
    const st = getSettings();
    const now = Date.now();
    const snooze = +(localStorage.getItem('fingernote.snooze') || 0);
    if (isIOS() && !isStandalone() && !localStorage.getItem('fingernote.installHint')) {
      b.append(this.banner('share', 'Als App installieren', 'In Safari auf „Teilen“ tippen und „Zum Home-Bildschirm“ wählen – dann startet FingerNote im Vollbild und offline.',
        null, () => { localStorage.setItem('fingernote.installHint', '1'); this.render(); }));
    }
    const nbs = live.filter((i) => i.kind === 'notebook');
    const changedSince = nbs.some((n) => n.updated > (st.lastBackup || 0) && n.updated - n.created > 60000);
    const due = st.lastBackup ? now - st.lastBackup > 14 * 86400000 : nbs.some((n) => now - n.created > 3 * 86400000);
    if (changedSince && due && now > snooze) {
      const txt = st.lastBackup ? `Letztes Backup ${relTime(st.lastBackup)}.` : 'Du hast noch kein Backup.';
      b.append(this.banner('download', 'Notizen sichern', `${txt} Ein Backup schützt vor Datenverlust, z. B. beim Gerätewechsel.`,
        { label: 'Jetzt sichern', run: () => this.backup() },
        () => { localStorage.setItem('fingernote.snooze', String(now + 3 * 86400000)); this.render(); }));
    }
  }

  banner(ic, title, text, action, onClose) {
    return el('div', { class: 'banner' },
      el('span', { class: 'banner-ic', html: icon(ic) }),
      el('div', { class: 'banner-txt' }, el('b', null, title), el('span', null, text)),
      action ? el('button', { class: 'btn primary sm', onclick: action.run }, action.label) : null,
      onClose ? el('button', { class: 'ib sm', 'aria-label': 'Ausblenden', html: icon('x'), onclick: onClose }) : null);
  }

  // ------------------------------------------------------------ Einstellungen & Backup
  async backup() {
    const prog = progress('Backup wird erstellt');
    try {
      const blob = await store.exportData(null);
      prog.close();
      const r = await offerFile(blob, `FingerNote-Backup-${dateStamp()}.json`, 'Backup ist fertig');
      if (r) { saveSettings({ lastBackup: Date.now() }); this.render(); }
    } catch (e) {
      prog.close();
      toast('Backup fehlgeschlagen.');
    }
  }

  async settings() {
    const st = getSettings();
    const info = await store.storageInfo();
    const row = (label, ctrl, hint) => el('div', { class: 'set-row' }, el('div', { class: 'set-l' }, el('span', null, label), hint ? el('small', null, hint) : null), ctrl);
    const storageTxt = info.usage != null ? `${fmtBytes(info.usage)} belegt` : 'unbekannt';
    const persistBtn = el('button', { class: 'btn sm' }, info.persisted ? 'Dauerhaft ✓' : 'Dauerhaft speichern');
    persistBtn.disabled = !!info.persisted;
    persistBtn.addEventListener('click', async () => {
      const ok = await store.requestPersist();
      persistBtn.textContent = ok ? 'Dauerhaft ✓' : 'Nicht erlaubt';
      persistBtn.disabled = ok;
      if (!ok) toast('Tipp: Als App zum Home-Bildschirm hinzufügen – dann bleiben Daten zuverlässig erhalten.');
    });
    const body = el('div', { class: 'settings' },
      el('h3', { class: 'set-h' }, 'Darstellung'),
      row('Design', segmented([['system', 'System'], ['light', 'Hell'], ['dark', 'Dunkel']], st.theme, (v) => { saveSettings({ theme: v }); applyTheme(); this.app.editor.themeChanged(); })),
      el('h3', { class: 'set-h' }, 'Eingabe'),
      row('Mit dem Finger zeichnen', segmented([['auto', 'Automatisch'], ['draw', 'Immer'], ['pan', 'Nie']], st.finger, (v) => saveSettings({ finger: v })),
        'Automatisch: Der Finger zeichnet, bis ein Apple Pencil benutzt wird – danach scrollt der Finger.'),
      row('Zeichnen & halten → Form', toggle(st.holdShape, (v) => saveSettings({ holdShape: v })), 'Kurz halten macht aus einer Skizze eine saubere Linie, einen Kreis oder ein Rechteck.'),
      row('Tipp-Gesten', toggle(st.tapUndo, (v) => saveSettings({ tapUndo: v })), 'Zwei Finger tippen = Rückgängig, drei Finger = Wiederholen.'),
      el('h3', { class: 'set-h' }, 'Datensicherung'),
      row('Backup sichern', el('button', { class: 'btn sm primary', onclick: () => this.backup() }, 'Sichern'),
        st.lastBackup ? `Letztes Backup: ${relTime(st.lastBackup)}` : 'Noch kein Backup – z. B. in iCloud Drive ablegen.'),
      row('Backup wiederherstellen', el('button', { class: 'btn sm', onclick: () => this.importFile() }, 'Datei wählen'), 'Fehlende oder ältere Notizbücher werden ergänzt, nichts wird gelöscht.'),
      row('Speicher', persistBtn, storageTxt),
      el('h3', { class: 'set-h' }, 'Hilfe'),
      row('Gesten & Tipps', el('button', { class: 'btn sm', onclick: () => showHelp() }, 'Anzeigen')),
      el('p', { class: 'about' },
        el('b', null, `FingerNote ${APP_VERSION}`), el('br'),
        'Kein Konto, kein Abo, keine Werbung. Alle Notizen bleiben auf diesem Gerät.'));
    await dialog({ title: 'Einstellungen', body, wide: true, buttons: [{ label: 'Fertig', value: true, primary: true }] });
    this.render();
  }
}

function folderSvg() {
  return `<svg viewBox="0 0 120 92" aria-hidden="true"><path d="M8 18a8 8 0 018-8h28l10 10h50a8 8 0 018 8v50a8 8 0 01-8 8H16a8 8 0 01-8-8z" fill="var(--c)" opacity=".9"/><path d="M8 32a8 8 0 018-8h88a8 8 0 018 8v46a8 8 0 01-8 8H16a8 8 0 01-8-8z" fill="var(--c)"/><path d="M8 32a8 8 0 018-8h88a8 8 0 018 8v4H8z" fill="#fff" opacity=".18"/></svg>`;
}

function emptyArt() {
  return `<svg viewBox="0 0 160 120" aria-hidden="true">
    <rect x="34" y="14" width="80" height="100" rx="8" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2" transform="rotate(-6 74 64)"/>
    <rect x="48" y="10" width="80" height="100" rx="8" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
    <path d="M60 36h56M60 50h56M60 64h40" stroke="var(--line-strong)" stroke-width="3" stroke-linecap="round"/>
    <path d="M58 88c10-14 20 8 30-4s16-10 26-2" stroke="var(--accent)" stroke-width="4" fill="none" stroke-linecap="round"/>
  </svg>`;
}
