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

/** Opens Lisbon's city page from the Home (D-033). */
export async function openLisbon(page: Page) {
  const byTestId = byTestIdOn(page);
  await byTestId('city-search').fill('Lisb');
  await byTestId('city-card-lisbon').click();
  await expect(page).toHaveURL(/\/short\/lisbon$/);
}

/** Opens Lisbon's attractions (Map / List) from the Home, through its city page. */
export async function openLisbonAttractions(page: Page) {
  await openLisbon(page);
  await roleOn(page)('button', 'Explore attractions').click();
  await expect(page).toHaveURL(/\/city\/lisbon$/);
}

/** Opens Lisbon from the Home in list view and adds the first `count` places to the route. */
export async function addLisbonPlaces(page: Page, count: number) {
  const byTestId = byTestIdOn(page);
  const role = roleOn(page);
  await openLisbonAttractions(page);
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

/**
 * Saves a two-stop Lisbon walk and returns its id (the owner stays on the trip page); with
 * `start` (Lisbon date and time) it is a meetup (D-041).
 */
export async function saveWalk(
  page: Page,
  name: string,
  start?: { date: string; time: string },
): Promise<string> {
  const byTestId = byTestIdOn(page);
  await addLisbonPlaces(page, 2);
  await byTestId('open-route').click();
  await byTestId('optimize').click();
  await expect(byTestId('route-distance')).toContainText(/\d/, { timeout: 30_000 });
  await byTestId('trip-name').fill(name);
  if (start) {
    await byTestId('trip-date').fill(start.date);
    await byTestId('trip-time').fill(start.time);
  }
  await byTestId('save-trip').click();
  await expect(page).toHaveURL(/\/trip\/[0-9a-f-]{36}$/);
  return page.url().split('/').pop()!;
}

/** Picks a visibility on the owner's trip page and saves it (D-031). */
export async function chooseVisibility(page: Page, label: string, password?: string) {
  const role = roleOn(page);
  await role('radio', label).click();
  if (password) await byTestIdOn(page)('trip-password').fill(password);
  await role('button', 'Save visibility').click();
}
