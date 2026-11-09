import type { ExploreIconName } from './ExploreIcons';

/**
 * Icône de la pastille météo (FID-071) — mêmes familles que la maquette
 * (`WXS` : sun / partly / cloud / rain / snow, `maquette-communaute.html`
 * L1071 `ic(s.w,'s')`). Le libellé vient de la donnée (`DayWeather.label`,
 * dérivé du code WMO) : on ne devine jamais l'état, on choisit seulement le
 * pictogramme qui lui correspond.
 */
export function weatherIconName(label: string | null | undefined): ExploreIconName {
  const value = (label ?? '').toLowerCase();
  if (value.includes('neige') || value.includes('fondue')) return 'snow';
  if (value.includes('orage') || value.includes('pluie') || value.includes('averse')) return 'rain';
  if (value.includes('ensoleill')) return 'sun';
  if (value.includes('claircie')) return 'partly';
  return 'cloud';
}

export default weatherIconName;
