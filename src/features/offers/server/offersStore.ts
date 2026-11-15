import 'server-only';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import {
  resolveEntitlementsFromRow,
  resolveUserEntitlements,
  stripeBillingConfiguration,
} from '@/lib/entitlements/server';
import {
  evaluateFamilySeatState,
  evaluatePartnerOffers,
  evaluateRightState,
  evaluateStudentEligibility,
  getIosAlternateIconsState,
  isPassEligibleForWorldCoverage,
  LATEST_OFFLINE_MAP_VERSION,
  listCommercialOffers,
  MAX_FAMILY_SEATS,
  resolveGeographicCoverage,
  resolveMapUpdatesAndPremium,
  resolvePrioritySupportTier,
  type CommercialOfferSpec,
  type FamilySeatMember,
  type GeographicCoverageSnapshot,
  type IosAlternateIconOption,
  type MapUpdatesAndPremiumStatus,
  type PartnerOfferItem,
  type PrioritySupportTier,
  type StudentEligibilityEvaluation,
} from '../domain/catalog';
import { PREDEFINED_REGIONS_CATALOG } from '@/features/offline/regionsAndCoverage';

/**
 * État serveur des offres par utilisateur (K7.09, K7.10, S6.22, S6.23).
 *
 * Les droits commerciaux réels restent lus depuis `user_entitlements` et
 * `stripeBillingConfiguration()`. Les choix de région gratuite, versions locales
 * de cartes et membres du foyer sont conservés en registre serveur isolé par
 * `userId` (zéro écriture non migrée, zéro paiement simulé).
 */

export interface UserOffersState {
  freeRegionId: string | null;
  purchasedRegionIds: string[];
  installedVersions: Record<string, string>;
  familySeats: FamilySeatMember[];
  studentEmail: string | null;
  studentVerifiedUntilIso: string | null;
  selectedIosIcon: IosAlternateIconOption['id'];
}

export interface OffersOverviewPayload {
  billingConfigured: boolean;
  entitlementSource: string;
  plan: string;
  coverage: GeographicCoverageSnapshot;
  mapUpdates: MapUpdatesAndPremiumStatus;
  commercialOffers: CommercialOfferSpec[];
  family: ReturnType<typeof evaluateFamilySeatState>;
  student: StudentEligibilityEvaluation;
  partnerOffers: PartnerOfferItem[];
  supportTier: PrioritySupportTier;
  iosIcons: {
    selectedIcon: IosAlternateIconOption['id'];
    platformSupported: boolean;
    reason: string;
    icons: IosAlternateIconOption[];
  };
}

const OFFERS_STORE_KEY = Symbol.for('lkdv.o02.offers.registry');

type OffersRegistry = Map<string, UserOffersState>;

function store(): OffersRegistry {
  const holder = globalThis as typeof globalThis & { [OFFERS_STORE_KEY]?: OffersRegistry };
  if (!holder[OFFERS_STORE_KEY]) {
    holder[OFFERS_STORE_KEY] = new Map<string, UserOffersState>();
  }
  return holder[OFFERS_STORE_KEY];
}

export function resetOffersStore(): void {
  store().clear();
}

function getOrCreateUserOffersState(userId: string, ownerEmail: string): UserOffersState {
  const existing = store().get(userId);
  if (existing) return existing;

  const created: UserOffersState = {
    freeRegionId: null,
    purchasedRegionIds: [],
    installedVersions: {},
    familySeats: [
      {
        seatId: `owner-${userId.slice(0, 8)}`,
        email: ownerEmail || 'titulaire@lkdv.local',
        role: 'owner',
        status: 'active',
        expiresAtIso: null,
      },
    ],
    studentEmail: null,
    studentVerifiedUntilIso: null,
    selectedIosIcon: 'default',
  };
  store().set(userId, created);
  return created;
}

export async function buildOffersOverview(
  userId: string,
  ownerEmail: string,
  options: { isNativeIos?: boolean; nowIso?: string } = {},
): Promise<OffersOverviewPayload> {
  const billing = stripeBillingConfiguration();
  const service = getServiceSupabase();
  const resolved = service
    ? await resolveUserEntitlements(service, userId, { configured: billing.configured })
    : resolveEntitlementsFromRow(null, {
        configured: billing.configured,
        sourceOnMissing: 'unavailable',
      });

  const userState = getOrCreateUserOffersState(userId, ownerEmail);
  const hasWorldCoverage =
    resolved.plan === 'expedition' ||
    resolved.plan === 'group' ||
    isPassEligibleForWorldCoverage(resolved.activePasses);

  const hasPaidRight = resolved.plan !== 'free' || resolved.activePasses.length > 0;
  const premiumRight = evaluateRightState({
    granted: hasPaidRight,
    configured: resolved.configured || hasPaidRight,
    nowIso: options.nowIso,
  });

  const coverage = resolveGeographicCoverage({
    freeRegionId: userState.freeRegionId,
    purchasedRegionIds: userState.purchasedRegionIds,
    worldPackRight: {
      granted: hasWorldCoverage,
      configured: resolved.configured || hasWorldCoverage,
      nowIso: options.nowIso,
    },
    installedVersions: userState.installedVersions,
    nowIso: options.nowIso,
  });

  const mapUpdates = resolveMapUpdatesAndPremium({
    entitlements: resolved,
    premiumRightInput: {
      granted: hasPaidRight,
      configured: resolved.configured || hasPaidRight,
      nowIso: options.nowIso,
    },
    coverage,
  });

  const familyRight = evaluateRightState({
    granted: resolved.plan === 'group',
    configured: resolved.configured || resolved.plan === 'group',
    nowIso: options.nowIso,
  });

  const family = evaluateFamilySeatState(userState.familySeats, familyRight, options.nowIso);
  const student = evaluateStudentEligibility({
    email: userState.studentEmail ?? ownerEmail,
    verifiedUntilIso: userState.studentVerifiedUntilIso,
    nowIso: options.nowIso,
  });

  const iconsState = getIosAlternateIconsState({
    isNativeIos: options.isNativeIos === true,
    premiumRight,
  });

  return {
    billingConfigured: billing.configured,
    entitlementSource: resolved.source,
    plan: resolved.plan,
    coverage,
    mapUpdates,
    commercialOffers: listCommercialOffers(billing.configured),
    family,
    student,
    partnerOffers: evaluatePartnerOffers(premiumRight),
    supportTier: resolvePrioritySupportTier(premiumRight),
    iosIcons: {
      selectedIcon: userState.selectedIosIcon,
      ...iconsState,
    },
  };
}

