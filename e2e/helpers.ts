import { test as base, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Jeder Test schlägt fehl bei Konsolenfehlern, Seitenfehlern und 5xx. */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('response', (r) => r.status() >= 500 && errors.push(`${r.status()} ${r.url()}`));
      await use(errors);
      expect(errors, 'keine Konsolenfehler').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export async function newNotebook(page: Page, name = 'Testbuch') {
  await page.goto('/');
  await page.getByRole('button', { name: /Neues Notizbuch|Notizbuch anlegen/ }).first().click();
  await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Erstellen' }).click();
  await expect(page.getByLabel('Seitentitel').first()).toBeVisible();
}

export async function typeAt(page: Page, x: number, y: number, text: string) {
  const box = (await page.getByTestId('paper').boundingBox())!;
  await page.mouse.click(box.x + x, box.y + y);
  await page.keyboard.type(text);
  await page.keyboard.press('Escape');
}

export async function draw(page: Page, pts: [number, number][]) {
  const layer = page.getByLabel('Zeichenfläche');
  const box = (await layer.boundingBox())!;
  await page.mouse.move(box.x + pts[0][0], box.y + pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(box.x + x, box.y + y, { steps: 3 });
  await page.mouse.up();
}

export const line = (x0: number, y0: number, x1: number, y1: number, n = 12): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);

/** Zählt Datensätze direkt in IndexedDB (nach dem automatischen Speichern). */
export async function count(page: Page, store: string): Promise<number> {
  await page.waitForTimeout(700);
  return page.evaluate(
    (s) =>
      new Promise<number>((res, rej) => {
        const req = indexedDB.open('fingernote');
        req.onsuccess = () => {
          const tx = req.result.transaction(s, 'readonly');
          const c = tx.objectStore(s).count();
          c.onsuccess = () => { res(c.result); req.result.close(); };
          c.onerror = () => rej(c.error);
        };
        req.onerror = () => rej(req.error);
      }),
    store,
  );
}

export async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).disableRules(['region']).analyze();
  const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.length}× ${v.nodes[0]?.target}`)).toEqual([]);
}

export async function makePdf(page: Page, pages = 2): Promise<Buffer> {
  const p = await page.context().newPage();
  await p.setContent(Array.from({ length: pages }, (_, i) => `<h1 style="page-break-after:always">Testseite ${i + 1}</h1>`).join(''));
  const buf = await p.pdf({ format: 'A4' });
  await p.close();
  return buf;
}
