// Legacy-Build: enthält Polyfills für Safari/iPad (der normale Build nutzt brandneue JS-Funktionen).
// Dieses Modul wird nur dynamisch geladen, wenn eine PDF gebraucht wird.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { db } from '../db/db';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

type PdfDoc = Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;
const docs = new Map<string, Promise<PdfDoc>>();

export async function openPdfBytes(data: ArrayBuffer) {
  return pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
}

export function pdfForAsset(assetId: string): Promise<PdfDoc> {
  let p = docs.get(assetId);
  if (!p) {
    p = (async () => {
      const asset = await db.assets.get(assetId);
      if (!asset) throw new Error('PDF nicht gefunden');
      return openPdfBytes(await asset.blob.arrayBuffer());
    })();
    docs.set(assetId, p);
    p.catch(() => docs.delete(assetId));
  }
  return p;
}

const renders = new Map<string, Promise<string>>();

/** Rendert eine PDF-Seite als Bild-URL in der gewünschten Pixelbreite (gecacht, gerundet). */
export function renderPdfPage(assetId: string, pageNo: number, pixelWidth: number): Promise<string> {
  const bucket = Math.min(3200, Math.max(400, Math.ceil(pixelWidth / 400) * 400));
  const key = `${assetId}:${pageNo}:${bucket}`;
  let p = renders.get(key);
  if (!p) {
    p = (async () => {
      const doc = await pdfForAsset(assetId);
      const page = await doc.getPage(pageNo);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: bucket / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport } as Parameters<typeof page.render>[0]).promise;
      const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('render'))), 'image/png'));
      return URL.createObjectURL(blob);
    })();
    renders.set(key, p);
    p.catch(() => renders.delete(key));
  }
  return p;
}
