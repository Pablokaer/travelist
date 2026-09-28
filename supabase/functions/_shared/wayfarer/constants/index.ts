export const SUPPORTED_LANGUAGES = ['en', 'pt'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'en';

export const UNITS = ['metric', 'imperial'] as const;
export type Units = (typeof UNITS)[number];

/** Colour themes the user can pick; the app starts light (D-021). */
export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = 'light';

export const ATTRACTION_CATEGORIES = [
  'museum',
  'monument',
  'church',
  'castle',
  'viewpoint',
  'landmark',
  'park',
  'palace',
  'other',
] as const;
export type AttractionCategory = (typeof ATTRACTION_CATEGORIES)[number];

/** Default visit duration per category, in minutes (overridable per attraction). */
export const DEFAULT_VISIT_MINUTES: Record<AttractionCategory, number> = {
  museum: 90,
  monument: 20,
  church: 30,
  castle: 90,
  viewpoint: 15,
  landmark: 20,
  park: 45,
  palace: 75,
  other: 30,
};

export const ROUTE_MIN_STOPS = 2;
export const ROUTE_MAX_STOPS = 12;

export const VISA_REQUIREMENTS = [
  'freedom_of_movement',
  'visa_free',
  'visa_on_arrival',
  'eta',
  'e_visa',
  'visa_required',
  'no_admission',
] as const;
export type VisaRequirement = (typeof VISA_REQUIREMENTS)[number];

/** Best-first ranking used when a traveller holds several passports. */
export const VISA_RANK: Record<VisaRequirement, number> = Object.fromEntries(
  VISA_REQUIREMENTS.map((r, i) => [r, i]),
) as Record<VisaRequirement, number>;

export const MAX_NATIONALITIES = 5;

/** EU member states (ISO alpha-2). */
export const EU_COUNTRIES = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
] as const;

/** EU + EEA (Iceland, Liechtenstein, Norway) + Switzerland: free movement area. */
export const FREE_MOVEMENT_COUNTRIES = [...EU_COUNTRIES, 'IS', 'LI', 'NO', 'CH'] as const;

/** Schengen area members (2026). */
export const SCHENGEN_COUNTRIES = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IS',
  'IT',
  'LV',
  'LI',
  'LT',
  'LU',
  'MT',
  'NL',
  'NO',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'CH',
] as const;

/** Walking model used for estimates and the offline route fallback. */
export const WALKING_SPEED_M_PER_S = 1.25; // 4.5 km/h
/** Straight-line → street-network distance factor for the fallback estimate. */
export const WALKING_DETOUR_FACTOR = 1.3;

/** Edge Function cache TTLs (seconds). */
export const CACHE_TTL = {
  weather: 3 * 3600,
  advisory: 24 * 3600,
  fx: 24 * 3600,
  route: 30 * 24 * 3600,
} as const;
