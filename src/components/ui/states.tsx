import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, type ViewProps } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type EmptyStateProps = ViewProps & {
  title: string;
  body?: string;
  action?: ReactNode;
};

export function EmptyState({ title, body, action, style, ...otherProps }: EmptyStateProps) {
  return (
    <ThemedView style={[statesStyles.container, style]} {...otherProps}>
      <ThemedText type="subtitle">{title}</ThemedText>
      {body ? (
        <ThemedText themeColor="textSecondary" style={statesStyles.center}>
          {body}
        </ThemedText>
      ) : null}
      {action}
    </ThemedView>
  );
}

export type LoadingStateProps = ViewProps & {
  label?: string;
};

export function LoadingState({ label, style, ...otherProps }: LoadingStateProps) {
  const theme = useTheme();
  return (
    <ThemedView style={[statesStyles.container, style]} {...otherProps}>
      <ActivityIndicator color={theme.textSecondary} />
      {label ? (
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

export type ErrorStateProps = ViewProps & {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
};

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retrying,
  style,
  ...otherProps
}: ErrorStateProps) {
  return (
    <ThemedView style={[statesStyles.container, style]} {...otherProps}>
      <ThemedText type="subtitle">{title}</ThemedText>
      {message ? (
        <ThemedText themeColor="textSecondary" style={statesStyles.center}>
          {message}
        </ThemedText>
      ) : null}
      {onRetry ? (
        <Button variant="secondary" onPress={onRetry} loading={retrying} style={statesStyles.retry}>
          Try again
        </Button>
      ) : null}
    </ThemedView>
  );
}

const statesStyles = StyleSheet.create({
  container: {
    gap: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    borderRadius: 12,
  },
  center: {
    textAlign: 'center',
  },
  retry: {
    alignSelf: 'stretch',
    borderRadius: 12,
  },
});
