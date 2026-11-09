// PDF-Import (über pdf.js, liegt in lib/) und PDF-Export (eigener, schlanker PDF-Schreiber).
import { renderPageToCanvas, ensureImages } from './ink.js';
import { putBlob } from './store.js';
import { canvasToBlob } from './util.js';

let pdfjsPromise = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfjsPromise) {
    pdfjsPromise = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'lib/pdf.min.js';
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
        res(window.pdfjsLib);
      };
      s.onerror = () => { pdfjsPromise = null; rej(new Error('Das PDF-Modul konnte nicht geladen werden.')); };
      document.head.append(s);
    });
  }
  return pdfjsPromise;
}

/** PDF-Datei in Seiten mit Hintergrundbild umwandeln. */
export async function importPdfPages(file, onProgress) {
  const lib = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await lib.getDocument({ data, isEvalSupported: false }).promise;
  const out = [];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      if (onProgress) onProgress((i - 1) / doc.numPages, `Seite ${i} von ${doc.numPages}`);
      const page = await doc.getPage(i);
      const vp1 = page.getViewport({ scale: 1 });
      // ca. 2 Bildpunkte pro Seiten-Einheit, aber höchstens 9 Megapixel
      const unitsW = vp1.width > vp1.height ? 1414 : 1000;
      let scale = (unitsW * 2) / vp1.width;
      scale = Math.min(scale, Math.sqrt(9e6 / (vp1.width * vp1.height)));
      const vp = page.getViewport({ scale });
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.88);
      const id = await putBlob(blob);
      const landscape = vp1.width > vp1.height;
      const w = landscape ? 1414 : 1000;
      out.push({ w, h: Math.round((w * vp1.height) / vp1.width), bg: id });
      page.cleanup();
    }
  } finally {
    canvas.width = canvas.height = 0;
    doc.destroy();
  }
  if (onProgress) onProgress(1, 'Fertig');
  return out;
}

// ---------------------------------------------------------------- PDF-Export
const enc = new TextEncoder();

function pdfHexString(str) {
  let hex = 'FEFF';
  for (const ch of str) {
    const code = ch.codePointAt(0);
    if (code > 0xffff) {
      const c = code - 0x10000;
      hex += (0xd800 + (c >> 10)).toString(16).padStart(4, '0') + (0xdc00 + (c & 0x3ff)).toString(16).padStart(4, '0');
    } else hex += code.toString(16).padStart(4, '0');
  }
  return `<${hex.toUpperCase()}>`;
}

/** imgs: [{bytes: Uint8Array (JPEG), pxW, pxH, ptW, ptH}] */
function buildPdf(imgs, title) {
  const chunks = [];
  let offset = 0;
  const offsets = [];
  const w = (s) => { const b = typeof s === 'string' ? enc.encode(s) : s; chunks.push(b); offset += b.length; };
  const obj = (n, parts) => { offsets[n] = offset; w(`${n} 0 obj\n`); for (const p of parts) w(p); w('\nendobj\n'); };

  w('%PDF-1.4\n');
  w(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  const n = imgs.length;
  const pageObj = (i) => 4 + i * 3;
  obj(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  obj(2, [`<< /Type /Pages /Count ${n} /Kids [${imgs.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] >>`]);
  obj(3, [`<< /Producer (FingerNote) /Title ${pdfHexString(title || 'FingerNote')} /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}) >>`]);
  imgs.forEach((im, i) => {
    const po = pageObj(i), co = po + 1, io = po + 2;
    const W = im.ptW.toFixed(2), H = im.ptH.toFixed(2);
    obj(po, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${io} 0 R >> >> /Contents ${co} 0 R >>`]);
    const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(co, [`<< /Length ${content.length} >>\nstream\n`, content, '\nendstream']);
    obj(io, [`<< /Type /XObject /Subtype /Image /Width ${im.pxW} /Height ${im.pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`, im.bytes, '\nendstream']);
  });
  const total = 3 + n * 3;
  const xref = offset;
  w(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= total; i++) w(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  w(`trailer\n<< /Size ${total + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: 'application/pdf' });
}

export async function exportPdf(title, pages, { hideTape = false } = {}, onProgress) {
  const imgs = [];
  const canvas = document.createElement('canvas');
  try {
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (onProgress) onProgress(i / pages.length, `Seite ${i + 1} von ${pages.length}`);
      await ensureImages(p);
      let K = 1654 / 1000; // ~200 dpi bei A4
      K = Math.min(K, Math.sqrt(14e6 / (p.w * p.h)));
      renderPageToCanvas(canvas, p, K, { hideTape });
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
      imgs.push({ bytes: new Uint8Array(await blob.arrayBuffer()), pxW: canvas.width, pxH: canvas.height, ptW: p.w * 0.59528, ptH: p.h * 0.59528 });
    }
  } finally {
    canvas.width = canvas.height = 0;
  }
  if (onProgress) onProgress(1, 'PDF wird erstellt …');
  return buildPdf(imgs, title);
}

export async function exportPageImage(page, { hideTape = false } = {}) {
  await ensureImages(page);
  const canvas = document.createElement('canvas');
  const K = Math.min(2, Math.sqrt(14e6 / (page.w * page.h)));
  renderPageToCanvas(canvas, page, K, { hideTape });
  const blob = await canvasToBlob(canvas, 'image/png');
  canvas.width = canvas.height = 0;
  return blob;
}
