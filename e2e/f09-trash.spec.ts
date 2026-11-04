import { test, expect, newNotebook, count } from './helpers';

test.describe('F09 Löschen & Wiederherstellen', () => {
  test('F09-H1 Seite löschen, im Papierkorb wiederherstellen', async ({ page }) => {
    await newNotebook(page);
    await page.getByLabel('Seitentitel').first().fill('Wichtig');
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /^Wichtig/ }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'In den Papierkorb' }).click();
    await expect(page.getByRole('heading', { name: 'Dieser Abschnitt ist leer' })).toBeVisible();
    await page.getByRole('button', { name: 'Papierkorb' }).click();
    await page.getByRole('button', { name: 'Wiederherstellen' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /^Wichtig/ })).toBeVisible();
  });

  test('F09-H2 Abschnitt in den Papierkorb, Papierkorb leeren', async ({ page }) => {
    await newNotebook(page);
    await page.getByRole('tab', { name: 'Notizen' }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'In den Papierkorb …' }).click();
    await page.getByRole('button', { name: 'In den Papierkorb', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Keine Abschnitte' })).toBeVisible();
    await page.getByRole('button', { name: 'Papierkorb', exact: true }).click();
    await page.getByRole('button', { name: 'Papierkorb leeren' }).click();
    await page.getByRole('dialog', { name: 'Papierkorb leeren?' }).getByRole('button', { name: 'Endgültig löschen' }).click();
    expect(await count(page, 'pages')).toBe(0);
  });
});
