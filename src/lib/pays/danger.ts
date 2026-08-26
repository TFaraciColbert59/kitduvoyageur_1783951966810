import type { Country } from '@/lib/countries';

/**
 * Sémantique niveau de danger — valeurs Liquid Glass officielles (standard Mon Matériel).
 * Source unique : ne PAS dupliquer ces couleurs ailleurs.
 */
export const DANGER_META: Record<Country['danger_level'], { label: string; bg: string; text: string }> = {
  low: { label: '🟢 Sûr', bg: 'rgba(91,127,85,0.14)', text: '#486944' },
  medium: { label: '🟡 Vigilance', bg: 'rgba(200,154,59,0.16)', text: '#8C6418' },
  high: { label: '🔴 Risqué', bg: 'rgba(168,68,58,0.16)', text: '#8A241B' },
};

/** Couleurs de remplissage globe par niveau de danger (caps nettes sur texture sombre). */
export const DANGER_FILL: Record<Country['danger_level'], string> = {
  low: '#5B7F55',
  medium: '#C89A3B',
  high: '#A8443A',
};

export const DANGER_CAP: Record<Country['danger_level'], string> = {
  low: 'rgba(91,127,85,0.50)',
  medium: 'rgba(200,154,59,0.50)',
  high: 'rgba(168,68,58,0.55)',
};

export const DANGER_SIDE: Record<Country['danger_level'], string> = {
  low: 'rgba(91,127,85,0.28)',
  medium: 'rgba(200,154,59,0.28)',
  high: 'rgba(168,68,58,0.28)',
};