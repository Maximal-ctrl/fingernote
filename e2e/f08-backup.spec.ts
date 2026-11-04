import { readFileSync } from 'node:fs';
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

  test('F08-H2 Notizbuch als Markdown exportieren (Text, Tags, Hinweis auf Handschrift)', async ({ page }) => {
    await newNotebook(page, 'Export');
    await page.getByLabel('Seitentitel').first().fill('Liste');
    const box = (await page.getByTestId('paper').boundingBox())!;
    await page.mouse.click(box.x + 120, box.y + 240);
    await page.keyboard.press('Control+1');
    await page.keyboard.type('Milch');
    await page.keyboard.press('Escape');
    await page.keyboard.press('p');
    await page.mouse.move(box.x + 100, box.y + 500);
    await page.mouse.down();
    await page.mouse.move(box.x + 300, box.y + 520, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    await page.goto('/');
    await page.getByRole('button', { name: 'Optionen für Export' }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Als Markdown exportieren' }).click()]);
    expect(download.suggestedFilename()).toBe('Export.md');
    const md = readFileSync(await download.path(), 'utf8');
    expect(md).toContain('# Export');
    expect(md).toContain('### Liste');
    expect(md).toContain('- [ ] Milch');
    expect(md).toContain('1 handschriftliche Strich');
  });

  test('F08-H3 Backup-Erinnerung erscheint und verschwindet nach dem Sichern', async ({ page }) => {
    await newNotebook(page, 'Erinnerung');
    await page.goto('/');
    await expect(page.getByText('Deine Notizen liegen nur in diesem Browser.')).toBeVisible();
    await page.getByRole('button', { name: 'Backup sichern' }).click();
    await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Backup exportieren' }).click()]);
    await page.keyboard.press('Escape');
    await expect(page.getByText('Deine Notizen liegen nur in diesem Browser.')).toHaveCount(0);
  });
});
