// Oberfläche des Editors: Werkzeugleiste, Optionsleiste, Seitenleiste, Menüs.
import { el, clamp, debounce, getSettings, safeFileName, pickFile, fmtBytes, shareOrDownload } from './util.js';
import { icon } from './icons.js';
import { toast, dialog, menu, popover, closePopover, prompt, progress, segmented, toggle } from './ui.js';
import { renderPageToCanvas } from './ink.js';
import { templatePicker, paperPicker, PALETTE, field } from './pickers.js';
import * as store from './store.js';
import { exportPdf, exportPageImage, importPdfPages } from './pdfio.js';

const TOOLS = [
  ['pen', 'pen', 'Stift (P)'],
  ['marker', 'highlighter', 'Textmarker (H)'],
  ['eraser', 'eraser', 'Radierer (E)'],
  ['lasso', 'lasso', 'Lasso (L)'],
  ['shape', 'shapes', 'Formen (S)'],
  ['text', 'text', 'Text (T)'],
  ['tape', 'tape', 'Lernband (B)'],
  ['laser', 'laser', 'Laserpointer (Z)'],
];

const WIDTH_RANGE = { pen: [0.6, 16, 0.2], marker: [6, 60, 1], tape: [12, 90, 1], eraser: [4, 80, 1] };

/** Fertige Datei anbieten: Teilen braucht auf dem iPad einen frischen Fingertipp. */
export function offerFile(blob, filename, title = 'Datei ist fertig') {
  return dialog({
    title,
    body: el('p', null, `${filename} · ${fmtBytes(blob.size)}`, el('br'), el('span', { class: 'muted' }, 'Im Teilen-Menü z. B. „In Dateien sichern“, AirDrop oder eine andere App wählen.')),
    buttons: [
      { label: 'Schließen', value: null },
      { label: 'Teilen / Sichern', primary: true, value: () => { shareOrDownload(blob, filename); return true; } },
    ],
  });
}

export function showHelp() {
  const rows = [
    ['Zwei Finger tippen', 'Rückgängig'],
    ['Drei Finger tippen', 'Wiederholen'],
    ['Zwei Finger ziehen', 'Seite bewegen'],
    ['Zwei Finger spreizen', 'Zoomen (rastet bei Seitenbreite ein)'],
    ['Zeichnen und kurz halten', 'Saubere Form: Linie, Kreis, Rechteck, Dreieck …'],
    ['Textmarker halten', 'Gerade Markierung'],
    ['Lernband antippen', 'Aufdecken / wieder abdecken'],
    ['Checkbox antippen', 'Abhaken'],
    ['Lineal: 1 Finger / 2 Finger', 'Verschieben / Drehen (rastet bei 45° ein)'],
    ['Hand-Symbol oben rechts', 'Finger zeichnet ↔ Finger scrollt'],
  ];
  const keys = [
    ['⌘Z / ⇧⌘Z', 'Rückgängig / Wiederholen'],
    ['P H E L S T B Z', 'Stift, Textmarker, Radierer, Lasso, Formen, Text, Lernband, Laser'],
    ['R', 'Lineal ein/aus'],
    ['⌘C ⌘X ⌘V ⌘D', 'Kopieren, Ausschneiden, Einfügen, Duplizieren'],
    ['+ / − / 0', 'Zoomen / Seitenbreite'],
  ];
  const table = (list) => el('div', { class: 'help-list' }, list.map(([a, b]) => el('div', { class: 'help-row' }, el('span', { class: 'help-k' }, a), el('span', null, b))));
  dialog({
    title: 'Gesten & Tipps',
    wide: true,
    body: el('div', null,
      table(rows),
      el('h3', { class: 'help-h' }, 'Mit Tastatur'),
      table(keys),
      el('h3', { class: 'help-h' }, 'Text formatieren (Markdown)'),
      el('p', { class: 'muted' }, '# Überschrift · **fett** · *kursiv* · ~~durchgestrichen~~ · ==markiert== · - Liste · 1. Nummeriert · - [ ] Checkliste. Mit dem Apple Pencil kannst du in Textfelder auch per Scribble direkt schreiben.')),
    buttons: [{ label: 'Alles klar', value: true, primary: true }],
  });
}

export class EditorUI {
  constructor(ed) {
    this.ed = ed;
    this.root = ed.root;
    this.sideOpen = false;
    this.bmOnly = false;
    this.thumbs = new Map(); // pageId -> {canvas, ver}
    this.build();
    this.refreshThumbsSoon = debounce(() => this.renderVisibleThumbs(), 500);
  }

