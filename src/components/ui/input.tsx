import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type InputProps = TextInputProps & {
  multiline?: boolean;
};

export function Input({ style, multiline, ...otherProps }: InputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      style={[
        styles.input,
        {
          color: theme.text,
          backgroundColor: theme.backgroundElement,
          borderColor: theme.backgroundSelected,
        },
        multiline && styles.multiline,
        style,
      ]}
      multiline={multiline}
      {...otherProps}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    fontSize: 16,
    lineHeight: 24,
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
});
