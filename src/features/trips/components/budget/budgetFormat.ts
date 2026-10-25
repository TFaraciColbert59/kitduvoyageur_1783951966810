export const BUDGET_CATEGORY_OPTIONS = [
  'hébergement',
  'nourriture',
  'transport',
  'activités',
  'matériel',
  'divers',
];

export const MONTHS_FR = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

export function formatDayLabel(date: string | null): string {
  if (!date) return 'Sans date';
  const [, m, d] = date.split('-');
  return `${Number(d)} ${MONTHS_FR[Number(m) - 1] ?? ''}`;
}
