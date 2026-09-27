import { expect, test } from '@playwright/test';

// Runs without a backend: only screens that don't need data.
test('signed-out users land on sign-in and can switch language', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Português' }).click();
  await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible();
});

test('about screen shows data attribution', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByText(/OpenStreetMap contributors/)).toBeVisible();
  await expect(page.getByText(/Open-Meteo/)).toBeVisible();
});
