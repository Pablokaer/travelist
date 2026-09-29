import { expect, test } from '@playwright/test';

import {
  addLisbonPlaces,
  byTestIdOn,
  makePremium,
  roleOn,
  saveWalk,
  signUpAndOnboard,
  type Page,
} from './helpers';

/**
 * Free and Premium, first version (D-047), against the local stack: Upgrade → plans, Settings →
 * Subscription, the Free limits in the interface and in the database, and Premium removing them.
 *   pnpm db:start && pnpm build:web && E2E_BACKEND=1 pnpm e2e subscription
 */
test.skip(!process.env.E2E_BACKEND, 'needs the local Supabase stack (set E2E_BACKEND=1)');

/** Deletes a trip with a direct REST call as the signed-in user (bypassing the app). */
async function deleteDirectly(page: Page, tripId: string): Promise<number> {
  return page.evaluate(async (id) => {
    const key = Object.keys(localStorage).find((k) => k.endsWith('-auth-token'))!;
    const token = (JSON.parse(localStorage.getItem(key)!) as { access_token: string }).access_token;
    const anon = (window as unknown as { __E2E_ANON__?: string }).__E2E_ANON__;
    const res = await fetch(`http://127.0.0.1:54321/rest/v1/trips?id=eq.${id}`, {
      method: 'DELETE',
      headers: { apikey: anon ?? token, Authorization: `Bearer ${token}` },
    });
    return res.status;
  }, tripId);
}

test('Free limits in the app and the database; Premium lifts them', async ({ page }) => {
  test.setTimeout(240_000);
  const byTestId = byTestIdOn(page);
  const role = roleOn(page);
  await signUpAndOnboard(page);

  // Upgrade → plans (no payment yet).
  await role('button', 'Upgrade').first().click();
  await expect(page).toHaveURL(/\/plans$/);
  await expect(byTestId('plan-free')).toContainText('Current plan');
  await expect(byTestId('plan-premium')).toContainText('€5.00 / month');
  await role('button', 'Upgrade to Premium').click();
  await expect(page.getByText(/Payments are coming soon/)).toBeVisible();

  // Settings → Subscription.
  await page.goto('/profile');
  await expect(page.getByText('Current plan: Free')).toBeVisible();

  // Five places fit a Free list; the sixth is refused with the reason.
  await page.goto('/');
  await addLisbonPlaces(page, 5);
  const list = byTestId('attraction-list');
  await list.getByRole('button').nth(5).click();
  await byTestId('toggle-route').click();
  await expect(page.getByText('Free accounts can add up to 5 places per list.')).toBeVisible();
  await expect(role('button', 'Upgrade to Premium')).toBeVisible();
  await page.goBack();
  await expect(page.getByText('5 stops in your route')).toBeVisible();

  // A Free list cannot be deleted — not in the app, not with a direct request.
  await page.goto('/');
  const tripId = await saveWalk(page, 'E2E free list');
  await expect(page.getByText('Deleting lists is a Premium feature.')).toBeVisible();
  await expect(role('button', 'Delete trip')).toHaveCount(0);
  await deleteDirectly(page, tripId);
  // Still there (dynamic pages are opened through the app: static hosts 404 on a direct load).
  await page.goto('/trips');
  await expect(role('button', /^E2E free list, /)).toBeVisible();

  // Premium: plan and validity in Settings, no Upgrade, and the list can be deleted.
  await makePremium(page);
  await page.goto('/profile');
  await expect(page.getByText('Current plan: Premium')).toBeVisible();
  await expect(page.getByText('€5.00 / month')).toBeVisible();
  await expect(page.getByText(/^Valid until: /)).toBeVisible();
  await expect(role('button', 'Upgrade')).toHaveCount(0);
  await page.goto('/trips');
  await role('button', /^E2E free list, /).click();
  await role('button', 'Delete trip').click();
  await page.getByRole('button', { name: 'Yes, delete trip' }).filter({ visible: true }).click();
  await expect(page).not.toHaveURL(new RegExp(tripId));
  await page.goto('/trips');
  await expect(role('button', /^E2E free list, /)).toHaveCount(0);
});
