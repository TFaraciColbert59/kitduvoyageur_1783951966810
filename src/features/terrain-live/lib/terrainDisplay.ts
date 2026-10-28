import type {
  TerrainPassability,
  TerrainReportCategory,
  TerrainReportPublic,
  TerrainSeverity,
} from '@/features/adventure-intelligence/schemas/live.schema';
import type { LKDVIconName } from '@/components/ui/LKDVIcon';

/** Signalement public enrichi de sa distance au point de recherche. */
export interface TerrainLiveReport extends TerrainReportPublic {
  distanceM: number;
}

export interface TerrainDisplayInfo {
  label: string;
  icon: LKDVIconName;
}

/** Libellés français des 6 catégories MVP (Phase 5). */
export const MVP_CATEGORY_DISPLAY: Record<string, TerrainDisplayInfo> = {
  obstacle: { label: 'Obstacle', icon: 'alerte' },
  closure: { label: 'Chemin fermé', icon: 'annuler' },
  mud: { label: 'Boue', icon: 'eau_potable' },
  snow_ice: { label: 'Neige / glace', icon: 'neige' },
  water: { label: 'Eau', icon: 'eau_potable' },
  danger: { label: 'Danger', icon: 'danger' },
};

/** Libellés français des catégories étendues (schéma complet A1). */
export const EXTENDED_CATEGORY_DISPLAY: Record<string, TerrainDisplayInfo> = {
  bridge: { label: 'Pont', icon: 'itineraire' },
  flood: { label: 'Crue', icon: 'eau_potable' },
  marking: { label: 'Balisage', icon: 'point_interet' },
  shelter: { label: 'Refuge', icon: 'accueil' },
  crowding: { label: 'Affluence', icon: 'communaute' },
  animal: { label: 'Animal', icon: 'alerte' },
  rockfall: { label: 'Chutes de pierres', icon: 'montagne' },
};

export const MVP_TERRAIN_CATEGORIES: TerrainReportCategory[] = [
  'obstacle',
  'closure',
  'mud',
  'snow_ice',
  'water',
  'danger',
];

export function categoryDisplay(category: TerrainReportCategory): TerrainDisplayInfo {
  return (
    MVP_CATEGORY_DISPLAY[category] ??
    EXTENDED_CATEGORY_DISPLAY[category] ?? { label: category, icon: 'informations' }
  );
}

export const SEVERITY_LABELS: Record<TerrainSeverity, string> = {
  info: 'Info',
  warning: 'Attention',
  critical: 'Critique',
};

export const PASSABILITY_LABELS: Record<TerrainPassability, string> = {
  passable: 'Passable',
  difficult: 'Difficile',
  impassable: 'Impassable',
  unknown: 'Inconnu',
};

/** Couleurs calmées, hors palette orange (interdite par le design system). */
export const SEVERITY_COLORS: Record<TerrainSeverity, string> = {
  info: '#334155',
  warning: '#8A6D1F',
  critical: '#7A2E2E',
};

/** Âge relatif compact en français : « il y a 18 min », « il y a 2 h », « il y a 3 j ». */
export function relativeAgeFr(iso: string, now: Date = new Date()): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const minutes = Math.max(0, Math.round((now.getTime() - then) / 60000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} j`;
}
