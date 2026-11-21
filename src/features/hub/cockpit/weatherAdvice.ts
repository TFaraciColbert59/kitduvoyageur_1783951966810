import type { CockpitWeatherDay } from './model';

export interface WeatherTerrainAlert {
  id: string;
  severity: 'info' | 'warning';
  title: string;
  detail: string;
  targetWidget: 'kit' | 'etapes';
  targetLabel: string;
}

export function deriveWeatherAlerts(day: CockpitWeatherDay | undefined): WeatherTerrainAlert[] {
  if (!day) return [];
  const alerts: WeatherTerrainAlert[] = [];

  if (day.wind != null && day.wind >= 50) {
    alerts.push({
      id: 'wind',
      severity: 'warning',
      title: `Vent fort annoncé (${Math.round(day.wind)} km/h)`,
      detail: 'Exposition accrue sur crêtes et cols. Vérifier coupe-vent et ancrage bivouac.',
      targetWidget: 'kit',
      targetLabel: 'Vérifier le kit',
    });
  }
  if (day.rain != null && day.rain >= 10) {
    alerts.push({
      id: 'rain',
      severity: 'warning',
      title: `Précipitations marquées (${day.rain.toFixed(1)} mm)`,
      detail: 'Terrain potentiellement glissant. Prévoir couche imperméable et protection du sac.',
      targetWidget: 'kit',
      targetLabel: 'Vérifier la protection pluie',
    });
  }
  if (day.low != null && day.low <= 0) {
    alerts.push({
      id: 'freeze',
      severity: 'warning',
      title: `Risque de gel (${Math.round(day.low)}°C)`,
      detail: 'Protéger l’eau et les batteries du froid. Adapter duvet et couche thermique.',
      targetWidget: 'kit',
      targetLabel: 'Vérifier l’isolation',
    });
  }
  if (day.high != null && day.high >= 32) {
    alerts.push({
      id: 'heat',
      severity: 'warning',
      title: `Forte chaleur (${Math.round(day.high)}°C)`,
      detail: 'Envisager un départ plus tôt et augmenter la réserve d’eau.',
      targetWidget: 'etapes',
      targetLabel: 'Voir les horaires d’étapes',
    });
  }
  return alerts;
}

export function weatherFreshnessLabel(observedAt?: string, nowMs = Date.now()): string | null {
  if (!observedAt) return null;
  const parsed = Date.parse(observedAt);
  if (!Number.isFinite(parsed)) return null;
  const diffMin = Math.max(0, Math.round((nowMs - parsed) / 60_000));
  if (diffMin < 5) return 'À jour (< 5 min)';
  if (diffMin < 60) return `Relevé il y a ${diffMin} min`;
  const hours = Math.round(diffMin / 60);
  if (hours < 24) return `Relevé il y a ${hours} h`;
  return `Données anciennes (${Math.round(hours / 24)} j)`;
}
