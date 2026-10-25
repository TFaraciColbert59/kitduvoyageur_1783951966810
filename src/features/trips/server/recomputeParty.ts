import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import {
  buildGroupPlan,
  type GroupMemberInput,
  type GroupPlan,
  type GroupSegment,
} from '@/features/adventure-intelligence/domain/groupIntelligence';
import { deriveMemberInput } from '@/features/trips/domain/memberProfile';
import { PER_PERSON_CATEGORIES } from '@/features/trips/engine/selectKitProducts';
import { buildPreTripSafetyControls } from '@/features/trips/safety/preTripSafetyRules';
import { getCivilDurationDays, parseCivilDate } from '@/lib/dates/tripDates';

/**
 * Task 18 — Moteur de recalcul d'équipage `recomputeParty`.
 *
 * Modèle : le roster fait foi (`trip_collaborators`, propriétaire inclus), les
 * snapshots `trip_member_profiles` alimentent le moteur A8, les membres sans
 * snapshot retombent explicitement sur les MOYENNES population (jamais un
 * profil inventé). Les écritures sont absolues et rejouables :
 *   • `trips.party_size = N` + `party_version + 1` ;
 *   • `trip_items` : consommables / eau / nourriture = N, tout le reste ×1,
 *     `owner_id` des partagés réassigné selon les transferts du plan (≤ 5 kg),
 *     `null` = à assigner pour ce qui ne tient pas dans les transferts ;
 *   • `trip_expenses` prévisionnelles : purge puis réécriture des lignes
 *     recalculées (provenance `party_recompute`), base par personne conservée
 *     dans `metadata.per_person_eur` pour un rejeu exact à N-1 ;
 *   • checklist : rappels par personne si une règle réelle existe, sinon no-op.
 *
 * `revalidatePath('/hub')` reste à la charge de l'appelant (route handler) :
 * la fonction peut tourner dans un rendu serveur.
 */

export interface RecomputePartyResult {
  partySize: number;
  version: number;
  warnings: string[];
}

/** Ligne `trips` minimale pour le recalcul. */
export interface PartyTripRow {
  id: string;
  user_id: string;
  party_size: number | null;
  party_version: number | null;
  primary_activity: string | null;
  difficulty: string | null;
  destination_country_code: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_currency: string | null;
}

export interface PartyMemberProfileRow {
  user_id: string;
  flat_speed_kmh: number | null;
  ascent_speed_m_per_h: number | null;
  descent_speed_m_per_h: number | null;
  pack_weight_kg: number | null;
  max_carry_kg: number | null;
  experience_level: string | null;
  limitations: string | null;
  is_child: boolean | null;
}

export interface PartyItemRow {
  id: string;
  item_name: string;
  category: string | null;
  quantity: number;
  ownership: string | null;
  owner_id: string | null;
  is_consumable: boolean | null;
  weight_grams: number | null;
}

export interface PartyExpenseRow {
  id: string;
  title: string;
  amount: number;
  category: string | null;
  currency: string | null;
  expense_date: string | null;
  payer_id: string | null;
  metadata: Record<string, unknown> | null;
}

export interface PartyStepRow {
  distance_km: number | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
}

export interface PartyBudgetLine {
  title: string;
  amountEur: number;
  category: string | null;
  currency: string | null;
  expenseDate: string | null;
  payerId: string | null;
  metadata: Record<string, unknown>;
}

