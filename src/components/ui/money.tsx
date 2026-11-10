import { StyleSheet, type TextProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { formatMoney } from '@shared/money';

export type MoneyProps = TextProps & {
  minor: number;
  currency?: 'NGN';
  type?: 'default' | 'title' | 'subtitle' | 'small' | 'smallBold';
  freeLabel?: string;
};

export function Money({ minor, currency = 'NGN', type = 'default', freeLabel = 'Free', style, ...otherProps }: MoneyProps) {
  return (
    <ThemedText
      type={type}
      style={[styles.inherit, style]}
      {...otherProps}>
      {minor === 0 ? freeLabel : formatMoney(minor, currency)}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  inherit: {},
});
