import { test, expect, newNotebook, typeAt, axe } from './helpers';

test.describe('F05 Suchen', () => {
  test('F05-H1 Treffer finden und öffnen, Groß/klein egal', async ({ page }) => {
    await newNotebook(page);
    await page.getByLabel('Seitentitel').first().fill('Rezepte');
    await typeAt(page, 120, 240, 'Käsespätzle mit Röstzwiebeln');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Bibliothek' })).toBeVisible();
    await page.keyboard.press('Control+f');
    await page.getByLabel('Suchbegriff').fill('KÄSE');
    await expect(page.getByRole('option')).toHaveCount(1);
    await axe(page);
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Seitentitel').first()).toHaveValue('Rezepte');
    await expect(page).toHaveURL(/q=K%C3%84SE/);
  });

  test('F05-E1 keine Treffer', async ({ page }) => {
    await newNotebook(page);
    await page.keyboard.press('Control+f');
    await page.getByLabel('Suchbegriff').fill('gibtsnicht');
    await expect(page.getByText('Nichts gefunden für „gibtsnicht“.')).toBeVisible();
  });

  test('F05-E2 Seite im Papierkorb wird nicht gefunden', async ({ page }) => {
    await newNotebook(page);
    await typeAt(page, 120, 240, 'geheimwort');
    await page.getByRole('button', { name: 'Mehr' }).click();
    await page.getByRole('button', { name: 'Seite in den Papierkorb' }).click();
    await page.keyboard.press('Control+f');
    await page.getByLabel('Suchbegriff').fill('geheimwort');
    await expect(page.getByText(/Nichts gefunden/)).toBeVisible();
  });
});
