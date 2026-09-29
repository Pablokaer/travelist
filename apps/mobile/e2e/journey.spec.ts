import { expect, test } from '@playwright/test';

/**
 * Full journey against a local Supabase stack with seeds loaded and functions served:
 *   pnpm db:start && pnpm functions:serve & pnpm build:web && E2E_BACKEND=1 pnpm e2e
 */
test.skip(!process.env.E2E_BACKEND, 'needs the local Supabase stack (set E2E_BACKEND=1)');
test.describe.configure({ mode: 'serial' });

type Page = import('@playwright/test').Page;

const byTestIdOn = (page: Page) => (id: string) => page.getByTestId(id).filter({ visible: true });
const roleOn = (page: Page) => (r: Parameters<Page['getByRole']>[0], name: string | RegExp) =>
  page.getByRole(r, { name }).filter({ visible: true });

/** Signs up a fresh user with a Brazilian passport and lands on Explore. */
async function signUpAndOnboard(page: Page) {
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
async function addLisbonPlaces(page: Page, count: number) {
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

test('sign up, onboard, explore, check, build and save a walk', async ({ page }) => {
  test.setTimeout(120_000);
  const byTestId = byTestIdOn(page);
  const role = roleOn(page);
  await signUpAndOnboard(page);
  await addLisbonPlaces(page, 2);

  // Checklist
  await byTestId('open-checklist').click();
  await expect(byTestId('section-visa')).toBeVisible({ timeout: 30_000 });
  await expect(byTestId('section-visa')).toContainText(/Visa-free|Free movement|citizen/);
  await expect(byTestId('section-power')).toBeVisible();
  await page.goBack();

  // Route
  await byTestId('open-route').click();
  await byTestId('optimize').click();
  // Wait for the optimiser's answer: the distance switches from "–" to a value.
  await expect(byTestId('route-distance')).toContainText(/\d+(\.\d+)? (km|m|mi)\b/, {
    timeout: 30_000,
  });
  await byTestId('trip-name').fill('E2E walk');
  await byTestId('save-trip').click();
  await expect(role('heading', 'E2E walk').first()).toBeVisible();
  // The saved trip keeps the route totals.
  await expect(byTestId('route-distance')).toContainText(/\d+(\.\d+)? (km|m|mi)\b/);
  await expect(role('button', 'Open the whole walk in Google Maps')).toBeVisible();

  // My Trips
  await page.goto('/trips');
  await expect(page.getByText('E2E walk')).toBeVisible();
});

test('orders picks automatically, splits them into two routes and saves both', async ({ page }) => {
  test.setTimeout(150_000);
  const byTestId = byTestIdOn(page);
  await signUpAndOnboard(page);
  await addLisbonPlaces(page, 6);

  await byTestId('open-route').click();
  await expect(byTestId('route-order-notice')).toContainText('shortest walk');
  await byTestId('suggest-split').click();
  await expect(byTestId('route-heading-0')).toContainText('Route 1');
  await expect(byTestId('route-heading-1')).toContainText('Route 2');

  await byTestId('optimize').click();
  await expect(byTestId('route-distance').first()).toContainText(/\d+(\.\d+)? (km|m|mi)\b/, {
    timeout: 30_000,
  });
  await expect(byTestId('route-distance').nth(1)).toContainText(/\d+(\.\d+)? (km|m|mi)\b/);
  await byTestId('trip-name').fill('E2E split');
  await byTestId('save-trip').click();

  await expect(page.getByText('E2E split · Route 1')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('E2E split · Route 2')).toBeVisible();
});
