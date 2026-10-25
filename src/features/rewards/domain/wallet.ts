import { z } from 'zod';
import { parseProgram, type ProgramContract } from './contract';
import type { CatalogItem } from './catalog';

/**
 * Portefeuille de points (pur) : lecture du snapshot serveur
 * (`rewards_wallet_snapshot`), états d'affichage et libellés.
 *
 * Règles d'affichage (03-ux-et-benchmarks.md § 4) :
 *   - inconnu ≠ 0 : sans donnée serveur, « Solde indisponible », jamais 0 ;
 *   - l'attente (« en vérification ») n'est jamais additionnée au solde ;
 *   - hors ligne : dernier solde connu, daté, et aucun échange possible.
 */

const nullableString = z.string().nullable().optional().transform((v) => v ?? null);

const catalogSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: nullableString,
  points_cost: z.number().int(),
  category: nullableString,
  value: nullableString,
  image: nullableString,
  alt: nullableString,
  available: z.boolean(),
  expires_at: nullableString,
  fulfillment: z.enum(['physical', 'voucher', 'service', 'digital']).nullable().optional().transform((v) => v ?? null),
  terms: nullableString,
  terms_version: nullableString,
  partner_disclosure: nullableString,
  cash_complement_cents: z.number().int().nullable().optional().transform((v) => v ?? 0),
  funding_status: z.enum(['unfunded', 'funded', 'suspended']).catch('unfunded'),
  stock_remaining: z.number().int().nullable().optional().transform((v) => v ?? null),
  created_at: nullableString,
});

const historySchema = z.object({
  id: z.string(),
  action: z.string(),
  points: z.number().int(),
  type: nullableString,
  created_at: z.string(),
  source_kind: nullableString,
});

const awardSchema = z.object({
  id: z.string(),
  rule_key: z.string(),
  points: z.number().int(),
  status: z.enum(['pending', 'confirmed', 'refused', 'reversed']),
  reason: nullableString,
  created_at: z.string(),
  decided_at: nullableString,
  reversal_shortfall: z.number().int().optional().default(0),
});

const redemptionSchema = z.object({
  id: z.string(),
  reward_id: nullableString,
  reward_title: nullableString,
  points_spent: z.number().int(),
  status: z.string(),
  reference: nullableString,
  created_at: z.string(),
  cancelled_at: nullableString,
});

export const snapshotSchema = z.object({
  success: z.literal(true),
  generated_at: z.string(),
  balance: z.number().int(),
  program: z.unknown(),
  week: z.object({ start: z.string(), used: z.number().int() }),
  pending_points: z.number().int(),
  goal: z.object({ reward_id: z.string(), chosen_at: z.string() }).nullable(),
  catalog: z.array(catalogSchema),
  history: z.array(historySchema),
  awards: z.array(awardSchema),
  redemptions: z.array(redemptionSchema),
  legacy: z.object({
    economic_points: z.number(),
    economic_pending_points: z.number(),
    available_cash: z.union([z.number(), z.string()]).transform(Number),
    pending_cash: z.union([z.number(), z.string()]).transform(Number),
    store_credit_cents: z.union([z.number(), z.string()]).transform(Number),
    cashout_active: z.boolean().optional().default(false),
    cashout_min_threshold: z.union([z.number(), z.string()]).nullable().optional().transform((v) => (v === null || v === undefined ? null : Number(v))),
    withdrawals: z
      .array(
        z.object({
          id: z.string(),
          amount: z.union([z.number(), z.string()]).transform(Number),
          status: z.string(),
          payment_provider: nullableString,
          requested_at: z.string(),
          rejection_reason: nullableString,
        })
      )
      .optional()
      .default([]),
  }),
});

export interface HistoryEntry {
  id: string;
  label: string;
  points: number;
  kind: HistoryKind;
  createdAt: string;
}

export interface AwardEntry {
  id: string;
  ruleKey: string;
  points: number;
  status: 'pending' | 'confirmed' | 'refused' | 'reversed';
  reason: string | null;
  createdAt: string;
  reversalShortfall: number;
}

export interface RedemptionEntry {
  id: string;
  rewardId: string | null;
  rewardTitle: string;
  pointsSpent: number;
  status: string;
  reference: string | null;
  createdAt: string;
  cancelledAt: string | null;
}