export async function claimFreeStarterRegion(
  userId: string,
  ownerEmail: string,
  regionId: string,
): Promise<{ ok: true; regionId: string } | { ok: false; code: string; message: string }> {
  const known = PREDEFINED_REGIONS_CATALOG.find((r) => r.regionId === regionId);
  if (!known) {
    return { ok: false, code: 'unknown_region', message: 'Région inconnue dans le catalogue.' };
  }
  const state = getOrCreateUserOffersState(userId, ownerEmail);
  if (state.freeRegionId && state.freeRegionId !== regionId) {
    return {
      ok: false,
      code: 'free_allowance_used',
      message: 'Votre région gratuite de départ est déjà attribuée.',
    };
  }
  state.freeRegionId = regionId;
  state.installedVersions[regionId] = LATEST_OFFLINE_MAP_VERSION;
  return { ok: true, regionId };
}

export async function refreshUnlockedRegionMaps(
  userId: string,
  ownerEmail: string,
  regionIds?: readonly string[],
): Promise<{ updatedRegions: string[]; catalogVersion: string }> {
  const overview = await buildOffersOverview(userId, ownerEmail);
  const state = getOrCreateUserOffersState(userId, ownerEmail);
  const unlockedIds = new Set(
    overview.coverage.regions.filter((r) => r.unlocked).map((r) => r.id),
  );
  const targets = (regionIds && regionIds.length > 0 ? regionIds : Array.from(unlockedIds)).filter(
    (id) => unlockedIds.has(id),
  );
  for (const id of targets) {
    state.installedVersions[id] = LATEST_OFFLINE_MAP_VERSION;
  }
  return { updatedRegions: targets, catalogVersion: LATEST_OFFLINE_MAP_VERSION };
}

export async function inviteFamilySeat(
  userId: string,
  ownerEmail: string,
  memberEmail: string,
): Promise<{ ok: true; seatId: string } | { ok: false; code: string; message: string }> {
  const overview = await buildOffersOverview(userId, ownerEmail);
  if (overview.plan !== 'group') {
    return {
      ok: false,
      code: 'family_plan_required',
      message: 'Un abonnement Familial / Groupe actif est requis pour inviter des membres.',
    };
  }
  const state = getOrCreateUserOffersState(userId, ownerEmail);
  const cleanEmail = memberEmail.trim().toLowerCase();
  if (!cleanEmail || cleanEmail === ownerEmail.trim().toLowerCase()) {
    return { ok: false, code: 'invalid_email', message: 'Adresse email de membre invalide.' };
  }
  const activeOrPending = state.familySeats.filter(
    (s) => s.status === 'active' || s.status === 'pending',
  );
  if (activeOrPending.length >= MAX_FAMILY_SEATS) {
    return {
      ok: false,
      code: 'seat_limit_reached',
      message: `La limite de ${MAX_FAMILY_SEATS} sièges familiaux est atteinte.`,
    };
  }
  if (activeOrPending.some((s) => s.email.toLowerCase() === cleanEmail)) {
    return { ok: false, code: 'already_invited', message: 'Ce membre dispose déjà d’un siège.' };
  }
  const seatId = `seat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  state.familySeats.push({
    seatId,
    email: cleanEmail,
    role: 'member',
    status: 'pending',
    expiresAtIso: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  });
  return { ok: true, seatId };
}

export function revokeFamilySeat(
  userId: string,
  ownerEmail: string,
  seatId: string,
): { ok: true } | { ok: false; code: string; message: string } {
  const state = getOrCreateUserOffersState(userId, ownerEmail);
  const target = state.familySeats.find((s) => s.seatId === seatId);
  if (!target) {
    return { ok: false, code: 'not_found', message: 'Siège introuvable.' };
  }
  if (target.role === 'owner') {
    return {
      ok: false,
      code: 'cannot_revoke_owner',
      message: 'Le siège titulaire ne peut pas être révoqué.',
    };
  }
  target.status = 'revoked';
  return { ok: true };
}

export function submitStudentVerificationEmail(
  userId: string,
  ownerEmail: string,
  academicEmail: string,
): StudentEligibilityEvaluation {
  const state = getOrCreateUserOffersState(userId, ownerEmail);
  state.studentEmail = academicEmail.trim().toLowerCase();
  return evaluateStudentEligibility({ email: state.studentEmail });
}
