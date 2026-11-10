import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function StepDots({ current, total, label }: { current: number; total: number; label: string }) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container} accessibilityLabel={`Step ${current} of ${total}: ${label}`}>
      <View style={styles.dotRow}>
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              { backgroundColor: index < current ? theme.text : theme.backgroundSelected },
              index + 1 === current && styles.activeDot,
            ]}
          />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Step {current} of {total} · {label}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  dotRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  dot: {
    height: 4,
    flex: 1,
    borderRadius: 999,
  },
  activeDot: {
    height: 6,
  },
});
