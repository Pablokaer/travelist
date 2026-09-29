import { expect, test } from '@playwright/test';

import { addLisbonPlaces, byTestIdOn, roleOn, signUpAndOnboard } from './helpers';

/**
 * Full journey against a local Supabase stack with seeds loaded and functions served:
 *   pnpm db:start && pnpm functions:serve & pnpm build:web && E2E_BACKEND=1 pnpm e2e
 */
test.skip(!process.env.E2E_BACKEND, 'needs the local Supabase stack (set E2E_BACKEND=1)');
test.describe.configure({ mode: 'serial' });

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

test('reorders stops by dragging their grip', async ({ page }) => {
  test.setTimeout(120_000);
  const byTestId = byTestIdOn(page);
  await signUpAndOnboard(page);
  await addLisbonPlaces(page, 3);
  await byTestId('open-route').click();

  const grip = byTestId('drag-stop-0');
  // "Drag {name} to reorder"
  const first = (await grip.getAttribute('aria-label'))!.replace(/^Drag (.*) to reorder$/, '$1');
  const last = byTestId('route-0-stop-2');
  const from = (await grip.boundingBox())!;
  const to = (await last.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, to.y + to.height - 4, { steps: 12 });
  await page.mouse.up();

  await expect(byTestId('route-order-notice')).toContainText('by hand');
  await expect(byTestId('route-0-stop-2')).toContainText(first);
  await expect(byTestId('drag-stop-2')).toHaveAttribute('aria-label', `Drag ${first} to reorder`);
});

test('publishes, edits and deletes a review of an attraction', async ({ page }) => {
  test.setTimeout(120_000);
  const byTestId = byTestIdOn(page);
  const role = roleOn(page);
  await signUpAndOnboard(page);
  await byTestId('city-search').fill('Lisb');
  await byTestId('city-card-lisbon').click();
  await page.getByRole('radio', { name: 'List' }).or(role('checkbox', 'List')).click();
  const list = byTestId('attraction-list');
  await list.getByRole('button').first().click();

  // Unique per run: other E2E users may have reviewed the same place.
  const comment = `E2E review ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const form = byTestId('review-form');
  // Published review cards (review-<uuid>), not the form's text box.
  const cards = page.getByTestId(/^review-[0-9a-f-]{36}$/).filter({ visible: true });
  await form.getByLabel('4 stars').click();
  await form.getByLabel('Your comment (optional)').fill(comment);
  await byTestId('save-review').click();
  await expect(cards.filter({ hasText: comment })).toHaveCount(1, { timeout: 15_000 });
  await expect(byTestId('rating-summary').first()).toContainText('★ ·');
  await expect(form.getByLabel('4 stars')).toBeChecked();
  await expect(form.getByRole('button', { name: 'Update review' })).toBeVisible();

  // Back on the city page, the card of the reviewed place shows its average beside the name.
  await page.goBack();
  await expect(list.getByRole('button').first().getByTestId('card-rating')).toHaveText(
    /^\d\.\d ★$/,
    { timeout: 15_000 },
  );
  await list.getByRole('button').first().click();

  await form.getByLabel('5 stars').click();
  await byTestId('save-review').click();
  await expect(byTestId('review-form').getByLabel('5 stars')).toBeChecked({ timeout: 15_000 });
  await expect(cards.filter({ hasText: comment }).getByLabel('Rated 5 out of 5')).toBeVisible();

  await byTestId('delete-review').click();
  await role('button', 'Delete review').click();
  await expect(cards.filter({ hasText: comment })).toHaveCount(0, { timeout: 15_000 });
  await expect(byTestId('save-review')).toHaveText('Publish review');
});
