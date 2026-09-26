export const SUPPORTED_LANGUAGES = ['en', 'pt'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'en';

export const UNITS = ['metric', 'imperial'] as const;
export type Units = (typeof UNITS)[number];

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
