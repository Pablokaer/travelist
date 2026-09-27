import type { AttractionCategory } from '@wayfarer/shared';
import { create } from 'zustand';

type ExploreState = {
  citySlug: string | null;
  categories: AttractionCategory[];
  view: 'map' | 'list';
  setCity: (slug: string) => void;
  toggleCategory: (c: AttractionCategory) => void;
  clearCategories: () => void;
  setView: (view: 'map' | 'list') => void;
};

export const useExploreStore = create<ExploreState>((set) => ({
  citySlug: null,
  categories: [],
  view: 'map',
  setCity: (citySlug) => set({ citySlug }),
  toggleCategory: (c) =>
    set((s) => ({
      categories: s.categories.includes(c)
        ? s.categories.filter((x) => x !== c)
        : [...s.categories, c],
    })),
  clearCategories: () => set({ categories: [] }),
  setView: (view) => set({ view }),
}));
