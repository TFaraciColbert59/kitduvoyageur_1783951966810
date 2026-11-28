import type { ActivityDomainEvent } from '../activityEventBus';

export interface ClubChallengeContribution {
  sessionId: string;
  userId: string;
  sportSlug: string;
  distanceM: number;
  elevGainM: number;
  movingS: number;
  category: 'muscular' | 'electric_assisted';
  eligible: boolean;
  exclusionReason?: 'leaderboard_ineligible' | 'rgpd_art9_private';
}

export interface SafetyTerrainReportProjection {
  sourceSessionId: string;
  waypointId: string;
  label: string;
  lat: number;
  lng: number;
  kind: 'danger' | 'water' | 'bivouac';
}

export interface PokedexObservationCandidate {
  sourceSessionId: string;
  waypointId: string;
  label: string;
  lat: number;
  lng: number;
}

/**
 * Propage une activité terminée vers les Challenges Clubs (`g03_challenges`),
 * les signalements sécurité terrain (`safety_reports`) et le Pokédex biodiversité.
 * Isole strictement les vélos électriques (`eBike`/`eMTB`) des classements musculaires.
 */
export function buildClubPokedexSafetyProjections(
  event: ActivityDomainEvent,
  options?: { rgpdArt9Sensitive?: boolean },
): {
  clubContribution: ClubChallengeContribution | null;
  safetyReports: SafetyTerrainReportProjection[];
  pokedexCandidates: PokedexObservationCandidate[];
} {
  if (event.eventType !== 'activity.completed.v1') {
    return { clubContribution: null, safetyReports: [], pokedexCandidates: [] };
  }

  const p = event.payload;
  const isElectric = Boolean(
    p.isElectricAssisted || p.sportSlug === 'ebike_road_trek' || p.sportSlug === 'emtb',
  );
  const art9 = Boolean(options?.rgpdArt9Sensitive);

  const clubContribution: ClubChallengeContribution = {
    sessionId: event.sessionId,
    userId: event.userId,
    sportSlug: p.sportSlug,
    distanceM: Math.round(Math.max(0, p.distanceM)),
    elevGainM: Math.round(Math.max(0, p.elevGainM)),
    movingS: Math.round(Math.max(0, p.movingS)),
    category: isElectric ? 'electric_assisted' : 'muscular',
    eligible: !art9 && p.eligibleForLeaderboards !== false,
    exclusionReason: art9
      ? 'rgpd_art9_private'
      : p.eligibleForLeaderboards === false
        ? 'leaderboard_ineligible'
        : undefined,
  };

  const safetyReports: SafetyTerrainReportProjection[] = [];
  const pokedexCandidates: PokedexObservationCandidate[] = [];

  for (const wp of p.waypoints) {
    const k = wp.kind.toLowerCase();
    if (k === 'danger' || k === 'water' || k === 'bivouac') {
      safetyReports.push({
        sourceSessionId: event.sessionId,
        waypointId: wp.id,
        label: wp.label,
        lat: wp.lat,
        lng: wp.lng,
        kind: k,
      });
    } else if (k === 'wildlife' || k === 'flora' || k === 'nature' || k === 'pokedex') {
      pokedexCandidates.push({
        sourceSessionId: event.sessionId,
        waypointId: wp.id,
        label: wp.label,
        lat: wp.lat,
        lng: wp.lng,
      });
    }
  }

  return { clubContribution, safetyReports, pokedexCandidates };
}
