import { StyleSheet, type ViewProps } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export type CardProps = ViewProps & {
  padded?: boolean;
};

export function Card({ style, padded = true, ...otherProps }: CardProps) {
  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, padded && styles.padded, style]}
      {...otherProps}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    alignSelf: 'stretch',
  },
  padded: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
});
