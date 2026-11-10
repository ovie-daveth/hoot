import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, type ImageRequireSource } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatEventStart } from '@/lib/datetime';
import type { PublicEvent } from '@shared/contracts';

const COVER_ART: ImageRequireSource[] = [
  require('@/assets/images/eventCovers/cover-aurora.png'),
  require('@/assets/images/eventCovers/cover-confetti.png'),
  require('@/assets/images/eventCovers/cover-waves.png'),
  require('@/assets/images/eventCovers/cover-orbs.png'),
  require('@/assets/images/eventCovers/cover-rings.png'),
  require('@/assets/images/eventCovers/cover-dune.png'),
];

export function coverArtFor(seedText: string): ImageRequireSource {  let h = 2166136261;
  for (const ch of seedText) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return COVER_ART[h % COVER_ART.length];
}

export type EventCardProps = {
  event: PublicEvent;
  onPress?: () => void;
};

export function EventCard({ event, onPress }: EventCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <EventCover slug={event.slug} title={event.title} imageUrl={event.coverImageUrl ?? null} />
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

export function EventCover({
  slug,
  title,
  imageUrl,
}: {
  slug: string;
  title: string;
  imageUrl: string | null;
}) {
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
  return (
    <Image
      source={coverArtFor(slug || title)}
      style={styles.cover}
      contentFit="cover"
      accessibilityLabel={title}
    />
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
