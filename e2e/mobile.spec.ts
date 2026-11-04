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
});
