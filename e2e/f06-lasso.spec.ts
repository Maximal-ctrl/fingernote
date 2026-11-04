import { test, expect, newNotebook, draw, line, count } from './helpers';

const loop: [number, number][] = [[80, 360], [450, 360], [450, 470], [80, 470], [80, 362]];

test.describe('F06 Lasso', () => {
  test('F06-H1 umkreisen, verschieben, duplizieren, löschen', async ({ page }) => {
    await newNotebook(page);
    await page.keyboard.press('p');
    await draw(page, line(100, 400, 400, 420));
    await draw(page, line(600, 700, 700, 700));
    await page.keyboard.press('l');
    await draw(page, loop);
    const sel = page.locator('.sel-box');
    await expect(sel).toBeVisible();
    const b = (await sel.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 100, b.y + b.height / 2 + 100, { steps: 5 });
    await page.mouse.up();
    await page.getByRole('button', { name: 'Duplizieren' }).click();
    expect(await count(page, 'strokes')).toBe(3);
    await page.keyboard.press('Delete');
    expect(await count(page, 'strokes')).toBe(2);
  });

  test('F06-E1 leeres Lasso wählt nichts', async ({ page }) => {
    await newNotebook(page);
    await page.keyboard.press('l');
    await draw(page, loop);
    await expect(page.locator('.sel-box')).toHaveCount(0);
  });

  test('F06-E2 umfärben', async ({ page }) => {
    await newNotebook(page);
    await page.keyboard.press('p');
    await draw(page, line(100, 400, 400, 420));
    await page.keyboard.press('l');
    await draw(page, loop);
    await page.getByRole('button', { name: 'Auswahl Rot färben' }).click();
    await page.waitForTimeout(700);
    const color = await page.evaluate(() => new Promise<string>((res) => {
      const r = indexedDB.open('fingernote');
      r.onsuccess = () => { const q = r.result.transaction('strokes').objectStore('strokes').getAll(); q.onsuccess = () => res(q.result[0].color); };
    }));
    expect(color).toBe('#c92a2a');
  });
});
