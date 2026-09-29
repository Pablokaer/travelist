import { userEvent } from '@testing-library/react-native';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import { useExploreStore } from '@/features/destinations/store';
import { supabase } from '@/lib/supabase';

import RootLayout from '../app/_layout';
import ExploreLayout from '../app/(tabs)/(explore)/_layout';
import CityScreen from '../app/(tabs)/(explore)/city/[slug]';
import HomeScreen from '../app/(tabs)/(explore)/index';
import CityHubScreen from '../app/(tabs)/(explore)/short/[slug]/index';
import CityWalklistsScreen from '../app/(tabs)/(explore)/short/[slug]/walklists';

import { cityRow } from '@/testing/fixtures';
import { fakeSession, queryResult } from '@/testing/test-utils';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    from: jest.fn(),
    rpc: jest.fn(),
  },
  unwrap: (r: { data: unknown }) => r.data,
  check: () => undefined,
}));
// Before you go has its own tests; here it stays loading.
jest.mock('@/features/checklist/api', () => ({
  useChecklist: () => ({ isPending: true, isError: false, data: undefined }),
}));

const profileRow = {
  id: 'user-1',
  display_name: 'Ana',
  home_country: 'PT',
  language: 'en',
  units: 'metric',
  theme: 'light',
  passport_expiry: null,
  onboarded_at: '2026-09-28T00:00:00Z',
  profile_nationalities: [{ country_code: 'BR' }],
};

const aboutRow = {
  summary_en: 'Amsterdam is the capital of the Netherlands, known for its canals.',
  summary_pt: 'Amesterdão é a capital dos Países Baixos.',
  wikipedia_en: 'Amsterdam',
  wikipedia_pt: 'Amesterdão',
};

/** A `list_walklists` row. */
function walklistRow(id: string, name: string, over: Record<string, unknown> = {}) {
  return {
    id,
    name,
    city_slug: 'amsterdam',
    author_name: 'Ben',
    is_official: false,
    visibility: 'public',
    stop_count: 5,
    distance_m: 3000,
    walking_seconds: 2400,
    visit_minutes: 120,
    review_count: 3,
    rating_avg: 4.7,
    created_at: '2026-09-01T10:00:00Z',
    is_saved: false,
    is_own: false,
    ...over,
  };
}

/** Fake RPCs: attractions, walk lists (by official flag and name), reviews, moderator. */
class FakeHubRpc {
  static walklistCalls: Record<string, unknown>[] = [];
  static community = [walklistRow('t1', 'Historic Amsterdam'), walklistRow('t2', 'Canal walk')];
  static official = [walklistRow('o1', 'Amsterdam highlights', { is_official: true })];

  static reset() {
    FakeHubRpc.walklistCalls = [];
    FakeHubRpc.community = [
      walklistRow('t1', 'Historic Amsterdam'),
      walklistRow('t2', 'Canal walk'),
    ];
    FakeHubRpc.official = [walklistRow('o1', 'Amsterdam highlights', { is_official: true })];
  }

  static walklists(args: Record<string, unknown>) {
    FakeHubRpc.walklistCalls.push(args);
    const rows = args.p_official === true ? FakeHubRpc.official : FakeHubRpc.community;
    const search = String(args.p_search ?? '').toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(search));
  }

  static call = async (fn: string, args: Record<string, unknown>) => {
    const answers: Record<string, () => unknown> = {
      attractions_in_view: () => [
        {
          id: 'a1',
          city_slug: 'amsterdam',
          name_en: 'Rijksmuseum',
          name_pt: null,
          category: 'museum',
          lat: 0,
          lng: 0,
          popularity: 50,
          avg_visit_minutes: 60,
          image_url: null,
          is_unesco: false,
        },
      ],
      list_walklists: () => FakeHubRpc.walklists(args),
      list_reviews: () => [],
      is_moderator: () => false,
    };
    return { data: answers[fn]?.() ?? null, error: null };
  };
}

const tables: Record<string, unknown> = {
  city_list: [cityRow()],
  profiles: profileRow,
  cities: aboutRow,
  rating_summary: { review_count: 2, rating_avg: 4, rating_counts: [0, 0, 1, 0, 1] },
  attraction_rating_summary: [],
};

beforeEach(() => {
  FakeHubRpc.reset();
  useExploreStore.setState({ view: 'list', categories: [] });
  jest
    .mocked(supabase.auth.getSession)
    .mockResolvedValue({ data: { session: fakeSession }, error: null } as never);
  jest
    .mocked(supabase.from)
    .mockImplementation(((table: string) => queryResult(tables[table] ?? null)) as never);
  jest.mocked(supabase.rpc).mockImplementation(FakeHubRpc.call as never);
});

afterEach(async () => {
  await act(async () => undefined);
});

const routes = {
  _layout: RootLayout,
  '(tabs)/(explore)/_layout': ExploreLayout,
  '(tabs)/(explore)/index': HomeScreen,
  '(tabs)/(explore)/city/[slug]': CityScreen,
  '(tabs)/(explore)/short/[slug]/index': CityHubScreen,
  '(tabs)/(explore)/short/[slug]/walklists': CityWalklistsScreen,
};

