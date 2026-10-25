import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Sun,
  type LucideIcon,
} from 'lucide-react';

/**
 * Hub V5e — Util partagé WMO → icône lucide (source unique ; remplace les
 * copies locales de DepartWeather/DepartHeader). Codes WMO :
 * 0 dégagé · 1-3 peu/portion nuageux · 45-48 brume · 51-67 pluie ·
 * 71-77 neige · 80-82 averses · 95+ orage.
 */
export function getWeatherIcon(code: number): LucideIcon {
  if (code === 0) return Sun;
  if (code <= 3) return CloudSun;
  if (code <= 48) return CloudFog;
  if (code <= 57) return CloudDrizzle;
  if (code <= 67) return CloudRain;
  if (code <= 77) return CloudSnow;
  if (code <= 82) return CloudRainWind;
  return CloudLightning;
}

/** Fallback neutre (jamais null côté affichage). */
export const WEATHER_FALLBACK_ICON: LucideIcon = Cloud;
