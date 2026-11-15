import type { Entitlement, PassId, PlanId } from '@/features/adventure-intelligence/domain/entitlements';
import { PREDEFINED_REGIONS_CATALOG } from '@/features/offline/regionsAndCoverage';
import type { PredefinedRegionCatalogItem } from '@/features/offline/types';

/**
 * Contrat O02 — Offres, couverture géographique, abonnements, avantages & icônes iOS
 * (K7.09, K7.10, S6.22, S6.23).
 *
 * Règles du chantier O02 :
 * - Toute capacité payante ou géographique distingue explicitement `active`,
 *   `expired`, `revoked`, `unconfigured` et `ineligible`.
 * - Un droit expiré ou révoqué coupe immédiatement la fonction correspondante.
 * - Sans configuration Stripe / marché validée, le paiement reste explicitement
 *   `unconfigured` (aucun achat simulé).
 */

export type RightStatus = 'active' | 'expired' | 'revoked' | 'unconfigured' | 'ineligible';

export type OfferTierId = 'free' | 'single_region' | 'world_pack' | 'individual' | 'family' | 'student';

export interface TemporalRightInput {
  granted?: boolean;
  configured?: boolean;
  expiresAtIso?: string | null;
  revokedAtIso?: string | null;
  nowIso?: string;
}

export interface EvaluatedRight {
  status: RightStatus;
  canUse: boolean;
  reason: string;
  actionLabel: string | null;
  expiresAtIso: string | null;
  revokedAtIso: string | null;
}

export function evaluateRightState(input: TemporalRightInput): EvaluatedRight {
  const nowMs = Date.parse(input.nowIso ?? new Date().toISOString());
  const revokedAt = input.revokedAtIso ?? null;
  const expiresAt = input.expiresAtIso ?? null;

  if (revokedAt) {
    return {
      status: 'revoked',
      canUse: false,
      reason: 'Droit révoqué : l’accès a été coupé côté serveur.',
      actionLabel: 'Réactiver ou souscrire à nouveau',
      expiresAtIso: expiresAt,
      revokedAtIso: revokedAt,
    };
  }

  if (expiresAt) {
    const expMs = Date.parse(expiresAt);
    if (Number.isFinite(expMs) && expMs <= nowMs) {
      return {
        status: 'expired',
        canUse: false,
        reason: 'Droit expiré : la période d’accès est terminée.',
        actionLabel: 'Renouveler l’offre',
        expiresAtIso: expiresAt,
        revokedAtIso: null,
      };
    }
  }

  if (input.configured === false) {
    return {
      status: 'unconfigured',
      canUse: false,
      reason: 'Offre non activée sur ce marché (paiement non configuré).',
      actionLabel: null,
      expiresAtIso: expiresAt,
      revokedAtIso: null,
    };
  }

  if (input.granted === false) {
    return {
      status: 'ineligible',
      canUse: false,
      reason: 'Aucun droit actif pour cette fonctionnalité.',
      actionLabel: 'Voir les formules',
      expiresAtIso: expiresAt,
      revokedAtIso: null,
    };
  }

  return {
    status: 'active',
    canUse: true,
    reason: 'Droit actif.',
    actionLabel: null,
    expiresAtIso: expiresAt,
    revokedAtIso: null,
  };
}

export type RegionAccessSource = 'free_starter' | 'single_purchase' | 'world_pack' | 'locked';

export interface RegionCoverageItem {
  id: string;
  name: string;
  countryCode: string;
  estimatedSizeMb: number;
  source: RegionAccessSource;
  unlocked: boolean;
  right: EvaluatedRight;
  installedVersion: string | null;
  latestVersion: string;
  updateAvailable: boolean;
}

export interface GeographicCoverageSnapshot {
  freeRegionId: string | null;
  freeRegionAllowanceRemaining: number;
  worldPackRight: EvaluatedRight;
  regions: RegionCoverageItem[];
}

export const LATEST_OFFLINE_MAP_VERSION = '2026.11.1';

export interface GeographicCoverageInput {
  freeRegionId?: string | null;
  purchasedRegionIds?: readonly string[];
  worldPackRight?: TemporalRightInput;
  installedVersions?: Record<string, string>;
  latestVersion?: string;
  nowIso?: string;
  regionsCatalog?: readonly PredefinedRegionCatalogItem[];
}

