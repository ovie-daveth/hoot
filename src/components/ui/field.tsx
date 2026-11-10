import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

export type FieldProps = PropsWithChildren & {
  label: string;
  error?: string | null;
  hint?: string | null;
};

export function Field({ label, error, hint, children }: FieldProps) {
  return (
    <View>
      <ThemedText type="smallBold">{label}</ThemedText>
      {hint && (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      )}
      <View style={styles.control}>{children}</View>
      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  control: {
    marginTop: 4,
    marginBottom: 8,
  },
});
