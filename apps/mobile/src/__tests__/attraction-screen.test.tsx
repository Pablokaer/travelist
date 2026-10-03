import { render, screen, userEvent, within } from '@testing-library/react-native';

import AttractionScreen from '@/app/attraction/[id]';
import type { AttractionDetail } from '@/features/destinations/api';
import { useRouteStore } from '@/features/route/store';
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
  useAttraction: () => ({
    isPending: false,
    isError: false,
    data: { summary: MockAttractionServer.detail, detail: MockAttractionServer.detail },
  }),
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

test('the page adds a sixth place to the route: no plan limit (D-065)', async () => {
  useRouteStore.getState().clear();
  for (const id of ['b', 'c', 'd', 'e', 'f'])
    useRouteStore.getState().add({ ...MockAttractionServer.detail, id, lng: -9.2 });
  render(<AttractionScreen />);
  await userEvent.press(screen.getByTestId('toggle-route'));
  expect(useRouteStore.getState().stops).toHaveLength(6);
  expect(screen.queryByText(/places per list/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Remove from route' })).toBeOnTheScreen();
});
