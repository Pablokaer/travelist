import { render, screen, within } from '@testing-library/react-native';

import AttractionScreen from '@/app/attraction/[id]';
import type { AttractionDetail } from '@/features/destinations/api';
import '@/lib/i18n';

/** Server data for one attraction with 128 reviews averaging 4.56. */
class MockAttractionServer {
  static detail: AttractionDetail = {
    id: 'a1',
    citySlug: 'lisbon',
    nameEn: 'Belém Tower',
    namePt: 'Torre de Belém',
    category: 'monument',
    lat: 38.69,
    lng: -9.21,
    popularity: 90,
    avgVisitMinutes: 45,
    imageUrl: null,
    isUnesco: true,
    descriptionEn: null,
    descriptionPt: null,
    imageAuthor: null,
    imageLicense: null,
    imageLicenseUrl: null,
    imagePageUrl: null,
    website: null,
    wikipediaEn: null,
    wikipediaPt: null,
    openingHours: null,
    fee: null,
    wikidataId: 'Q1',
  };
}

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 'a1' }),
}));
jest.mock('@/features/destinations/api', () => ({
  ...jest.requireActual('@/features/destinations/api'),
  useAttraction: () => ({ isPending: false, isError: false, data: MockAttractionServer.detail }),
}));
jest.mock('@/features/reviews/api', () => {
  const idle = { isPending: false, error: null, mutate: jest.fn() };
  return {
    ...jest.requireActual('@/features/reviews/api'),
    useReviews: () => ({ data: [], isPending: false }),
    useRatingSummary: () => ({ data: { count: 128, average: 4.56 } }),
    useSaveReview: () => idle,
    useDeleteReview: () => idle,
  };
});

test('the average rating sits with the title, and the reviews section is on the page', () => {
  render(<AttractionScreen />);
  const title = screen.getByTestId('attraction-title');
  expect(within(title).getByTestId('rating-summary')).toHaveTextContent('4.6 ★ · 128 reviews');
  expect(screen.getByText('Reviews')).toBeTruthy();
  expect(screen.getByTestId('review-form')).toBeTruthy();
});
