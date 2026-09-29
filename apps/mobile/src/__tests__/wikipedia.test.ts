import { act, renderHook } from '@testing-library/react-native';

import { useDebouncedValue } from '@/lib/use-debounced-value';
import { preferredArticle, wikipediaUrl } from '@/lib/wikipedia';

describe('Wikipedia links', () => {
  test('an article URL uses underscores and encodes the title', () => {
    expect(wikipediaUrl({ language: 'pt', title: 'Torre de Belém' })).toBe(
      'https://pt.wikipedia.org/wiki/Torre_de_Bel%C3%A9m',
    );
  });

  test('the article in the app language is preferred, then the other one', () => {
    expect(preferredArticle('pt', 'Lisbon', 'Lisboa')).toEqual({ language: 'pt', title: 'Lisboa' });
    expect(preferredArticle('pt', 'Lisbon', null)).toEqual({ language: 'en', title: 'Lisbon' });
    expect(preferredArticle('en', null, 'Lisboa')).toEqual({ language: 'pt', title: 'Lisboa' });
    expect(preferredArticle('en', null, null)).toBeNull();
  });
});

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('follows the value once it stops changing for the delay', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 300),
      {
        initialProps: { value: 'c' },
      },
    );
    rerender({ value: 'ca' });
    rerender({ value: 'can' });
    expect(result.current).toBe('c');
    act(() => jest.advanceTimersByTime(300));
    expect(result.current).toBe('can');
  });
});
