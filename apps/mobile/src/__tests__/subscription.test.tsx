import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import PlansScreen from '@/app/plans';
import type { AttractionSummary } from '@/features/destinations/api';
import { useRouteStore } from '@/features/route/store';
import {
  planFromRow,
  PlanLimitError,
  startCheckout,
  type Subscription,
} from '@/features/subscription/api';
import { PlanLimitNotice } from '@/features/subscription/plan-limit-notice';
import { SubscriptionSection } from '@/features/subscription/subscription-section';
import { UpgradeButton } from '@/features/subscription/upgrade-button';
import '@/lib/i18n';
import {
  freePlanRow,
  freeSubscription as freeFixture,
  premiumPlanRow,
  premiumSubscription as premiumFixture,
} from '@/testing/subscription';

/** Plans as the `plans` table returns them, and the caller's subscription. */
class MockPlansServer {
  static planRows = [freePlanRow, premiumPlanRow];
  static subscription: Subscription;
}

jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, router: { push: jest.fn() } }));
jest.mock('@/features/subscription/api', () => ({
  ...jest.requireActual('@/features/subscription/api'),
  usePlans: () => ({
    isPending: false,
    isError: false,
    data: MockPlansServer.planRows.map(
      jest.requireActual('@/features/subscription/api').planFromRow,
    ),
  }),
  useMySubscription: () => ({
    isPending: false,
    isError: false,
    data: MockPlansServer.subscription,
  }),
}));

const plans = MockPlansServer.planRows.map(planFromRow);
const freePlan = plans[0]!;
const premiumPlan = plans[1]!;

const freeSubscription = () => freeFixture(2);
const premiumSubscription = () => premiumFixture(9);

const place = (id: string): AttractionSummary => ({
  id,
  citySlug: 'lisbon',
  nameEn: id,
  namePt: null,
  category: 'museum',
  lat: 38.7,
  lng: -9.2,
  popularity: 1,
  avgVisitMinutes: 30,
  imageUrl: null,
  isUnesco: false,
});

beforeEach(() => {
  MockPlansServer.subscription = freeSubscription();
  jest.mocked(router.push).mockClear();
  useRouteStore.getState().clear();
});

describe('plans and subscriptions (D-047)', () => {
  test('plans come from the database with their limits; null means unlimited', () => {
    expect(freePlan).toEqual({
      id: 'free',
      priceCents: 0,
      currency: 'EUR',
      billingInterval: null,
      rules: { maxLists: 5, maxItemsPerList: 5, canDeleteLists: false },
    });
    expect(premiumPlan.rules).toEqual({
      maxLists: null,
      maxItemsPerList: null,
      canDeleteLists: true,
    });
  });

  test('a user without a subscription is on the Free plan', () => {
    const s = freeSubscription();
    expect(s.plan.id).toBe('free');
    expect(s.status).toBe('free');
    expect(s.validUntil).toBeNull();
    expect(s.listCount).toBe(2);
  });

  test('a database plan-limit error becomes a PlanLimitError', () => {
    expect(PlanLimitError.from({ code: 'WF001', message: 'plan limit' })?.limit).toBe('lists');
    expect(PlanLimitError.from({ code: '23505', message: 'duplicate' })).toBeNull();
  });

  test('checkout is not connected yet: it says so instead of charging', async () => {
    await expect(startCheckout('premium')).resolves.toEqual({ status: 'unavailable' });
  });
});

describe('the route tray holds as many places as the plan allows', () => {
  test('Free: the sixth place is refused with the plan limit', () => {
    const store = useRouteStore.getState();
    for (const id of ['a', 'b', 'c', 'd', 'e']) expect(store.toggle(place(id), 5)).toBe('added');
    expect(useRouteStore.getState().toggle(place('f'), 5)).toBe('planLimit');
    expect(useRouteStore.getState().stops).toHaveLength(5);
  });

  test('Premium: only the technical route limit applies', () => {
    const store = useRouteStore.getState();
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f'])
      expect(store.toggle(place(id), 20)).toBe('added');
  });
});

describe('PlansScreen', () => {
  test('shows Free and a highlighted Premium with their prices and limits', () => {
    render(<PlansScreen />);
    const free = screen.getByTestId('plan-free');
    expect(free).toHaveTextContent(/€0/);
    expect(free).toHaveTextContent(/Up to 5 lists/);
    expect(free).toHaveTextContent(/Up to 5 places per list/);
    const premium = screen.getByTestId('plan-premium');
    expect(premium).toHaveTextContent(/€5\.00 \/ month/);
    expect(premium).toHaveTextContent(/Unlimited lists/);
    expect(premium).toHaveTextContent(/Unlimited places per list/);
    expect(premium).toHaveTextContent(/Delete your lists/);
    expect(premium).toHaveTextContent(/Recommended/);
    expect(free).toHaveTextContent(/Current plan/);
  });

  test('"Upgrade to Premium" does not charge anything yet', async () => {
    render(<PlansScreen />);
    await userEvent.press(screen.getByRole('button', { name: 'Upgrade to Premium' }));
    expect(await screen.findByText(/Payments are coming soon/)).toBeOnTheScreen();
  });

  test('a Premium user sees Premium as the current plan and no upgrade', () => {
    MockPlansServer.subscription = premiumSubscription();
    render(<PlansScreen />);
    expect(screen.getByTestId('plan-premium')).toHaveTextContent(/Current plan/);
    expect(screen.queryByRole('button', { name: 'Upgrade to Premium' })).toBeNull();
  });
});

describe('Settings → Subscription', () => {
  test('Free: the current plan', () => {
    render(<SubscriptionSection />);
    expect(screen.getByText('Subscription')).toBeOnTheScreen();
    expect(screen.getByText('Current plan: Free')).toBeOnTheScreen();
    expect(screen.queryByText(/Valid until/)).toBeNull();
  });

  test('Premium: the plan, price, validity and Manage subscription', async () => {
    MockPlansServer.subscription = premiumSubscription();
    render(<SubscriptionSection />);
    expect(screen.getByText('Current plan: Premium')).toBeOnTheScreen();
    expect(screen.getByText('€5.00 / month')).toBeOnTheScreen();
    expect(screen.getByText(/^Valid until: /)).toHaveTextContent(/31/);
    await userEvent.press(screen.getByRole('button', { name: 'Manage subscription' }));
    expect(router.push).toHaveBeenCalledWith('/plans');
  });
});

describe('Upgrade in the top bar', () => {
  test('Free users get "Upgrade", which opens the plans', async () => {
    render(<UpgradeButton />);
    await userEvent.press(screen.getByRole('button', { name: 'Upgrade' }));
    expect(router.push).toHaveBeenCalledWith('/plans');
  });

  test('Premium users do not', () => {
    MockPlansServer.subscription = premiumSubscription();
    render(<UpgradeButton />);
    expect(screen.queryByRole('button', { name: 'Upgrade' })).toBeNull();
  });
});

describe('PlanLimitNotice', () => {
  test('explains each limit from the plan and offers Premium', async () => {
    const { rerender } = render(<PlanLimitNotice limit="lists" />);
    expect(screen.getByText("You've reached the Free plan limit of 5 lists.")).toBeOnTheScreen();
    rerender(<PlanLimitNotice limit="items" />);
    expect(screen.getByText('Free accounts can add up to 5 places per list.')).toBeOnTheScreen();
    rerender(<PlanLimitNotice limit="delete" />);
    expect(screen.getByText('Deleting lists is a Premium feature.')).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: 'Upgrade to Premium' }));
    expect(router.push).toHaveBeenCalledWith('/plans');
  });
});
