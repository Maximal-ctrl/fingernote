import { test, expect, newNotebook, axe } from './helpers';

test.describe('Mobil 390px', () => {
  test('M-H1 Bibliothek und Editor auf dem Handy bedienbar @mobile @mobileonly', async ({ page }) => {
    await page.goto('/');
    await axe(page);
    await newNotebook(page, 'Handy');
    await expect(page.getByRole('navigation', { name: 'Abschnitte und Seiten' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Seitenleiste einblenden' }).click();
    await expect(page.getByRole('navigation', { name: 'Abschnitte und Seiten' })).toBeVisible();
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollW).toBeLessThanOrEqual(page.viewportSize()!.width);
  });

  test('M-H2 Seite per Lang-Drücken mit dem Finger umsortieren @mobile @mobileonly', async ({ page }) => {
    await newNotebook(page, 'Touch');
    await page.getByLabel('Seitentitel').first().fill('A');
    await page.getByRole('button', { name: 'Seitenleiste einblenden' }).click();
    await page.getByRole('button', { name: 'Seite', exact: true }).click();
    await expect(page.getByLabel('Seitentitel').first()).toHaveValue('');
    await page.getByLabel('Seitentitel').first().fill('B');
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Seitenleiste einblenden' }).click();
    const b = (await page.getByRole('button', { name: /^B\s?\d/ }).boundingBox())!;
    const a = (await page.getByRole('button', { name: /^A\s?\d/ }).boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const pt = (x: number, y: number) => [{ x, y, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(b.x + 20, b.y + b.height / 2) });
    await page.waitForTimeout(500);
    for (let i = 1; i <= 8; i++) {
      const y = b.y + b.height / 2 + ((a.y + 4 - (b.y + b.height / 2)) * i) / 8;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(b.x + 20, y) });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('.pages-col .page-name').first()).toHaveText('B');
  });
});
