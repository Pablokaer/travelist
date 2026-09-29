import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { City } from '@/features/destinations/api';
import { ExploreHeader, INLINE_HEADER_MIN_WIDTH } from '@/features/destinations/explore-header';
import '@/lib/i18n';

const amsterdam: City = {
  slug: 'amsterdam',
  nameEn: 'Amsterdam',
  namePt: 'Amesterdão',
  countryCode: 'NL',
  lat: 52.37,
  lng: 4.9,
  bbox: [52.3, 4.8, 52.4, 5.0],
  timezone: 'Europe/Amsterdam',
  attractionCount: 269,
};
const GUTTER = 32;

function renderHeader() {
  const onOpenChecklist = jest.fn();
  render(
    <ExploreHeader
      cities={[amsterdam]}
      city={amsterdam}
      onSelectCity={jest.fn()}
      search={<Text>search field</Text>}
      categories={[]}
      onToggleCategory={jest.fn()}
      onClearCategories={jest.fn()}
      onOpenChecklist={onOpenChecklist}
      container={{ paddingHorizontal: GUTTER }}
      gutter={GUTTER}
    />,
  );
  return { onOpenChecklist };
}

/** Simulates the header container being laid out with `contentWidth` px inside the gutters. */
function layoutHeader(contentWidth: number) {
  fireEvent(screen.getByTestId('explore-header-container'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, height: 64, width: contentWidth + 2 * GUTTER } },
  });
}

describe('ExploreHeader', () => {
  // Jest's default window (750 px) is a tablet for useBreakpoint.
  test('stacks city + search under the logo row when the content is narrow', () => {
    renderHeader();
    layoutHeader(INLINE_HEADER_MIN_WIDTH - 1);
    expect(screen.getByTestId('explore-header-stacked')).toBeOnTheScreen();
    expect(screen.queryByTestId('explore-header-inline')).toBeNull();
  });

  test('puts logo, city + search and the action in one row when they fit', () => {
    renderHeader();
    layoutHeader(INLINE_HEADER_MIN_WIDTH);
    expect(screen.getByTestId('explore-header-inline')).toBeOnTheScreen();
    expect(screen.getByText('Wayfarer')).toBeOnTheScreen();
    expect(screen.getByText('search field')).toBeOnTheScreen();
  });

  test('keeps the checklist action and the category tabs', async () => {
    const { onOpenChecklist } = renderHeader();
    await userEvent.press(screen.getByTestId('open-checklist'));
    expect(onOpenChecklist).toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'All' })).toBeChecked();
  });
});
