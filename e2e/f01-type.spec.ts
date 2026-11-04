import { test, expect, newNotebook, typeAt, count, axe } from './helpers';

test.describe('F01 Erste Notiz tippen', () => {
  test('F01-H1 Notizbuch anlegen, tippen, neu laden, Text ist da', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Noch keine Notizbücher' })).toBeVisible();
    await axe(page);
    await newNotebook(page, 'Studium');
    await page.getByLabel('Seitentitel').first().fill('Vorlesung 1');
    await typeAt(page, 120, 240, 'Hallo Welt mit Ümlauten ÄÖÜß und Emoji 🙂');
    expect(await count(page, 'blocks')).toBe(1);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Notiztext' })).toHaveText(/Ümlauten ÄÖÜß und Emoji 🙂/);
    await expect(page.getByLabel('Seitentitel').first()).toHaveValue('Vorlesung 1');
    await expect(page.getByRole('button', { name: /Vorlesung 1/ })).toBeVisible();
    await axe(page);
  });

  test('F01-E1 leerer Name zeigt Fehler', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Notizbuch anlegen' }).click();
    await page.getByRole('button', { name: 'Erstellen' }).click();
    await expect(page.getByRole('alert')).toHaveText('Gib dem Notizbuch einen Namen.');
  });

  test('F01-E2 leeres Textfeld verschwindet beim Verlassen', async ({ page }) => {
    await newNotebook(page);
    const box = (await page.getByTestId('paper').boundingBox())!;
    await page.mouse.click(box.x + 200, box.y + 300);
    await page.keyboard.press('Escape');
    expect(await count(page, 'blocks')).toBe(0);
  });

  test('F01-E3 sehr langer Name wird gekürzt angezeigt, nicht abgeschnitten gespeichert', async ({ page }) => {
    const long = 'Ein sehr langer Notizbuchname mit mehr als sechzig Zeichen zum Testen';
    await newNotebook(page, long);
    await page.goto('/');
    await expect(page.getByRole('button', { name: `${long} öffnen` })).toBeVisible();
  });

  test('F01-E4 Text formatieren: fett per Toolbar', async ({ page }) => {
    await newNotebook(page);
    const box = (await page.getByTestId('paper').boundingBox())!;
    await page.mouse.click(box.x + 120, box.y + 240);
    await page.keyboard.type('fett');
    await page.keyboard.press('Shift+Home');
    await page.getByRole('button', { name: 'Fett' }).click();
    await expect(page.getByRole('textbox', { name: 'Notiztext' }).locator('b, strong')).toHaveText('fett');
  });

  test('F01-E5 Rückgängig entfernt gelöschtes Textfeld nicht dauerhaft', async ({ page }) => {
    await newNotebook(page);
    await typeAt(page, 120, 240, 'bleibt');
    await page.getByRole('textbox', { name: 'Notiztext' }).hover();
    await page.getByRole('button', { name: 'Textfeld löschen' }).click();
    expect(await count(page, 'blocks')).toBe(0);
    await page.keyboard.press('Control+z');
    await expect(page.getByRole('textbox', { name: 'Notiztext' })).toHaveText('bleibt');
    expect(await count(page, 'blocks')).toBe(1);
  });

  test('F01-E6 sofort neu laden nach dem Tippen verliert nichts', async ({ page }) => {
    await newNotebook(page);
    const box = (await page.getByTestId('paper').boundingBox())!;
    await page.mouse.click(box.x + 120, box.y + 240);
    await page.keyboard.type('gerade eben getippt');
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Notiztext' })).toHaveText('gerade eben getippt');
  });
});
