// Bibliothek: Meine Welt (Netzwerk), Bücher & Ordner, Suche, Favoriten, Zuletzt, Papierkorb,
// Einstellungen mit Konto und OneDrive.
import { el, relTime, debounce, getSettings, saveSettings, applyTheme, pickFile, dateStamp, safeFileName, fmtBytes, APP_VERSION } from './util.js';
import { icon, logoSvg } from './icons.js';
import { toast, dialog, menu, prompt, confirm, progress, segmented, toggle } from './ui.js';
import * as store from './store.js';
import { templatePicker, paperPicker, formatPicker, colorRow, field } from './pickers.js';
import { importPdfPages, exportPdf } from './pdfio.js';
import { offerFile, showHelp } from './editor-ui.js';
import { renderPageToCanvas, ensureImages, pageRegion } from './ink.js';
import { World } from './world.js';
import * as accounts from './accounts.js';
import * as od from './onedrive.js';

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const isStandalone = () => window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

const TABS = [
  ['world', 'network', 'Meine Welt'],
  ['all', 'book', 'Bibliothek'],
  ['fav', 'star', 'Favoriten'],
  ['recent', 'clock', 'Zuletzt'],
  ['trash', 'trash', 'Papierkorb'],
];

export class Library {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('library');
    this.folder = null;
    this.tab = getSettings().libView === 'grid' ? 'all' : 'world';
    this.query = '';
    this.items = [];
    this.world = new World({
      open: (id, node) => this.worldOpen(id, node),
      root: (node) => this.newMenu(node, null),
    });
    this.build();
    window.addEventListener('fingernote:sync', () => this.renderSync());
    window.addEventListener('online', () => this.renderSync());
    window.addEventListener('offline', () => this.renderSync());
  }

  build() {
    const me = accounts.currentAccount();
    this.root.innerHTML = `
      <aside class="lib-nav">
        <div class="brand">${logoSvg(34)}<span>FingerNote</span></div>
        <nav class="nav-tabs">
          ${TABS.map(([k, ic, label]) => `<button data-tab="${k}">${icon(ic)}<span>${label}</span></button>`).join('')}
        </nav>
        <div class="nav-folders"></div>
        <div class="nav-foot">
          <button class="sync-pill" hidden></button>
          <button class="me" data-a="me"></button>
        </div>
      </aside>
      <main class="lib-main">
        <header class="lib-head">
          <div class="lib-titlebox">
            <button class="ib lib-back" hidden aria-label="Zurück">${icon('back')}</button>
            <div class="lib-titles">
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
        </header>
        <div class="lib-banners"></div>
        <div class="lib-scroll"><div class="lib-content"></div></div>
      </main>`;
    this.content = this.root.querySelector('.lib-content');
    this.scroller = this.root.querySelector('.lib-scroll');
    this.h1 = this.root.querySelector('.lib-h1');
    this.crumb = this.root.querySelector('.lib-crumb');
    this.backBtn = this.root.querySelector('.lib-back');
    this.banners = this.root.querySelector('.lib-banners');
    this.navFolders = this.root.querySelector('.nav-folders');
    this.syncPill = this.root.querySelector('.sync-pill');
    const meBtn = this.root.querySelector('.me');
    meBtn.append(accounts.avatar(me, 30), el('span', { class: 'me-name' }, me.name), el('span', { html: icon('chevronDown') }));
    const search = this.root.querySelector('.search input');
    const doSearch = debounce(() => { this.query = search.value.trim(); this.render(); }, 180);
    search.addEventListener('input', doSearch);
    this.backBtn.addEventListener('click', () => this.goUp());
    this.root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => this.setTab(b.dataset.tab)));
    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (!b || !this.root.contains(b)) return;
      if (b.dataset.a === 'new') this.newMenu(b, this.tab === 'all' ? this.folder : null);
      if (b.dataset.a === 'settings') this.settings();
      if (b.dataset.a === 'sort') this.sortMenu(b);
      if (b.dataset.a === 'me') this.meMenu(b);
    });
    this.syncPill.addEventListener('click', () => this.oneDriveDialog());
  }

  setTab(tab, folder = null) {
    this.tab = tab;
    this.folder = tab === 'all' ? folder : null;
    if (tab === 'world' || tab === 'all') saveSettings({ libView: tab === 'world' ? 'world' : 'grid' });
    this.render();
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
    this.root.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x.dataset.tab === this.tab));
    this.renderBanners(live);
    this.renderNavFolders(live);
    this.renderSync();
    const f = this.folder && this.get(this.folder);
    const inFolder = !!f && this.tab === 'all' && !this.query;
    this.backBtn.hidden = !inFolder;
    this.crumb.hidden = !inFolder;
    const titles = { world: 'Meine Welt', all: 'Bibliothek', fav: 'Favoriten', recent: 'Zuletzt bearbeitet', trash: 'Papierkorb' };
    this.h1.textContent = this.query ? 'Suche' : inFolder ? f.name : titles[this.tab];
    if (inFolder) this.crumb.textContent = this.path(f).join(' › ');
    const c = this.content;
    c.innerHTML = '';
    this.root.classList.toggle('world-mode', this.tab === 'world' && !this.query);

    if (this.query) { await this.renderSearch(c); return; }

    if (this.tab === 'world') {
      c.append(this.world.el);
      this.world.render(live, accounts.currentAccount());
      const books = live.filter((i) => i.kind === 'notebook').length, folders = live.length - books;
      c.append(el('div', { class: 'world-legend glass' },
        el('span', null, `${books} ${books === 1 ? 'Buch' : 'Bücher'} · ${folders} ${folders === 1 ? 'Ordner' : 'Ordner'}`),
        el('button', { class: 'ib sm', title: 'Alles zeigen', 'aria-label': 'Alles zeigen', html: icon('fit'), onclick: () => this.world.fit() })));
      return;
    }

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
    const folders = list.filter((i) => i.kind === 'folder');
    const books = list.filter((i) => i.kind !== 'folder');
    if (folders.length) {
      if (books.length) c.append(el('h3', { class: 'sec-h' }, 'Ordner'));
      c.append(el('div', { class: 'grid folders' }, folders.map((it) => this.folderCard(it))));
    }
    if (books.length) {
      if (folders.length) c.append(el('h3', { class: 'sec-h' }, 'Bücher'));
      c.append(el('div', { class: 'grid' }, books.map((it) => this.bookCard(it))));
    }
    this.fillThumbs(books);
  }

  renderNavFolders(live) {
    const top = this.sorted(live.filter((i) => i.kind === 'folder' && !i.parent)).slice(0, 12);
    this.navFolders.innerHTML = '';
    if (!top.length) return;
    this.navFolders.append(el('div', { class: 'nav-h' }, 'Ordner'));
    for (const f of top) {
      const b = el('button', { class: `nav-folder ${this.tab === 'all' && this.folder === f.id ? 'on' : ''}` },
        el('span', { class: 'nav-dot', style: { background: f.color } }), el('span', null, f.name));
      b.addEventListener('click', () => this.setTab('all', f.id));
      this.navFolders.append(b);
    }
  }

  /** Fehlende Vorschaubilder im Hintergrund erzeugen. */
  async fillThumbs(list) {
    for (const nb of list) {
      if (nb.kind !== 'notebook' || nb.thumb || nb.deleted || nb.mode === 'schematic') continue;
      try {
        const data = await store.loadNotebook(nb.id);
        if (!data) continue;
        const p = data.pages[0];
        await ensureImages(p);
        const cv = document.createElement('canvas');
        const R = pageRegion(p);
        renderPageToCanvas(cv, p, 300 / R.w, { region: R });
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
      all: this.folder ? ['Dieser Ordner ist leer', 'Lege hier ein Buch oder einen Unterordner an.'] : ['Noch keine Bücher', 'Erstelle dein erstes Buch – mit Seiten oder als unendliche Leinwand.'],
      fav: ['Noch keine Favoriten', 'Markiere Bücher oder Ordner mit dem Stern, um sie hier schnell zu finden.'],
      recent: ['Noch nichts bearbeitet', 'Zuletzt geöffnete Bücher erscheinen hier.'],
      trash: ['Der Papierkorb ist leer', 'Gelöschte Bücher bleiben hier 30 Tage, bevor sie endgültig verschwinden.'],
    };
    const [h, p] = msgs[this.tab];
    const box = el('div', { class: 'empty' }, el('div', { class: 'empty-art', html: emptyArt() }), el('h2', null, h), el('p', null, p));
    if (this.tab === 'all') {
      box.append(el('div', { class: 'empty-btns' },
        el('button', { class: 'btn primary', onclick: () => this.newBook(this.folder) }, 'Buch erstellen'),
        el('button', { class: 'btn', onclick: () => this.newFolder(this.folder) }, 'Ordner erstellen'),
        el('button', { class: 'btn', onclick: () => this.importPdf(this.folder) }, 'PDF importieren')));
    }
    return box;
  }

  folderCard(f) {
    const live = this.items.filter((i) => !i.deleted);
    const kids = live.filter((i) => i.parent === f.id);
    const nB = kids.filter((k) => k.kind === 'notebook').length, nF = kids.length - nB;
    const sub = this.tab === 'trash' ? `gelöscht ${relTime(f.deleted)}` :
      [nB ? `${nB} ${nB === 1 ? 'Buch' : 'Bücher'}` : '', nF ? `${nF} Ordner` : ''].filter(Boolean).join(' · ') || 'leer';
    const card = el('div', { class: 'card folder', tabindex: '0', style: { '--c': f.color || '#64748b' } },
      el('div', { class: 'folder-tile' }, el('span', { class: 'folder-ic', html: icon('folder') }),
        el('div', { class: 'card-meta' },
          el('div', { class: 'card-name' }, f.fav ? el('span', { class: 'fav', html: icon('star2') }) : null, f.name),
          el('div', { class: 'card-sub' }, sub))),
      this.moreBtn(f));
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-more')) return;
      if (this.tab === 'trash') { this.cardMenu(card.querySelector('.card-more'), f); return; }
      this.setTab('all', f.id);
    });
    return card;
  }

  bookCard(nb) {
    const cover = el('div', { class: 'cover', style: { '--c': nb.color || '#6a5cff' } });
    if (nb.thumb) cover.append(el('img', { src: nb.thumb, alt: '', draggable: 'false' }));
    else cover.append(el('div', { class: 'cover-blank' }));
    cover.append(el('span', { class: 'spine' }),
      el('span', { class: 'mode-badge', html: icon(nb.mode === 'canvas' ? 'canvas' : nb.mode === 'schematic' ? 'circuit' : 'pages') + `<span>${nb.mode === 'canvas' ? 'Leinwand' : nb.mode === 'schematic' ? 'Stromlaufplan' : 'Seiten'}</span>` }));
    const n = (nb.pages || []).length;
    const ns = (nb.sections || []).length;
    const sub = this.tab === 'trash' ? `gelöscht ${relTime(nb.deleted)}` :
      `${relTime(nb.updated)} · ${nb.mode === 'canvas' ? (ns > 1 ? `${ns} Leinwände` : 'Leinwand') : nb.mode === 'schematic' ? `${n} Blatt` : `${n} ${n === 1 ? 'Seite' : 'Seiten'}`}`;
    const card = el('div', { class: 'card nb', tabindex: '0', dataset: { id: nb.id } }, cover,
      el('div', { class: 'card-meta' },
        el('div', { class: 'card-name' }, nb.fav ? el('span', { class: 'fav', html: icon('star2') }) : null, nb.name),
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

  worldOpen(id, node) {
    const it = this.get(id);
    if (!it) return;
    if (it.kind === 'notebook') { this.app.openNotebook(id); return; }
    this.cardMenu(node, it);
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
      { title: it.name },
      nb ? { label: 'Öffnen', icon: 'book', run: () => this.app.openNotebook(it.id) } : { label: 'Öffnen', icon: 'folder', run: () => this.setTab('all', it.id) },
      !nb ? { label: 'Neues Buch hier', icon: 'book', run: () => this.newBook(it.id) } : null,
      !nb ? { label: 'Neuer Ordner hier', icon: 'folderPlus', run: () => this.newFolder(it.id) } : null,
      { sep: true },
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

  folderOptions(selected, blocked = new Set()) {
    const folders = this.items.filter((i) => i.kind === 'folder' && !i.deleted);
    const list = el('div', { class: 'move-list' });
    const add = (parent, depth) => {
      for (const f of this.sorted(folders.filter((x) => (x.parent || null) === parent))) {
        if (blocked.has(f.id)) continue;
        const b = el('button', { class: `move-item ${selected === f.id ? 'on' : ''}`, dataset: { id: f.id }, style: { paddingLeft: 14 + depth * 22 + 'px', '--c': f.color }, html: icon('folder') + '<span></span>' });
        b.querySelector('span').textContent = f.name;
        list.append(b);
        add(f.id, depth + 1);
      }
    };
    list.append(el('button', { class: `move-item ${!selected ? 'on' : ''}`, dataset: { id: '' }, html: icon('network') + '<span>Meine Welt (oberste Ebene)</span>' }));
    add(null, 1);
    return list;
  }

  async move(it) {
    const blocked = new Set();
    if (it.kind === 'folder') {
      const folders = this.items.filter((i) => i.kind === 'folder');
      const mark = (id) => { blocked.add(id); folders.filter((f) => f.parent === id).forEach((f) => mark(f.id)); };
      mark(it.id);
    }
    const list = this.folderOptions(it.parent, blocked);
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
  newMenu(btn, parent) {
    const where = parent ? this.get(parent) : null;
    menu(btn, [
      { title: where ? `In „${where.name}“` : 'In Meine Welt' },
      { label: 'Buch', icon: 'book', run: () => this.newBook(parent) },
      { label: 'Ordner', icon: 'folderPlus', run: () => this.newFolder(parent) },
      { sep: true },
      { label: 'PDF als Buch importieren', icon: 'pdf', run: () => this.importPdf(parent) },
      { label: 'FingerNote-Datei öffnen', icon: 'upload', run: () => this.importFile() },
    ]);
  }

  async newFolder(parent = null) {
    let color = store.COVER_COLORS[(this.items.length + 3) % store.COVER_COLORS.length];
    const inp = el('input', { class: 'inp', type: 'text', placeholder: 'z. B. Uni, Arbeit, Ideen', autocomplete: 'off', autocapitalize: 'sentences' });
    const r = await dialog({
      title: 'Neuer Ordner',
      body: el('div', null, field('Name', inp), field('Farbe', colorRow(store.COVER_COLORS, color, (v) => { color = v; }))),
      buttons: [{ label: 'Abbrechen', value: null }, { label: 'Erstellen', value: true, primary: true }],
      onOpen: () => setTimeout(() => inp.focus(), 80),
    });
    if (!r) return;
    await store.createFolder(inp.value.trim() || 'Neuer Ordner', parent, color);
    await this.refresh();
    toast('Ordner erstellt');
  }

  async newBook(parent = null) {
    const last = getSettings().lastNew || {};
    const o = { color: last.color || store.COVER_COLORS[0], template: last.template || 'lined', paper: last.paper || 'white', format: last.format || 'portrait', mode: last.mode || 'pages', parent };
    const name = el('input', { class: 'inp', type: 'text', placeholder: 'Buchname', autocomplete: 'off', autocapitalize: 'sentences' });
    const tplBox = el('div');
    const fmtField = field('Format', formatPicker(o.format, (v) => { o.format = v; }), 'Endlos: Die Seite wächst beim Schreiben nach unten.');
    const schSize = el('div', { class: 'seg' }, ['A4', 'A3'].map((k) => {
      const b = el('button', { type: 'button', class: (o.schSize || 'A4') === k ? 'on' : '' }, `${k} quer`);
      b.addEventListener('click', () => { o.schSize = k; schSize.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); });
      return b;
    }));
    const schField = field('Blattgröße', schSize, 'Mit Rahmen, Spalteneinteilung für Querverweise und Schriftfeld.');
    const drawTpl = () => {
      tplBox.hidden = o.mode === 'schematic';
      schField.hidden = o.mode !== 'schematic';
      const allowed = o.mode === 'canvas' ? ['blank', 'lined', 'grid', 'dots'] : null;
      if (allowed && !allowed.includes(o.template)) o.template = 'dots';
      const tpl = templatePicker(o.template, o.paper, (v) => { o.template = v; }, allowed);
      tplBox.replaceChildren(field(o.mode === 'canvas' ? 'Muster' : 'Vorlage', tpl), field('Papier', paperPicker(o.paper, (v) => { o.paper = v; tpl.setPaper(v); })));
      fmtField.hidden = o.mode !== 'pages';
    };
    const modeCard = (k, ic, title, sub) => {
      const b = el('button', { class: `mode-card ${o.mode === k ? 'on' : ''}`, type: 'button' },
        el('span', { class: 'mode-ic', html: icon(ic) }), el('b', null, title), el('small', null, sub));
      b.addEventListener('click', () => { o.mode = k; modes.querySelectorAll('.mode-card').forEach((x) => x.classList.toggle('on', x === b)); drawTpl(); });
      return b;
    };
    const modes = el('div', { class: 'mode-cards' },
      modeCard('pages', 'pages', 'Buch mit Seiten', 'Wie ein Heft – Seite für Seite, auch PDFs'),
      modeCard('canvas', 'canvas', 'Unendliche Leinwand', 'Grenzenlos in alle Richtungen – für Mindmaps & Skizzen'),
      modeCard('schematic', 'circuit', 'Stromlaufplan', 'Schaltplan nach IEC 60617 – mit BMK, Kontaktspiegel & Stückliste'));
    const whereBtn = el('button', { class: 'where-btn', type: 'button' });
    const drawWhere = () => { const f = o.parent && this.get(o.parent); whereBtn.innerHTML = icon(f ? 'folder' : 'network') + '<span></span>' + icon('chevronDown'); whereBtn.querySelector('span').textContent = f ? f.name : 'Meine Welt'; };
    whereBtn.addEventListener('click', async () => {
      const list = this.folderOptions(o.parent);
      const r = await dialog({ title: 'Speichern in', body: list, buttons: [{ label: 'Abbrechen', value: null }],
        onOpen: (box, close) => list.addEventListener('click', (e) => { const b = e.target.closest('.move-item'); if (b) close({ id: b.dataset.id }); }) });
      if (r) { o.parent = r.id || null; drawWhere(); }
    });
    drawWhere();
    drawTpl();
    const body = el('div', { class: 'new-nb' },
      field('Name', name), modes,
      el('div', { class: 'field-row' }, field('Farbe', colorRow(store.COVER_COLORS, o.color, (v) => { o.color = v; })), field('Ort', whereBtn)),
      tplBox, fmtField, schField);
    const r = await dialog({
      title: 'Neues Buch', body, wide: true,
      buttons: [{ label: 'Abbrechen', value: null }, { label: 'Erstellen', value: true, primary: true }],
      onOpen: () => setTimeout(() => name.focus(), 80),
    });
    if (!r) return;
    const nm = name.value.trim() || `Buch ${new Date().toLocaleDateString('de-DE')}`;
    saveSettings({ lastNew: { color: o.color, template: o.template, paper: o.paper, format: o.format, mode: o.mode } });
    const nb = await store.createNotebook({ ...o, name: nm, format: o.mode === 'schematic' ? (o.schSize || 'A4') : o.format });
    await this.app.openNotebook(nb.id);
  }

  async importPdf(parent = null) {
    const f = await pickFile('application/pdf,.pdf');
    if (!f) return;
    const prog = progress('PDF wird importiert');
    try {
      const pages = await importPdfPages(f, (fr, t) => prog.set(fr, t));
      const pageObjs = pages.map((p) => ({ ...store.newPage(null, { template: 'blank' }), ...p }));
      const nb = await store.createNotebook({ name: f.name.replace(/\.pdf$/i, ''), parent, color: '#2f6bff', template: 'blank', pages: pageObjs });
      prog.close();
      await this.app.openNotebook(nb.id);
      toast('PDF importiert – jede Seite ist direkt beschreibbar');
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
      if (r.notebooks) parts.push(`${r.notebooks} ${r.notebooks === 1 ? 'Buch' : 'Bücher'}`);
      if (r.folders) parts.push(`${r.folders} Ordner`);
      toast(parts.length ? `Importiert: ${parts.join(', ')}` : 'Alles war schon aktuell vorhanden.');
    } catch (e) {
      toast(e.message || 'Import fehlgeschlagen');
    }
  }

  async exportPdf(nb) {
    if (nb.mode === 'schematic') { await this.app.openNotebook(nb.id); this.app.sch.exportPdf(); return; }
    const prog = progress('PDF wird erstellt');
    try {
      const data = await store.loadNotebook(nb.id);
      const order = (data.nb.sections || []).flatMap((s) => data.pages.filter((p) => p.sec === s.id));
      const blob = await exportPdf(nb.name, order.length ? order : data.pages, {}, (f, t) => prog.set(f, t));
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
      c.append(el('h3', { class: 'sec-h' }, 'Bücher & Ordner'));
      c.append(el('div', { class: 'grid' }, this.sorted(items).map((it) => (it.kind === 'folder' ? this.folderCard(it) : this.bookCard(it)))));
    }
    if (hits.length) {
      c.append(el('h3', { class: 'sec-h' }, 'In Notizen'));
      const list = el('div', { class: 'hits' });
      for (const h of hits) {
        const row = el('button', { class: 'hit' },
          el('span', { class: 'hit-ic', style: { background: h.nb.color }, html: icon('book') }),
          el('span', { class: 'hit-txt' }, el('b', null, h.nb.name), el('small', null, h.snippet)));
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
    const snooze = +(localStorage.getItem(accounts.accountKey('snooze')) || 0);
    if (isIOS() && !isStandalone() && !localStorage.getItem('fingernote.installHint')) {
      b.append(this.banner('share', 'Als App installieren', 'In Safari auf „Teilen“ tippen und „Zum Home-Bildschirm“ wählen – dann startet FingerNote im Vollbild und offline.',
        null, () => { localStorage.setItem('fingernote.installHint', '1'); this.render(); }));
    }
    const s = od.status();
    if (od.isConnected() && s.needLogin) {
      b.append(this.banner('cloud', 'OneDrive neu verbinden', 'Microsoft verlangt aus Sicherheitsgründen regelmäßig eine neue Anmeldung.',
        { label: 'Verbinden', run: () => od.connect().catch((e) => toast(e.message)) }, null));
    }
    const nbs = live.filter((i) => i.kind === 'notebook');
    const lastSafe = Math.max(st.lastBackup || 0, s.lastUpload || 0);
    const changedSince = nbs.some((n) => n.updated > lastSafe && n.updated - n.created > 60000);
    const due = lastSafe ? now - lastSafe > 14 * 86400000 : nbs.some((n) => now - n.created > 3 * 86400000);
    if (changedSince && due && now > snooze && !(od.isConnected() && st.odAuto)) {
      const txt = lastSafe ? `Letzte Sicherung ${relTime(lastSafe)}.` : 'Du hast noch keine Sicherung.';
      b.append(this.banner('download', 'Notizen sichern', `${txt} Verbinde OneDrive oder sichere eine Datei – das schützt vor Datenverlust.`,
        { label: 'Sichern', run: () => this.backup() },
        () => { localStorage.setItem(accounts.accountKey('snooze'), String(now + 3 * 86400000)); this.render(); }));
    }
  }

  banner(ic, title, text, action, onClose) {
    return el('div', { class: 'banner' },
      el('span', { class: 'banner-ic', html: icon(ic) }),
      el('div', { class: 'banner-txt' }, el('b', null, title), el('span', null, text)),
      action ? el('button', { class: 'btn primary sm', onclick: action.run }, action.label) : null,
      onClose ? el('button', { class: 'ib sm', 'aria-label': 'Ausblenden', html: icon('x'), onclick: onClose }) : null);
  }

  renderSync() {
    const p = this.syncPill;
    if (!p) return;
    if (!od.isConnected()) { p.hidden = true; return; }
    p.hidden = false;
    const s = od.status();
    let ic = 'cloud', txt = 'OneDrive', cls = '';
    if (s.needLogin) { txt = 'Neu anmelden'; cls = 'warn'; }
    else if (s.busy) { ic = 'cloudUp'; txt = s.progress ? `Lädt hoch … ${Math.round(s.progress * 100)} %` : 'Lädt hoch …'; cls = 'busy'; }
    else if (!navigator.onLine && s.pending) { txt = 'Offline – wartet'; cls = 'warn'; }
    else if (s.error && s.pending) { txt = 'Fehler beim Sichern'; cls = 'warn'; }
    else if (s.pending) { ic = 'cloudUp'; txt = 'Änderungen ausstehend'; }
    else if (s.lastUpload) { ic = 'cloud'; txt = `Gesichert ${relTime(s.lastUpload)}`; cls = 'ok'; }
    p.className = `sync-pill ${cls}`;
    p.innerHTML = icon(ic) + '<span></span>';
    p.lastChild.textContent = txt;
  }

  // ------------------------------------------------------------ Konto
  meMenu(btn) {
    const others = accounts.listAccounts().filter((a) => a.id !== accounts.currentAccount().id);
    menu(btn, [
      { title: accounts.currentAccount().name },
      { label: 'Einstellungen', icon: 'settings', run: () => this.settings() },
      { label: 'OneDrive', icon: 'cloud', run: () => this.oneDriveDialog() },
      { sep: true },
      { label: others.length ? 'Konto wechseln' : 'Weiteres Konto anlegen', icon: 'user', run: () => this.app.lock() },
      { label: 'Abmelden', icon: 'logout', run: () => this.app.lock() },
    ], { placement: 'above' });
  }

  async accountDialog() {
    const acc = accounts.currentAccount();
    let color = acc.color;
    const name = el('input', { class: 'inp', type: 'text', value: acc.name, autocomplete: 'off' });
    const r = await dialog({
      title: 'Konto',
      body: el('div', null, field('Name', name), field('Farbe', colorRow(accounts.ACCOUNT_COLORS, color, (v) => { color = v; }))),
      buttons: [{ label: 'Abbrechen', value: null }, { label: 'Speichern', value: true, primary: true }],
    });
    if (r) { accounts.updateAccount(acc.id, { name: name.value.trim() || acc.name, color }); this.build(); this.render(); }
  }

  async changePin() {
    const acc = accounts.currentAccount();
    if (!(await accounts.askPassword(acc, 'Aktuelles Passwort'))) return;
    const pw = await accounts.askNewPassword();
    if (!pw) return;
    await accounts.changePassword(acc, pw);
    toast('Passwort geändert' + (od.isConnected() ? ' – gilt nach dem nächsten Hochladen auch auf anderen Geräten' : ''));
    if (od.isConnected()) od.upload().catch(() => {});
  }

  async deleteAccount() {
    const acc = accounts.currentAccount();
    if (!(await confirm('Konto löschen?', `Das Konto „${acc.name}“ und alle seine Bücher werden von diesem Gerät gelöscht. Sichere vorher, was du behalten willst.`, 'Weiter', true))) return;
    if (!(await accounts.askPassword(acc, 'Zum Löschen Passwort eingeben'))) return;
    await accounts.deleteAccount(acc);
    accounts.logout();
  }

  // ------------------------------------------------------------ OneDrive
  async oneDriveDialog() {
    const st = getSettings();
    const connected = od.isConnected();
    const s = od.status();
    const user = od.accountInfo();
    const rows = [];
    const row = (label, ctrl, hint) => el('div', { class: 'set-row' }, el('div', { class: 'set-l' }, el('span', null, label), hint ? el('small', null, hint) : null), ctrl);
    let close;
    const run = (fn) => async () => { close && close(null); try { await fn(); } catch (e) { toast(e.message || 'Fehler'); } this.render(); };
    if (!od.clientId()) {
      const idInp = el('input', { class: 'inp', type: 'text', placeholder: '00000000-0000-0000-0000-000000000000', value: st.odClientId || '', autocomplete: 'off', spellcheck: 'false' });
      rows.push(el('p', { class: 'muted' }, 'Für OneDrive braucht FingerNote einmalig eine kostenlose App-Registrierung bei Microsoft (Anleitung in der README im GitHub-Repo). Trage hier die „Anwendungs-ID (Client-ID)“ ein:'),
        idInp,
        el('div', { class: 'dlg-inline' }, el('button', { class: 'btn primary sm', onclick: () => { saveSettings({ odClientId: idInp.value.trim() }); close && close(null); if (idInp.value.trim()) this.oneDriveDialog(); } }, 'Speichern')));
    } else if (!connected) {
      rows.push(el('p', { class: 'muted' }, 'Verbinde dein Microsoft-Konto. FingerNote legt dann im Ordner „Apps/FingerNote“ deiner OneDrive eine Sicherung an und lädt Änderungen automatisch hoch, sobald du online bist. Damit kannst du dich auch auf anderen Geräten mit Name und Passwort anmelden.'),
        el('button', { class: 'btn primary wide', onclick: run(() => od.connect()) }, 'Mit OneDrive verbinden'));
    } else {
      rows.push(
        row('Verbunden', el('button', { class: 'btn sm danger', onclick: run(async () => { od.disconnect(); toast('OneDrive getrennt'); }) }, 'Trennen'), user ? `${user.name}${user.mail ? ' · ' + user.mail : ''}` : ''),
        row('Automatisch hochladen', toggle(st.odAuto, (v) => od.setAuto(v)), 'Nach Änderungen und sobald du wieder online bist.'),
        row('Jetzt hochladen', el('button', { class: 'btn sm primary', onclick: run(async () => { const p = progress('Wird hochgeladen'); try { await od.upload(); p.close(); toast('In OneDrive gesichert'); } catch (e) { p.close(); throw e; } }) }, 'Hochladen'),
          s.lastUpload ? `Zuletzt ${relTime(s.lastUpload)}${s.size ? ' · ' + fmtBytes(s.size) : ''}` : 'Noch nicht hochgeladen'),
        row('Aus OneDrive laden', el('button', { class: 'btn sm', onclick: run(async () => {
          if (!(await confirm('Aus OneDrive laden?', 'Fehlende oder in OneDrive neuere Bücher werden übernommen. Es wird nichts gelöscht.', 'Laden'))) return;
          const p = progress('Wird geladen'); try { const r = await od.restore(); p.close(); await this.refresh(); toast(`Übernommen: ${r.notebooks} ${r.notebooks === 1 ? 'Buch' : 'Bücher'}`); } catch (e) { p.close(); throw e; }
        }) }, 'Laden'), 'Holt deine Sicherung zurück, z. B. auf einem neuen iPad.'),
        row('Sicherung als Datei', el('button', { class: 'btn sm', onclick: run(async () => {
          const p = progress('Wird geladen'); try { const b = await od.downloadBlob(); p.close(); await offerFile(b, `FingerNote-OneDrive-${dateStamp()}.json`, 'Sicherung aus OneDrive'); } catch (e) { p.close(); throw e; }
        }) }, 'Exportieren'), 'Die OneDrive-Sicherung als Datei teilen oder in „Dateien“ ablegen.'));
      if (s.error) rows.push(el('p', { class: 'warn-text' }, `Letzter Fehler: ${s.error}`));
    }
    await dialog({ title: 'OneDrive', wide: true, body: el('div', { class: 'settings' }, ...rows), buttons: [{ label: 'Fertig', value: true, primary: true }], onOpen: (box, c) => { close = c; } });
  }

  // ------------------------------------------------------------ Einstellungen & Backup
  async backup() {
    const prog = progress('Sicherung wird erstellt');
    try {
      const blob = await store.exportData(null);
      prog.close();
      const r = await offerFile(blob, `FingerNote-Backup-${dateStamp()}.json`, 'Sicherung ist fertig');
      if (r) { saveSettings({ lastBackup: Date.now() }); this.render(); }
    } catch (e) {
      prog.close();
      toast('Sicherung fehlgeschlagen.');
    }
  }

  async settings() {
    const st = getSettings();
    const acc = accounts.currentAccount();
    const info = await store.storageInfo();
    const row = (label, ctrl, hint) => el('div', { class: 'set-row' }, el('div', { class: 'set-l' }, el('span', null, label), hint ? el('small', null, hint) : null), ctrl);
    let close;
    const later = (fn) => () => { close && close(null); setTimeout(fn, 220); };
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
      el('div', { class: 'set-account' }, accounts.avatar(acc, 52), el('div', null, el('b', null, acc.name), el('small', { class: 'muted' }, od.isConnected() ? 'Über OneDrive auf jedem Gerät abrufbar' : 'Anmeldung mit Name und Passwort')),
        el('button', { class: 'btn sm', onclick: later(() => this.accountDialog()) }, 'Bearbeiten')),
      el('h3', { class: 'set-h' }, 'Darstellung'),
      row('Design', segmented([['system', 'System'], ['light', 'Hell'], ['dark', 'Dunkel']], st.theme, (v) => { saveSettings({ theme: v }); applyTheme(); this.app.editor.themeChanged(); })),
      row('Seiten im Dunkelmodus abdunkeln', toggle(st.darkPages, (v) => { saveSettings({ darkPages: v }); this.app.editor.themeChanged(); }), 'Weißes Papier wird dunkel, schwarze Schrift hell – schont die Augen.'),
      el('h3', { class: 'set-h' }, 'Schreiben'),
      row('Mit dem Finger zeichnen', segmented([['auto', 'Automatisch'], ['draw', 'Immer'], ['pan', 'Nie']], st.finger, (v) => saveSettings({ finger: v })),
        'Automatisch: Der Finger zeichnet, bis ein Apple Pencil benutzt wird – danach scrollt der Finger.'),
      row('Zeichnen & halten → Form', toggle(st.holdShape, (v) => saveSettings({ holdShape: v })), 'Kurz halten macht aus einer Skizze eine saubere Linie, einen Kreis oder ein Rechteck.'),
      row('Wegkritzeln radiert', toggle(st.scribbleErase, (v) => saveSettings({ scribbleErase: v })), 'Mit dem Stift im Zickzack über Schrift fahren löscht sie – ohne Werkzeugwechsel.'),
      row('Radierer springt zurück', toggle(st.eraserBack, (v) => saveSettings({ eraserBack: v })), 'Nach dem Radieren automatisch wieder das vorige Werkzeug.'),
      row('Tipp-Gesten', toggle(st.tapUndo, (v) => saveSettings({ tapUndo: v })), 'Zwei Finger tippen = Rückgängig, drei Finger = Wiederholen.'),
      el('h3', { class: 'set-h' }, 'Konto & Sicherheit'),
      row('Passwort ändern', el('button', { class: 'btn sm', onclick: later(() => this.changePin()) }, 'Ändern')),
      row('Abmelden', el('button', { class: 'btn sm', onclick: () => this.app.lock() }, 'Abmelden'), 'Beim nächsten Öffnen werden Name und Passwort abgefragt.'),
      row('Konto löschen', el('button', { class: 'btn sm danger', onclick: later(() => this.deleteAccount()) }, 'Löschen'), 'Entfernt dieses Konto und seine Bücher von diesem Gerät.'),
      el('h3', { class: 'set-h' }, 'Sicherung'),
      row('OneDrive', el('button', { class: 'btn sm primary', onclick: later(() => this.oneDriveDialog()) }, od.isConnected() ? 'Verwalten' : 'Verbinden'),
        od.isConnected() ? 'Verbunden – automatische Sicherung' : 'Automatisch in deine OneDrive sichern'),
      row('Sicherung als Datei', el('button', { class: 'btn sm', onclick: later(() => this.backup()) }, 'Sichern'),
        st.lastBackup ? `Zuletzt ${relTime(st.lastBackup)}` : 'z. B. in iCloud Drive ablegen'),
      row('Sicherung wiederherstellen', el('button', { class: 'btn sm', onclick: later(() => this.importFile()) }, 'Datei wählen'), 'Fehlende oder ältere Bücher werden ergänzt, nichts wird gelöscht.'),
      row('Speicher', persistBtn, storageTxt),
      el('h3', { class: 'set-h' }, 'Hilfe'),
      row('Gesten & Tipps', el('button', { class: 'btn sm', onclick: () => showHelp() }, 'Anzeigen')),
      el('p', { class: 'about' }, el('span', { html: logoSvg(28) }), el('br'),
        el('b', null, `FingerNote ${APP_VERSION}`), el('br'),
        'Kein Abo, keine Werbung. Deine Notizen bleiben auf diesem Gerät – und auf Wunsch in deiner OneDrive.'));
    await dialog({ title: 'Einstellungen', body, wide: true, buttons: [{ label: 'Fertig', value: true, primary: true }], onOpen: (box, c) => { close = c; } });
    this.render();
  }
}

function emptyArt() {
  return `<svg viewBox="0 0 160 120" aria-hidden="true">
    <circle cx="80" cy="60" r="44" fill="none" stroke="var(--line-strong)" stroke-dasharray="4 6"/>
    <circle cx="80" cy="60" r="16" fill="var(--accent)"/>
    <circle cx="124" cy="60" r="9" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
    <circle cx="49" cy="29" r="9" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
    <circle cx="57" cy="98" r="9" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
    <path d="M96 60h19M68 48L56 36M72 74l-10 17" stroke="var(--line-strong)" stroke-width="2"/>
  </svg>`;
}
