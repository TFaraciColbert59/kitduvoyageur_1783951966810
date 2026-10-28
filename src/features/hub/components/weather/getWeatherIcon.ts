
import { lkdvIcon, type LKDVIconComponent } from '@/components/ui/lkdvIconComponent';

/**
 * Hub V5e — Util partagé WMO → icône lucide (source unique ; remplace les
 * copies locales de DepartWeather/DepartHeader). Codes WMO :
 * 0 dégagé · 1-3 peu/portion nuageux · 45-48 brume · 51-67 pluie ·
 * 71-77 neige · 80-82 averses · 95+ orage.
 */
export function getWeatherIcon(code: number): LKDVIconComponent {
  if (code === 0) return lkdvIcon('soleil');
  if (code <= 3) return lkdvIcon('meteo');
  if (code <= 48) return lkdvIcon('meteo');
  if (code <= 57) return lkdvIcon('pluie');
  if (code <= 67) return lkdvIcon('pluie');
  if (code <= 77) return lkdvIcon('neige');
  if (code <= 82) return lkdvIcon('pluie');
  return lkdvIcon('meteo_extreme');
}

/** Fallback neutre (jamais null côté affichage). */
export const WEATHER_FALLBACK_ICON: LKDVIconComponent = lkdvIcon('meteo');
