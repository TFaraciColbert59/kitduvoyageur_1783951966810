/**
 * Compas v5 · tiroir Budget : tout ce que l'écran calcule pour se présenter (fonctions PURES, sans React).
 *
 * Les totaux, la répartition et « qui doit quoi » viennent du moteur (`model.budget`, `model.crew.settlement`,
 * `settleExpenses`) : rien n'est recalculé ici, seulement mis en forme. Règles tenues :
 * - « prévu » = tout ce qui est prévu ET déjà payé (`planned + spent`) : c'est la somme des postes ;
 * - l'enveloppe est PROPOSÉE (prévu arrondi au multiple de 50 au-dessus) tant que personne n'en a fixé une ;
 * - une valeur absente est absente (`null`), jamais un zéro ni une valeur de remplissage ;
 * - aucun taux de change n'est deviné : sans taux, la conversion est dite indisponible.
 */
import type { CompasExpenseInput, CompasModel } from '../../engine/compasModel';
import { convertBetween } from '../../engine/currency';
import type { BudgetFxData, FxKind } from '../../engine/budgetFx';
import type { CompasSettlement } from '../../engine/crew';

/** Pas du stepper d'enveloppe, et arrondi de la proposition. */
export const ENVELOPE_STEP = 50;
/** Plafond de `compasSetBudgetAction` (zod côté serveur). */
export const ENVELOPE_MAX = 10_000_000;
/** Plafond de `addTripExpenseSchema` (zod côté serveur). */
export const EXPENSE_MAX = 100_000;
/** Bornes du libellé : le minimum est celui du schéma serveur (2), le maximum celui de la maquette (80). */
export const EXPENSE_LABEL_MIN = 2;
export const EXPENSE_LABEL_MAX = 80;

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/* ---------- Onglets ---------- */

export type BudgetTab = 'overview' | 'expenses' | 'settle';

/** Trois onglets pour un groupe, deux en solo (personne à qui devoir quoi). */
export function budgetTabs(solo: boolean): BudgetTab[] {
  return solo ? ['overview', 'expenses'] : ['overview', 'expenses', 'settle'];
}

/** Onglet à l'index demandé, ramené dans les bornes (un index hors liste n'ouvre jamais rien de vide). */
export function budgetTabAt(solo: boolean, index: number): BudgetTab {
  const tabs = budgetTabs(solo);
  const i = Number.isFinite(index) ? Math.min(tabs.length - 1, Math.max(0, Math.trunc(index))) : 0;
  return tabs[i];
}

/* ---------- Enveloppe ---------- */

/** Total prévu : ce qui est prévu et ce qui est déjà payé (la somme des postes). */
export function budgetTotal(b: Pick<CompasModel['budget'], 'planned' | 'spent'>): number {
  return round2(b.planned + b.spent);
}

/**
 * Enveloppe proposée : le total arrondi au multiple de 50 au-dessus. Rien à proposer (null) tant qu'aucun
 * montant n'est prévu ou dépensé.
 */
export function proposeEnvelope(total: number): number | null {
  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.ceil(total / ENVELOPE_STEP - 1e-9) * ENVELOPE_STEP;
}

export interface EnvelopeView {
  /** Total prévu (prévu + déjà payé). */
  total: number;
  /** Enveloppe retenue : fixée par l'équipe, sinon proposée ; null sans rien à proposer. */
  amount: number | null;
  /** Le montant est la proposition du Compas (personne n'en a fixé). */
  proposed: boolean;
  /** Enveloppe fixée par l'équipe (`trips.estimated_budget`), null sinon. */
  fixed: number | null;
  /** Part du total dans l'enveloppe, en % entier (peut dépasser 100) ; null sans enveloppe. */
  usedPct: number | null;
  /** Largeur de la barre, bornée de 0 à 100. */
  barPct: number;
  over: boolean;
  /** Écart absolu à l'enveloppe : reste si elle n'est pas dépassée, dépassement sinon. */
  gap: number | null;
}

export function envelopeView(b: Pick<CompasModel['budget'], 'target' | 'planned' | 'spent'>): EnvelopeView {
  const total = budgetTotal(b);
  const fixed = b.target != null && b.target > 0 ? b.target : null;
  const proposedAmount = fixed == null ? proposeEnvelope(total) : null;
  const amount = fixed ?? proposedAmount;
  if (amount == null || amount <= 0) {
    return { total, amount: null, proposed: false, fixed, usedPct: null, barPct: 0, over: false, gap: null };
  }
  const usedPct = Math.round((total / amount) * 100);
  return {
    total,
    amount,
    proposed: fixed == null,
    fixed,
    usedPct,
    barPct: Math.max(0, Math.min(100, usedPct)),
    over: total > amount,
    gap: round2(Math.abs(amount - total)),
  };
}

