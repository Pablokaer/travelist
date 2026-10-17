import type { i18n as I18nInstance } from 'i18next';
import { useMemo, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { FeatureStrip } from './feature-strip';
import { FinalCta } from './final-cta';
import { HeroSection } from './hero-section';
import { HowItWorks } from './how-it-works';
import { LANDING_HEADER_HEIGHT, LandingHeader } from './landing-header';
import { LandingFooter } from './landing-footer';
import { landingLayout, type LandingLayout } from './layout';
import { PopularDestinations } from './popular-destinations';
import { sectionScrollY, type LandingSection, type SectionOffsets } from './sections';

import { useCities, type City } from '@/features/destinations/api';
import { useTheme } from '@/theme/use-theme';

/** Cities and countries Travelist covers, for the hero's eyebrow; null until loaded. */
function coverageOf(cities: City[] | undefined) {
  if (!cities?.length) return null;
  return { cities: cities.length, countries: new Set(cities.map((c) => c.countryCode)).size };
}

/**
 * Scrolls the page to its sections. Each is measured when a link is pressed, not on layout:
 * on the web a section that only moves (the hero's eyebrow arrives with the city list) does
 * not lay out again, so a stored offset would go stale.
 */
function useSectionScroll() {
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const sectionRefs = useRef<Partial<Record<LandingSection, View | null>>>({});
  const sectionRef = (section: LandingSection) => (node: View | null) => {
    sectionRefs.current[section] = node;
  };
  const scrollTo = (section: LandingSection) => {
    const node = sectionRefs.current[section];
    if (!node || !contentRef.current) return;
    node.measureLayout(contentRef.current, (_x, y) => {
      // The content starts below the header bar, which the section must clear.
      const offsets: SectionOffsets = { [section]: y + LANDING_HEADER_HEIGHT };
      const top = sectionScrollY(offsets, section, LANDING_HEADER_HEIGHT);
      if (top != null) scrollRef.current?.scrollTo({ y: top, animated: true });
    });
  };
  const scrollTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });
  return { scrollRef, contentRef, sectionRef, scrollTo, scrollTop };
}

/** Whether the page has left the top, so the sticky header can lift off it. */
function useScrolledPastTop() {
  const [scrolled, setScrolled] = useState(false);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setScrolled(e.nativeEvent.contentOffset.y > 8);
  return { scrolled, onScroll };
}

type SectionsProps = {
  layout: LandingLayout;
  width: number;
  sectionRef: (section: LandingSection) => (node: View | null) => void;
  scrollTo: (section: LandingSection) => void;
};

function SectionGap({ layout }: { layout: LandingLayout }) {
  return <View style={{ height: layout.sectionGap }} />;
}

/** Hero, features and destinations: what Travelist is, then the real cities it covers. */
function OpeningSections({ layout, width, sectionRef, scrollTo }: SectionsProps) {
  const cities = useCities();
  const counts = useMemo(() => coverageOf(cities.data), [cities.data]);
  return (
    <>
      <HeroSection layout={layout} counts={counts} onSeeHow={() => scrollTo('how')} />
      <View ref={sectionRef('features')} style={styles.features}>
        <FeatureStrip layout={layout} width={width} />
      </View>
      <SectionGap layout={layout} />
      <View ref={sectionRef('destinations')}>
        <PopularDestinations
          layout={layout}
          width={width}
          cities={cities.data ?? null}
          failed={cities.isError}
        />
      </View>
    </>
  );
}

/** How it works, the last call to sign up and the footer. */
function ClosingSections({ layout, width, sectionRef, scrollTo }: SectionsProps) {
  return (
    <>
      <SectionGap layout={layout} />
      <View ref={sectionRef('how')}>
        <HowItWorks layout={layout} width={width} />
      </View>
      <SectionGap layout={layout} />
      <FinalCta layout={layout} />
      <SectionGap layout={layout} />
      <LandingFooter layout={layout} onNavigate={scrollTo} />
    </>
  );
}

/** The scrolling page: the sticky header, then every section it links to. */
function LandingScroll() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const layout = landingLayout(width);
  const { scrollRef, contentRef, sectionRef, scrollTo, scrollTop } = useSectionScroll();
  const { scrolled, onScroll } = useScrolledPastTop();
  const sections = { layout, width, sectionRef, scrollTo };
  return (
    <ScrollView
      ref={scrollRef}
      stickyHeaderIndices={[0]}
      onScroll={onScroll}
      scrollEventThrottle={32}
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.page}>
      <LandingHeader layout={layout} elevated={scrolled} onNavigate={scrollTo} onHome={scrollTop} />
      <View ref={contentRef}>
        <OpeningSections {...sections} />
        <ClosingSections {...sections} />
      </View>
    </ScrollView>
  );
}

/**
 * The landing page (D-072): what Travelist does, the app itself, real destinations, and the
 * way to sign up or in. Its text comes from `i18n`, which the route pins to English (D-077)
 * so the page never follows the app language.
 * @example <LandingPage i18n={landingI18n()} />
 */
export function LandingPage({ i18n }: { i18n: I18nInstance }) {
  return (
    <I18nextProvider i18n={i18n}>
      <LandingScroll />
    </I18nextProvider>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1 },
  features: { paddingTop: 8 },
});