function estimateRegionSizeMb(region: PredefinedRegionCatalogItem): number {
  const zoomSpan = Math.max(1, region.recommendedMaxZoom - region.recommendedMinZoom + 1);
  return Math.max(12, Math.round(zoomSpan * 9 + (region.poiCount + region.routeCount) * 0.05));
}

/**
 * K7.09 — Résout la région gratuite unique, les régions à l'unité et le Pack Monde.
 */
export function resolveGeographicCoverage(
  input: GeographicCoverageInput = {},
): GeographicCoverageSnapshot {
  const catalog = input.regionsCatalog ?? PREDEFINED_REGIONS_CATALOG;
  const freeRegionId = input.freeRegionId ?? null;
  const purchasedSet = new Set(input.purchasedRegionIds ?? []);
  const latestVersion = input.latestVersion ?? LATEST_OFFLINE_MAP_VERSION;
  const installed = input.installedVersions ?? {};

  const worldPackRight = evaluateRightState(
    input.worldPackRight ?? { granted: false, configured: true, nowIso: input.nowIso },
  );

  const regions: RegionCoverageItem[] = catalog.map((region) => {
    const regionId = region.regionId;
    const isFree = freeRegionId === regionId;
    const isPurchased = purchasedSet.has(regionId);
    const installedVersion = installed[regionId] ?? null;
    const updateAvailable = installedVersion !== null && installedVersion !== latestVersion;
    const estimatedSizeMb = estimateRegionSizeMb(region);

    if (worldPackRight.canUse) {
      return {
        id: regionId,
        name: region.name,
        countryCode: region.countryIsoA2,
        estimatedSizeMb,
        source: isFree ? 'free_starter' : 'world_pack',
        unlocked: true,
        right: worldPackRight,
        installedVersion,
        latestVersion,
        updateAvailable,
      };
    }

    if (isFree) {
      return {
        id: regionId,
        name: region.name,
        countryCode: region.countryIsoA2,
        estimatedSizeMb,
        source: 'free_starter',
        unlocked: true,
        right: evaluateRightState({ granted: true, configured: true, nowIso: input.nowIso }),
        installedVersion,
        latestVersion,
        updateAvailable,
      };
    }

    if (isPurchased) {
      return {
        id: regionId,
        name: region.name,
        countryCode: region.countryIsoA2,
        estimatedSizeMb,
        source: 'single_purchase',
        unlocked: true,
        right: evaluateRightState({ granted: true, configured: true, nowIso: input.nowIso }),
        installedVersion,
        latestVersion,
        updateAvailable,
      };
    }

    const lockedRight =
      worldPackRight.status === 'expired' || worldPackRight.status === 'revoked'
        ? worldPackRight
        : evaluateRightState({ granted: false, configured: true, nowIso: input.nowIso });

    return {
      id: regionId,
      name: region.name,
      countryCode: region.countryIsoA2,
      estimatedSizeMb,
      source: 'locked',
      unlocked: false,
      right: lockedRight,
      installedVersion,
      latestVersion,
      updateAvailable,
    };
  });

  return {
    freeRegionId,
    freeRegionAllowanceRemaining: freeRegionId ? 0 : 1,
    worldPackRight,
    regions,
  };
}

export interface MapUpdatesAndPremiumStatus {
  premiumRight: EvaluatedRight;
  planLabel: string;
  canUsePremiumRouting: boolean;
  canUseAdvancedTerrain: boolean;
  catalogVersion: string;
  staleUnlockedRegions: string[];
  canRefreshUnlockedMaps: boolean;
  distinctionNote: string;
}

export interface OfferEntitlementInput {
  configured: boolean;
  plan: PlanId;
  activePasses: readonly PassId[];
  entitlements: readonly Entitlement[] | Partial<Record<Entitlement, boolean>>;
}

function hasEntitlement(
  entitlements: OfferEntitlementInput['entitlements'],
  key: Entitlement,
): boolean {
  if (Array.isArray(entitlements)) {
    return entitlements.includes(key);
  }
  return (entitlements as Partial<Record<Entitlement, boolean>>)[key] === true;
}

