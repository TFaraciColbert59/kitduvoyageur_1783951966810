import type { TripPhase } from '@/features/trips/engine/temporalPhaseEngine';

export type ActivityStateCheckStatus = 'ready' | 'attention' | 'blocked';
export type ActivityStateCtaKind = 'launch' | 'prepare' | 'continue' | 'recount';

export interface ActivityStateHrefs {
  route: string;
  checklist: string;
  equipment: string;
  safety: string;
  documents: string;
  live: string;
  journal: string;
}

export interface ActivityStateInput {
  phase: TripPhase;
  daysUntil: number | null;
  checklist: { done: number; total: number };
  equipment: { ready: number; total: number };
  safety: { pending: number };
  documents: { expired: number; expiring: number };
  route: {
    ready: boolean;
    href: string;
    name: string | null;
    reason: string | null;
  };
  nextAction: {
    kind: string;
    href: string;
    title: string;
    description: string;
  } | null;
  hrefs: ActivityStateHrefs;
}

export interface ActivityStateCheck {
  id: 'route' | 'checklist' | 'equipment' | 'safety' | 'documents';
  label: string;
  value: string;
  status: ActivityStateCheckStatus;
  href: string;
}

export interface ActivityStateCta {
  kind: ActivityStateCtaKind;
  label: string;
  href: string;
}

export interface ActivityStateViewModel {
  phase: TripPhase;
  ready: boolean;
  timingLabel: string;
  headline: string;
  summary: string;
  validatedChecks: number;
  blockerCount: number;
  attentionCount: number;
  totalChecks: number;
  checks: ActivityStateCheck[];
  blockers: ActivityStateCheck[];
  cta: ActivityStateCta;
  nextAction: ActivityStateInput['nextAction'];
}

function plural(count: number, singular: string, pluralForm = singular + 's'): string {
  return count <= 1 ? singular : pluralForm;
}

function timingLabel(phase: TripPhase, daysUntil: number | null): string {
  if (phase === 'live') return 'En cours';
  if (phase === 'recount') return 'À raconter';
  if (daysUntil == null) return 'Date non renseignée';
  if (daysUntil === 0) return 'Aujourd’hui';
  if (daysUntil === 1) return 'Demain';
  return `J-${daysUntil}`;
}

function readyValue(label: string, value: string): string {
  return `${label} · ${value}`;
}

function buildChecks(input: ActivityStateInput): ActivityStateCheck[] {
  const checklistReady =
    input.checklist.total === 0 || input.checklist.done >= input.checklist.total;
  const equipmentReady =
    input.equipment.total === 0 || input.equipment.ready >= input.equipment.total;

  return [
    {
      id: 'route',
      label: 'Parcours',
      value: input.route.ready
        ? readyValue('GPS vérifié', input.route.name ?? 'Itinéraire disponible')
        : (input.route.reason ?? 'Choisir un parcours vérifié'),
      status: input.route.ready ? 'ready' : 'blocked',
      href: input.route.ready ? input.hrefs.route : input.route.href,
    },
    {
      id: 'checklist',
      label: 'Checklist',
      value:
        input.checklist.total === 0
          ? 'Aucune checklist configurée'
          : readyValue('Validée', `${input.checklist.done}/${input.checklist.total}`),
      status: input.checklist.total === 0 ? 'attention' : checklistReady ? 'ready' : 'blocked',
      href: input.hrefs.checklist,
    },
    {
      id: 'equipment',
      label: 'Équipement',
      value:
        input.equipment.total === 0
          ? 'Aucun équipement déclaré'
          : readyValue('Prêt', `${input.equipment.ready}/${input.equipment.total}`),
      status: input.equipment.total === 0 ? 'attention' : equipmentReady ? 'ready' : 'blocked',
      href: input.hrefs.equipment,
    },
    {
      id: 'safety',
      label: 'Sécurité',
      value:
        input.safety.pending === 0
          ? 'Tous les points sont confirmés'
          : `${input.safety.pending} point${input.safety.pending > 1 ? 's' : ''} à confirmer`,
      status: input.safety.pending === 0 ? 'ready' : 'blocked',
      href: input.hrefs.safety,
    },
    {
      id: 'documents',
      label: 'Documents',
      value:
        input.documents.expired > 0
          ? `${input.documents.expired} document${input.documents.expired > 1 ? 's' : ''} expiré${input.documents.expired > 1 ? 's' : ''}`
          : input.documents.expiring > 0
            ? `${input.documents.expiring} expiration${input.documents.expiring > 1 ? 's' : ''} proche${input.documents.expiring > 1 ? 's' : ''}`
            : 'Tous les documents sont valides',
      status:
        input.documents.expired > 0
          ? 'blocked'
          : input.documents.expiring > 0
            ? 'attention'
            : 'ready',
      href: input.hrefs.documents,
    },
  ];
}

function launchLabel(daysUntil: number | null): string {
  if (daysUntil == null) return 'Démarrer l’activité';
  return daysUntil === 0 ? 'Démarrer maintenant' : 'Démarrer en avance';
}

export function deriveActivityState(input: ActivityStateInput): ActivityStateViewModel {
  const checks = buildChecks(input);
  const blockers = checks.filter((check) => check.status === 'blocked');
  const attentionCount = checks.filter((check) => check.status === 'attention').length;
  const ready = blockers.length === 0;
  const timing = timingLabel(input.phase, input.daysUntil);

  let headline: string;
  let summary: string;
  let cta: ActivityStateCta;

  if (input.phase === 'live') {
    headline = 'Activité en cours';
    summary = 'Le cockpit terrain et les actions de l’activité sont accessibles ici.';
    cta = { kind: 'continue', label: 'Ouvrir le cockpit', href: input.hrefs.live };
  } else if (input.phase === 'recount') {
    headline = 'Expérience terminée';
    summary = 'Le journal, les dépenses et les souvenirs sont prêts à être enrichis.';
    cta = { kind: 'recount', label: 'Ouvrir le carnet', href: input.hrefs.journal };
  } else if (ready) {
    headline =
      input.daysUntil != null && input.daysUntil > 0 ? 'Prête en avance' : 'Prête à partir';
    summary = 'Tous les contrôles requis sont validés. Le départ est disponible.';
    cta = { kind: 'launch', label: launchLabel(input.daysUntil), href: input.route.href };
  } else {
    const blockerCount = blockers.length;
    headline = 'Préparation à finaliser';
    summary = `${blockerCount} ${plural(blockerCount, 'contrôle')} à valider avant le départ.`;
    cta = { kind: 'prepare', label: 'Finaliser la préparation', href: blockers[0].href };
  }

  const nextAction =
    input.nextAction &&
    input.nextAction.href !== cta.href &&
    input.nextAction.kind !== 'navigation' &&
    (ready || input.nextAction.kind !== 'all-clear')
      ? input.nextAction
      : null;

  return {
    phase: input.phase,
    ready,
    timingLabel: timing,
    headline,
    summary,
    validatedChecks: checks.filter((check) => check.status === 'ready').length,
    blockerCount: blockers.length,
    attentionCount,
    totalChecks: checks.length,
    checks,
    blockers,
    cta,
    nextAction,
  };
}
