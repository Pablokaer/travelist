import { describe, expect, it } from 'vitest';

import { ENGLISH_ONLY_NAMESPACES, flattenKeys, isEnglishOnlyKey, resources } from './index.ts';

const interpolations = (s: string) => [...s.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();

/** The keys every language translates: all but the English-only namespaces (D-078). */
const localizedKeys = (lang: Record<string, unknown>) =>
  flattenKeys(lang).filter((key) => !isEnglishOnlyKey(key));

describe('i18n resources', () => {
  const en = resources.en.translation as Record<string, unknown>;
  const pt = resources.pt.translation as Record<string, unknown>;

  it('EN and PT have exactly the same keys outside the English-only namespaces', () => {
    expect(localizedKeys(pt).sort()).toEqual(localizedKeys(en).sort());
  });

  it('the English-only namespaces exist in English and nowhere else (D-078)', () => {
    for (const namespace of ENGLISH_ONLY_NAMESPACES) {
      expect(en, namespace).toHaveProperty(namespace);
      expect(pt, namespace).not.toHaveProperty(namespace);
    }
  });

  it('no translation is empty', () => {
    for (const lang of [en, pt]) {
      for (const key of flattenKeys(lang)) {
        const value = key
          .split('.')
          .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], lang);
        expect(typeof value === 'string' && value.trim().length > 0, key).toBe(true);
      }
    }
  });

  it('interpolation variables match between languages', () => {
    for (const key of localizedKeys(en)) {
      const get = (o: Record<string, unknown>) =>
        key
          .split('.')
          .reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], o) as string;
      expect(interpolations(get(pt)), key).toEqual(interpolations(get(en)));
    }
  });
});

describe('isEnglishOnlyKey', () => {
  it('is true for keys of the landing page, English only (D-077)', () => {
    expect(isEnglishOnlyKey('landing.hero.title')).toBe(true);
  });

  it('is false for the translated keys, even when they merely start alike', () => {
    expect(isEnglishOnlyKey('auth.signUpTitle')).toBe(false);
    expect(isEnglishOnlyKey('landingPage.title')).toBe(false);
  });
});