test('a city card opens the city page: photo, country, rating and About', async () => {
  const app = renderRouter(routes, { initialUrl: '/' });
  await userEvent.press(await screen.findByTestId('city-card-amsterdam'));
  expect(app.getPathname()).toBe('/short/amsterdam');

  const hero = await screen.findByTestId('city-hero');
  expect(within(hero).getByText('Amsterdam')).toBeOnTheScreen();
  expect(within(hero).getByText(/Netherlands/)).toBeOnTheScreen();
  expect(await within(hero).findByTestId('rating-summary')).toHaveTextContent('4.0 ★ · 2 reviews');
  expect(await screen.findByText(/known for its canals/)).toBeOnTheScreen();
  expect(screen.getByText('From Wikipedia · CC BY-SA 4.0')).toBeOnTheScreen();
  expect(screen.getAllByText('Photo © Jose A. · CC BY 2.0').length).toBeGreaterThan(0);
});

test('Explore attractions leads to the existing Map / List page of the city', async () => {
  const app = renderRouter(routes, { initialUrl: '/short/amsterdam' });
  await userEvent.press(await screen.findByRole('button', { name: 'Explore attractions' }));
  expect(app.getPathname()).toBe('/city/amsterdam');
  expect(await screen.findByText('Rijksmuseum')).toBeOnTheScreen();
});

test('community and official walk lists are previewed apart, best rated first', async () => {
  renderRouter(routes, { initialUrl: '/short/amsterdam' });
  const community = await screen.findByTestId('walklists-community');
  expect(await within(community).findByText('Historic Amsterdam')).toBeOnTheScreen();
  expect(within(community).queryByText('Amsterdam highlights')).toBeNull();
  const official = screen.getByTestId('walklists-official');
  expect(await within(official).findByText('Amsterdam highlights')).toBeOnTheScreen();
  expect(within(official).getByText('by Travelist')).toBeOnTheScreen();
  // One small request per section, not the whole city.
  expect(FakeHubRpc.walklistCalls).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ p_official: false, p_sort: 'top', p_limit: 7 }),
      expect.objectContaining({ p_official: true, p_sort: 'top', p_limit: 7 }),
    ]),
  );
});

test('empty sections say so without hiding the rest of the page', async () => {
  FakeHubRpc.community = [];
  FakeHubRpc.official = [];
  renderRouter(routes, { initialUrl: '/short/amsterdam' });
  expect(await screen.findByText('No public walk lists yet')).toBeOnTheScreen();
  expect(await screen.findByText('No official walk lists yet')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'View all walk lists' })).toBeNull();
  expect(screen.getByText('Reviews')).toBeOnTheScreen();
  expect(screen.getByText('Rate this city')).toBeOnTheScreen();
});

test('View all walk lists opens the full list of the city, searchable by name', async () => {
  const app = renderRouter(routes, { initialUrl: '/short/amsterdam' });
  await userEvent.press(await screen.findByRole('button', { name: 'View all walk lists' }));
  expect(app.getPathname()).toBe('/short/amsterdam/walklists');
  expect(await screen.findByText('Community walk lists in Amsterdam')).toBeOnTheScreen();
  expect(await screen.findByText('Canal walk')).toBeOnTheScreen();

  fireEvent.changeText(screen.getByTestId('walklist-search'), 'canal');
  await waitFor(() =>
    expect(FakeHubRpc.walklistCalls.at(-1)).toMatchObject({
      p_city_slug: 'amsterdam',
      p_official: false,
      p_search: 'canal',
    }),
  );
  // The city page stays mounted under this one; look only at the full list.
  const grid = screen.getByTestId('walklist-grid');
  await waitFor(() => expect(within(grid).queryByText('Historic Amsterdam')).toBeNull());
  expect(await within(grid).findByText('Canal walk')).toBeOnTheScreen();
});

test('the full list sorts by rating, lowest first on demand', async () => {
  renderRouter(routes, { initialUrl: '/short/amsterdam/walklists' });
  expect(await screen.findByText('Canal walk')).toBeOnTheScreen();
  expect(FakeHubRpc.walklistCalls.at(-1)).toMatchObject({ p_sort: 'top' });
  await userEvent.press(screen.getByRole('radio', { name: 'Lowest rated' }));
  await waitFor(() => expect(FakeHubRpc.walklistCalls.at(-1)).toMatchObject({ p_sort: 'lowest' }));
});

test('a search without matches says so', async () => {
  renderRouter(routes, { initialUrl: '/short/amsterdam/walklists' });
  fireEvent.changeText(await screen.findByTestId('walklist-search'), 'zzz');
  expect(await screen.findByText('No walk lists match your search.')).toBeOnTheScreen();
});

test('an unknown city shows a way back to the Home', async () => {
  const app = renderRouter(routes, { initialUrl: '/short/atlantis' });
  expect(await screen.findByText('City not found')).toBeOnTheScreen();
  await userEvent.press(screen.getByRole('button', { name: 'See all destinations' }));
  expect(app.getPathname()).toBe('/');
});
