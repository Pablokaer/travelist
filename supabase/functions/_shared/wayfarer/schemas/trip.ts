import { z } from 'zod';

import { TRIP_PASSWORD_MAX, TRIP_PASSWORD_MIN, TRIP_VISIBILITIES } from '../constants/index.ts';
import { isoDateSchema } from './common.ts';

export const tripVisibilitySchema = z.enum(TRIP_VISIBILITIES);

/**
 * The owner's visibility form (D-031). A new password needs 4–72 characters and is never
 * trimmed; left blank, a trip that is already protected keeps its password.
 * @example tripVisibilityFormSchema(true).parse({ visibility: 'password', password: '' }) // ok
 */
export function tripVisibilityFormSchema(hasPassword: boolean) {
  return z
    .object({
      visibility: tripVisibilitySchema,
      password: z
        .string()
        .max(TRIP_PASSWORD_MAX, { message: 'validation.tripPasswordLength' })
        .refine((p) => p === '' || p.length >= TRIP_PASSWORD_MIN, {
          message: 'validation.tripPasswordLength',
        }),
    })
    .refine((f) => f.visibility !== 'password' || hasPassword || f.password !== '', {
      path: ['password'],
      message: 'validation.tripPasswordRequired',
    });
}
export type TripVisibilityForm = z.infer<ReturnType<typeof tripVisibilityFormSchema>>;

/** The `trip` of a `shared_trip` answer: the trip's columns, its stop ids in order, is_owner. */
export const sharedTripSchema = z.object({
  id: z.string(),
  name: z.string(),
  city_slug: z.string(),
  trip_date: isoDateSchema.nullable(),
  route_geometry: z.unknown().nullable(),
  distance_m: z.number().nullable(),
  walking_seconds: z.number().nullable(),
  visit_minutes: z.number().nullable(),
  is_fallback: z.boolean(),
  provider: z.string().nullable(),
  visibility: tripVisibilitySchema,
  created_at: z.string(),
  is_owner: z.boolean(),
  stop_ids: z.array(z.string()),
});
export type SharedTrip = z.infer<typeof sharedTripSchema>;

/**
 * What `shared_trip(id, password)` returns: the trip, or why it cannot be shown. Private and
 * missing trips are both `not_found`, so a link never reveals that a private trip exists.
 * @example sharedTripResultSchema.parse({ status: 'password_required' })
 */
export const sharedTripResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), trip: sharedTripSchema }),
  z.object({ status: z.literal('not_found') }),
  z.object({ status: z.literal('password_required') }),
  z.object({ status: z.literal('wrong_password') }),
]);
export type SharedTripResult = z.infer<typeof sharedTripResultSchema>;
