import { test, expect, makePdf, count, newNotebook, draw, line } from './helpers';

test.describe('F04 PDF beschriften', () => {
  test('F04-H1 PDF importieren, Seiten erscheinen, markieren', async ({ page }) => {
    const pdf = await makePdf(page, 3);
    await page.goto('/');
    await page.getByRole('button', { name: 'PDF öffnen' }).click();
    await page.locator('input[type=file][accept*=pdf]').setInputFiles({ name: 'Skript.pdf', mimeType: 'application/pdf', buffer: pdf });
    await expect(page.getByRole('img', { name: 'PDF-Seite 1' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Skript · S\. 3/ })).toBeVisible();
    await page.keyboard.press('h');
    await draw(page, line(100, 200, 500, 200));
    expect(await count(page, 'strokes')).toBe(1);
    expect(await count(page, 'assets')).toBe(1);
  });

  test('F04-N1 kaputte Datei zeigt verständlichen Fehler', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'PDF öffnen' }).click();
    await page.locator('input[type=file][accept*=pdf]').setInputFiles({ name: 'kaputt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('kein pdf') });
    await expect(page.getByRole('alert')).toHaveText('Die Datei ließ sich nicht als PDF lesen.');
  });

  test('F04-H2 PDF in bestehendes Notizbuch als Abschnitt', async ({ page }) => {
    const pdf = await makePdf(page, 1);
    await newNotebook(page);
    await page.getByRole('button', { name: 'PDF', exact: true }).click();
    await page.locator('input[type=file][accept*=pdf]').setInputFiles({ name: 'Blatt.pdf', mimeType: 'application/pdf', buffer: pdf });
    await expect(page.getByRole('tab', { name: 'Blatt' })).toBeVisible({ timeout: 15000 });
  });
});
