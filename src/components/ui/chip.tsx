import { Pressable, StyleSheet, Text, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ChipProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  selected?: boolean;
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
};

export function Chip({ label, selected = false, disabled, style, ...otherProps }: ChipProps) {
  const theme = useTheme();
  const isMuted = Boolean(disabled);

  const resolveStyle = (state: PressableStateCallbackType): StyleProp<ViewStyle> => [
    styles.chip,
    {
      backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
    },
    (state.pressed || isMuted) && styles.dimmed,
    typeof style === 'function' ? style(state) : style,
  ];

  return (
    <Pressable disabled={disabled} style={resolveStyle} {...otherProps}>
      <Text style={[styles.label, { color: selected ? theme.text : theme.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  dimmed: {
    opacity: 0.75,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
});
