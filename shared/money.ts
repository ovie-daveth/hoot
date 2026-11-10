import { z } from 'zod';

export const MoneyMinor = z.number().int().gte(0);
export type MoneyMinor = z.infer<typeof MoneyMinor>;

export const COMMISSION_RATE_BPS_DEFAULT = 500;

export const BPS_DENOMINATOR = 10_000;

export type SignedMoneyMinor = number;

export function assertMoneyInteger(value: number, label = 'amount'): asserts value is MoneyMinor {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer number of minor units`);
  }
}

export function assertRateBps(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > BPS_DENOMINATOR) {
    throw new Error(`rateBps must be an integer between 1 and ${BPS_DENOMINATOR}`);
  }
}

export function addMoney(...amounts: MoneyMinor[]): MoneyMinor {
  return amounts.reduce((total, next) => {
    assertMoneyInteger(next);
    return total + next;
  }, 0);
}

export function subtractMoney(a: MoneyMinor, b: MoneyMinor): SignedMoneyMinor {
  assertMoneyInteger(a);
  assertMoneyInteger(b);
  return a - b;
}

export function calculatePlatformCommission(
  grossMinor: MoneyMinor,
  rateBps: number = COMMISSION_RATE_BPS_DEFAULT,
): MoneyMinor {
  assertMoneyInteger(grossMinor, 'grossMinor');
  assertRateBps(rateBps);
  return Math.floor((grossMinor * rateBps) / BPS_DENOMINATOR);
}

export function majorToMinor(major: number): MoneyMinor {
  const minor = Math.round(major * 100);
  assertMoneyInteger(minor, 'major');
  return minor;
}

export function minorToMajor(minor: MoneyMinor): number {
  return minor / 100;
}

export function bpsToPercentLabel(rateBps: number): string {
  assertRateBps(rateBps);
  const percent = (rateBps / 100).toString();
  return `${percent}%`;
}

export function formatMoney(minor: MoneyMinor, currency: 'NGN' = 'NGN'): string {
  assertMoneyInteger(minor);
  const major = minorToMajor(minor);
  let formatted: string;
  try {
    formatted = new Intl.NumberFormat(currency === 'NGN' ? 'en-NG' : 'en', {
      style: 'currency',
      currency,
    }).format(major);
  } catch {
    formatted = `${currency === 'NGN' ? '\u20A6' : currency} ${major.toFixed(2)}`;
  }
  return formatted;
}