  build() {
    const r = this.root;
    r.innerHTML = `
      <header class="ed-bar">
        <div class="ed-left">
          <button class="ib" data-a="back" title="Zur Bibliothek" aria-label="Zur Bibliothek">${icon('back')}</button>
          <button class="ib" data-a="pages" title="Seitenübersicht" aria-label="Seitenübersicht">${icon('sidebar')}</button>
          <button class="ed-title" data-a="rename" title="Umbenennen"><span class="t"></span><span class="save-state"></span></button>
        </div>
        <div class="ed-tools" role="toolbar" aria-label="Werkzeuge">
          ${TOOLS.map(([k, ic, label]) => `<button class="tb" data-tool="${k}" title="${label}" aria-label="${label}">${icon(ic)}<span class="tdot"></span></button>`).join('')}
          <span class="tb-sep"></span>
          <button class="tb" data-a="image" title="Bild einfügen" aria-label="Bild einfügen">${icon('image')}</button>
          <button class="tb" data-a="ruler" title="Lineal (R)" aria-label="Lineal">${icon('ruler')}</button>
        </div>
        <div class="ed-right">
          <button class="ib" data-a="finger"></button>
          <button class="ib" data-a="undo" title="Rückgängig (2 Finger tippen)" aria-label="Rückgängig">${icon('undo')}</button>
          <button class="ib" data-a="redo" title="Wiederholen (3 Finger tippen)" aria-label="Wiederholen">${icon('redo')}</button>
          <button class="ib" data-a="addpage" title="Neue Seite danach" aria-label="Neue Seite">${icon('plus')}</button>
          <button class="ib" data-a="more" title="Mehr" aria-label="Mehr">${icon('more')}</button>
        </div>
      </header>
      <div class="ed-ctx"><div class="ctx-inner"></div></div>
      <div class="ed-body">
        <div class="ed-stage">
          <canvas class="base"></canvas>
          <div class="ruler" hidden><span class="ruler-angle">0°</span></div>
          <canvas class="live"></canvas>
          <textarea class="text-edit" hidden spellcheck="true" autocapitalize="sentences" aria-label="Text"></textarea>
          <div class="sel-menu" hidden></div>
          <div class="flash" hidden></div>
          <button class="pg-ind" title="Seitenübersicht"></button>
          <button class="zoom-ind" hidden title="Auf Seitenbreite"></button>
          <button class="focus-exit ib" hidden title="Vollbild beenden" aria-label="Vollbild beenden">${icon('focus')}</button>
        </div>
        <aside class="ed-side" hidden>
          <div class="side-head">
            <span class="side-title">Seiten</span>
            <button class="chip" data-a="bmonly">${icon('bookmark')}<span>Lesezeichen</span></button>
            <button class="ib sm" data-a="closeside" aria-label="Schließen">${icon('x')}</button>
          </div>
          <div class="side-list"></div>
          <button class="side-add" data-a="addend">${icon('plus')}<span>Seite am Ende</span></button>
        </aside>
      </div>`;
    this.ctxInner = r.querySelector('.ctx-inner');
    this.title = r.querySelector('.ed-title .t');
    this.saveEl = r.querySelector('.save-state');
    this.selMenu = r.querySelector('.sel-menu');
    this.pgInd = r.querySelector('.pg-ind');
    this.zoomInd = r.querySelector('.zoom-ind');
    this.flashEl = r.querySelector('.flash');
    this.side = r.querySelector('.ed-side');
    this.sideList = r.querySelector('.side-list');

    r.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a],[data-tool]');
      if (!b || !r.contains(b)) return;
      if (b.dataset.tool) { this.ed.setTool(b.dataset.tool); return; }
      this.action(b.dataset.a, b);
    });
    // Formatierungsknöpfe sollen das Textfeld nicht schließen
    r.querySelector('.ed-ctx').addEventListener('pointerdown', (e) => {
      if (this.ed.editing && e.target.closest('button')) e.preventDefault();
    });
    this.selMenu.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.pgInd.addEventListener('click', () => this.toggleSidebar());
    this.zoomInd.addEventListener('click', () => { this.ed.fit(); this.updateZoomIndicator(); });
    r.querySelector('.focus-exit').addEventListener('click', () => this.setFocus(false));
    this.thumbObserver = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) this.renderThumb(en.target.dataset.id);
    }, { root: this.sideList, rootMargin: '200px' });
  }

  async action(a, btn) {
    const ed = this.ed;
    switch (a) {
      case 'back': await ed.app.closeEditor(); break;
      case 'pages': this.toggleSidebar(); break;
      case 'closeside': this.toggleSidebar(false); break;
      case 'bmonly': this.bmOnly = !this.bmOnly; btn.classList.toggle('on', this.bmOnly); this.refreshSidebar(); break;
      case 'addend': ed.addPage(ed.pages.length - 1); break;
      case 'rename': {
        const v = await prompt('Notizbuch umbenennen', ed.nb.name, { okLabel: 'Umbenennen' });
        if (v) { ed.nb.name = v; ed.nbDirty = true; ed.scheduleSave(); this.title.textContent = v; }
        break;
      }
      case 'image': this.pickImage(); break;
      case 'ruler': ed.ruler.toggle(); break;
      case 'finger': ed.toggleFinger(); break;
      case 'undo': ed.undo(); break;
      case 'redo': ed.redo(); break;
      case 'addpage': ed.addPage(); toast(`Seite ${ed.currentIndex() + 1} hinzugefügt`); break;
      case 'more': this.moreMenu(btn); break;
      default: break;
    }
  }

  onOpen() {
    this.title.textContent = this.ed.nb.name;
    this.setFocus(false, true);
    this.thumbs.clear();
    this.refreshTool();
    this.updateUndo();
    this.updateFinger();
    this.updateRuler();
    this.setSaveState('saved');
    if (this.sideOpen) this.refreshSidebar();
  }

  onClose() {
    this.selMenu.hidden = true;
    closePopover();
    for (const t of this.thumbs.values()) { t.canvas.width = t.canvas.height = 0; }
    this.thumbs.clear();
    this.sideList.innerHTML = '';
  }

  // ------------------------------------------------------------ Werkzeuge
  refreshTool() {
    const ed = this.ed;
    this.root.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === ed.tool));
    this.updateToolDots();
    this.buildCtx();
    this.selectionChanged();
  }

  updateToolDots() {
    const ts = this.ed.toolState;
    const set = (k, c) => { const d = this.root.querySelector(`[data-tool="${k}"] .tdot`); if (d) d.style.background = c; };
    set('pen', ts.pen.type === 'rainbow' ? 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' : ts.pen.colors[ts.pen.ci]);
    set('marker', ts.marker.colors[ts.marker.ci]);
    set('shape', ts.pen.colors[ts.pen.ci]);
    set('tape', ts.tape.colors[ts.tape.ci]);
  }

  buildCtx() {
    const ed = this.ed, ts = ed.toolState, box = this.ctxInner;
    box.innerHTML = '';
    const sep = () => el('span', { class: 'ctx-sep' });
    const hint = (t) => el('span', { class: 'ctx-hint' }, t);
    const save = () => { ed.saveToolState(); this.updateToolDots(); };
    switch (ed.tool) {
      case 'pen':
        box.append(
          segmented([['pen', 'Füller'], ['ball', 'Fineliner'], ['rainbow', 'Regenbogen']], ts.pen.type, (v) => { ts.pen.type = v; save(); }),
          sep(), this.widthButtons('pen'), sep(), this.colorButtons('pen'));
        break;
      case 'shape':
        box.append(hint('Form zeichnen – sie wird automatisch geglättet'), sep(), this.widthButtons('pen'), sep(), this.colorButtons('pen'));
        break;
      case 'marker':
        box.append(this.widthButtons('marker'), sep(), this.colorButtons('marker'), sep(),
          this.chip('Gerade Linien', ts.marker.straight, (v) => { ts.marker.straight = v; save(); }));
        break;
      case 'eraser':
        box.append(
          segmented([['stroke', 'Ganze Striche'], ['pixel', 'Teilweise']], ts.eraser.mode, (v) => { ts.eraser.mode = v; save(); }),
          sep(), this.widthButtons('eraser'), sep(),
          this.chip('Nur Textmarker', ts.eraser.markerOnly, (v) => { ts.eraser.markerOnly = v; save(); }));
        break;
      case 'lasso':
        box.append(hint('Einkreisen zum Auswählen · Antippen wählt ein einzelnes Element'));
        if (ed.clipboard) box.append(sep(), this.ctxButton('paste', 'Einfügen', () => ed.paste()));
        break;
      case 'text':
        if (ed.editing) this.buildTextBar(box);
        else {
          box.append(hint('Auf die Seite tippen, um zu schreiben'), sep(),
            segmented([['14', 'S'], ['20', 'M'], ['28', 'L'], ['40', 'XL']], String(nearestSize(ts.text.size)), (v) => { ts.text.size = +v; save(); }),
            sep(), this.colorButtons('pen'));
        }
        break;
      case 'tape':
        box.append(this.widthButtons('tape'), sep(), this.colorButtons('tape'), sep(),
          this.ctxButton('eye', 'Alle aufdecken', () => { const n = ed.setAllTapes(ed.currentLayout().page, true); if (!n) toast('Kein Lernband auf dieser Seite'); }),
          this.ctxButton('eyeoff', 'Alle abdecken', () => { const n = ed.setAllTapes(ed.currentLayout().page, false); if (!n) toast('Kein aufgedecktes Lernband'); }));
        break;
      case 'laser':
        box.append(hint('Zum Präsentieren – die Spur verblasst von selbst'));
        break;
      default: break;
    }
  }

  buildTextBar(box) {
    const ed = this.ed, ts = ed.toolState, t = ed.editing.t;
    const sep = () => el('span', { class: 'ctx-sep' });
    box.append(
      segmented([['14', 'S'], ['20', 'M'], ['28', 'L'], ['40', 'XL']], String(nearestSize(t.size)), (v) => {
        ts.text.size = +v; ed.saveToolState(); ed.applyTextProps({ size: +v });
      }),
      sep(),
      this.fmtButton('bold', 'Fett', () => ed.wrapText('**')),
      this.fmtButton(null, 'Kursiv', () => ed.wrapText('*'), 'I'),
      this.fmtButton('heading', 'Überschrift', () => ed.prefixLine('# ')),
      this.fmtButton('list', 'Liste', () => ed.prefixLine('- ')),
      this.fmtButton('checklist', 'Checkliste', () => ed.prefixLine('- [ ] ')),
      sep(),
      this.colorButtons('pen', (c) => ed.applyTextProps({ c: c === '#1d1d1f' ? null : c })),
      sep(),
      el('button', { class: 'btn primary sm', onclick: () => ed.finishTextEdit() }, 'Fertig'));
  }

  fmtButton(ic, label, run, text) {
    const b = el('button', { class: 'tb sm', title: label, 'aria-label': label, onclick: run });
    b.innerHTML = ic ? icon(ic) : `<span class="fmt-i">${text}</span>`;
    return b;
  }

  ctxButton(ic, label, run) {
    return el('button', { class: 'ctx-btn', onclick: run }, label);
  }

  chip(label, on, onChange) {
    const b = el('button', { class: `chip ${on ? 'on' : ''}` }, label);
    b.addEventListener('click', () => { on = !on; b.classList.toggle('on', on); onChange(on); });
    return b;
  }

  widthButtons(tool) {
    const ts = this.ed.toolState;
    const t = ts[tool];
    const arr = tool === 'eraser' ? t.sizes : t.widths;
    const key = tool === 'eraser' ? 'si' : 'wi';
    const wrap = el('div', { class: 'wbtns' });
    arr.forEach((w, i) => {
      const b = el('button', { class: `wbtn ${i === t[key] ? 'on' : ''}`, title: `Stärke ${i + 1} – erneut tippen zum Anpassen`, 'aria-label': `Stärke ${i + 1}` });
      const px = [4, 8, 13][i];
      const dot = el('span', { class: `wdot ${tool === 'marker' || tool === 'tape' ? 'bar' : ''} ${tool === 'eraser' ? 'ring' : ''}` });
      dot.style.width = (tool === 'marker' || tool === 'tape' ? 16 : px) + 'px';
      dot.style.height = px + 'px';
      if (tool !== 'eraser') dot.style.background = tool === 'pen' && ts.pen.type === 'rainbow' ? '#888' : t.colors[t.ci];
      b.append(dot);
      b.addEventListener('click', () => {
        if (t[key] === i) this.widthSlider(b, tool, i);
        else { t[key] = i; this.ed.saveToolState(); this.buildCtx(); }
      });
      wrap.append(b);
    });
    return wrap;
  }

  widthSlider(anchor, tool, i) {
    const t = this.ed.toolState[tool];
    const arr = tool === 'eraser' ? t.sizes : t.widths;
    const [min, max, step] = WIDTH_RANGE[tool];
    const val = el('span', { class: 'slider-val' }, fmtW(arr[i], tool));
    const inp = el('input', { type: 'range', min, max, step, value: arr[i], class: 'slider' });
    inp.addEventListener('input', () => { arr[i] = +inp.value; val.textContent = fmtW(arr[i], tool); this.ed.saveToolState(); });
    popover(anchor, el('div', { class: 'slider-pop' }, el('div', { class: 'slider-head' }, 'Stärke', val), inp), { onClose: () => this.buildCtx() });
  }

  colorButtons(tool, onPick) {
    const ts = this.ed.toolState;
    const t = ts[tool];
    const wrap = el('div', { class: 'cbtns' });
    const editing = this.ed.editing;
    const activeColor = editing && onPick ? (editing.t.c || '#1d1d1f') : null;
    t.colors.forEach((c, i) => {
      const on = activeColor ? activeColor === c : i === t.ci;
      const b = el('button', { class: `csw ${on ? 'on' : ''}`, style: { '--c': c }, title: 'Farbe – erneut tippen zum Ändern', 'aria-label': `Farbe ${i + 1}` });
      b.addEventListener('click', () => {
        if (on && !onPick) { this.paletteFor(b, tool, i); return; }
        t.ci = i;
        this.ed.saveToolState();
        this.updateToolDots();
        if (onPick) onPick(c);
        this.buildCtx();
      });
      wrap.append(b);
    });
    return wrap;
  }

  paletteFor(anchor, tool, i) {
    const t = this.ed.toolState[tool];
    const pick = (c) => {
      t.colors[i] = c; t.ci = i;
      this.ed.saveToolState();
      this.updateToolDots();
    };
    const grid = el('div', { class: 'palette' });
    for (const c of PALETTE) {
      grid.append(el('button', { class: 'pal-sw', style: { background: c }, 'aria-label': c, onclick: () => { pick(c); closePopover(); } }));
    }
    const custom = el('input', { type: 'color', value: t.colors[i] });
    custom.addEventListener('input', () => pick(custom.value));
    popover(anchor, el('div', { class: 'pal-pop' }, el('div', { class: 'pal-title' }, 'Farbe für dieses Feld'), grid, el('label', { class: 'pal-custom' }, el('span', null, 'Eigene Farbe'), custom)), { onClose: () => this.buildCtx() });
  }

  updateUndo() {
    this.root.querySelector('[data-a="undo"]').disabled = !this.ed.history.undo.length;
    this.root.querySelector('[data-a="redo"]').disabled = !this.ed.history.redo.length;
  }

  updateFinger() {
    const b = this.root.querySelector('[data-a="finger"]');
    const draws = this.ed.fingerDraws();
    b.innerHTML = icon(draws ? 'finger' : 'hand');
    b.classList.toggle('on', draws);
    b.title = draws ? 'Finger zeichnet – tippen, damit der Finger scrollt' : 'Finger scrollt – tippen, damit der Finger zeichnet';
    b.setAttribute('aria-label', b.title);
  }

  updateRuler() {
    this.root.querySelector('[data-a="ruler"]').classList.toggle('on', this.ed.ruler.visible);
  }

  setSaveState(s) {
    const map = { dirty: '', saving: 'Speichert …', saved: 'Gespeichert', error: 'Nicht gespeichert!' };
    this.saveEl.textContent = map[s] || '';
    this.saveEl.className = 'save-state ' + s;
  }

  flash(kind) {
    const f = this.flashEl;
    f.innerHTML = kind === 'undo' ? `${icon('undo')}<span>Rückgängig</span>` : `${icon('redo')}<span>Wiederholen</span>`;
    f.hidden = false;
    f.classList.remove('show');
    void f.offsetWidth;
    f.classList.add('show');
    clearTimeout(this.flashT);
    this.flashT = setTimeout(() => { f.hidden = true; }, 750);
  }

  // ------------------------------------------------------------ Anzeige
  viewChanged() {
    this.updatePageIndicator();
    this.updateZoomIndicator();
    this.positionSelMenu();
    if (this.sideOpen) this.markCurrentThumb();
  }

  updatePageIndicator() {
    const ed = this.ed;
    if (!ed.pages.length) return;
    const i = ed.currentIndex();
    const bm = ed.pages[i] && ed.pages[i].bm;
    const txt = `${i + 1} / ${ed.pages.length}`;
    if (this.pgInd.dataset.txt !== txt + bm) {
      this.pgInd.dataset.txt = txt + bm;
      this.pgInd.innerHTML = (bm ? icon('bookmark', 'bm') : '') + `<span>${txt}</span>`;
    }
  }

  updateZoomIndicator(active) {
    const ed = this.ed;
    const pct = Math.round((ed.view.s / ed.fitScale()) * 100);
    const show = active || Math.abs(pct - 100) > 2;
    this.zoomInd.hidden = !show;
    if (show) this.zoomInd.textContent = pct + ' %';
  }

  setFocus(on, silent) {
    this.root.classList.toggle('focus', on);
    this.root.querySelector('.focus-exit').hidden = !on;
    if (!silent) { this.ed.resize(); if (on) toast('Vollbild – Symbol oben rechts beendet'); }
  }

  // ------------------------------------------------------------ Auswahl-Menü
  selectionChanged() {
    const ed = this.ed;
    if (!ed.selection) { this.selMenu.hidden = true; return; }
    const m = this.selMenu;
    m.innerHTML = '';
    const btn = (ic, label, run, danger) => {
      const b = el('button', { class: `sel-btn ${danger ? 'danger' : ''}`, title: label, onclick: (e) => run(e.currentTarget) });
      b.innerHTML = `${icon(ic)}<span>${label}</span>`;
      return b;
    };
    m.append(
      btn('copy', 'Kopieren', () => ed.copySelection()),
      btn('cut', 'Ausschneiden', () => ed.cutSelection()),
      btn('duplicate', 'Duplizieren', () => ed.duplicateSelection()),
      btn('palette', 'Farbe', (b) => this.selColor(b)),
      btn('trash', 'Löschen', () => ed.deleteSelection(), true));
    m.hidden = false;
    this.positionSelMenu();
  }

  selColor(anchor) {
    const grid = el('div', { class: 'palette' });
    for (const c of PALETTE) grid.append(el('button', { class: 'pal-sw', style: { background: c }, onclick: () => { closePopover(); this.ed.recolorSelection(c); } }));
    popover(anchor, el('div', { class: 'pal-pop' }, grid));
  }

  positionSelMenu() {
    const ed = this.ed;
    if (!ed.selection) return;
    const busy = ed.action && ed.action.sel;
    const r = ed.selScreenRect();
    if (busy || !r) { this.selMenu.style.visibility = 'hidden'; return; }
    this.selMenu.style.visibility = 'visible';
    const m = this.selMenu;
    const mw = m.offsetWidth, mh = m.offsetHeight;
    let x = (r.x0 + r.x1) / 2 - mw / 2;
    let y = r.y0 - mh - 14;
    if (y < 8) y = r.y1 + 18;
    if (y + mh > ed.H - 8) y = Math.max(8, ed.H - mh - 60);
    x = clamp(x, 8, ed.W - mw - 8);
    m.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  // ------------------------------------------------------------ Seitenleiste
  toggleSidebar(force) {
    this.sideOpen = force != null ? force : !this.sideOpen;
    this.side.hidden = !this.sideOpen;
    this.root.querySelector('[data-a="pages"]').classList.toggle('on', this.sideOpen);
    if (this.sideOpen) {
      this.refreshSidebar();
      const cur = this.sideList.querySelector('.thumb.on');
      if (cur) cur.scrollIntoView({ block: 'center' });
    }
  }

  refreshSidebar() {
    if (!this.sideOpen) return;
    const ed = this.ed;
    const list = this.sideList;
    this.thumbObserver.disconnect();
    list.innerHTML = '';
    const cur = ed.currentIndex();
    let shown = 0;
    ed.pages.forEach((p, i) => {
      if (this.bmOnly && !p.bm) return;
      shown++;
      const holder = el('div', { class: 'thumb-img', dataset: { id: p.id } });
      holder.style.aspectRatio = `${p.w} / ${p.h > p.w * 2.2 ? p.w * 2.2 : p.h}`;
      const more = el('button', { class: 'thumb-more', 'aria-label': 'Seitenoptionen' });
      more.innerHTML = icon('more');
      more.addEventListener('click', (e) => { e.stopPropagation(); this.pageMenu(more, i); });
      const item = el('div', { class: `thumb ${i === cur ? 'on' : ''}`, dataset: { idx: i } },
        holder,
        el('div', { class: 'thumb-meta' }, p.bm ? el('span', { class: 'thumb-bm', html: icon('bookmark') }) : null, el('span', { class: 'thumb-n' }, String(i + 1)), more));
      item.addEventListener('click', () => { ed.goToPage(i); if (window.innerWidth < 700) this.toggleSidebar(false); });
      list.append(item);
      const t = this.thumbs.get(p.id);
      if (t) holder.append(t.canvas);
      this.thumbObserver.observe(holder);
    });
    if (!shown) list.append(el('div', { class: 'side-empty' }, 'Keine Seiten mit Lesezeichen'));
  }

  markCurrentThumb() {
    const i = String(this.ed.currentIndex());
    if (this.lastCur === i) return;
    this.lastCur = i;
    this.sideList.querySelectorAll('.thumb').forEach((t) => t.classList.toggle('on', t.dataset.idx === i));
  }

  renderThumb(id) {
    const ed = this.ed;
    const p = ed.pages.find((x) => x.id === id);
    if (!p) return;
    let t = this.thumbs.get(id);
    if (t && t.ver === (p._v || 0) && t.h === p.h) return;
    if (!t) { t = { canvas: document.createElement('canvas') }; this.thumbs.set(id, t); }
    const W = 150 * Math.min(window.devicePixelRatio || 1, 2);
    const vis = Math.min(p.h, p.w * 2.2);
    const c = t.canvas;
    renderPageToCanvas(c, { ...p, h: vis }, W / p.w);
    t.ver = p._v || 0;
    t.h = p.h;
    const holder = this.sideList.querySelector(`.thumb-img[data-id="${id}"]`);
    if (holder && c.parentNode !== holder) holder.append(c);
  }

  renderVisibleThumbs() {
    if (!this.sideOpen) return;
    const box = this.sideList.getBoundingClientRect();
    this.sideList.querySelectorAll('.thumb-img').forEach((h) => {
      const r = h.getBoundingClientRect();
      if (r.bottom > box.top - 100 && r.top < box.bottom + 100) this.renderThumb(h.dataset.id);
    });
  }

  pageChanged() { if (this.sideOpen) this.refreshThumbsSoon(); }
  invalidateThumbs() { this.thumbs.forEach((t) => { t.ver = -1; }); this.refreshThumbsSoon(); }

  pageMenu(anchor, i) {
    const ed = this.ed, p = ed.pages[i], n = ed.pages.length;
    menu(anchor, [
      { title: `Seite ${i + 1}` },
      { label: 'Neue Seite davor', icon: 'plus', run: () => ed.addPage(i - 1) },
      { label: 'Neue Seite danach', icon: 'plus', run: () => ed.addPage(i) },
      { label: 'Duplizieren', icon: 'duplicate', run: () => ed.duplicatePage(i) },
      { label: p.bm ? 'Lesezeichen entfernen' : 'Lesezeichen setzen', icon: 'bookmark', run: () => ed.toggleBookmark(p) },
      { label: 'Vorlage ändern …', icon: 'layout', run: () => this.templateDialog(p) },
      { label: 'Nach oben', icon: 'arrowUp', disabled: i === 0, run: () => ed.movePage(i, -1) },
      { label: 'Nach unten', icon: 'arrowDown', disabled: i === n - 1, run: () => ed.movePage(i, 1) },
      { sep: true },
      { label: n > 1 ? 'Seite löschen' : 'Seite leeren', icon: 'trash', danger: true, run: () => ed.deletePage(i) },
    ]);
  }

  // ------------------------------------------------------------ Menüs & Dialoge
  moreMenu(btn) {
    const ed = this.ed;
    const i = ed.currentIndex(), p = ed.pages[i];
    menu(btn, [
      { title: `Seite ${i + 1} von ${ed.pages.length}` },
      { label: 'Vorlage & Papier …', icon: 'layout', run: () => this.templateDialog(p) },
      { label: p.bm ? 'Lesezeichen entfernen' : 'Lesezeichen setzen', icon: 'bookmark', run: () => ed.toggleBookmark(p) },
      { label: 'Seite duplizieren', icon: 'duplicate', run: () => ed.duplicatePage(i) },
      { label: ed.pages.length > 1 ? 'Seite löschen' : 'Seite leeren', icon: 'trash', danger: true, run: () => ed.deletePage(i) },
      { sep: true },
      { label: 'Bild einfügen', icon: 'image', run: () => this.pickImage() },
      { label: 'PDF-Seiten einfügen', icon: 'pdf', run: () => this.importPdf() },
      { label: 'Exportieren & teilen …', icon: 'share', run: () => this.exportDialog() },
      { sep: true },
      { label: 'Vollbild-Schreiben', icon: 'focus', run: () => this.setFocus(true) },
      { label: 'Auf Seitenbreite zoomen', icon: 'fit', run: () => { ed.fit(); this.updateZoomIndicator(); } },
      { label: 'Gesten & Tipps', icon: 'info', run: () => showHelp() },
    ]);
  }

  async pickImage() {
    const f = await pickFile('image/*');
    if (!f) return;
    try { await this.ed.insertImageFile(f); } catch (e) { console.error(e); toast('Das Bild konnte nicht geladen werden.'); }
  }

  async importPdf() {
    const f = await pickFile('application/pdf,.pdf');
    if (!f) return;
    const prog = progress('PDF wird importiert');
    try {
      const pages = await importPdfPages(f, (fr, t) => prog.set(fr, t));
      prog.close();
      await this.ed.insertPages(pages);
      toast(`${pages.length} Seite${pages.length === 1 ? '' : 'n'} eingefügt`);
    } catch (e) {
      console.error(e);
      prog.close();
      toast('PDF konnte nicht gelesen werden.');
    }
  }

  async templateDialog(page) {
    const ed = this.ed;
    let tpl = page.template, paper = page.paper;
    const picker = templatePicker(tpl, paper, (v) => { tpl = v; });
    const papers = paperPicker(paper, (v) => { paper = v; picker.setPaper(v); });
    const body = el('div', null,
      page.bg ? el('p', { class: 'muted' }, 'Diese Seite hat einen PDF-Hintergrund. Linien werden darauf nicht angezeigt.') : null,
      field('Vorlage', picker), field('Papierfarbe', papers));
    const r = await dialog({
      title: 'Vorlage & Papier', body, wide: true,
      buttons: [{ label: 'Abbrechen', value: null }, { label: 'Alle Seiten', value: 'all' }, { label: 'Diese Seite', value: 'one', primary: true }],
    });
    if (r === 'one') ed.setPageProps(page, { template: tpl, paper });
    else if (r === 'all') {
      ed.setPagesProps(ed.pages, { template: tpl, paper });
      ed.nb.defaults = { ...(ed.nb.defaults || {}), template: tpl, paper };
      ed.nbDirty = true;
      ed.scheduleSave();
    }
  }

  async exportDialog() {
    const ed = this.ed;
    let hideTape = false;
    const opt = (ic, title, sub, value) => el('button', { class: 'opt', dataset: { v: value } },
      el('span', { class: 'opt-ic', html: icon(ic) }), el('span', { class: 'opt-txt' }, el('b', null, title), el('small', null, sub)));
    const list = el('div', { class: 'opt-list' },
      opt('pdf', 'Notizbuch als PDF', `${ed.pages.length} Seite${ed.pages.length === 1 ? '' : 'n'}`, 'pdf-all'),
      opt('file', 'Aktuelle Seite als PDF', `Seite ${ed.currentIndex() + 1}`, 'pdf-page'),
      opt('image', 'Aktuelle Seite als Bild', 'PNG – z. B. für Nachrichten', 'png'),
      opt('notebook', 'FingerNote-Datei', 'Zum Sichern oder Weitergeben – mit FingerNote wieder öffnen', 'fn'));
    const tapeRow = el('label', { class: 'row-toggle' }, el('span', null, 'Lernband im Export ausblenden'), toggle(false, (v) => { hideTape = v; }));
    const r = await dialog({
      title: 'Exportieren & teilen',
      body: el('div', null, list, tapeRow),
      buttons: [{ label: 'Abbrechen', value: null }],
      onOpen: (box, close) => list.addEventListener('click', (e) => { const b = e.target.closest('.opt'); if (b) close(b.dataset.v); }),
    });
    if (!r) return;
    await ed.save();
    const name = safeFileName(ed.nb.name);
    try {
      if (r === 'pdf-all' || r === 'pdf-page') {
        const pages = r === 'pdf-all' ? ed.pages : [ed.pages[ed.currentIndex()]];
        const prog = progress('PDF wird erstellt');
        const blob = await exportPdf(ed.nb.name, pages, { hideTape }, (f, t) => prog.set(f, t));
        prog.close();
        await offerFile(blob, `${name}${r === 'pdf-page' ? ` – Seite ${ed.currentIndex() + 1}` : ''}.pdf`, 'PDF ist fertig');
      } else if (r === 'png') {
        const blob = await exportPageImage(ed.pages[ed.currentIndex()], { hideTape });
        await offerFile(blob, `${name} – Seite ${ed.currentIndex() + 1}.png`, 'Bild ist fertig');
      } else if (r === 'fn') {
        const blob = await store.exportData([ed.nb.id]);
        await offerFile(blob, `${name}.fingernote.json`, 'Datei ist fertig');
      }
    } catch (e) {
      console.error(e);
      toast('Export fehlgeschlagen.');
    }
  }
}

function nearestSize(s) {
  const opts = [14, 20, 28, 40];
  return opts.reduce((a, b) => (Math.abs(b - s) < Math.abs(a - s) ? b : a));
}

function fmtW(v, tool) {
  if (tool === 'eraser') return Math.round(v) + ' px';
  return (Math.round(v * 0.21 * 10) / 10).toLocaleString('de-DE') + ' mm';
}

export { getSettings };
