import { db, type Block, type Stroke } from './db';
import { createNotebook, createPage } from './repo';
import { uid } from '../lib/ids';

/** Beispiel-Notizbuch mit erfundenem Inhalt, damit man die App sofort ausprobieren kann. */
export async function seedExample() {
  const { notebook, page } = await createNotebook('Willkommen bei Fingernote', '#2f6f5e', { type: 'lined', color: 'white' });
  await db.pages.update(page.id, { title: 'So funktioniert’s' });
  const blocks: Block[] = [
    {
      id: uid(), pageId: page.id, kind: 'text', x: 48, y: 140, w: 560,
      html: '<h2>Tippen, wo du willst</h2><p>Klick irgendwo auf das Papier und schreib los. Jedes Textfeld lässt sich an der Leiste oben verschieben und rechts in der Breite ziehen.</p>',
    },
    {
      id: uid(), pageId: page.id, kind: 'text', x: 48, y: 330, w: 440,
      html: '<p data-tag="todo" data-done="1">Ein Notizbuch anlegen</p><p data-tag="todo">Mit dem Stift (P) etwas skizzieren</p><p data-tag="todo">Eine PDF importieren und markieren</p><p data-tag="important">Strg 1 bis 4 setzen Tags</p><p data-tag="idea">Alle Tags findest du oben rechts</p>',
    },
    {
      id: uid(), pageId: page.id, kind: 'text', x: 560, y: 560, w: 360,
      html: '<p>Zwei Finger: zoomen und verschieben. Lasso (L): umkreisen, ziehen, umfärben.</p>',
    },
  ];
  const wave: number[] = [];
  for (let i = 0; i <= 60; i++) wave.push(560 + i * 6, 470 + Math.sin(i / 6) * 22, 0.5);
  const strokes: Stroke[] = [
    { id: uid(), pageId: page.id, tool: 'pen', color: '#3b5bdb', width: 3, points: wave },
    { id: uid(), pageId: page.id, tool: 'highlighter', color: '#ffe066', width: 18, points: [52, 175, 0.5, 300, 175, 0.5] },
    { id: uid(), pageId: page.id, tool: 'shape', shape: 'arrow', color: '#c92a2a', width: 3, points: [700, 640, 0.5, 620, 520, 0.5] },
  ];
  await db.transaction('rw', db.blocks, db.strokes, async () => {
    await db.blocks.bulkAdd(blocks);
    await db.strokes.bulkAdd(strokes);
  });
  const p2 = await createPage(page.sectionId, { paper: { type: 'grid', color: 'cream' } });
  await db.pages.update(p2.id, { title: 'Kariertes Papier' });
  const sub = await createPage(page.sectionId, { afterId: p2.id, level: 1, paper: { type: 'dotted', color: 'white' } });
  await db.pages.update(sub.id, { title: 'Unterseite mit Punkten' });
  return { notebookId: notebook.id, pageId: page.id };
}
