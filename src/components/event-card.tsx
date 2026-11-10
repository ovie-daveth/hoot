import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatEventStart } from '@/lib/datetime';
import type { PublicEvent } from '@shared/contracts';

export type EventCardProps = {
  event: PublicEvent;
  onPress?: () => void;
};

export function EventCard({ event, onPress }: EventCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <EventCover title={event.title} imageUrl={event.coverImageUrl ?? null} />
        <ThemedView type="backgroundElement" style={styles.body}>
          <ThemedText style={styles.title}>{event.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatEventStart(event.startsAt, event.timezone)}
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.chipRow}>
            <Chip label={event.format === 'online' ? 'Online' : 'In person'} />
            <Chip label={event.admission === 'free' ? 'Free' : 'Paid'} />
          </ThemedView>
        </ThemedView>
      </ThemedView>
    </Pressable>
  );
}

export function EventCover({ title, imageUrl }: { title: string; imageUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !failed;

  if (showImage) {
    return (
      <Image
        source={{ uri: imageUrl as string }}
        style={styles.cover}
        contentFit="cover"
        onError={() => setFailed(true)}
        transition={200}
      />
    );
  }
  const monogram = title
    .split(' ')
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase())
    .join('');
  return (
    <ThemedView
      type="backgroundSelected"
      style={[styles.cover, styles.monogram]}>
      <ThemedText type="subtitle" themeColor="textSecondary">
        {monogram || '•'}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  monogram: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontWeight: 600,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
