import { z } from 'zod';

import { ROUTE_MAX_STOPS, ROUTE_MIN_STOPS } from '../constants/index.ts';
import { isoDateSchema } from './common.ts';

export const routeStopSchema = z.object({
  id: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  visitMinutes: z.number().int().min(0).max(600),
});
export type RouteStop = z.infer<typeof routeStopSchema>;

export const routeRequestSchema = z.object({
  stops: z
    .array(routeStopSchema)
    .min(ROUTE_MIN_STOPS)
    .max(ROUTE_MAX_STOPS)
    .refine((s) => new Set(s.map((x) => x.id)).size === s.length, { message: 'duplicate stop' }),
  /** Keep the first stop as the starting point (default) instead of letting the optimiser pick. */
  keepFirst: z.boolean().default(true),
});
export type RouteRequest = z.infer<typeof routeRequestSchema>;

export const lineStringSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number(), z.number()])).min(2),
});
export type LineString = z.infer<typeof lineStringSchema>;

export const routeResponseSchema = z.object({
  order: z.array(z.string()),
  legs: z.array(
    z.object({
      fromId: z.string(),
      toId: z.string(),
      distanceM: z.number(),
      durationS: z.number(),
    }),
  ),
  geometry: lineStringSchema,
  distanceM: z.number(),
  walkingSeconds: z.number(),
  visitMinutes: z.number(),
  isFallback: z.boolean(),
  provider: z.enum(['openrouteservice', 'fallback']),
  attribution: z.string(),
});
export type RouteResponse = z.infer<typeof routeResponseSchema>;

export const saveTripFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'validation.required' })
    .max(80, { message: 'validation.tooLong' }),
  tripDate: isoDateSchema.nullable(),
});
export type SaveTripForm = z.infer<typeof saveTripFormSchema>;
