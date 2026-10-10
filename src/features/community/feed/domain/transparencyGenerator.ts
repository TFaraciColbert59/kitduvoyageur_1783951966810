/**
 * LKDV Feed V1 - Deterministic Transparency Generator
 *
 * Resolves the primary contributing recommendation factor and generates
 * clear, human-readable French explanations ("Pourquoi je vois ce contenu")
 * along with detailed factor breakdowns and badge labels.
 */

import type {
  ScoredCandidateItem,
  RecommendationTransparency,
  TransparencyReason,
} from '../types/feed.types';

export function resolvePrimaryReason(item: ScoredCandidateItem): {
  primaryReason: TransparencyReason;
  explanation: string;
  badgeLabel: string;
} {
  const { breakdown } = { breakdown: item.scoreBreakdown };
  const { signals } = item;

  // 1. Travel Intent (Active trip destination or activity match)
  if (
    breakdown.intent >= 0.60 &&
    breakdown.intent >= Math.max(breakdown.geo, breakdown.social)
  ) {
    const destination =
      signals.intent.matchedDestinationName ||
      item.linkedCarnet?.destination;

    return {
      primaryReason: 'travel_intent',
      explanation: destination
        ? `Recommandé pour préparer votre projet de voyage (${destination}).`
        : 'Recommandé pour préparer votre projet de voyage à venir.',
      badgeLabel: destination ? `Projet ${destination}` : 'Projet voyage',
    };
  }

  // 2. Following (Author followed by user)
  if (breakdown.social >= 0.60 && signals.social.isAuthorFollowed) {
    return {
      primaryReason: 'following',
      explanation: 'Publié par un auteur que vous suivez.',
      badgeLabel: 'Abonnement',
    };
  }

  // 3. Territory / Geo Proximity
  if (breakdown.geo >= 0.60) {
    const massif = signals.geo.matchedMassifName;
    return {
      primaryReason: 'territory',
      explanation: massif
        ? `Écho récent dans votre massif (${massif}).`
        : 'Publication récente à proximité de votre position.',
      badgeLabel: 'Autour de vous',
    };
  }

  const hasVerifiedProof = Boolean(signals.utility.hasVerifiedCarnet || signals.utility.hasGpsTrack);

  // 4. Verified Field Proof & Utility (prioritized over club membership when utility >= 0.70)
  if (breakdown.utility >= 0.70 && hasVerifiedProof) {
    return {
      primaryReason: 'quality_field_proof',
      explanation: "Récit d'expédition vérifié avec tracé GPS et données terrain.",
      badgeLabel: 'Vérifié terrain',
    };
  }

  // 5. Club affiliation
  if (signals.social.sharesClubMembership) {
    const clubName = signals.social.sharedClubName;
    return {
      primaryReason: 'club',
      explanation: clubName
        ? `Partagé au sein du club ${clubName}.`
        : "Partagé au sein d'un club que vous avez rejoint.",
      badgeLabel: 'Club',
    };
  }

  // 6. Verified Field Proof & Utility (standard threshold utility >= 0.60)
  if (breakdown.utility >= 0.60 && hasVerifiedProof) {
    return {
      primaryReason: 'quality_field_proof',
      explanation: "Récit d'expédition vérifié avec tracé GPS et données terrain.",
      badgeLabel: 'Vérifié terrain',
    };
  }

  // 6. Discovery / Evergreen Fallback
  return {
    primaryReason: 'discovery',
    explanation: "Sélectionné pour la qualité et la pertinence du retour d'expérience.",
    badgeLabel: 'Découverte',
  };
}

/**
 * Generates recommendation transparency metadata for a scored candidate.
 * 100% deterministic, pure function.
 */
export function generateTransparencyMetadata(
  item: ScoredCandidateItem
): RecommendationTransparency {
  const { primaryReason, explanation, badgeLabel } = resolvePrimaryReason(item);

  return {
    primaryReason,
    explanation,
    badgeLabel,
    scoreBreakdown: {
      total: item.scoreBreakdown.total,
      intent: item.scoreBreakdown.intent,
      utility: item.scoreBreakdown.utility,
      quality: item.scoreBreakdown.quality,
      geo: item.scoreBreakdown.geo,
      social: item.scoreBreakdown.social,
    },
    matchedSignals: {
      tripDestination:
        item.signals.intent.matchedDestinationName || item.linkedCarnet?.destination,
      massif: item.signals.geo.matchedMassifName,
      clubName: item.signals.social.sharedClubName,
      isVerifiedCarnet: item.signals.utility.hasVerifiedCarnet,
      authorTrustScore: item.author?.trustScore ?? item.signals.quality.authorTrustScore ?? undefined,
    },
  };
}