export interface SharedOwnerAssignment {
  id: string;
  ownerId: string | null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Normalise accents/casse pour comparer les catégories du catalogue. */
function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Un item se compte par personne s'il est consommable, de la catégorie
 * Hydratation (règle `selectKitProducts`, eau ×N) ou explicitement nourriture.
 */
export function isPerPersonItem(item: {
  category?: string | null;
  is_consumable?: boolean | null;
}): boolean {
  if (item.is_consumable === true) return true;
  const category = typeof item.category === 'string' ? normalizeText(item.category) : '';
  if (category === '') return false;
  if (PER_PERSON_CATEGORIES.some((expected) => normalizeText(expected) === category)) return true;
  return /nourriture|alimentation|vivres|repas|food|hydratation|eau/.test(category);
}

/** Quantité absolue d'un item pour une équipe de `partySize` membres. */
export function itemQuantityForParty(
  item: { category?: string | null; is_consumable?: boolean | null },
  partySize: number
): number {
  const size = Math.max(1, Math.trunc(partySize || 1));
  return isPerPersonItem(item) ? size : 1;
}

/** Membre de groupe construit depuis un snapshot, moyennes si absent. */
export function buildPartyMember(
  memberId: string,
  role: GroupMemberInput['role'],
  snapshot: PartyMemberProfileRow | null,
  label: string
): GroupMemberInput {
  if (!snapshot) {
    const averages = deriveMemberInput({});
    return {
      memberId,
      displayName: label,
      role,
      flatSpeedKmH: averages.flatSpeedKmH,
      ascentSpeedMPerHour: averages.ascentSpeedMPerHour,
      descentSpeedMPerHour: averages.descentSpeedMPerHour,
      packWeightKg: averages.packWeightKg,
      maxCarryKg: averages.maxCarryKg,
      experienceLevel: 'intermediate',
      isChild: averages.isChild,
    };
  }

  const experience = snapshot.experience_level;
  const normalized = typeof experience === 'string' ? normalizeText(experience) : '';
  const experienceLevel: GroupMemberInput['experienceLevel'] =
    normalized === 'beginner' || normalized === 'debut' || normalized === 'debutant'
      ? 'beginner'
      : normalized === 'advanced' || normalized === 'aguerri' || normalized === 'avance'
        ? 'advanced'
        : normalized === 'expert'
          ? 'advanced'
          : 'intermediate';

  const limitations =
    typeof snapshot.limitations === 'string' && snapshot.limitations.trim() !== ''
      ? [snapshot.limitations.trim()]
      : undefined;

  return {
    memberId,
    displayName: label,
    role,
    flatSpeedKmH: toFiniteNumber(snapshot.flat_speed_kmh),
    ascentSpeedMPerHour: toFiniteNumber(snapshot.ascent_speed_m_per_h),
    descentSpeedMPerHour: toFiniteNumber(snapshot.descent_speed_m_per_h),
    packWeightKg: toFiniteNumber(snapshot.pack_weight_kg),
    maxCarryKg: toFiniteNumber(snapshot.max_carry_kg),
    experienceLevel,
    limitations,
    isChild: snapshot.is_child === true,
  };
}

/** Étapes réelles → segments du moteur A8 (ordre stable, trous ignorés). */
export function groupSegmentsFromStepRows(rows: PartyStepRow[]): GroupSegment[] {
  const segments: GroupSegment[] = [];
  for (const row of rows) {
    const distanceKm = toFiniteNumber(row.distance_km);
    const gainM = toFiniteNumber(row.elevation_gain_m);
    const lossM = toFiniteNumber(row.elevation_loss_m);
    if (distanceKm == null && gainM == null && lossM == null) continue;
    segments.push({
      segmentId: segments.length + 1,
      distanceM: Math.max(0, (distanceKm ?? 0) * 1000),
      gainM: Math.max(0, gainM ?? 0),
      lossM: Math.max(0, lossM ?? 0),
    });
  }
  return segments;
}

/**
 * `owner_id` des items partagés selon les transferts du plan A8 : seuls les
 * receveurs disposant d'une capacité transférée peuvent porter un item de
 * poids connu ; tout le reste reste `null` (à assigner, jamais un porteur
 * inventé).
 */
export function planSharedItemOwnerAssignments(
  items: PartyItemRow[],
  transfers: GroupPlan['gearRedistribution'],
  memberIds: string[]
): SharedOwnerAssignment[] {
  const capacities = new Map<string, number>();
  for (const transfer of transfers) {
    const weight = toFiniteNumber(transfer.weightKg) ?? 0;
    if (weight <= 0) continue;
    capacities.set(transfer.toMemberId, (capacities.get(transfer.toMemberId) ?? 0) + weight);
  }

  const memberSet = new Set(memberIds);
  const assignments: SharedOwnerAssignment[] = [];

  for (const item of items) {
    if (item.ownership !== 'shared') continue;
    if (item.owner_id && memberSet.has(item.owner_id)) continue;

    const weightKg =
      item.weight_grams != null && item.weight_grams > 0 ? item.weight_grams / 1000 : null;
    let assigned: string | null = null;

    if (weightKg != null) {
      for (const transfer of transfers) {
        const remaining = capacities.get(transfer.toMemberId) ?? 0;
        if (remaining >= weightKg) {
          assigned = transfer.toMemberId;
          capacities.set(transfer.toMemberId, remaining - weightKg);
          break;
        }
      }
    }

    if (assigned !== item.owner_id) {
      assignments.push({ id: item.id, ownerId: assigned });
    }
  }

  return assignments;
}

/**
 * Lignes prévisionnelles recalculées pour N : base par personne conservée dans
 * `metadata.per_person_eur` (rejeu exact), provenance `party_recompute`,
 * répartition égale, jamais de ligne à zéro.
 */
export function recomputePlannedBudgetLines(
  rows: PartyExpenseRow[],
  partySize: number
): PartyBudgetLine[] {
  const size = Math.max(1, Math.trunc(partySize || 1));
  const lines: PartyBudgetLine[] = [];

  for (const row of rows) {
    const metadata = row.metadata ?? {};
    const amount = toFiniteNumber(row.amount);
    const storedPerPerson = toFiniteNumber(metadata.per_person_eur);
    const basePartySizeRaw = toFiniteNumber(metadata.party_size);
    const basePartySize =
      basePartySizeRaw != null && basePartySizeRaw > 0 ? Math.trunc(basePartySizeRaw) : 1;

    const perPerson =
      storedPerPerson != null && storedPerPerson > 0
        ? storedPerPerson
        : amount != null && amount > 0
          ? amount / basePartySize
          : 0;

    const amountEur = round2(perPerson * size);
    if (!(amountEur > 0)) continue;

    lines.push({
      title: row.title,
      amountEur,
      category: row.category,
      currency: row.currency,
      expenseDate: row.expense_date,
      payerId: row.payer_id,
      metadata: {
        ...metadata,
        source: 'party_recompute',
        party_size: size,
        per_person_eur: round2(perPerson),
        split: 'equal',
      },
    });
  }

  return lines;
}

/** Durée civile réelle du voyage (null = inconnue, jamais inventée). */
function tripDurationDays(trip: PartyTripRow): number | null {
  if (parseCivilDate(trip.start_date) && parseCivilDate(trip.end_date)) {
    const days = getCivilDurationDays(trip.start_date as string, trip.end_date as string);
    return days > 0 ? days : null;
  }
  return null;
}

/**
 * Recalcule l'équipage d'un voyage : quantités, portage, budget prévisionnel et
 * rappels par personne. Idempotent (`party_version` + règles absolues).
 */
export async function recomputeParty(tripId: string): Promise<RecomputePartyResult> {
  const warnings: string[] = [];
  const service = getServiceSupabase();
  if (!service) {
    return { partySize: 1, version: 0, warnings: ['Service indisponible — recalcul non appliqué.'] };
  }

  const { data: tripData } = await service
    .from('trips')
    .select(
      'id, user_id, party_size, party_version, primary_activity, difficulty, destination_country_code, start_date, end_date, budget_currency'
    )
    .eq('id', tripId)
    .maybeSingle();

  if (!tripData) {
    return { partySize: 0, version: 0, warnings: ['Voyage introuvable — recalcul non appliqué.'] };
  }
  const trip = tripData as unknown as PartyTripRow;

  const [{ data: collabData }, { data: profileData }, { data: stepData }] = await Promise.all([
    service.from('trip_collaborators').select('user_id, role').eq('trip_id', tripId),
    service
      .from('trip_member_profiles')
      .select(
        'user_id, flat_speed_kmh, ascent_speed_m_per_h, descent_speed_m_per_h, pack_weight_kg, max_carry_kg, experience_level, limitations, is_child'
      )
      .eq('trip_id', tripId),
    service
      .from('trip_steps')
      .select('distance_km, elevation_gain_m, elevation_loss_m')
      .eq('trip_id', tripId)
      .order('day_number', { ascending: true })
      .order('order_index', { ascending: true }),
  ]);

  const profileRows = (profileData ?? []) as unknown as PartyMemberProfileRow[];
  const collaborators = (collabData ?? []) as { user_id: string; role: string }[];

  const memberIds =
    collaborators.length > 0
      ? collaborators.map((row) => row.user_id)
      : profileRows.length > 0
        ? profileRows.map((row) => row.user_id)
        : [trip.user_id];

  const partySize = Math.max(1, memberIds.length);
  const profileByUser = new Map(profileRows.map((row) => [row.user_id, row]));
  const members = memberIds.map((userId, index) =>
    buildPartyMember(
      userId,
      userId === trip.user_id ? 'owner' : 'member',
      profileByUser.get(userId) ?? null,
      `Membre ${index + 1}`
    )
  );

  if (profileRows.length === 0) {
    warnings.push('Aucun profil membre — moyennes population utilisées.');
  } else if (memberIds.some((userId) => !profileByUser.has(userId))) {
    warnings.push('Profils manquants pour certains membres — moyennes population utilisées.');
  }

  const segments = groupSegmentsFromStepRows((stepData ?? []) as unknown as PartyStepRow[]);
  if (segments.length === 0) {
    warnings.push('Aucune étape — allure recalculée sans dénivelé réel.');
  }

  const plan = buildGroupPlan(members, segments, { strategy: 'recommended' });

  // ── Items : purge des lignes recalculées puis quantités absolues + portage ──
  await service.from('trip_items').delete().eq('trip_id', tripId).eq('source', 'party_recompute');
  const { data: itemData } = await service
    .from('trip_items')
    .select(
      'id, item_name, category, quantity, ownership, owner_id, is_consumable, weight_grams'
    )
    .eq('trip_id', tripId);
  const items = (itemData ?? []) as unknown as PartyItemRow[];

  for (const item of items) {
    const desired = itemQuantityForParty(item, partySize);
    if (desired !== item.quantity) {
      await service.from('trip_items').update({ quantity: desired }).eq('id', item.id);
    }
  }

  for (const assignment of planSharedItemOwnerAssignments(items, plan.gearRedistribution, memberIds)) {
    await service
      .from('trip_items')
      .update({ owner_id: assignment.ownerId })
      .eq('id', assignment.id);
  }

  // ── Budget prévisionnel : purge des lignes recalculées puis réécriture ─────
  const { data: expenseData } = await service
    .from('trip_expenses')
    .select('id, title, amount, category, currency, expense_date, payer_id, metadata')
    .eq('trip_id', tripId)
    .eq('is_planned', true);
  const plannedRows = (expenseData ?? []) as unknown as PartyExpenseRow[];

  if (plannedRows.length > 0) {
    const lines = recomputePlannedBudgetLines(plannedRows, partySize);
    await service.from('trip_expenses').delete().eq('trip_id', tripId).eq('is_planned', true);
    if (lines.length > 0) {
      await service.from('trip_expenses').insert(
        lines.map((line) => ({
          trip_id: tripId,
          payer_id: line.payerId ?? trip.user_id,
          title: line.title,
          amount: line.amountEur,
          currency: line.currency ?? trip.budget_currency ?? 'EUR',
          category: line.category,
          expense_date: line.expenseDate ?? new Date().toISOString().slice(0, 10),
          split_type: 'equal',
          is_planned: true,
          metadata: line.metadata,
        }))
      );
    }
  }

  // ── Checklist : rappels par personne si une règle réelle existe ────────────
  await ensureChecklistReminders(service, trip, partySize, warnings);

  const version = (toFiniteNumber(trip.party_version) ?? 0) + 1;
  await service
    .from('trips')
    .update({ party_size: partySize, party_version: version })
    .eq('id', tripId);

  return { partySize, version, warnings };
}

/**
 * Ajoute les contrôles de préparation manquants (dédupliqués par libellé réel).
 * Les règles dépendant de N produisent un nouveau rappel quand l'équipe change ;
 * sans règle applicable, aucun libellé n'est écrit (no-op).
 */
async function ensureChecklistReminders(
  service: SupabaseClient,
  trip: PartyTripRow,
  partySize: number,
  warnings: string[]
): Promise<void> {
  try {
    const controls = buildPreTripSafetyControls({
      activity: trip.primary_activity ?? 'hiking',
      countryCode: trip.destination_country_code,
      durationDays: tripDurationDays(trip) ?? 0,
      partySize,
      route: trip.difficulty ? { difficulty: trip.difficulty } : null,
    });
    if (controls.length === 0) return;

    const { data: existing } = await service
      .from('trip_checklist_items')
      .select('label')
      .eq('trip_id', trip.id);
    const labels = new Set(
      ((existing ?? []) as { label: string }[]).map((row) => row.label)
    );
    const missing = controls.filter((control) => !labels.has(control.label));
    if (missing.length === 0) return;

    const { data: last } = await service
      .from('trip_checklist_items')
      .select('position')
      .eq('trip_id', trip.id)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    const basePosition =
      (toFiniteNumber((last as { position?: unknown } | null)?.position) ?? -1) + 1;

    await service.from('trip_checklist_items').insert(
      missing.map((control, index) => ({
        trip_id: trip.id,
        label: control.label,
        due_offset_days: control.dueOffsetDays,
        done: false,
        position: basePosition + index,
      }))
    );
  } catch (error) {
    console.error('[LKDV recomputeParty] checklist rappels en échec:', error);
    warnings.push('Rappels de checklist non actualisés (erreur de lecture/écriture).');
  }
}

export default recomputeParty;
