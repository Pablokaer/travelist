// Shared steps of the backend E2E specs (journey, sharing).
import { expect } from '@playwright/test';

export type Page = import('@playwright/test').Page;

export const byTestIdOn = (page: Page) => (id: string) =>
  page.getByTestId(id).filter({ visible: true });
export const roleOn =
  (page: Page) => (r: Parameters<Page['getByRole']>[0], name: string | RegExp) =>
    page.getByRole(r, { name }).filter({ visible: true });

/** Signs up a fresh user with a Brazilian passport and lands on Explore. */
export async function signUpAndOnboard(page: Page) {
  const byTestId = byTestIdOn(page);
  const role = roleOn(page);
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

  await page.goto('/sign-up');
  await byTestId('displayName').fill('E2E Traveller');
  await byTestId('email').fill(email);
  await byTestId('password').fill('correct-horse-battery');
  await role('button', 'Create account').click();

  await expect(page.getByText('Step 1 of 3')).toBeVisible();
  await role('button', 'Next').click();
  await expect(page.getByText('Step 2 of 3')).toBeVisible();
  await role('button', 'Choose a country').first().click();
  await page.getByLabel('Search countries').filter({ visible: true }).last().fill('Brazil');
  await role('checkbox', 'Brazil').click();
  await role('button', 'Done').click();
  await role('button', 'Choose a country').click();
  await page.getByLabel('Search countries').filter({ visible: true }).last().fill('Brazil');
  await role('radio', 'Brazil').click();
  await role('button', 'Next').click();
  await byTestId('passportExpiry').fill('2030-01-31');
  await role('button', 'Start exploring').click();
}

/** Opens Lisbon from the Home in list view and adds the first `count` places to the route. */
export async function addLisbonPlaces(page: Page, count: number) {
  const byTestId = byTestIdOn(page);
  const role = roleOn(page);
  await byTestId('city-search').fill('Lisb');
  await byTestId('city-card-lisbon').click();
  await expect(page).toHaveURL(/\/city\/lisbon$/);
  await page.getByRole('radio', { name: 'List' }).or(role('checkbox', 'List')).click();
  const list = byTestId('attraction-list');
  await expect(list.getByRole('button').first()).toBeVisible({ timeout: 20_000 });
  for (let i = 0; i < count; i++) {
    await list.getByRole('button').nth(i).click();
    await byTestId('toggle-route').click();
    await expect(byTestId('toggle-route')).toHaveText('Remove from route');
    await page.goBack();
  }
  await expect(page.getByText(`${count} stops in your route`)).toBeVisible();
}
