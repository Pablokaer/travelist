// Plans and subscriptions (D-047). The plans and their limits are rows of the `plans` table;
// the caller's plan comes from `my_subscription` (Free without an active subscription). The
// database enforces the limits; the app reads the same rules to explain them before a request
// and maps the database's plan-limit errors (WF001–WF003) to `PlanLimitError`.
import { planLimitFromCode, type PlanLimit, type PlanRules } from '@wayfarer/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type Plan = {
  id: string;
  priceCents: number;
  currency: string;
  /** null for free plans. */
  billingInterval: 'month' | 'year' | null;
  rules: PlanRules;
};

/** Free has no subscription; the other statuses come from the payment side later. */
export type SubscriptionStatus = 'free' | 'active' | 'cancelled' | 'expired' | 'past_due';

export type Subscription = {
  plan: Plan;
  status: SubscriptionStatus;
  startedAt: string | null;
  /** End of the paid period ("valid until"), when there is one. */
  validUntil: string | null;
  /** The caller's walk lists, for the list limit. */
  listCount: number;
};

type PlanRow = {
  id: string;
  price_cents: number;
  currency: string;
  billing_interval: string | null;
  max_lists: number | null;
  max_items_per_list: number | null;
  can_delete_lists: boolean;
};

type SubscriptionResult = {
  plan: PlanRow;
  status: string;
  started_at: string | null;
  valid_until: string | null;
  list_count: number;
};

export const subscriptionKeys = {
  plans: ['plans'] as const,
  mine: ['subscription'] as const,
};

/**
 * @example planFromRow(row).rules.maxLists // 5
 */
export function planFromRow(r: PlanRow): Plan {
  return {
    id: r.id,
    priceCents: r.price_cents,
    currency: r.currency,
    billingInterval: r.billing_interval as Plan['billingInterval'],
    rules: {
      maxLists: r.max_lists,
      maxItemsPerList: r.max_items_per_list,
      canDeleteLists: r.can_delete_lists,
    },
  };
}

/**
 * @example subscriptionFrom(await rpc('my_subscription')).plan.id // 'free'
 */
export function subscriptionFrom(r: SubscriptionResult): Subscription {
  return {
    plan: planFromRow(r.plan),
    status: r.status as SubscriptionStatus,
    startedAt: r.started_at,
    validUntil: r.valid_until,
    listCount: r.list_count,
  };
}

/** A request refused by the database because of the plan (WF001–WF003). */
export class PlanLimitError extends Error {
  constructor(
    readonly limit: PlanLimit,
    message: string,
  ) {
    super(message);
  }

  /**
   * The plan-limit error behind a Supabase error, or null for any other error.
   * @example PlanLimitError.from(result.error)?.limit // 'lists'
   */
  static from(error: { code?: string; message: string } | null): PlanLimitError | null {
    const limit = planLimitFromCode(error?.code);
    return limit && error ? new PlanLimitError(limit, error.message) : null;
  }
}

/**
 * Throws the Supabase error of a write — as a PlanLimitError when a plan limit refused it.
 * @example throwIfError(await supabase.rpc('save_trip', …))
 */
export function throwIfError(result: { error: { code?: string; message: string } | null }) {
  if (!result.error) return;
  throw PlanLimitError.from(result.error) ?? new Error(result.error.message);
}

/** Every plan, in display order (from the `plans` table; readable by everyone). */
export function usePlans() {
  return useQuery({
    queryKey: subscriptionKeys.plans,
    staleTime: 3_600_000,
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await supabase.from('plans').select('*').order('sort_order');
      if (error) throw new Error(error.message);
      return (data as PlanRow[]).map(planFromRow);
    },
  });
}

/** The signed-in user's plan, subscription and list count. */
export function useMySubscription() {
  return useQuery({
    queryKey: subscriptionKeys.mine,
    queryFn: async (): Promise<Subscription> => {
      const { data, error } = await supabase.rpc('my_subscription');
      if (error) throw new Error(error.message);
      return subscriptionFrom(data as unknown as SubscriptionResult);
    },
  });
}

/** Refreshes the plan and usage after lists are created or deleted. */
export function useInvalidateSubscription() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: subscriptionKeys.mine });
}

/**
 * Where checkout will start (next round: a payment provider such as Stripe creates a session
 * and, on payment, the backend writes the `subscriptions` row). Nothing is charged today.
 * @example const result = await startCheckout('premium'); // { status: 'unavailable' }
 */
export async function startCheckout(_planId: string): Promise<{ status: 'unavailable' }> {
  return { status: 'unavailable' };
}
