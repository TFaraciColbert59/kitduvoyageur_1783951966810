/**
 * Budget : les nuits réellement choisies dans l'itinéraire publié deviennent des lignes PRÉVUES de
 * `trip_expenses` (10.6). Module pur, testé.
 *
 * Règles :
 *  - jamais de montant inventé : une ligne n'existe que si le lieu de nuit retenu porte un repère de prix
 *    (`priceHint`, barème du Compas ou partenaire) ; sinon aucune ligne, la nuit reste « à chiffrer » ;
 *  - le repère est dit comme tel (`metadata.basis`) et la ligne est « prévue », jamais « payée » ;
 *  - idempotent : une clé stable par étape (`route_collab_key`) ; rejouer la synchronisation ne double rien ;
 *  - une ligne retouchée à la main (montant différent de celui posé par la synchronisation) n'est jamais écrasée ;
 *  - transports (par journée : aller / retour, type, montant) et achats prévus du sac : seul un MONTANT SAISI donne une
 *    ligne (total du groupe, jamais multiplié ni estimé) ; « à estimer » (montant absent) n'écrit rien. Clés stables
 *    `<espace>:<étape>:transport:<id>` et `<espace>:kit:<objet>:purchase`, même règle d'idempotence et de non-écrasement.
 */
import { publishedRevisionOf } from './integrations';
import type { RouteWorkspaceState } from './types';

export const BUDGET_SYNC_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'JPY'] as const;

export interface DesiredBudgetLine {
  readonly key: string;
  readonly title: string;
  readonly amount: number;
  readonly currency: string;
  readonly category: 'hébergement' | 'transport' | 'matériel';
  readonly expenseDate: string | null;
  readonly basis: string;
  readonly revisionNo: number;
}

export interface ExistingBudgetLine {
  readonly id: string;
  readonly isPlanned: boolean;
  readonly amount: number;
  readonly metadata: Record<string, unknown> | null;
}

export function desiredBudgetLines(workspace: RouteWorkspaceState, partySize: number): DesiredBudgetLine[] {
  const rev = publishedRevisionOf(workspace);
  if (!rev) return [];
  const party = Math.max(1, Math.min(50, Math.trunc(partySize) || 1));
  const lines: DesiredBudgetLine[] = [];
  for (const stage of rev.stages) {
    const night = stage.overnightPlace;
    const hint = night?.priceHint;
    if (!night || !hint) continue;
    if (!Number.isFinite(hint.perPerson) || hint.perPerson <= 0) continue;
    if (!(BUDGET_SYNC_CURRENCIES as readonly string[]).includes(hint.currency)) continue;
    const amount = Math.round(hint.perPerson * party * 100) / 100;
    if (amount <= 0) continue;
    lines.push({
      key: `${workspace.id}:${stage.id}:night`.slice(0, 120),
      title: `Nuit ${stage.dayNumber} · ${night.name}`.slice(0, 100),
      amount,
      currency: hint.currency,
      category: 'hébergement',
      expenseDate: stage.dateIso && /^\d{4}-\d{2}-\d{2}$/.test(stage.dateIso) ? stage.dateIso : null,
      basis: hint.basis === 'partenaire' ? 'repère partenaire × personnes' : 'repère du barème Compas × personnes (pas le tarif du lieu)',
      revisionNo: rev.revisionNo,
    });
  }
  // Transports saisis : une ligne par transport avec montant (montant total du groupe, tel que saisi).
  const MODE_LABEL: Record<string, string> = { train: 'train', bus: 'bus', avion: 'avion', voiture: 'voiture', taxi: 'taxi', bateau: 'bateau', autre: 'autre transport' };
  for (const stage of rev.stages) {
    for (const t of stage.transports ?? []) {
      if (t.amount == null || !Number.isFinite(t.amount) || t.amount <= 0) continue;
      if (!(BUDGET_SYNC_CURRENCIES as readonly string[]).includes(t.currency)) continue;
      lines.push({
        key: `${workspace.id}:${stage.id}:transport:${t.id}`.slice(0, 120),
        title: `Transport ${t.direction} · ${MODE_LABEL[t.mode] ?? t.mode} · jour ${stage.dayNumber}`.slice(0, 100),
        amount: Math.round(t.amount * 100) / 100,
        currency: t.currency,
        category: 'transport',
        expenseDate: stage.dateIso && /^\d{4}-\d{2}-\d{2}$/.test(stage.dateIso) ? stage.dateIso : null,
        basis: 'montant saisi dans l’itinéraire (total du groupe)',
        revisionNo: rev.revisionNo,
      });
    }
  }
  // Achats prévus du sac (version publiée).
  for (const item of rev.kitSnapshot ?? []) {
    const p = item.plannedPurchase;
    if (!p || !Number.isFinite(p.amount) || p.amount <= 0) continue;
    if (!(BUDGET_SYNC_CURRENCIES as readonly string[]).includes(p.currency)) continue;
    lines.push({
      key: `${workspace.id}:kit:${item.id}:purchase`.slice(0, 120),
      title: `Achat prévu · ${item.name}`.slice(0, 100),
      amount: Math.round(p.amount * 100) / 100,
      currency: p.currency,
      category: 'matériel',
      expenseDate: null,
      basis: 'montant saisi dans le sac (total du groupe)',
      revisionNo: rev.revisionNo,
    });
  }
  return lines;
}

export interface BudgetSyncPlan {
  readonly insert: readonly DesiredBudgetLine[];
  readonly update: ReadonlyArray<{ id: string; line: DesiredBudgetLine }>;
  readonly remove: readonly string[];
}

function keyOf(meta: Record<string, unknown> | null): string | null {
  const v = meta?.route_collab_key;
  return typeof v === 'string' ? v : null;
}

/** Compare les lignes voulues et les lignes déjà écrites par cette synchronisation. */
export function planBudgetSync(
  desired: readonly DesiredBudgetLine[],
  existing: readonly ExistingBudgetLine[],
): BudgetSyncPlan {
  const byKey = new Map<string, ExistingBudgetLine>();
  for (const row of existing) {
    const key = keyOf(row.metadata);
    if (key) byKey.set(key, row);
  }
  const insert: DesiredBudgetLine[] = [];
  const update: Array<{ id: string; line: DesiredBudgetLine }> = [];
  const wanted = new Set<string>();
  for (const line of desired) {
    wanted.add(line.key);
    const row = byKey.get(line.key);
    if (!row) {
      insert.push(line);
      continue;
    }
    const posed = Number(row.metadata?.route_collab_amount);
    const untouched = row.isPlanned && Number.isFinite(posed) && Math.abs(posed - row.amount) < 0.005;
    if (untouched && Math.abs(row.amount - line.amount) >= 0.005) update.push({ id: row.id, line });
  }
  const remove: string[] = [];
  for (const [key, row] of byKey) {
    if (wanted.has(key)) continue;
    const posed = Number(row.metadata?.route_collab_amount);
    // Nuit retirée de la version publiée : seule une ligne prévue et non retouchée disparaît.
    if (row.isPlanned && Number.isFinite(posed) && Math.abs(posed - row.amount) < 0.005) remove.push(row.id);
  }
  return { insert, update, remove };
}
