import { test, expect, newNotebook, typeAt, count } from './helpers';

test.describe('F08 Backup', () => {
  test('F08-H1 exportieren, alles löschen, importieren', async ({ page }) => {
    await newNotebook(page, 'Sicherung');
    await typeAt(page, 120, 240, 'wichtiger Text');
    await page.getByRole('button', { name: 'Einstellungen' }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Backup exportieren' }).click()]);
    const file = await download.path();
    await page.keyboard.press('Escape');
    await page.goto('/');
    await page.getByRole('button', { name: 'Optionen für Sicherung' }).click();
    await page.getByRole('menuitem', { name: 'Löschen …' }).click();
    await page.getByRole('button', { name: 'Endgültig löschen' }).click();
    expect(await count(page, 'blocks')).toBe(0);
    await page.getByRole('button', { name: 'Einstellungen' }).click();
    await page.locator('input[type=file][accept*=json]').setInputFiles(file!);
    await expect(page.getByText('1 Notizbücher mit 1 Seiten importiert.')).toBeVisible();
    expect(await count(page, 'blocks')).toBe(1);
  });

  test('F08-N1 falsche Datei wird abgelehnt', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Einstellungen' }).click();
    await page.locator('input[type=file][accept*=json]').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"foo":1}') });
    await expect(page.getByText('Die Datei ist kein gültiges Fingernote-Backup.')).toBeVisible();
  });
});
