import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventCard } from '@/components/event-card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useEvents } from '@/api/queries/events';
import { toApiError } from '@shared/errors';
import type { EventAdmission, EventFormat } from '@shared/contracts';

type QuickFilterKey = 'all' | 'thisWeek' | 'weekend' | 'free' | 'paid' | 'online' | 'inPerson';

const QUICK_FILTERS: { key: QuickFilterKey; label: string }[] = [
  { key: 'all', label: '✨ All' },
  { key: 'thisWeek', label: '🗓️ This week' },
  { key: 'weekend', label: '🌙 Weekend' },
  { key: 'free', label: '🎟️ Free' },
  { key: 'paid', label: '💳 Paid' },
  { key: 'online', label: '💻 Online' },
  { key: 'inPerson', label: '📍 In person' },
];

const CITY_EMOJI: Record<string, string> = {
  Lagos: '🌊',
  Abuja: '🏛️',
  Nairobi: '🏢',
  Accra: '🌴',
};

type EventFiltersInput = {
  query?: string;
  format?: EventFormat;
  admission?: EventAdmission;
  city?: string;
  when?: 'this_week' | 'weekend';
};

export default function DiscoverScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [quick, setQuick] = useState<QuickFilterKey>('all');
  const [city, setCity] = useState<string | null>(null);

  const filters: EventFiltersInput = useMemo(
    () => ({
      query: query.trim() ? query : undefined,
      format: quick === 'online' ? 'online' : quick === 'inPerson' ? 'offline' : undefined,
      admission: quick === 'free' ? 'free' : quick === 'paid' ? 'paid' : undefined,
      when: quick === 'thisWeek' ? 'this_week' : quick === 'weekend' ? 'weekend' : undefined,
      city: city ?? undefined,
    }),
    [query, quick, city],
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
            <ThemedView style={styles.filterRow}>
              {QUICK_FILTERS.map((option) => (
                <Chip
                  key={option.key}
                  label={option.label}
                  selected={quick === option.key}
                  onPress={() => setQuick(option.key)}
                />
              ))}
            </ThemedView>
            {cities.length > 0 ? (
              <ThemedView style={styles.citiesBlock}>
                <ThemedText type="smallBold">Cities</ThemedText>
                <ThemedView style={styles.cityRow}>
                  <CityCard
                    name="All cities"
                    selected={city === null}
                    onPress={() => setCity(null)}
                  />
                  {cities.map((name) => (
                    <CityCard
                      key={name}
                      name={name}
                      selected={city === name}
                      onPress={() => setCity((current) => (current === name ? null : name))}
                    />
                  ))}
                </ThemedView>
              </ThemedView>
            ) : null}
            <ThemedText type="smallBold">
              {eventsQuery.isLoading ? 'Loading events…' : `${events.length} events`}
            </ThemedText>
            {city ? (
              <ThemedText type="small" themeColor="textSecondary">
                Filtered to {city}
              </ThemedText>
            ) : null}
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
              body="Try other categories, another city, or clear your search."
            />
          );
        })()}
      />
    </SafeAreaView>
  );
}

function CityCard({
  name,
  selected,
  onPress,
}: {
  name: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const emoji = CITY_EMOJI[name] ?? (name === 'All cities' ? '🌍' : '📍');
  const isAllRow = name === 'All cities';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.cityPressed}>
      <ThemedView
        type="backgroundElement"
        style={[
          styles.cityCard,
          selected && { borderColor: theme.text, borderWidth: 2 },
        ]}>
        <ThemedView type="backgroundSelected" style={styles.cityEmojiBadge}>
          <ThemedText>{emoji}</ThemedText>
        </ThemedView>
        <ThemedText style={styles.cityName}>{name}</ThemedText>
        {isAllRow ? null : null}
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  citiesBlock: {
    gap: Spacing.two,
  },
  cityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  cityCard: {
    width: 168,
    height: 104,
    borderRadius: 16,
    padding: Spacing.three,
    justifyContent: 'space-between',
  },
  cityEmojiBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityName: {
    fontWeight: 600,
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
