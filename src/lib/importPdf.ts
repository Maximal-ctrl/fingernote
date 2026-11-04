import { db, PAGE_W, type Page, type Block } from '../db/db';
import { addAsset, createNotebook, createSection } from '../db/repo';
import { openPdfBytes } from './pdf';
import { uid } from './ids';

export class PdfImportError extends Error {}

/**
 * Legt pro PDF-Seite eine Fingernote-Seite an, mit der PDF-Seite als fester Hintergrund.
 * Ziel: neues Notizbuch (aus der Bibliothek) oder neuer Abschnitt im offenen Notizbuch.
 */
export async function importPdf(
  file: File,
  target: { notebookId?: string },
  onProgress: (done: number, total: number) => void,
): Promise<{ notebookId: string; pageId: string; pages: number }> {
  if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new PdfImportError('Das ist keine PDF-Datei.');
  }
  if (file.size > 300 * 1024 * 1024) throw new PdfImportError('Die PDF ist größer als 300 MB.');
  const bytes = await file.arrayBuffer();
  let doc;
  try {
    doc = await openPdfBytes(bytes.slice(0));
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === 'PasswordException') throw new PdfImportError('Diese PDF ist passwortgeschützt. Bitte erst ohne Passwort speichern.');
    throw new PdfImportError('Die Datei ließ sich nicht als PDF lesen.');
  }
  const total = doc.numPages;
  const name = file.name.replace(/\.pdf$/i, '') || 'PDF';
  const paper = { type: 'blank' as const, color: 'white' as const };

  let notebookId: string;
  let sectionId: string;
  let firstPage: Page;
  if (target.notebookId) {
    const r = await createSection(target.notebookId, name.slice(0, 60));
    notebookId = target.notebookId;
    sectionId = r.section.id;
    firstPage = r.page;
  } else {
    const r = await createNotebook(name.slice(0, 80), '#4a5361', paper);
    notebookId = r.notebook.id;
    firstPage = r.page;
    sectionId = r.page.sectionId;
    await db.sections.update(sectionId, { title: 'PDF' });
  }
  await db.pages.update(firstPage.id, { paper });

  const assetId = await addAsset(new Blob([bytes], { type: 'application/pdf' }), file.name);
  const pages: Page[] = [];
  const blocks: Block[] = [];
  const t = Date.now();
  for (let i = 1; i <= total; i++) {
    const p = await doc.getPage(i);
    const vp = p.getViewport({ scale: 1 });
    const h = Math.round((PAGE_W * vp.height) / vp.width);
    const page: Page = i === 1
      ? { ...firstPage, title: `${name} · S. 1`, paper }
      : { ...firstPage, id: uid(), title: `${name} · S. ${i}`, sortOrder: i, createdAt: t + i, updatedAt: t + i };
    pages.push(page);
    blocks.push({ id: uid(), pageId: page.id, kind: 'pdf', x: 0, y: 0, w: PAGE_W, h, assetId, pdfPage: i });
    onProgress(i, total);
  }
  await db.transaction('rw', db.pages, db.blocks, async () => {
    await db.pages.bulkPut(pages);
    await db.blocks.bulkAdd(blocks);
  });
  void doc.loadingTask?.destroy();
  return { notebookId, pageId: firstPage.id, pages: total };
}