export interface LegacyRights {
  economicPoints: number;
  economicPendingPoints: number;
  availableCashEur: number;
  pendingCashEur: number;
  storeCreditCents: number;
  cashoutActive: boolean;
  /** Seuil lu en configuration ; null si absent (aucun seuil inventé). */
  cashoutMinThresholdEur: number | null;
  withdrawals: WithdrawalEntry[];
}

export interface WithdrawalEntry {
  id: string;
  amountEur: number;
  status: string;
  provider: string | null;
  requestedAt: string;
  rejectionReason: string | null;
}

export interface Wallet {
  generatedAt: string;
  balance: number;
  pendingPoints: number;
  weekStart: string;
  weekUsed: number;
  program: ProgramContract;
  goalRewardId: string | null;
  catalog: CatalogItem[];
  history: HistoryEntry[];
  awards: AwardEntry[];
  redemptions: RedemptionEntry[];
  legacy: LegacyRights;
}

export type HistoryKind = 'gain' | 'achat' | 'ouverture' | 'echange' | 'remboursement' | 'correction' | 'depense' | 'autre';

/** Type d'écriture du journal → catégorie lisible. Inconnu → « autre », jamais masqué. */
export function historyKind(type: string | null, points: number): HistoryKind {
  switch (type) {
    case 'award':
    case 'earn':
    case 'earned':
      return 'gain';
    case 'purchase':
      return 'achat';
    case 'opening_balance':
      return 'ouverture';
    case 'reward_redemption':
      return 'echange';
    case 'redeem_refund':
    case 'cart_refund':
      return 'remboursement';
    case 'award_reversal':
      return 'correction';
    case 'spent':
      return 'depense';
    default:
      return points >= 0 ? 'autre' : 'depense';
  }
}

export function parseWallet(input: unknown): Wallet | null {
  const parsed = snapshotSchema.safeParse(input);
  if (!parsed.success) return null;
  const s = parsed.data;
  return {
    generatedAt: s.generated_at,
    balance: s.balance,
    pendingPoints: s.pending_points,
    weekStart: s.week.start,
    weekUsed: s.week.used,
    program: parseProgram(s.program),
    goalRewardId: s.goal?.reward_id ?? null,
    catalog: s.catalog.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description ?? '',
      pointsCost: item.points_cost,
      category: item.category ?? '',
      value: item.value ?? '',
      image: item.image,
      alt: item.alt ?? item.title,
      available: item.available,
      expiresAt: item.expires_at,
      fulfillment: item.fulfillment,
      terms: item.terms,
      termsVersion: item.terms_version,
      partnerDisclosure: item.partner_disclosure,
      cashComplementCents: item.cash_complement_cents,
      fundingStatus: item.funding_status,
      stockRemaining: item.stock_remaining,
      createdAt: item.created_at,
    })),
    history: s.history.map((entry) => ({
      id: entry.id,
      label: entry.action,
      points: entry.points,
      kind: historyKind(entry.type, entry.points),
      createdAt: entry.created_at,
    })),
    awards: s.awards.map((award) => ({
      id: award.id,
      ruleKey: award.rule_key,
      points: award.points,
      status: award.status,
      reason: award.reason,
      createdAt: award.created_at,
      reversalShortfall: award.reversal_shortfall,
    })),
    redemptions: s.redemptions.map((r) => ({
      id: r.id,
      rewardId: r.reward_id,
      rewardTitle: r.reward_title ?? 'Récompense retirée du catalogue',
      pointsSpent: r.points_spent,
      status: r.status,
      reference: r.reference,
      createdAt: r.created_at,
      cancelledAt: r.cancelled_at,
    })),
    legacy: {
      economicPoints: s.legacy.economic_points,
      economicPendingPoints: s.legacy.economic_pending_points,
      availableCashEur: Number.isFinite(s.legacy.available_cash) ? s.legacy.available_cash : 0,
      pendingCashEur: Number.isFinite(s.legacy.pending_cash) ? s.legacy.pending_cash : 0,
      storeCreditCents: Number.isFinite(s.legacy.store_credit_cents) ? s.legacy.store_credit_cents : 0,
      cashoutActive: s.legacy.cashout_active,
      cashoutMinThresholdEur:
        s.legacy.cashout_min_threshold !== null && Number.isFinite(s.legacy.cashout_min_threshold)
          ? s.legacy.cashout_min_threshold
          : null,
      withdrawals: s.legacy.withdrawals.map((w) => ({
        id: w.id,
        amountEur: Number.isFinite(w.amount) ? w.amount : 0,
        status: w.status,
        provider: w.payment_provider,
        requestedAt: w.requested_at,
        rejectionReason: w.rejection_reason,
      })),
    },
  };
}

