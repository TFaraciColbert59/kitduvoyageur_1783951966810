import { BOOKING_STATE_LABELS, type BookingState, type MoneyValue } from '../types';

/** Formulation unique pour toute donnee absente : jamais de zero, jamais de tiret. */
export const A_VERIFIER = 'À vérifier';

export function stateLabel(state: BookingState): string {
  return BOOKING_STATE_LABELS[state];
}

export function formatEur(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const hasCents = Math.abs(rounded - Math.trunc(rounded)) > 0.004;
  const fixed = rounded.toFixed(2).replace('.', ',');
  const [units, cents] = fixed.split(',');
  const grouped = Number(units).toLocaleString('fr-FR');
  return hasCents ? `${grouped},${cents} €` : `${grouped} €`;
}

export function moneyLabel(money: MoneyValue): string {
  return money.amount === null ? A_VERIFIER : formatEur(money.amount);
}

export function formatMinutes(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return A_VERIFIER;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

export function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString('fr-FR')
    : value.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

/** Valeur formatée d'une mesure, ou la formulation « à vérifier ». */
export function withUnit(value: number | null, unit: string, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return A_VERIFIER;
  const rendered =
    digits === 0
      ? formatNumber(value)
      : value.toLocaleString('fr-FR', { maximumFractionDigits: digits });
  return `${rendered} ${unit}`;
}
