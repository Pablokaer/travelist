import { expect, test } from '@playwright/test';

import {
  byTestIdOn,
  chooseVisibility,
  openLisbon,
  roleOn,
  saveWalk,
  signUpAndOnboard,
} from './helpers';

/**
 * Public traveller profiles (D-045) against the local Supabase stack: the author's name on a
 * chat message and on a review opens their profile — name, member since, public walk lists.
 *   pnpm db:start && pnpm build:web && E2E_BACKEND=1 pnpm e2e traveller-profile
 */
test.skip(!process.env.E2E_BACKEND, 'needs the local Supabase stack (set E2E_BACKEND=1)');

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const year = String(new Date().getFullYear());

test('names on chat messages and reviews open the author public profile', async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  // The organiser (sign-up gives the name "E2E Traveller") shares a public list and writes in its chat.
  await signUpAndOnboard(page);
  const listName = `E2E profile walk ${unique()}`;
  const tripId = await saveWalk(page, listName);
  await chooseVisibility(page, 'Public');
  await expect(roleOn(page)('button', 'Share list')).toBeVisible();
  await roleOn(page)('button', 'Open group chat').click();
  const hello = `Welcome ${unique()}`;
  await byTestIdOn(page)('chat-input').fill(hello);
  await roleOn(page)('button', 'Send').click();
  await expect(page.getByText(hello)).toBeVisible();

  // Another traveller joins, and opens the organiser's profile from the chat.
  const other = await (await browser.newContext()).newPage();
  const role = roleOn(other);
  await signUpAndOnboard(other);
  await other.goto(`/shared?id=${tripId}`);
  await role('button', "I'm going").click();
  await role('button', 'Open group chat').click();
  await expect(other.getByText(hello)).toBeVisible();
  await role('link', 'E2E Traveller').first().click();
  await expect(other).toHaveURL(/\/traveller\?id=[0-9a-f-]{36}$/);
  // The name is both the stack header title and the page heading.
  await expect(role('heading', 'E2E Traveller').last()).toBeVisible();
  await expect(other.getByText(new RegExp(`Member since .*${year}`))).toBeVisible();
  await expect(other.getByText('1 public walk list')).toBeVisible();
  // Earlier screens stay mounted in the stack: look for the list's card on the profile.
  await expect(role('button', `${listName}, Lisbon`)).toBeVisible();

  // The same traveller reviews Lisbon; the organiser opens the reviewer's profile from it.
  await other.goto('/');
  await openLisbon(other);
  const comment = `E2E profile review ${unique()}`;
  const form = byTestIdOn(other)('review-form');
  await form.getByLabel('4 stars').click();
  await form.getByLabel('Your comment (optional)').fill(comment);
  await byTestIdOn(other)('save-review').click();
  await expect(other.getByText(comment)).toBeVisible();

  await page.goto('/');
  await openLisbon(page);
  const card = page.getByTestId(/^review-[0-9a-f-]{36}$/).filter({ hasText: comment });
  await card.getByRole('link', { name: 'E2E Traveller' }).click();
  await expect(page).toHaveURL(/\/traveller\?id=/);
  await expect(page.getByText('No public walk lists yet')).toBeVisible();
});