/** Le circuit cash/part créateur ne s'affiche que s'il porte un droit réel. */
export function hasLegacyRights(legacy: LegacyRights): boolean {
  return (
    legacy.economicPoints > 0 ||
    legacy.economicPendingPoints > 0 ||
    legacy.availableCashEur > 0 ||
    legacy.pendingCashEur > 0 ||
    legacy.storeCreditCents > 0 ||
    legacy.withdrawals.length > 0
  );
}

export const WITHDRAWAL_STATUS_LABEL: Record<string, string> = {
  pending: 'En attente',
  under_review: 'En cours d’examen',
  approved: 'Approuvé',
  processing: 'Virement en cours',
  paid: 'Versé',
  rejected: 'Refusé',
};

export type WalletView =
  | { state: 'loading' }
  | { state: 'unauthenticated' }
  | { state: 'unavailable' }
  | { state: 'offline'; wallet: Wallet; savedAt: string }
  | { state: 'offline_empty' }
  | { state: 'ready'; wallet: Wallet };

export interface WalletViewInput {
  authenticated: boolean | null;
  online: boolean;
  loading: boolean;
  error: boolean;
  wallet: Wallet | null;
  cached: { wallet: Wallet; savedAt: string } | null;
}

/** Une seule source pour l'état affiché : jamais un 0 transitoire. */
export function walletView(input: WalletViewInput): WalletView {
  if (input.authenticated === false) return { state: 'unauthenticated' };
  if (!input.online) {
    if (input.wallet) return { state: 'offline', wallet: input.wallet, savedAt: input.wallet.generatedAt };
    if (input.cached) return { state: 'offline', wallet: input.cached.wallet, savedAt: input.cached.savedAt };
    return { state: 'offline_empty' };
  }
  if (input.wallet) return { state: 'ready', wallet: input.wallet };
  if (input.loading || input.authenticated === null) return { state: 'loading' };
  if (input.error) return { state: 'unavailable' };
  return { state: 'loading' };
}

const POINTS_FORMAT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** Entiers, séparateur français des milliers (espace fine insécable). */
export function formatPoints(value: number): string {
  return POINTS_FORMAT.format(Math.trunc(value));
}

export function formatSignedPoints(value: number): string {
  const abs = formatPoints(Math.abs(value));
  return value > 0 ? `+${abs}` : value < 0 ? `−${abs}` : '0';
}

export function formatDay(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const AWARD_STATUS_LABEL: Record<AwardEntry['status'], string> = {
  pending: 'En vérification',
  confirmed: 'Validé',
  refused: 'Non attribué',
  reversed: 'Attribution corrigée',
};

export const AWARD_REASON_LABEL: Record<string, string> = {
  rule_limit: 'Limite de la semaine atteinte pour cette action',
  weekly_cap: 'Plafond de points de la semaine atteint',
  review_refused: 'Cette contribution n’est pas éligible',
};

export const REDEMPTION_STATUS_LABEL: Record<string, string> = {
  reserved: 'Récompense réservée',
  shipped: 'Expédiée',
  fulfilled: 'Remise',
  completed: 'Échangée',
  cancelled: 'Réservation annulée',
};

/**
 * Message près de l'action après une demande de gain : célébration seulement
 * sur décision confirmée, « en vérification » si le serveur a enregistré une
 * attente, rien sinon (programme fermé, refus, doublon, réponse illisible).
 */
export function earnAnnouncement(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const { status, points } = payload as { status?: unknown; points?: unknown };
  if (typeof points !== 'number' || !Number.isInteger(points) || points <= 0) return null;
  if (status === 'confirmed') return `+${formatPoints(points)} points validés`;
  if (status === 'pending') return `${formatPoints(points)} points en vérification`;
  return null;
}

/** Prochain lundi (renouvellement du plafond), pour expliquer la règle. */
export function nextWeekStart(weekStart: string): string {
  const at = new Date(`${weekStart}T00:00:00`);
  if (Number.isNaN(at.getTime())) return '';
  at.setDate(at.getDate() + 7);
  return at.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
