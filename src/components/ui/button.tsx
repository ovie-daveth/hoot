import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'secondary';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  variant?: ButtonVariant;
  loading?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
};

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  style,
  children,
  ...otherProps
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = Boolean(disabled) || loading;

  const resolveStyle = (state: PressableStateCallbackType): StyleProp<ViewStyle> => [
    styles.base,
    {
      backgroundColor: variant === 'primary' ? theme.text : theme.backgroundElement,
    },
    (isDisabled || state.pressed) && styles.dimmed,
    typeof style === 'function' ? style(state) : style,
  ];

  return (
    <Pressable disabled={isDisabled} style={resolveStyle} {...otherProps}>
      <Text
        style={[
          styles.label,
          { color: variant === 'primary' ? theme.background : theme.text },
        ]}>
        {children}
      </Text>
      {loading && (
        <ActivityIndicator
          style={styles.spinner}
          color={variant === 'primary' ? theme.background : theme.text}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 12,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  dimmed: {
    opacity: 0.8,
  },
  label: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 600,
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  spinner: {
    position: 'absolute',
  },
});
