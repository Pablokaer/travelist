import { expect, test } from '@playwright/test';

test('app shell loads on web and switches language', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Where to next?' })).toBeVisible();

  await page.getByRole('tab', { name: 'Profile' }).click();
  await expect(page).toHaveURL(/\/profile$/);

  await page.getByRole('radio', { name: 'Português' }).click();
  await expect(page.getByRole('heading', { name: 'Perfil' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Explorar' })).toBeVisible();
});

test('about screen shows data attribution', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByText(/OpenStreetMap contributors/)).toBeVisible();
});
