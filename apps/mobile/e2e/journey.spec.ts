import { expect, test } from '@playwright/test';

/**
 * Full journey against a local Supabase stack with seeds loaded and functions served:
 *   pnpm db:start && pnpm functions:serve & pnpm build:web && E2E_BACKEND=1 pnpm e2e
 */
test.skip(!process.env.E2E_BACKEND, 'needs the local Supabase stack (set E2E_BACKEND=1)');
test.describe.configure({ mode: 'serial' });

test('sign up, onboard, explore, check, build and save a walk', async ({ page }) => {
  test.setTimeout(120_000);
  const byTestId = (id: string) => page.getByTestId(id).filter({ visible: true });
  const role = (r: Parameters<typeof page.getByRole>[0], name: string | RegExp) =>
    page.getByRole(r, { name }).filter({ visible: true });
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

  await page.goto('/sign-up');
  await byTestId('displayName').fill('E2E Traveller');
  await byTestId('email').fill(email);
  await byTestId('password').fill('correct-horse-battery');
  await role('button', 'Create account').click();

  // Onboarding
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

  // Explore: switch to Lisbon, list view
  await byTestId('city-switcher').click();
  await role('radio', 'Lisbon').click();
  await page.getByRole('radio', { name: 'List' }).or(role('checkbox', 'List')).click();
  const list = byTestId('attraction-list');
  await expect(list.getByRole('button').first()).toBeVisible({ timeout: 20_000 });

  // Add the first two places to the route
  for (const i of [0, 1]) {
    await list.getByRole('button').nth(i).click();
    await byTestId('toggle-route').click();
    await expect(byTestId('toggle-route')).toHaveText('Remove from route');
    await page.goBack();
  }
  await expect(page.getByText('2 stops in your route')).toBeVisible();

  // Checklist
  await byTestId('open-checklist').click();
  await expect(byTestId('section-visa')).toBeVisible({ timeout: 30_000 });
  await expect(byTestId('section-visa')).toContainText(/Visa-free|Free movement|citizen/);
  await expect(byTestId('section-power')).toBeVisible();
  await page.goBack();

  // Route
  await byTestId('open-route').click();
  await byTestId('optimize').click();
  await expect(byTestId('route-totals')).toContainText(/km| m/, { timeout: 30_000 });
  await byTestId('trip-name').fill('E2E walk');
  await byTestId('save-trip').click();
  await expect(role('heading', 'E2E walk').first()).toBeVisible();
  await expect(role('button', 'Open the whole walk in Google Maps')).toBeVisible();

  // My Trips
  await page.goto('/trips');
  await expect(page.getByText('E2E walk')).toBeVisible();
});