/**
 * K7.10 — Distingue explicitement les mises à jour de cartes hors ligne
 * (toujours autorisées pour les régions gratuites/acquises) des droits
 * d'abonnement Premium (coupés dès expiration ou révocation).
 */
export function resolveMapUpdatesAndPremium(params: {
  entitlements: OfferEntitlementInput;
  premiumRightInput?: TemporalRightInput;
  coverage: GeographicCoverageSnapshot;
}): MapUpdatesAndPremiumStatus {
  const { entitlements, coverage } = params;
  const hasPaidEntitlement =
    entitlements.plan !== 'free' || entitlements.activePasses.length > 0;
  const premiumRight = evaluateRightState(
    params.premiumRightInput ?? {
      granted: hasPaidEntitlement,
      configured: entitlements.configured,
    },
  );

  const staleUnlockedRegions = coverage.regions
    .filter((region) => region.unlocked && region.updateAvailable)
    .map((region) => region.id);

  const planLabels: Record<PlanId, string> = {
    free: 'Découverte (gratuit)',
    explorer: 'Individuel / Explorer',
    expedition: 'Expédition / Pack Monde',
    group: 'Famille / Groupe',
  };

  return {
    premiumRight,
    planLabel: planLabels[entitlements.plan] ?? 'Découverte',
    canUsePremiumRouting:
      premiumRight.canUse && hasEntitlement(entitlements.entitlements, 'full_generation'),
    canUseAdvancedTerrain:
      premiumRight.canUse && hasEntitlement(entitlements.entitlements, 'terrain_live_advanced'),
    catalogVersion: LATEST_OFFLINE_MAP_VERSION,
    staleUnlockedRegions,
    canRefreshUnlockedMaps: coverage.regions.some((r) => r.unlocked),
    distinctionNote:
      'Le rafraîchissement des fonds de carte acquis reste indépendant de l’abonnement Premium : une expiration coupe le routage et le terrain avancé sans effacer vos régions déjà acquises.',
  };
}

export interface CommercialOfferSpec {
  id: 'individual' | 'family' | 'student' | 'world_pack';
  name: string;
  targetAudience: string;
  seatsIncluded: number;
  billingModel: 'subscription' | 'one_time_or_sub';
  indicativePriceLabel: string;
  checkoutConfigured: boolean;
  includes: string[];
}

export function listCommercialOffers(stripeConfigured: boolean): CommercialOfferSpec[] {
  return [
    {
      id: 'individual',
      name: 'Abonnement Individuel',
      targetAudience: '1 compte sportif',
      seatsIncluded: 1,
      billingModel: 'subscription',
      indicativePriceLabel: stripeConfigured ? '59,99 € / an' : 'Tarif à confirmer (paiement non activé)',
      checkoutConfigured: stripeConfigured,
      includes: [
        'Cartes hors ligne multi-régions',
        'Suivi matériel avancé & alertes usure',
        'Support prioritaire & avantages partenaires',
      ],
    },
    {
      id: 'family',
      name: 'Abonnement Familial',
      targetAudience: 'Jusqu’à 4 membres du foyer',
      seatsIncluded: 4,
      billingModel: 'subscription',
      indicativePriceLabel: stripeConfigured ? '99,99 € / an' : 'Tarif à confirmer (paiement non activé)',
      checkoutConfigured: stripeConfigured,
      includes: [
        '4 sièges indépendants (activités privées séparées)',
        'Partage de régions hors ligne du titulaire',
        'Révocation instantanée d’un siège sans perte de traces personnelles',
      ],
    },
    {
      id: 'student',
      name: 'Abonnement Étudiant',
      targetAudience: 'Étudiants éligibles (-50 %)',
      seatsIncluded: 1,
      billingModel: 'subscription',
      indicativePriceLabel: stripeConfigured ? '29,99 € / an' : 'Tarif à confirmer (vérification requise)',
      checkoutConfigured: stripeConfigured,
      includes: [
        'Mêmes droits que la formule Individuelle',
        'Éligibilité renouvelable annuellement sur justificatif académique',
      ],
    },
    {
      id: 'world_pack',
      name: 'Pack Monde & Régions',
      targetAudience: 'Couverture géographique permanente',
      seatsIncluded: 1,
      billingModel: 'one_time_or_sub',
      indicativePriceLabel: stripeConfigured ? '29,99 € (achat unique)' : '1ère région gratuite · Pack Monde à activer',
      checkoutConfigured: stripeConfigured,
      includes: [
        '1 région de départ gratuite sans expiration',
        'Déblocage à l’unité ou Pack Monde complet',
      ],
    },
  ];
}

