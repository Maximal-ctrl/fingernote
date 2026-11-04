import { db, type Asset } from '../db/db';
import { sanitizeHtml } from './sanitize';

interface BackupFile {
  app: 'fingernote';
  version: 1;
  exportedAt: string;
  notebooks: unknown[];
  sections: unknown[];
  pages: unknown[];
  blocks: { html?: string }[];
  strokes: unknown[];
  assets: { id: string; mime: string; name?: string; data: string }[];
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

function base64ToBlob(data: string, mime: string): Blob {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function exportBackup(): Promise<Blob> {
  const assets = await db.assets.toArray();
  const file: BackupFile = {
    app: 'fingernote', version: 1, exportedAt: new Date().toISOString(),
    notebooks: await db.notebooks.toArray(),
    sections: await db.sections.toArray(),
    pages: await db.pages.toArray(),
    blocks: await db.blocks.toArray(),
    strokes: await db.strokes.toArray(),
    assets: await Promise.all(assets.map(async (a) => ({ id: a.id, mime: a.mime, name: a.name, data: await blobToBase64(a.blob) }))),
  };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

export async function importBackup(file: File): Promise<{ notebooks: number; pages: number }> {
  let data: BackupFile;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('Die Datei ist kein gültiges Fingernote-Backup.');
  }
  if (data?.app !== 'fingernote' || data.version !== 1 || !Array.isArray(data.notebooks)) {
    throw new Error('Die Datei ist kein gültiges Fingernote-Backup.');
  }
  const assets: Asset[] = (data.assets ?? []).map((a) => ({ id: a.id, mime: a.mime, name: a.name, blob: base64ToBlob(a.data, a.mime) }));
  const blocks = (data.blocks ?? []).map((b) => (typeof b.html === 'string' ? { ...b, html: sanitizeHtml(b.html) } : b));
  await db.transaction('rw', [db.notebooks, db.sections, db.pages, db.blocks, db.strokes, db.assets], async () => {
    await db.notebooks.bulkPut(data.notebooks as never[]);
    await db.sections.bulkPut((data.sections ?? []) as never[]);
    await db.pages.bulkPut((data.pages ?? []) as never[]);
    await db.blocks.bulkPut(blocks as never[]);
    await db.strokes.bulkPut((data.strokes ?? []) as never[]);
    await db.assets.bulkPut(assets);
  });
  return { notebooks: data.notebooks.length, pages: (data.pages ?? []).length };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
