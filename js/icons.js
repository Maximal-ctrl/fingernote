// Schlichte Linien-Symbole (24×24). Einige Formen angelehnt an Lucide (ISC-Lizenz).
const P = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  chevronRight: '<path d="M9 18l6-6-6-6"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>',
  pen: '<path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5z"/><path d="M15 5l4 4"/>',
  highlighter: '<path d="M9 11l-6 6v3h9l3-3"/><path d="M22 12l-4.6 4.6a2 2 0 01-2.8 0l-5.2-5.2a2 2 0 010-2.8L14 4"/>',
  eraser: '<path d="M7 21l-4.3-4.3a2.4 2.4 0 010-3.4l9.6-9.6a2.4 2.4 0 013.4 0l5.6 5.6a2.4 2.4 0 010 3.4L13 21"/><path d="M22 21H7"/><path d="M5 11l9 9"/>',
  lasso: '<path d="M7 19.5c-1.6-.5-3-1.3-3.9-2.4" /><path d="M3 12.5C2.4 11.7 2 10.9 2 10c0-4.4 4.5-8 10-8s10 3.6 10 8-4.5 8-10 8c-1 0-2-.1-3-.3" stroke-dasharray="3 3"/><circle cx="5" cy="17" r="2"/><path d="M5 19c0 1.5.5 2.5 2 3"/>',
  shapes: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><circle cx="17" cy="17" r="4"/><path d="M17 3l4.5 7.5h-9z"/>',
  text: '<path d="M4 7V5h16v2"/><path d="M12 5v14"/><path d="M9 19h6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-3.1-3.1a2 2 0 00-2.8 0L6 21"/>',
  ruler: '<path d="M21.3 15.3a2.4 2.4 0 010 3.4l-2.6 2.6a2.4 2.4 0 01-3.4 0L2.7 8.7a2.4 2.4 0 010-3.4l2.6-2.6a2.4 2.4 0 013.4 0z"/><path d="M14.5 12.5l2-2"/><path d="M11.5 9.5l2-2"/><path d="M8.5 6.5l2-2"/><path d="M17.5 15.5l2-2"/>',
  laser: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  tape: '<rect x="2" y="8" width="20" height="8" rx="1.5"/><path d="M7 8v8M12 8v8M17 8v8" opacity=".45"/>',
  sidebar: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M9 3v18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  share: '<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>',
  download: '<path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M5 17v2a2 2 0 002 2h10a2 2 0 002-2v-2"/>',
  upload: '<path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M5 17v2a2 2 0 002 2h10a2 2 0 002-2v-2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  folderPlus: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M12 10v6M9 13h6"/>',
  notebook: '<rect x="5" y="3" width="15" height="18" rx="2"/><path d="M9 3v18"/><path d="M3 7h4M3 12h4M3 17h4"/>',
  file: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/>',
  pdf: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/><path d="M8.5 13h7M8.5 16.5h5"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14"/>',
  restore: '<path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8"/><path d="M3 3v5h5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  hand: '<path d="M18 11V6a2 2 0 00-4 0v5"/><path d="M14 10V4a2 2 0 00-4 0v6"/><path d="M10 10.5V6a2 2 0 00-4 0v8"/><path d="M18 8a2 2 0 014 0v6a8 8 0 01-8 8h-2c-2.8 0-4.5-.9-6-2.3l-3.6-3.6a2 2 0 012.8-2.8L7 15"/>',
  finger: '<path d="M10 9.5V4a2 2 0 00-4 0v10"/><path d="M14 10V9a2 2 0 00-4 0v1"/><path d="M18 11v-1a2 2 0 00-4 0"/><path d="M18 11a2 2 0 014 0v3a8 8 0 01-8 8h-2c-2.8 0-4.5-.9-6-2.3l-3.6-3.6a2 2 0 012.8-2.8L7 15"/>',
  pencil: '<path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',
  cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12"/>',
  paste: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>',
  duplicate: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a1 1 0 011-1h11"/><path d="M14.5 11.5v6M11.5 14.5h6"/>',
  palette: '<circle cx="13.5" cy="6.5" r="1.2" fill="currentColor"/><circle cx="17.5" cy="10.5" r="1.2" fill="currentColor"/><circle cx="8.5" cy="7.5" r="1.2" fill="currentColor"/><circle cx="6.5" cy="12.5" r="1.2" fill="currentColor"/><path d="M12 2a10 10 0 000 20c.9 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.8-1.7 1.7-1.7h2a5.6 5.6 0 005.6-5.6C22 6 17.5 2 12 2z"/>',
  layout: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 8h16M4 13h16M4 18h16" opacity=".6"/>',
  focus: '<path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3"/>',
  fit: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  move: '<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  sort: '<path d="M3 6h13M3 12h9M3 18h5"/><path d="M18 9V21M15 18l3 3 3-3"/>',
  bold: '<path d="M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z"/>',
  heading: '<path d="M6 4v16M18 4v16M6 12h12"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>',
  checklist: '<rect x="3" y="4" width="6" height="6" rx="1.2"/><path d="M4.5 7l1 1 2-2"/><rect x="3" y="14" width="6" height="6" rx="1.2"/><path d="M13 7h8M13 17h8"/>',
  minus: '<path d="M5 12h14"/>',
  zoomIn: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/>',
  wand: '<path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8l1.4 1.4M15 9h0M17.8 6.2l1.4-1.4M3 21l9-9M12.2 6.2l-1.4-1.4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
  network: '<circle cx="12" cy="12" r="2.6"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M10.2 10.2L6.4 6.4M13.8 10.2l3.8-3.8M10.2 13.8l-3.8 3.8M13.8 13.8l3.8 3.8"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5z"/><path d="M4 20.5A2.5 2.5 0 016.5 18H20v3H6.5A2.5 2.5 0 014 20.5z"/>',
  canvas: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 15c2-4 4 1 6-2s3-4 4-3" /><path d="M3 9h2M19 15h2M9 3v2M15 19v2" opacity=".5"/>',
  pages: '<rect x="7" y="3" width="13" height="16" rx="2"/><path d="M4 7v12a2 2 0 002 2h10"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 017.5-2"/>',
  layerFront: '<rect x="8" y="8" width="12" height="12" rx="2" fill="currentColor" fill-opacity=".25"/><path d="M4 16V6a2 2 0 012-2h10"/>',
  layerBack: '<rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor" fill-opacity=".25"/><path d="M20 8v10a2 2 0 01-2 2H8"/>',
  dropper: '<path d="M19.5 4.5a2.1 2.1 0 00-3 0L13 8l-1-1-2 2 1 1-6.5 6.5V20h3.5L14.5 13.5l1 1 2-2-1-1 3-3a2.1 2.1 0 000-3z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
  logout: '<path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
  cloud: '<path d="M7 18a5 5 0 01-.5-9.97A6 6 0 0118 9a4.5 4.5 0 01-.5 9z"/>',
  cloudUp: '<path d="M7 18a5 5 0 01-.5-9.97A6 6 0 0118 9a4.5 4.5 0 01-.5 9"/><path d="M12 12v8M9 15l3-3 3 3"/>',
  cloudDown: '<path d="M7 18a5 5 0 01-.5-9.97A6 6 0 0118 9a4.5 4.5 0 01-.5 9"/><path d="M12 12v8M9 17l3 3 3-3"/>',
  chapter: '<path d="M6 3h11a2 2 0 012 2v16l-4-3-4 3V5" /><path d="M6 3a2 2 0 00-2 2v14" />',
  star2: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" fill="currentColor"/>',
  scribble: '<path d="M3 15c3-6 4 4 7-2s4 4 7-2 3 2 4 1"/>',
  cursor: '<path d="M5 3l14 7.5-6.2 1.7L10 18.5z"/>',
  wire: '<circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M7 19h5V5h5"/>',
  tag: '<path d="M3 12V5a2 2 0 012-2h7l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/>',
  flip: '<path d="M12 3v18" stroke-dasharray="2 2"/><path d="M9 6L4 18h5zM15 6l5 12h-5z"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.8"/>',
  circuit: '<path d="M3 12h4l2-5 3 10 2-5h7"/><circle cx="3" cy="12" r="1"/><circle cx="21" cy="12" r="1"/>',
  rotate: '<path d="M21 12a9 9 0 11-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

// Logo: handgeschriebenes „f.“ mit Farbverlauf auf dunklem Grund
let logoN = 0;
export function logoSvg(size = 40) {
  const n = ++logoN;
  return `<svg class="logo" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true">
<defs><linearGradient id="lb${n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#26263a"/><stop offset="1" stop-color="#0d0d14"/></linearGradient>
<linearGradient id="ls${n}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#5b8cff"/><stop offset=".55" stop-color="#8b5cf6"/><stop offset="1" stop-color="#ff6fb1"/></linearGradient></defs>
<rect width="512" height="512" rx="116" fill="url(#lb${n})"/>
<path d="M138 368C190 368 226 332 250 272C278 202 296 136 340 136C378 136 380 194 334 212C294 228 246 226 222 226L336 226" fill="none" stroke="url(#ls${n})" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="374" cy="362" r="20" fill="#fff"/></svg>`;
}

export const ICON_NAMES = Object.keys(P);