export type EnvelopeCheck = { ok: true; amount: number } | { ok: false };

/** Montant d'enveloppe saisi : > 0, au plus le plafond du serveur, arrondi au centime. */
export function parseEnvelope(raw: string): EnvelopeCheck {
  const n = parseAmount(raw);
  if (n == null || n <= 0 || n > ENVELOPE_MAX) return { ok: false };
  return { ok: true, amount: n };
}

/** Enveloppe après un pas du stepper : jamais sous un pas, jamais au-dessus du plafond. */
export function stepEnvelope(current: number, direction: 1 | -1): number {
  const next = current + direction * ENVELOPE_STEP;
  return Math.min(ENVELOPE_MAX, Math.max(ENVELOPE_STEP, next));
}

/* ---------- Postes ---------- */

export type PostKey = 'lodging' | 'food' | 'transport' | 'activities' | 'gear' | 'misc' | 'custom';

const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();

/** Noms de postes reconnus (écrits sans accent, en minuscules) : ceux de l'écran actuel, de la maquette et du moteur. */
const ALIASES: Record<string, Exclude<PostKey, 'custom'>> = {
  hebergement: 'lodging',
  nuits: 'lodging',
  logement: 'lodging',
  nourriture: 'food',
  repas: 'food',
  food: 'food',
  transport: 'transport',
  trajet: 'transport',
  activites: 'activities',
  materiel: 'gear',
  achats: 'gear',
  divers: 'misc',
  autre: 'misc',
  other: 'misc',
};

/** Valeur écrite en base pour chaque poste (le vocabulaire de l'écran actuel). */
export const POST_STORED: Record<Exclude<PostKey, 'custom'>, string> = {
  lodging: 'hébergement', // i18n-ok : valeur stockée
  food: 'nourriture',
  transport: 'transport',
  activities: 'activités', // i18n-ok : valeur stockée
  gear: 'matériel', // i18n-ok : valeur stockée
  misc: 'divers',
};

export const POST_KEYS = ['lodging', 'food', 'transport', 'activities', 'gear', 'misc'] as const;

/** Poste d'une dépense : connu, ou libre (le texte de la personne, affiché tel quel). */
export function postOf(raw: string | null | undefined): { key: PostKey; label: string | null } {
  const text = (raw ?? '').trim();
  if (!text) return { key: 'misc', label: null };
  const known = ALIASES[plain(text)];
  return known ? { key: known, label: null } : { key: 'custom', label: text };
}

export interface PostRow {
  key: PostKey;
  /** Texte libre d'un poste inconnu ; null pour les postes connus. */
  label: string | null;
  amount: number;
  /** Part du total des postes, en % entier. */
  pct: number;
}

/**
 * Prévu par poste, à partir de `model.budget.byCategory` : les écritures différentes d'un même poste
 * (« repas » et « nourriture ») sont regroupées, les postes libres restent séparés.
 */
export function postRows(byCategory: ReadonlyArray<{ category: string; amount: number }>): PostRow[] {
  const merged = new Map<string, PostRow>();
  for (const c of byCategory) {
    if (!(c.amount > 0)) continue;
    const { key, label } = postOf(c.category);
    const id = key === 'custom' ? `custom:${plain(label ?? '')}` : key;
    const row = merged.get(id);
    if (row) row.amount = round2(row.amount + c.amount);
    else merged.set(id, { key, label, amount: round2(c.amount), pct: 0 });
  }
  const rows = [...merged.values()].sort((a, b) => b.amount - a.amount);
  const sum = rows.reduce((s, r) => s + r.amount, 0);
  for (const r of rows) r.pct = sum ? Math.round((r.amount / sum) * 100) : 0;
  return rows;
}

/* ---------- Dépenses ---------- */

export interface ExpenseRow {
  id: string;
  title: string;
  amount: number;
  planned: boolean;
  payerId: string;
  /** Nom du payeur, null s'il n'est plus membre du voyage. */
  payerName: string | null;
  post: PostKey;
  postLabel: string | null;
  /** Valeur brute de la catégorie, pour la reécrire telle quelle. */
  categoryRaw: string | null;
  splitType: string;
}

