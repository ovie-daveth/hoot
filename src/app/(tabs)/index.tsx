import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View, type ImageRequireSource } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useEvents } from '@/api/queries/events';
import { CreateEventFab } from '@/components/create-event-fab';
import { EventCard, coverArtFor } from '@/components/event-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Spacing } from '@/constants/theme';
import type { EventAdmission, EventFormat } from '@shared/contracts';
import { toApiError } from '@shared/errors';

type WhenFilter = 'any' | 'this_week' | 'weekend';
type AdmissionFilter = 'any' | 'free' | 'paid';
type FormatFilter = 'any' | 'online' | 'inPerson';

const WHEN_FILTERS: { key: WhenFilter; label: string }[] = [
  { key: 'any', label: '🗓️ Any time' },
  { key: 'this_week', label: 'weekday' },
  { key: 'weekend', label: '🌙 Weekend' },
];

const ADMISSION_FILTERS: { key: AdmissionFilter; label: string }[] = [
  { key: 'any', label: '🎟️ Any price' },
  { key: 'free', label: 'Free' },
  { key: 'paid', label: '💳 Paid' },
];

const FORMAT_FILTERS: { key: FormatFilter; label: string }[] = [
  { key: 'any', label: '📍 Any format' },
  { key: 'online', label: '💻 Online' },
  { key: 'inPerson', label: 'In person' },
];

const CITY_IMAGES: Record<string, ImageRequireSource> = {
  Lagos: require('@/assets/images/cities/lagos.png'),
  Abuja: require('@/assets/images/cities/abuja.png'),
  Nairobi: require('@/assets/images/cities/nairobi.png'),
};

export default function DiscoverScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [when, setWhen] = useState<WhenFilter>('any');
  const [admission, setAdmission] = useState<AdmissionFilter>('any');
  const [format, setFormat] = useState<FormatFilter>('any');
  const allClear = when === 'any' && admission === 'any' && format === 'any';

  const filters: { query?: string; format?: EventFormat; admission?: EventAdmission; when?: 'this_week' | 'weekend' } = useMemo(
    () => ({
      query: query.trim() ? query : undefined,
      format: format === 'online' ? 'online' : format === 'inPerson' ? 'offline' : undefined,
      admission: admission === 'any' ? undefined : admission,
      when: when === 'any' ? undefined : when,
    }),
    [query, when, admission, format],
  );

  const baseQuery = useEvents({});
  const eventsQuery = useEvents(filters);

  const cities = useMemo(() => {
    const seen = new Map<string, number>();
    for (const event of baseQuery.data ?? []) {
      const name = event.venue?.city;
      if (name && event.status === 'published') {
        seen.set(name, (seen.get(name) ?? 0) + 1);
      }
    }
    return [...seen.entries()].sort((left, right) => right[1] - left[1]).map(([name]) => name);
  }, [baseQuery.data]);

  const events = eventsQuery.data ?? [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        data={events}
        keyExtractor={(event) => event.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <ThemedView style={styles.header}>
            <ThemedText type="title">Discover</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Upcoming events across cities and formats
            </ThemedText>
            <Input
              placeholder="Search events"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              accessibilityLabel="Search events"
            />
            <ThemedText type="smallBold">Categories</ThemedText>
            <ThemedView style={styles.filterGroup}>
              {WHEN_FILTERS.map((option) => (
                <Chip
                  key={option.key}
                  label={option.label}
                  selected={when === option.key}
                  onPress={() => setWhen(option.key)}
                />
              ))}
            </ThemedView>
            <ThemedView style={styles.filterGroup}>
              {ADMISSION_FILTERS.map((option) => (
                <Chip
                  key={option.key}
                  label={option.label}
                  selected={admission === option.key}
                  onPress={() => setAdmission(option.key)}
                />
              ))}
            </ThemedView>
            <ThemedView style={styles.filterGroup}>
              {FORMAT_FILTERS.map((option) => (
                <Chip
                  key={option.key}
                  label={option.label}
                  selected={format === option.key}
                  onPress={() => setFormat(option.key)}
                />
              ))}
              {!allClear ? (
                <Chip
                  label="✕ Clear all"
                  onPress={() => {
                    setWhen('any');
                    setAdmission('any');
                    setFormat('any');
                  }}
                />
              ) : null}
            </ThemedView>
            {cities.length > 0 ? (
              <ThemedView style={styles.citiesBlock}>
                <ThemedText type="smallBold">Cities</ThemedText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.cityRow}>
                  {cities.map((name) => (
                    <CityCard
                      key={name}
                      name={name}
                      onPress={() =>
                        router.push({ pathname: '/city/[name]', params: { name } })
                      }
                    />
                  ))}
                </ScrollView>
              </ThemedView>
            ) : null}
            <ThemedText type="smallBold">
              {eventsQuery.isLoading ? 'Loading events…' : `${events.length} events`}
            </ThemedText>
          </ThemedView>
        }
        renderItem={({ item }) => (
          <EventCard
            event={item}
            onPress={() => router.push({ pathname: '/event/[slug]', params: { slug: item.slug } })}
          />
        )}
        ListEmptyComponent={(() => {
          if (eventsQuery.isLoading) {
            return <LoadingState label="Loading events" />;
          }
          if (eventsQuery.isError) {
            return (
              <ErrorState
                title="Could not load events"
                message={toApiError(eventsQuery.error).message}
                onRetry={() => void eventsQuery.refetch()}
                retrying={eventsQuery.isRefetching}
              />
            );
          }
          return (
            <EmptyState
              title="No events found"
              body="Try other categories, or clear your search."
            />
          );
        })()}
      />
      <CreateEventFab />
    </SafeAreaView>
  );
}

function CityCard({ name, onPress }: { name: string; onPress: () => void }) {
  const source = CITY_IMAGES[name];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.cityPressable, pressed && styles.cityPressed]}>
      <View style={styles.cityCard}>
        {source ? (
          <Image source={source} style={styles.cityImage} contentFit="cover" />
        ) : (
          <Image source={coverArtFor(`city:${name}`)} style={styles.cityImage} contentFit="cover" />
        )}
        <ThemedText style={styles.cityName}>{name}</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    gap: Spacing.three,
    paddingTop: Spacing.three,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  filterGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  citiesBlock: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  cityRow: {
    gap: Spacing.two,
    paddingRight: Spacing.four,
    alignItems: 'center',
  },
  cityPressable: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  cityCard: {
    width: 108,
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  cityImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  cityName: {
    position: 'relative',
    zIndex: 1,
    fontWeight: 700,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  cityPressed: {
    opacity: 0.85,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
});
