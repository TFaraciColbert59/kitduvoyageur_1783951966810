/**
 * Chantier configurateur (L0.7) — modification d'une aventure enregistrée.
 *
 * Une modification ne réécrit jamais l'historique : elle produit une NOUVELLE
 * version immuable, persistée par `a13_append_plan_version` (propriété vérifiée
 * sous verrou côté base). Le snapshot précédent est repris tel quel — candidats,
 * plan de groupe, simulation trek — seul le plan accepté change.
 *
 * Les sections calculées (météo, sac, ETA…) décrivent le plan d'ORIGINE. Si
 * l'utilisateur change ce qui les fonde (lieu, date, durée, activités, groupe),
 * elles ne sont pas recalculées en silence : la version porte `sectionsStale`
 * pour que l'écran l'annonce. Le recalcul ciblé relève du lot L6.
 *
 * Module PUR : aucune I/O, aucune horloge implicite.
 */
import type { AcceptedPrepPlan } from '@/features/adventure-prep/acceptedPlan';
import type { AdventurePlan } from './adventurePlan';

export const ACCEPTED_PLAN_EDIT_REASON = 'prep-edited';
export const ACCEPTED_PLAN_EDIT_GENERATOR = 'prep-editor';

export interface AcceptedPlanEditMeta {
  editedAt: string;
  /** Vrai si un fondement des sections calculées a changé depuis la génération. */
  sectionsStale: boolean;
  /** Fondements modifiés, en clair, pour l'affichage. */
  changedFoundations: readonly AcceptedPlanFoundation[];
}

export type AcceptedPlanFoundation = 'lieux' | 'dates' | 'duree' | 'activites' | 'groupe';

export interface AcceptedPlanEditVersion {
  snapshot: Record<string, unknown>;
  reason: string;
  generated_by: string;
  confidence: AdventurePlan['confidence'];
  created_at: string;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Fondements des sections calculées qui diffèrent entre deux plans acceptés.
 * Sans plan précédent (plan créé avant le contrat), tout est considéré changé :
 * on ne prétend jamais que les sections sont à jour sans pouvoir le vérifier.
 */
export function changedFoundations(
  previous: AcceptedPrepPlan | null,
  next: AcceptedPrepPlan,
): AcceptedPlanFoundation[] {
  if (!previous) return ['lieux', 'dates', 'duree', 'activites', 'groupe'];
  const changed: AcceptedPlanFoundation[] = [];
  if (!sameJson(previous.route, next.route)) changed.push('lieux');
  if (previous.calendar.startDate !== next.calendar.startDate) changed.push('dates');
  if (previous.calendar.durationDays !== next.calendar.durationDays) changed.push('duree');
  if (!sameJson(previous.activities, next.activities)) changed.push('activites');
  if (
    previous.group.adults !== next.group.adults ||
    previous.group.children !== next.group.children
  ) {
    changed.push('groupe');
  }
  return changed;
}

/** Titre visible : le nom choisi, sinon le titre existant. */
export function editedTitle(plan: AdventurePlan, accepted: AcceptedPrepPlan): string | undefined {
  const cover = accepted.coverName?.trim();
  return cover && cover.length > 0 ? cover.slice(0, 200) : plan.title;
}

export interface BuildAcceptedPlanEditInput {
  plan: AdventurePlan;
  /** Snapshot brut de la dernière version (peut porter candidats, groupe, trek). */
  latestSnapshot: unknown;
  previousAccepted: AcceptedPrepPlan | null;
  nextAccepted: AcceptedPrepPlan;
  now: string;
}

export function buildAcceptedPlanEditVersion(
  input: BuildAcceptedPlanEditInput,
): { version: AcceptedPlanEditVersion; meta: AcceptedPlanEditMeta; title: string | undefined } {
  const base =
    input.latestSnapshot !== null && typeof input.latestSnapshot === 'object'
      ? (input.latestSnapshot as Record<string, unknown>)
      : (input.plan as unknown as Record<string, unknown>);

  const foundations = changedFoundations(input.previousAccepted, input.nextAccepted);
  const previousMeta = base.acceptedPlanMeta as Partial<AcceptedPlanEditMeta> | undefined;
  // Une fois périmées, les sections le restent jusqu'au recalcul : revenir aux
  // valeurs d'origine ne suffit pas à prouver qu'elles sont à jour.
  const sectionsStale = foundations.length > 0 || previousMeta?.sectionsStale === true;
  const meta: AcceptedPlanEditMeta = {
    editedAt: input.now,
    sectionsStale,
    changedFoundations: foundations,
  };
  const title = editedTitle(input.plan, input.nextAccepted);

  return {
    title,
    meta,
    version: {
      snapshot: {
        ...base,
        ...(title !== undefined ? { title } : {}),
        updatedAt: input.now,
        acceptedPlan: input.nextAccepted,
        acceptedPlanMeta: meta,
      },
      reason: ACCEPTED_PLAN_EDIT_REASON,
      generated_by: ACCEPTED_PLAN_EDIT_GENERATOR,
      confidence: input.plan.confidence,
      created_at: input.now,
    },
  };
}

/** Relecture tolérante de la méta d'édition d'un snapshot. */
export function acceptedPlanMetaFromSnapshot(snapshot: unknown): AcceptedPlanEditMeta | null {
  if (snapshot === null || typeof snapshot !== 'object') return null;
  const raw = (snapshot as { acceptedPlanMeta?: unknown }).acceptedPlanMeta;
  if (raw === null || typeof raw !== 'object') return null;
  const meta = raw as Record<string, unknown>;
  if (typeof meta.editedAt !== 'string' || typeof meta.sectionsStale !== 'boolean') return null;
  const allowed: readonly AcceptedPlanFoundation[] = ['lieux', 'dates', 'duree', 'activites', 'groupe'];
  const changed = Array.isArray(meta.changedFoundations)
    ? meta.changedFoundations.filter((value): value is AcceptedPlanFoundation =>
        allowed.includes(value as AcceptedPlanFoundation),
      )
    : [];
  return { editedAt: meta.editedAt, sectionsStale: meta.sectionsStale, changedFoundations: changed };
}