/** Dépenses réelles ET prévues, distinguées. L'ordre de la base est gardé. */
export function expenseGroups(
  expenses: readonly CompasExpenseInput[],
  nameOf: (userId: string) => string | null
): { paid: ExpenseRow[]; planned: ExpenseRow[] } {
  const rows = expenses.map((e): ExpenseRow => {
    const { key, label } = postOf(e.category);
    return {
      id: e.id,
      title: e.title,
      amount: e.amount,
      planned: e.isPlanned,
      payerId: e.payerId,
      payerName: nameOf(e.payerId),
      post: key,
      postLabel: label,
      categoryRaw: e.category,
      splitType: e.splitType,
    };
  });
  return { paid: rows.filter((r) => !r.planned), planned: rows.filter((r) => r.planned) };
}

/* ---------- Saisie d'une dépense ---------- */

/**
 * Montant saisi : « 12,5 », « 1 200 », « 3.40 ». Au plus deux chiffres après la virgule comptent (arrondi au
 * centime). Tout le reste (lettres, notation scientifique, plusieurs séparateurs) est refusé : null.
 */
export function parseAmount(raw: string): number | null {
  const text = raw.replace(/[\s  ]/g, '').replace(',', '.');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? round2(n) : null;
}

/** Libellé nettoyé : espaces réduits, caractères de contrôle retirés. Jamais interprété comme du HTML (React l'échappe). */
export function cleanLabel(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface DraftIssues {
  title?: 'length';
  amount?: 'invalid' | 'max';
}

export type DraftCheck = { ok: true; title: string; amount: number } | { ok: false; issues: DraftIssues };

export function validateExpenseDraft(input: { title: string; amount: string }): DraftCheck {
  const title = cleanLabel(input.title);
  const amount = parseAmount(input.amount);
  const issues: DraftIssues = {};
  const length = [...title].length;
  if (length < EXPENSE_LABEL_MIN || length > EXPENSE_LABEL_MAX) issues.title = 'length';
  if (amount == null || amount <= 0) issues.amount = 'invalid';
  else if (amount > EXPENSE_MAX) issues.amount = 'max';
  if (issues.title || issues.amount) return { ok: false, issues };
  return { ok: true, title, amount: amount as number };
}

/* ---------- Formulaires des actions existantes ---------- */

export interface ExpenseCtx {
  tripId: string;
  slug: string;
  currency: string;
}

export interface ExpenseFields {
  title: string;
  amount: number;
  /** Valeur de poste à écrire (voir `POST_STORED`) ou texte libre déjà en base. */
  category: string;
  payerId?: string | null;
  planned: boolean;
  splitType?: string;
}

/** Corps de `addExpenseAction` : les champs que l'action lit, rien d'autre. */
export function addFormData(ctx: ExpenseCtx, f: ExpenseFields): FormData {
  const fd = new FormData();
  fd.set('tripId', ctx.tripId);
  fd.set('tripSlug', ctx.slug);
  fd.set('title', f.title);
  fd.set('amount', String(f.amount));
  fd.set('currency', ctx.currency);
  fd.set('category', f.category);
  fd.set('splitType', f.splitType ?? 'equal');
  fd.set('isPlanned', f.planned ? 'true' : 'false');
  if (f.payerId) fd.set('payerId', f.payerId);
  return fd;
}

/** Corps de `updateExpenseAction` : seuls les champs fournis sont envoyés (l'action ne touche que ceux-là). */
export function updateFormData(
  ctx: ExpenseCtx,
  expenseId: string,
  patch: Partial<Pick<ExpenseFields, 'title' | 'amount' | 'category' | 'payerId' | 'planned'>>
): FormData {
  const fd = new FormData();
  fd.set('tripId', ctx.tripId);
  fd.set('tripSlug', ctx.slug);
  fd.set('expenseId', expenseId);
  if (patch.title !== undefined) fd.set('title', patch.title);
  if (patch.amount !== undefined) fd.set('amount', String(patch.amount));
  if (patch.category !== undefined) fd.set('category', patch.category);
  if (patch.payerId) fd.set('payerId', patch.payerId);
  if (patch.planned !== undefined) fd.set('isPlanned', patch.planned ? 'true' : 'false');
  return fd;
}

/** Corps de `settleExpenseAction` : la dépense prévue devient réelle ; le payeur est celui choisi, sinon inchangé. */
export function settleFormData(ctx: ExpenseCtx, expenseId: string, payerId?: string | null): FormData {
  const fd = new FormData();
  fd.set('tripId', ctx.tripId);
  fd.set('tripSlug', ctx.slug);
  fd.set('expenseId', expenseId);
  if (payerId) fd.set('payerId', payerId);
  return fd;
}

/** Une dépense supprimée peut être recréée à l'identique, sauf si ses parts sont libres (non stockées ici). */
export function canRestore(row: Pick<ExpenseRow, 'splitType'>): boolean {
  return row.splitType !== 'custom';
}

/** Les champs pour recréer une dépense supprimée (la date de saisie sera celle du jour). */
export function restoreFields(row: ExpenseRow): ExpenseFields {
  return {
    title: row.title,
    amount: row.amount,
    category: row.categoryRaw?.trim() || POST_STORED.misc,
    payerId: row.payerId,
    planned: row.planned,
    splitType: row.splitType,
  };
}

/* ---------- Qui doit quoi ---------- */

export interface DebtView {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
  /** Le lecteur doit (`pays`), reçoit (`gets`) ou n'est pas concerné. */
  viewer: 'pays' | 'gets' | null;
}

export interface BalanceView {
  userId: string;
  name: string;
  paid: number;
  share: number;
  net: number;
}

export interface SettleView {
  debts: DebtView[];
  balances: BalanceView[];
  /** Total des dépenses réelles prises en compte. */
  counted: number;
  excludedCount: number;
  excludedAmount: number;
  balanced: boolean;
  /** Dépensé par personne (dépenses réelles, hors parts libres, sur la taille du groupe). */
  perPerson: number | null;
  /** Il n'y a encore aucune dépense réelle. */
  empty: boolean;
}

export function settleView(
  settlement: CompasSettlement,
  groupSize: number,
  viewerId: string | null,
  spent: number
): SettleView {
  const debts = settlement.debts.map((d): DebtView => ({
    fromId: d.fromUserId,
    fromName: d.fromName,
    toId: d.toUserId,
    toName: d.toName,
    amount: d.amount,
    viewer: viewerId && d.fromUserId === viewerId ? 'pays' : viewerId && d.toUserId === viewerId ? 'gets' : null,
  }));
  const balances = settlement.balances
    .filter((b) => b.paid !== 0 || b.share !== 0)
    .map((b) => ({ userId: b.userId, name: b.name, paid: b.paid, share: b.share, net: b.net }));
  return {
    debts,
    balances,
    counted: settlement.countedAmount,
    excludedCount: settlement.excludedCount,
    excludedAmount: settlement.excludedAmount,
    balanced: debts.length === 0,
    perPerson: groupSize >= 1 && spent > 0 ? round2(spent / groupSize) : null,
    empty: settlement.countedAmount === 0 && settlement.excludedCount === 0,
  };
}

/* ---------- Autres devises ---------- */

export type FxPartId = 'envelope' | 'planned' | 'spent' | 'perPerson';

export interface FxView {
  currency: string;
  kinds: FxKind[];
  unavailable: boolean;
  /** Taux appliqué (1 devise du voyage = rate × devise affichée), sa date et sa source ; null si indisponible. */
  rate: number | null;
  date: string | null;
  source: string | null;
  parts: Array<{ id: FxPartId; amount: number }>;
}

/**
 * Les montants du voyage dans chaque autre devise à montrer (`data.budgetFx`). Le taux est celui du premier
 * montant (le même pour tous). Un taux manquant : la ligne est marquée indisponible, aucun montant n'est deviné.
 */
export function fxViews(
  fx: BudgetFxData | null | undefined,
  tripCurrency: string,
  items: ReadonlyArray<{ id: FxPartId; amount: number | null | undefined }>
): FxView[] {
  const todo = items.filter(
    (i): i is { id: FxPartId; amount: number } => typeof i.amount === 'number' && Number.isFinite(i.amount) && i.amount > 0
  );
  if (!fx || !fx.targets.length || !todo.length) return [];
  return fx.targets.map((target) => {
    const converted = todo.map((i) => ({ id: i.id, conv: convertBetween(i.amount, tripCurrency, target.currency, fx.rates) }));
    const first = converted[0].conv;
    if (!first || converted.some((c) => !c.conv)) {
      return { currency: target.currency, kinds: target.kinds, unavailable: true, rate: null, date: null, source: null, parts: [] };
    }
    return {
      currency: target.currency,
      kinds: target.kinds,
      unavailable: false,
      rate: first.rate,
      date: first.date,
      source: first.source,
      parts: converted.map((c) => ({ id: c.id, amount: (c.conv as NonNullable<typeof c.conv>).amount })),
    };
  });
}
