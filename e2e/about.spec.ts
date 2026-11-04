import { test, expect, axe } from './helpers';

test('L-H1 Landingpage: Hero, Fixes, FAQ, Weg in die App, barrierefrei @mobile', async ({ page }) => {
  await page.goto('/#/about');
  await expect(page.getByRole('heading', { level: 1, name: 'Notizen mit Stift und Tastatur. Nur auf deinem Gerät.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Du kommst jederzeit raus' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Fingernote: eine Seite/ })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: 'Jetzt loslegen' }).click();
  await expect(page.getByRole('heading', { name: 'Bibliothek' })).toBeVisible();
});