export interface FamilySeatMember {
  seatId: string;
  email: string;
  role: 'owner' | 'member';
  status: 'active' | 'pending' | 'revoked' | 'expired';
  expiresAtIso: string | null;
}

export const MAX_FAMILY_SEATS = 4;

export function evaluateFamilySeatState(
  seats: readonly FamilySeatMember[],
  ownerRight: EvaluatedRight,
  nowIso: string = new Date().toISOString(),
): {
  seatsUsed: number;
  seatsAvailable: number;
  seats: Array<FamilySeatMember & { effectiveActive: boolean; note: string }>;
} {
  const nowMs = Date.parse(nowIso);
  const evaluated = seats.map((seat) => {
    const expMs = seat.expiresAtIso ? Date.parse(seat.expiresAtIso) : NaN;
    const isExpired = Number.isFinite(expMs) && expMs <= nowMs;
    if (!ownerRight.canUse) {
      return {
        ...seat,
        status: ownerRight.status === 'revoked' ? ('revoked' as const) : ('expired' as const),
        effectiveActive: false,
        note: 'Accès coupé : abonnement familial titulaire inactif.',
      };
    }
    if (seat.status === 'revoked') {
      return {
        ...seat,
        effectiveActive: false,
        note: 'Siège révoqué : les activités personnelles du membre restent intactes.',
      };
    }
    if (isExpired || seat.status === 'expired') {
      return {
        ...seat,
        status: 'expired' as const,
        effectiveActive: false,
        note: 'Invitation ou siège expiré.',
      };
    }
    if (seat.status === 'pending') {
      return {
        ...seat,
        effectiveActive: false,
        note: 'Invitation en attente d’acceptation.',
      };
    }
    return {
      ...seat,
      effectiveActive: true,
      note: seat.role === 'owner' ? 'Titulaire de l’offre' : 'Membre actif',
    };
  });

  const seatsUsed = evaluated.filter(
    (s) => s.effectiveActive || s.status === 'pending',
  ).length;

  return {
    seatsUsed,
    seatsAvailable: Math.max(0, MAX_FAMILY_SEATS - seatsUsed),
    seats: evaluated,
  };
}

export type StudentVerificationStatus = 'unverified' | 'pending' | 'verified' | 'expired';

export interface StudentEligibilityEvaluation {
  status: StudentVerificationStatus;
  eligibleForDiscount: boolean;
  institutionHint: string | null;
  reason: string;
}

const ACADEMIC_DOMAIN_RE = /(^|\.)(edu|ac\.[a-z]{2}|univ-[a-z0-9-]+\.fr|etu\.[a-z0-9.-]+)$/i;

export function evaluateStudentEligibility(params: {
  email?: string | null;
  verifiedUntilIso?: string | null;
  nowIso?: string;
}): StudentEligibilityEvaluation {
  const nowMs = Date.parse(params.nowIso ?? new Date().toISOString());
  if (params.verifiedUntilIso) {
    const expMs = Date.parse(params.verifiedUntilIso);
    if (Number.isFinite(expMs) && expMs > nowMs) {
      return {
        status: 'verified',
        eligibleForDiscount: true,
        institutionHint: params.email?.split('@')[1] ?? null,
        reason: 'Statut étudiant vérifié jusqu’au terme de la période universitaire.',
      };
    }
    return {
      status: 'expired',
      eligibleForDiscount: false,
      institutionHint: params.email?.split('@')[1] ?? null,
      reason: 'Attestation étudiante expirée : une nouvelle vérification est requise.',
    };
  }

  const domain = params.email?.trim().split('@')[1] ?? '';
  if (domain && ACADEMIC_DOMAIN_RE.test(domain)) {
    return {
      status: 'pending',
      eligibleForDiscount: false,
      institutionHint: domain,
      reason: `Domaine académique détecté (${domain}) : validation manuelle ou justificatif requis.`,
    };
  }

  return {
    status: 'unverified',
    eligibleForDiscount: false,
    institutionHint: null,
    reason: 'Aucune attestation étudiante enregistrée.',
  };
}

