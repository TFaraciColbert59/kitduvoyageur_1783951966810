/**
 * Classement contextuel 4 piliers pour Explorer v2 :
 *   1. Pilier Athlétique & Sécurité (fitScore, veto)
 *   2. Pilier Spatial, Brouillard de guerre (Fog-of-War) & Routine horaire
 *   3. Pilier Social, Clubs & Carnets
 *   4. Pilier Découverte & Pokédex Biodiversité
 *
 * Invariant zéro-mock strict : préserve `ROUTE_CATALOG_SPORT` (`'rando'`).
 * Aucun itinéraire issu du catalogue randonnée n'est recyclé lorsque
 * l'utilisateur filtre explicitement un autre sport.
 */

import { haversineKm, ROUTE_CATALOG_SPORT } from '../routeSuggestions';
import type {
  ContextualItem,
  ContextualRankerInput,
  ContextualRankerResult,
  RankedContextualItem,
} from './types';

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function scoreAthleticSafety(item: ContextualItem, readinessScore: number | null): {
  score: number;
  reasonFr: string | null;
} {
  if (item.vetoed) {
    return {
      score: 5,
      reasonFr: 'Déconseillé : veto sécurité actif sur cet élément.',
    };
  }
  if (item.fitScore != null && Number.isFinite(item.fitScore)) {
    const score = clamp(item.fitScore, 0, 100);
    return {
      score,
      reasonFr:
        score >= 78
          ? `Très bonne adéquation physique (${Math.round(score)}/100).`
          : score < 45
            ? `Adéquation modérée (${Math.round(score)}/100).`
            : null,
    };
  }
  // Sans fitScore dédié (ex. POI, espèce Pokédex), neutre modulé par l'état de forme
  const base = readinessScore != null ? clamp(45 + readinessScore * 0.25, 45, 70) : 55;
  return { score: Math.round(base), reasonFr: null };
}

function scoreSpatialFogRoutine(
  item: ContextualItem,
  distanceKm: number,
  maxRadiusKm: number,
): { score: number; reasonFr: string | null } {
  const proximity = clamp(1 - distanceKm / Math.max(1, maxRadiusKm), 0, 1) * 70;
  const fogBonus = item.fogOfWarUnvisited ? 18 : 0;
  const routineBonus = item.matchesRoutineTime ? 12 : 0;
  const score = clamp(proximity + fogBonus + routineBonus, 0, 100);

  let reasonFr: string | null = null;
  if (item.fogOfWarUnvisited && distanceKm <= maxRadiusKm * 0.6) {
    reasonFr = 'Secteur inexploré à proximité (brouillard de guerre).';
  } else if (item.matchesRoutineTime) {
    reasonFr = 'Correspond à ton créneau habituel de sortie.';
  } else if (distanceKm <= 3) {
    reasonFr = `À proximité immédiate (${round(distanceKm, 1)} km).`;
  }
  return { score: Math.round(score), reasonFr };
}

function scoreSocialClubs(item: ContextualItem): { score: number; reasonFr: string | null } {
  let score = 15;
  const friends = Math.max(0, Math.round(item.friendsCount ?? 0));
  if (item.fromJoinedClub) score += 45;
  if (friends > 0) score += Math.min(30, friends * 10);
  if (item.hasCarnetEntry) score += 18;
  score = clamp(score, 0, 100);

  let reasonFr: string | null = null;
  if (item.fromJoinedClub) {
    reasonFr = 'Partagé par l’un de tes clubs.';
  } else if (friends > 0) {
    reasonFr = `${friends} proche${friends > 1 ? 's' : ''} actif${friends > 1 ? 's' : ''} sur ce secteur.`;
  } else if (item.hasCarnetEntry) {
    reasonFr = 'Documenté dans un carnet de voyage.';
  }
  return { score: Math.round(score), reasonFr };
}

