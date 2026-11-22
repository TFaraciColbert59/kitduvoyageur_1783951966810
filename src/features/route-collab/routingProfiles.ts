/**
 * Profils de routage de l'itinéraire (amélioration 5.1) : cinq choix pour tout le monde, deux réglages de
 * surface pour l'expert. Module pur : il ne fait que traduire un choix en `RouteSport` + `RouteRoutingOptions`,
 * les seules entrées que `/api/route` accepte (`sport`, `ebike`, `surfacePref`, `avoidSteps`, `avoidFerries`).
 *
 * Honnêteté sur ce que fait le routeur : « éviter les routes » et « préférer les sentiers » sont des
 * préférences souples de Valhalla (poids de coût, `use_roads` / `use_trails`), jamais une exclusion. Un
 * tronçon peut donc emprunter une route quand aucun sentier n'existe ; la page le dit.
 */
import {
  ebikeSupportedForSport,
  normalizeRoutingOptions,
  type RouteRoutingOptions,
  type RouteSport,
  type SurfacePreference,
} from '@/features/adventure-prep/routeProfiles';
import type { RouteOperationInput } from './types';

export type RouteProfileId = 'rando' | 'trail' | 'velo_route' | 'vtt' | 'gravel';

export interface RouteProfileChoice {
  readonly id: RouteProfileId;
  readonly label: string;
  readonly sport: RouteSport;
  /** Préférence de surface propre au profil (le trail préfère les sentiers). */
  readonly surfacePref: SurfacePreference;
  readonly hint: string;
}

export const ROUTE_PROFILE_CHOICES: readonly RouteProfileChoice[] = [
  { id: 'rando', label: 'Rando', sport: 'marche', surfacePref: 'balanced', hint: 'À pied, sentiers et chemins' },
  { id: 'trail', label: 'Trail', sport: 'marche', surfacePref: 'prefer_trails', hint: 'À pied, sentiers d’abord' },
  { id: 'velo_route', label: 'Vélo route', sport: 'route', surfacePref: 'balanced', hint: 'Routes revêtues' },
  { id: 'vtt', label: 'VTT', sport: 'vtt', surfacePref: 'balanced', hint: 'Sentiers et pistes' },
  { id: 'gravel', label: 'Gravel', sport: 'gravel', surfacePref: 'balanced', hint: 'Pistes et petites routes' },
];

/** Le profil qui correspond au sport et aux options du tracé (`null` : moto ou combinaison hors des cinq). */
export function activeProfileId(sport: RouteSport, options: RouteRoutingOptions | undefined): RouteProfileId | null {
  if (sport === 'marche') return options?.surfacePref === 'prefer_trails' ? 'trail' : 'rando';
  if (sport === 'route') return 'velo_route';
  if (sport === 'vtt') return 'vtt';
  if (sport === 'gravel') return 'gravel';
  return null;
}

export type SurfaceChoiceId = 'balanced' | 'avoid_roads' | 'prefer_trails' | 'prefer_paved';

export interface SurfaceChoice {
  readonly id: SurfaceChoiceId;
  readonly label: string;
  readonly pref: SurfacePreference;
}

/** Réglages de surface de la vue experte. « Éviter les routes » = `prefer_unpaved` côté routeur. */
export const SURFACE_CHOICES: readonly SurfaceChoice[] = [
  { id: 'balanced', label: 'Équilibré', pref: 'balanced' },
  { id: 'avoid_roads', label: 'Éviter les routes', pref: 'prefer_unpaved' },
  { id: 'prefer_trails', label: 'Préférer les sentiers', pref: 'prefer_trails' },
  { id: 'prefer_paved', label: 'Préférer le revêtu', pref: 'prefer_paved' },
];

export function surfaceChoiceOf(options: RouteRoutingOptions | undefined): SurfaceChoiceId {
  return SURFACE_CHOICES.find((c) => c.pref === (options?.surfacePref ?? 'balanced'))?.id ?? 'balanced';
}

/** Options normalisées après un changement de surface ou d'un indicateur. */
export function patchRoutingOptions(
  sport: RouteSport,
  current: RouteRoutingOptions | undefined,
  patch: Partial<{ surface: SurfaceChoiceId; avoidSteps: boolean; avoidFerries: boolean; ebike: boolean }>,
): RouteRoutingOptions {
  const surfacePref =
    patch.surface !== undefined
      ? (SURFACE_CHOICES.find((c) => c.id === patch.surface)?.pref ?? 'balanced')
      : (current?.surfacePref ?? 'balanced');
  return normalizeRoutingOptions(sport, {
    ebike: patch.ebike ?? current?.ebike,
    surfacePref,
    avoidSteps: patch.avoidSteps ?? current?.avoidSteps,
    avoidFerries: patch.avoidFerries ?? current?.avoidFerries,
  });
}

/**
 * L'opération qui applique un profil. Les indicateurs (marches, bacs, assistance électrique) sont gardés
 * quand le nouveau sport les supporte ; la surface repart de celle du profil.
 */
export function profileOperation(
  id: RouteProfileId,
  current: RouteRoutingOptions | undefined,
): Extract<RouteOperationInput, { type: 'set_sport_profile' }> {
  const choice = ROUTE_PROFILE_CHOICES.find((c) => c.id === id) ?? ROUTE_PROFILE_CHOICES[0];
  return {
    type: 'set_sport_profile',
    sport: choice.sport,
    routingOptions: normalizeRoutingOptions(choice.sport, {
      surfacePref: choice.surfacePref,
      avoidSteps: current?.avoidSteps,
      avoidFerries: current?.avoidFerries,
      ebike: ebikeSupportedForSport(choice.sport) ? current?.ebike : undefined,
    }),
  };
}

/** Paramètres de requête exacts pour `/api/route` (aucune clé inconnue : la route les refuse). */
export function routingQueryParams(
  points: ReadonlyArray<readonly [number, number]>,
  sport: RouteSport,
  options: RouteRoutingOptions | undefined,
): URLSearchParams {
  const qs = new URLSearchParams({
    points: points.map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join(';'),
    sport,
    snap: '1',
  });
  const n = normalizeRoutingOptions(sport, options);
  if (n.ebike) qs.set('ebike', '1');
  if (n.surfacePref) qs.set('surfacePref', n.surfacePref);
  if (n.avoidSteps) qs.set('avoidSteps', '1');
  if (n.avoidFerries) qs.set('avoidFerries', '1');
  return qs;
}

/** Une phrase qui dit ce que le profil demande au routeur (vue experte). */
export function describeRouting(sport: RouteSport, options: RouteRoutingOptions | undefined): string {
  const n = normalizeRoutingOptions(sport, options);
  const parts: string[] = [];
  const surface = SURFACE_CHOICES.find((c) => c.pref === (n.surfacePref ?? 'balanced'));
  if (surface && surface.id !== 'balanced') parts.push(`${surface.label.toLowerCase()} (préférence souple)`);
  if (n.avoidSteps) parts.push('sans marches');
  if (n.avoidFerries) parts.push('sans bac');
  if (n.ebike) parts.push('assistance électrique');
  return parts.length > 0 ? parts.join(' · ') : 'réglages par défaut du routeur';
}
