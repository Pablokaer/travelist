import { describe, expect, it } from 'vitest';

import {
  canAddItemToList,
  canCreateList,
  canDeleteList,
  itemCapacity,
  planLimitFromCode,
  PLAN_LIMIT_ERRORS,
  type PlanRules,
} from './plans.ts';

// Plans come from the database (`plans` table); these mirror its two rows.
const free: PlanRules = { maxLists: 5, maxItemsPerList: 5, canDeleteLists: false };
const premium: PlanRules = { maxLists: null, maxItemsPerList: null, canDeleteLists: true };

describe('plan rules (D-047)', () => {
  it('Free creates lists while it has fewer than its maximum; Premium without limit', () => {
    expect(canCreateList(free, 4)).toBe(true);
    expect(canCreateList(free, 5)).toBe(false);
    expect(canCreateList(free, 7)).toBe(false); // an old account over the limit keeps its lists
    expect(canCreateList(premium, 500)).toBe(true);
  });

  it('Free adds places while a list has fewer than its maximum; Premium without limit', () => {
    expect(canAddItemToList(free, 4)).toBe(true);
    expect(canAddItemToList(free, 5)).toBe(false);
    expect(canAddItemToList(premium, 50)).toBe(true);
  });

  it('only a plan that allows it deletes lists, and only the owner', () => {
    expect(canDeleteList(free, true)).toBe(false);
    expect(canDeleteList(premium, true)).toBe(true);
    expect(canDeleteList(premium, false)).toBe(false);
  });

  it('the places a route can hold: the plan limit within the technical route limit', () => {
    expect(itemCapacity(free, 20)).toBe(5);
    expect(itemCapacity(premium, 20)).toBe(20);
  });

  it('database errors map to the limit that was hit', () => {
    expect(PLAN_LIMIT_ERRORS).toEqual({ WF001: 'lists', WF002: 'items', WF003: 'delete' });
    expect(planLimitFromCode('WF002')).toBe('items');
    expect(planLimitFromCode('23505')).toBeNull();
    expect(planLimitFromCode(undefined)).toBeNull();
  });
});
