import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { FEATURES, parseFeatureFlags, useFeatures } from '@/lib/features';
import { featuresWrapper } from '@/testing/features';

function FlagsProbe() {
  const flags = useFeatures();
  return <Text testID="flags">{JSON.stringify(flags)}</Text>;
}

describe('feature flags (D-065)', () => {
  test('a build without the variables ships with the walk chat and paid plans hidden', () => {
    expect(parseFeatureFlags({ walkChat: undefined, paidPlans: undefined })).toEqual({
      walkChat: false,
      paidPlans: false,
    });
    expect(parseFeatureFlags({ walkChat: '', paidPlans: ' ' })).toEqual({
      walkChat: false,
      paidPlans: false,
    });
  });

  test('"true" or "1" turns a feature on; "false" or "0" keeps it off', () => {
    expect(parseFeatureFlags({ walkChat: 'true', paidPlans: '0' })).toEqual({
      walkChat: true,
      paidPlans: false,
    });
    expect(parseFeatureFlags({ walkChat: 'FALSE', paidPlans: '1' })).toEqual({
      walkChat: false,
      paidPlans: true,
    });
  });

  test('any other value is a configuration error naming the variable and the value', () => {
    expect(() => parseFeatureFlags({ walkChat: 'yes', paidPlans: undefined })).toThrow(
      /EXPO_PUBLIC_FEATURE_WALK_CHAT.*"yes".*true/,
    );
  });

  test('the app reads the build flags; tests (and previews) can inject others', () => {
    // The test environment sets no EXPO_PUBLIC_FEATURE_* variables: both hidden.
    expect(FEATURES).toEqual({ walkChat: false, paidPlans: false });
    const { unmount } = render(<FlagsProbe />);
    expect(screen.getByTestId('flags')).toHaveTextContent('{"walkChat":false,"paidPlans":false}');
    unmount();
    render(<FlagsProbe />, { wrapper: featuresWrapper({ walkChat: true }) });
    expect(screen.getByTestId('flags')).toHaveTextContent('{"walkChat":true,"paidPlans":false}');
  });
});