function scoreDiscoveryPokedex(item: ContextualItem): { score: number; reasonFr: string | null } {
  let score = 12;
  if (item.pokedexNovelty) score += 50;
  switch (item.pokedexRarity) {
    case 'threatened':
      score += 34;
      break;
    case 'rare':
      score += 28;
      break;
    case 'uncommon':
      score += 18;
      break;
    case 'common':
      score += 8;
      break;
    default:
      break;
  }
  if (
    item.freshnessHours != null &&
    Number.isFinite(item.freshnessHours) &&
    item.freshnessHours >= 0 &&
    item.freshnessHours <= 24
  ) {
    score += 10;
  }
  score = clamp(score, 0, 100);

  let reasonFr: string | null = null;
  if (item.pokedexNovelty) {
    reasonFr = 'Nouvelle espèce à découvrir pour ton Pokédex.';
  } else if (item.pokedexRarity === 'rare' || item.pokedexRarity === 'threatened') {
    reasonFr = 'Observation biodiversité remarquable sur cette zone.';
  }
  return { score: Math.round(score), reasonFr };
}

export function rankContextualItems(input: ContextualRankerInput): ContextualRankerResult {
  const maxRadiusKm = Math.max(1, input.maxRadiusKm ?? 25);
  const wAthletic = Math.max(0, input.weights?.athleticSafety ?? 0.35);
  const wSpatial = Math.max(0, input.weights?.spatialFogRoutine ?? 0.3);
  const wSocial = Math.max(0, input.weights?.socialClubs ?? 0.2);
  const wDiscovery = Math.max(0, input.weights?.discoveryPokedex ?? 0.15);
  const weightSum = wAthletic + wSpatial + wSocial + wDiscovery || 1;

  const requestedSport = input.requestedSport ?? null;
  let filteredOutRoutesCount = 0;
  const eligible: ContextualItem[] = [];

  for (const item of input.items) {
    if (item.kind === 'route' && requestedSport !== null) {
      // Filtrage zéro-mock : les itinéraires sans sport déclaré ou de randonnée
      // appartiennent exclusivement au catalogue `ROUTE_CATALOG_SPORT` ('rando').
      const effectiveRouteSport = item.sport ?? ROUTE_CATALOG_SPORT;
      if (effectiveRouteSport !== requestedSport) {
        filteredOutRoutesCount += 1;
        continue;
      }
    }
    eligible.push(item);
  }

  const readinessScore = input.readiness?.score ?? null;

  const ranked: RankedContextualItem[] = eligible.map((item) => {
    const distanceKm =
      Number.isFinite(input.userLat) &&
      Number.isFinite(input.userLng) &&
      Number.isFinite(item.lat) &&
      Number.isFinite(item.lng)
        ? round(haversineKm(input.userLat, input.userLng, item.lat, item.lng), 2)
        : maxRadiusKm;

    const athletic = scoreAthleticSafety(item, readinessScore);
    const spatial = scoreSpatialFogRoutine(item, distanceKm, maxRadiusKm);
    const social = scoreSocialClubs(item);
    const discovery = scoreDiscoveryPokedex(item);

    let total =
      (athletic.score * wAthletic +
        spatial.score * wSpatial +
        social.score * wSocial +
        discovery.score * wDiscovery) /
      weightSum;

    // Un élément frappé d'un veto sécurité est systématiquement rétrogradé
    if (item.vetoed) {
      total = Math.min(total, 18);
    }

    const reasonsFr = [
      athletic.reasonFr,
      spatial.reasonFr,
      social.reasonFr,
      discovery.reasonFr,
    ].filter((r): r is string => Boolean(r));

    return {
      item,
      totalScore: round(clamp(total, 0, 100), 1),
      distanceKm,
      pillarScores: {
        athleticSafety: athletic.score,
        spatialFogRoutine: spatial.score,
        socialClubs: social.score,
        discoveryPokedex: discovery.score,
      },
      reasonsFr,
    };
  });

  ranked.sort(
    (a, b) =>
      b.totalScore - a.totalScore ||
      a.distanceKm - b.distanceKm ||
      a.item.id.localeCompare(b.item.id),
  );

  const routeCatalogNoteFr =
    requestedSport !== null &&
    requestedSport !== ROUTE_CATALOG_SPORT &&
    filteredOutRoutesCount > 0
      ? `Aucun catalogue d’itinéraires dédié pour « ${requestedSport} » : ${filteredOutRoutesCount} tracé${filteredOutRoutesCount > 1 ? 's' : ''} randonnée non recyclé${filteredOutRoutesCount > 1 ? 's' : ''}.`
      : null;

  return {
    ranked,
    filteredOutRoutesCount,
    routeCatalogNoteFr,
  };
}
