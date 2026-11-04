import { test, expect, newNotebook, axe } from './helpers';

test.describe('F07 Tags', () => {
  test('F07-H1 To-Do taggen, in Übersicht abhaken, Seite zeigt es', async ({ page }) => {
    await newNotebook(page);
    const box = (await page.getByTestId('paper').boundingBox())!;
    await page.mouse.click(box.x + 120, box.y + 240);
    await page.keyboard.press('Control+1');
    await page.keyboard.type('Milch kaufen');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Brot kaufen');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Tags' }).click();
    await expect(page.getByRole('checkbox', { name: /kaufen erledigt/ })).toHaveCount(2);
    await axe(page);
    await page.getByRole('checkbox', { name: 'Milch kaufen erledigt' }).check();
    await expect(page.getByRole('checkbox', { name: /kaufen erledigt/ })).toHaveCount(2);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Tags' }).click();
    await expect(page.getByRole('checkbox', { name: /kaufen erledigt/ })).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-tag=todo][data-done="1"]')).toHaveText('Milch kaufen');
  });

  test('F07-E1 Enter in leerer To-Do-Zeile beendet die Liste', async ({ page }) => {
    await newNotebook(page);
    const box = (await page.getByTestId('paper').boundingBox())!;
    await page.mouse.click(box.x + 120, box.y + 240);
    await page.keyboard.press('Control+1');
    await page.keyboard.type('Eins');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('normal');
    await expect(page.locator('[data-tag=todo]')).toHaveCount(1);
  });
});