export interface PartnerOfferItem {
  id: string;
  partner: string;
  title: string;
  marketAvailability: 'fr_eu' | 'contract_pending';
  right: EvaluatedRight;
  detail: string;
}

/**
 * S6.23 — Offres partenaires séparées des droits de base.
 */
export function evaluatePartnerOffers(
  premiumRight: EvaluatedRight,
): PartnerOfferItem[] {
  return [
    {
      id: 'partner-caf-refuges',
      partner: 'Réseau Refuges & Montagne',
      title: 'Réduction nuitée & météo refuge',
      marketAvailability: 'contract_pending',
      right: premiumRight.canUse
        ? {
            status: 'unconfigured',
            canUse: false,
            reason: 'Partenariat commercial en cours de contractualisation pour le marché FR.',
            actionLabel: null,
            expiresAtIso: null,
            revokedAtIso: null,
          }
        : premiumRight,
      detail: 'Exposé uniquement une fois l’accord partenaire et le marché validés.',
    },
    {
      id: 'partner-equipment-care',
      partner: 'Atelier Vélo & Trail LKDV',
      title: 'Alerte révision & bon d’entretien annuel',
      marketAvailability: 'fr_eu',
      right: premiumRight,
      detail: 'Lié à un abonnement individuel, familial ou étudiant actif.',
    },
  ];
}

export interface PrioritySupportTier {
  level: 'standard' | 'priority';
  slaLabel: string;
  eligible: boolean;
  reason: string;
}

export function resolvePrioritySupportTier(
  premiumRight: EvaluatedRight,
): PrioritySupportTier {
  if (premiumRight.canUse) {
    return {
      level: 'priority',
      slaLabel: 'Réponse prioritaire sous 4h ouvrées',
      eligible: true,
      reason: 'Incluse avec votre abonnement actif.',
    };
  }
  return {
    level: 'standard',
    slaLabel: 'Traitement standard sous 48h ouvrées',
    eligible: false,
    reason: premiumRight.reason,
  };
}

export interface IosAlternateIconOption {
  id: 'default' | 'topo-green' | 'alpine-night' | 'liquid-glass';
  label: string;
  requiresPremium: boolean;
  assetName: string;
  selectable: boolean;
  unavailableReason: string | null;
}

export function getIosAlternateIconsState(params: {
  isNativeIos: boolean;
  premiumRight: EvaluatedRight;
}): {
  platformSupported: boolean;
  reason: string;
  icons: IosAlternateIconOption[];
} {
  const { isNativeIos, premiumRight } = params;
  const platformReason = isNativeIos
    ? 'Personnalisation iOS prête via UIApplication.setAlternateIconName.'
    : 'Icônes alternatives réservées à l’application native iOS (indisponible sur navigateur web / Android).';

  const specs: Array<{
    id: IosAlternateIconOption['id'];
    label: string;
    requiresPremium: boolean;
    assetName: string;
  }> = [
    { id: 'default', label: 'Classique LKDV', requiresPremium: false, assetName: 'AppIcon' },
    { id: 'topo-green', label: 'Topographie Sauge', requiresPremium: true, assetName: 'AppIconTopo' },
    { id: 'alpine-night', label: 'Sommet Nocturne', requiresPremium: true, assetName: 'AppIconNight' },
    { id: 'liquid-glass', label: 'Liquid Glass iOS', requiresPremium: true, assetName: 'AppIconGlass' },
  ];

  return {
    platformSupported: isNativeIos,
    reason: platformReason,
    icons: specs.map((spec) => {
      let unavailableReason: string | null = null;
      if (!isNativeIos) {
        unavailableReason = 'native_ios_only';
      } else if (spec.requiresPremium && !premiumRight.canUse) {
        unavailableReason = premiumRight.reason;
      }
      return {
        ...spec,
        selectable: unavailableReason === null,
        unavailableReason,
      };
    }),
  };
}

export function isPassEligibleForWorldCoverage(passes: readonly PassId[]): boolean {
  return passes.includes('expedition') || passes.includes('trip');
}
