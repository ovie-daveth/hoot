import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventCard } from '@/components/event-card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useEvents } from '@/api/queries/events';
import { toApiError } from '@shared/errors';
import type { EventAdmission, EventFormat } from '@shared/contracts';

const FORMAT_FILTERS: { key: EventFormat | null; label: string }[] = [
  { key: null, label: 'Any format' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'In person' },
];

const ADMISSION_FILTERS: { key: EventAdmission | null; label: string }[] = [
  { key: null, label: 'Any price' },
  { key: 'free', label: 'Free' },
  { key: 'paid', label: 'Paid' },
];

export default function DiscoverScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState<EventFormat | null>(null);
  const [admission, setAdmission] = useState<EventAdmission | null>(null);
  const eventsQuery = useEvents({ query, format: format ?? undefined, admission: admission ?? undefined });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ThemedView style={styles.header}>
        <ThemedText type="subtitle">Discover</ThemedText>
        <Input
          placeholder="Search events"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          accessibilityLabel="Search events"
        />
        <ThemedView style={styles.filterRow}>
          {FORMAT_FILTERS.map((option) => (
            <Chip
              key={option.label}
              label={option.label}
              selected={format === option.key}
              onPress={() => setFormat(option.key)}
            />
          ))}
        </ThemedView>
        <ThemedView style={styles.filterRow}>
          {ADMISSION_FILTERS.map((option) => (
            <Chip
              key={option.label}
              label={option.label}
              selected={admission === option.key}
              onPress={() => setAdmission(option.key)}
            />
          ))}
        </ThemedView>
      </ThemedView>

      {eventsQuery.isLoading ? (
        <LoadingState label="Loading events" />
      ) : eventsQuery.isError ? (
        <ErrorState
          message={toApiError(eventsQuery.error).message}
          onRetry={() => void eventsQuery.refetch()}
          retrying={eventsQuery.isRefetching}
        />
      ) : eventsQuery.data && eventsQuery.data.length === 0 ? (
        <EmptyState title="No events found" body="Try different keywords or filters." />
      ) : (
        <FlatList
          data={eventsQuery.data ?? []}
          keyExtractor={(event) => event.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              onPress={() =>
                router.push({ pathname: '/event/[slug]', params: { slug: item.slug } })
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  subtitle: {
    marginBottom: Spacing.two,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
});
