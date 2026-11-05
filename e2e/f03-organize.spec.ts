import { test, expect, newNotebook, count } from './helpers';

test.describe('F03 Organisieren', () => {
  test('F03-H1 Abschnitt und Seiten anlegen, Unterseite, verschieben', async ({ page }) => {
    await newNotebook(page);
    await page.getByRole('button', { name: 'Abschnitt', exact: true }).click();
    await expect(page.getByLabel('Abschnittsname')).toBeFocused();
    await page.keyboard.type('Mathe');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'Mathe' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Seite', exact: true }).click();
    await expect(page.locator('.pages-col .page-item')).toHaveCount(2);
    await expect(page.locator('.pages-col .page-item').nth(1)).toHaveAttribute('aria-current', 'page');
    await page.getByLabel('Seitentitel').first().fill('Analysis');
    await page.getByRole('button', { name: /^Analysis/ }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Einrücken (Unterseite)' }).click();
    await expect(page.getByRole('button', { name: /^Analysis/ })).toHaveClass(/level-1/);
    await page.getByRole('button', { name: /^Analysis/ }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Verschieben nach „Notizen“' }).click();
    await page.getByRole('tab', { name: 'Notizen' }).click();
    await expect(page.getByRole('button', { name: /^Analysis/ })).toBeVisible();
    expect(await count(page, 'sections')).toBe(2);
  });

  test('F03-H2 Seiten umsortieren per Menü', async ({ page }) => {
    await newNotebook(page);
    await page.getByLabel('Seitentitel').first().fill('Erste');
    await page.getByRole('button', { name: 'Seite', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Unbenannte Seite/ })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByLabel('Seitentitel').first()).toHaveValue('');
    await page.getByLabel('Seitentitel').first().fill('Zweite');
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /^Zweite/ }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Nach oben' }).click();
    await expect(page.locator('.pages-col .page-name').first()).toHaveText('Zweite');
  });

  test('F03-H3 Umbenennen per Doppelklick und Coverfarbe', async ({ page }) => {
    await newNotebook(page, 'Alt');
    await page.getByRole('tab', { name: 'Notizen' }).dblclick();
    await page.getByLabel('Abschnittsname').fill('Neu');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'Neu' })).toBeVisible();
    await page.goto('/');
    await page.getByRole('button', { name: 'Optionen für Alt' }).click();
    await page.getByRole('menuitem', { name: 'Umbenennen' }).click();
    await page.getByLabel('Notizbuchname').fill('Umbenannt');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Umbenannt öffnen' })).toBeVisible();
  });

  test('F03-E1 Notizbuch löschen fragt nach und löscht alles', async ({ page }) => {
    await newNotebook(page, 'Weg');
    await page.goto('/');
    await page.getByRole('button', { name: 'Optionen für Weg' }).click();
    await page.getByRole('menuitem', { name: 'Löschen …' }).click();
    await page.getByRole('button', { name: 'Endgültig löschen' }).click();
    await expect(page.getByRole('heading', { name: 'Noch keine Notizbücher' })).toBeVisible();
    expect(await count(page, 'pages')).toBe(0);
  });

  test('F03-E2 Favorit erscheint oben @mobile', async ({ page }) => {
    await newNotebook(page, 'Lieblings');
    await page.goto('/');
    await page.getByRole('button', { name: 'Optionen für Lieblings' }).click();
    await page.getByRole('menuitem', { name: 'Zu Favoriten' }).click();
    await expect(page.getByRole('heading', { name: 'Favoriten' })).toBeVisible();
  });

  test('F03-E3 Seite per Maus-Drag umsortieren und auf anderen Abschnitt ziehen', async ({ page }) => {
    await newNotebook(page);
    await page.getByLabel('Seitentitel').first().fill('A');
    await page.getByRole('button', { name: 'Seite', exact: true }).click();
    await expect(page.getByLabel('Seitentitel').first()).toHaveValue('');
    await page.getByLabel('Seitentitel').first().fill('B');
    await page.waitForTimeout(400);
    const b = (await page.getByRole('button', { name: /^B\s?\d/ }).boundingBox())!;
    const a = (await page.getByRole('button', { name: /^A\s?\d/ }).boundingBox())!;
    await page.mouse.move(b.x + 20, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + 20, a.y + 4, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('.pages-col .page-name').first()).toHaveText('B');
    // auf neuen Abschnitt ziehen
    await page.getByRole('button', { name: 'Abschnitt', exact: true }).click();
    await expect(page.getByLabel('Abschnittsname')).toBeFocused();
    await page.keyboard.press('Enter');
    await page.getByRole('tab', { name: 'Notizen' }).click();
    const src = (await page.getByRole('button', { name: /^A\s?\d/ }).boundingBox())!;
    const tab = (await page.getByRole('tab', { name: 'Abschnitt 2' }).boundingBox())!;
    await page.mouse.move(src.x + 20, src.y + src.height / 2);
    await page.mouse.down();
    await page.mouse.move(tab.x + 30, tab.y + tab.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByRole('button', { name: /^A\s?\d/ })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Abschnitt 2' }).click();
    await expect(page.getByRole('button', { name: /^A\s?\d/ })).toBeVisible();
  });
});
