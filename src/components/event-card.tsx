import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatEventStart } from '@/lib/datetime';
import type { PublicEvent } from '@shared/contracts';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  type ImageRequireSource,
  type ImageStyle,
  type StyleProp,
} from 'react-native';

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
  const description = event.description.trim();
  const summary = description.length > 50 ? `${description.slice(0, 45)}…` : description;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView style={styles.card}>
        <EventCover slug={event.slug} title={event.title} imageUrl={event.coverImageUrl ?? null} />
        <ThemedView style={styles.body}>
          <ThemedView style={styles.details}>
            <ThemedText style={styles.title}>{event.title}</ThemedText>
               <ThemedView style={styles.badgeRow}>
            <ThemedView type="backgroundSelected" style={styles.badge}>
              <ThemedText style={styles.badgeLabel} type="small">
                {event.format === 'online' ? 'Online' : 'In person'}
              </ThemedText>
            </ThemedView>
            <ThemedView type="backgroundSelected" style={styles.badge}>
              <ThemedText style={styles.badgeLabel} type="small">
                {event.admission === 'free' ? 'Free' : 'Paid'}
              </ThemedText>
            </ThemedView>
          </ThemedView>
            <ThemedText style={styles.subtitle} type="small" themeColor="textSecondary">
              {formatEventStart(event.startsAt, event.timezone)}
            </ThemedText>
            {summary ? (
              <ThemedText style={styles.description} type="small" themeColor="textSecondary">
                {summary}
              </ThemedText>
            ) : null}
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
  style,
}: {
  slug: string;
  title: string;
  imageUrl: string | null;
  style?: StyleProp<ImageStyle>;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !failed;

  if (showImage) {
    return (
      <Image
        source={{ uri: imageUrl as string }}
        style={[styles.cover, style]}
        contentFit="cover"
        onError={() => setFailed(true)}
        transition={200}
      />
    );
  }
  return (
    <Image
      source={coverArtFor(slug || title)}
      style={[styles.cover, style]}
      contentFit="cover"
      accessibilityLabel={title}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.three,
  },
  pressed: {
    opacity: 0.85,
  },
  cover: {
    width: 96,
    height: 96,
    borderRadius: 12,
  },
  body: {
    flex: 1,
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  details: {
    gap: Spacing.one,
  },
  title: {
    fontWeight: 700,
    fontSize: 14,
    lineHeight: 16,
  },
  subtitle: {
    fontWeight: 300,
    fontSize: 12,
    lineHeight: 14,
    fontStyle: 'italic',
  },
  description: {
    fontWeight: 400,
    fontSize: 12,
    lineHeight: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: Spacing.two,
    marginVertical: Spacing.half,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  badgeLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: 600,
  },
});
