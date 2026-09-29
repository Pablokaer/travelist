// Plan rules (D-047). The plans and their limits live in the database (`plans` table) and are
// enforced there; these pure functions answer the same questions in the app, from the caller's
// plan as `my_subscription` returns it — never from numbers written in the UI.

/** A plan's limits; null means unlimited. */
export type PlanRules = {
  maxLists: number | null;
  maxItemsPerList: number | null;
  canDeleteLists: boolean;
};

export type PlanLimit = 'lists' | 'items' | 'delete';

/**
 * SQLSTATE codes the database raises when a plan limit is hit (mirrors the `subscriptions`
 * migration).
 */
export const PLAN_LIMIT_ERRORS: Record<string, PlanLimit> = {
  WF001: 'lists',
  WF002: 'items',
  WF003: 'delete',
};

/**
 * @example canCreateList({ maxLists: 5, … }, 5) // false
 */
export function canCreateList(plan: PlanRules, listCount: number): boolean {
  return plan.maxLists === null || listCount < plan.maxLists;
}

/**
 * @example canAddItemToList({ maxItemsPerList: 5, … }, 4) // true
 */
export function canAddItemToList(plan: PlanRules, itemCount: number): boolean {
  return plan.maxItemsPerList === null || itemCount < plan.maxItemsPerList;
}

/**
 * Deleting is a plan feature, and only ever for the owner's own lists.
 * @example canDeleteList(premium, true) // true
 */
export function canDeleteList(plan: PlanRules, isOwner: boolean): boolean {
  return isOwner && plan.canDeleteLists;
}

/**
 * Places a route can hold: the plan's limit, within the technical limit of a walking route.
 * @example itemCapacity({ maxItemsPerList: 5, … }, 20) // 5
 */
export function itemCapacity(plan: PlanRules, routeMaxStops: number): number {
  return plan.maxItemsPerList === null
    ? routeMaxStops
    : Math.min(plan.maxItemsPerList, routeMaxStops);
}

/**
 * The limit behind a database error code, or null for any other error.
 * @example planLimitFromCode('WF001') // 'lists'
 */
export function planLimitFromCode(code: string | undefined): PlanLimit | null {
  return (code && PLAN_LIMIT_ERRORS[code]) || null;
}
