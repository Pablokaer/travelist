import en from './en.json' with { type: 'json' };
import pt from './pt.json' with { type: 'json' };

import type { Language } from '../constants/index.ts';

export type TranslationResource = typeof en;

/**
 * Namespaces written in English alone. The landing page is always English (D-077), so a
 * Portuguese copy of its strings would never be read (D-078); i18next falls back to English
 * for them anyway.
 * @example ENGLISH_ONLY_NAMESPACES.includes('landing') // true
 */
export const ENGLISH_ONLY_NAMESPACES = ['landing'] as const;

/** What every language but English translates: English minus its English-only namespaces. */
export type LocalizedResource = Omit<TranslationResource, (typeof ENGLISH_ONLY_NAMESPACES)[number]>;

export const resources = {
  en: { translation: en },
  pt: { translation: pt satisfies LocalizedResource },
} as const satisfies Record<Language, { translation: LocalizedResource }>;

/** Flattens a nested resource into dot-separated keys ("tabs.explore"). */
export function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === 'object'
      ? flattenKeys(value as Record<string, unknown>, path)
      : [path];
  });
}

/**
 * Whether a dot-separated key belongs to an English-only namespace (D-078).
 * @example isEnglishOnlyKey('landing.hero.title') // true
 */
export function isEnglishOnlyKey(key: string): boolean {
  const namespace = key.split('.', 1)[0] ?? '';
  return (ENGLISH_ONLY_NAMESPACES as readonly string[]).includes(namespace);
}
