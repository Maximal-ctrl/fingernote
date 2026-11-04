import { test, expect, newNotebook, draw, line, count } from './helpers';

test.describe('F02 Handschrift', () => {
  test('F02-H1 Stift, Marker, Form zeichnen und nach Reload noch da', async ({ page }) => {
    await newNotebook(page);
    await page.getByRole('button', { name: 'Stift' }).click();
    await draw(page, line(100, 400, 400, 450));
    await page.getByRole('button', { name: 'Marker', exact: true }).click();
    await draw(page, line(100, 500, 400, 500));
    await page.getByRole('button', { name: 'Formen' }).click();
    await page.getByRole('button', { name: 'Ellipse' }).click();
    await draw(page, line(500, 400, 650, 500, 4));
    expect(await count(page, 'strokes')).toBe(3);
    await page.reload();
    expect(await count(page, 'strokes')).toBe(3);
  });

  test('F02-H2 Radierer löscht Strich, Rückgängig holt ihn zurück, Wiederholen löscht wieder', async ({ page }) => {
    await newNotebook(page);
    await page.keyboard.press('p');
    await draw(page, line(100, 400, 400, 400));
    await page.keyboard.press('e');
    await draw(page, line(250, 360, 250, 440));
    expect(await count(page, 'strokes')).toBe(0);
    await page.keyboard.press('Control+z');
    expect(await count(page, 'strokes')).toBe(1);
    await page.keyboard.press('Control+y');
    expect(await count(page, 'strokes')).toBe(0);
  });

  test('F02-E1 Radierer "nur Marker" lässt Stiftstriche stehen', async ({ page }) => {
    await newNotebook(page);
    await page.keyboard.press('p');
    await draw(page, line(100, 400, 400, 400));
    await page.keyboard.press('h');
    await draw(page, line(100, 420, 400, 420));
    await page.keyboard.press('e');
    await page.getByLabel('nur Marker').check();
    await draw(page, line(250, 380, 250, 440));
    expect(await count(page, 'strokes')).toBe(1);
  });

  test('F02-E2 Punkt (Klick ohne Bewegung) wird gespeichert', async ({ page }) => {
    await newNotebook(page);
    await page.keyboard.press('p');
    await draw(page, [[300, 300]]);
    expect(await count(page, 'strokes')).toBe(1);
  });

  test('F02-E3 Zoom per Tastatur ändert Anzeige, Zeichnen trifft trotzdem', async ({ page }) => {
    await newNotebook(page);
    const label = page.getByRole('button', { name: /%$/ });
    const before = await label.textContent();
    await page.keyboard.press('Control+=');
    await expect(label).not.toHaveText(before!);
    await page.keyboard.press('p');
    await draw(page, line(200, 300, 300, 300));
    await page.keyboard.press('e');
    await draw(page, line(250, 260, 250, 340));
    expect(await count(page, 'strokes')).toBe(0);
  });
});
