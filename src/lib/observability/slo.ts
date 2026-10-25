/**
 * Phase 10 — SLO & alertes comme code.
 *
 * Reprend le tableau « SLO proposés » de
 * `docs/architecture/CHANTIER_LANCEMENT_MONDIAL.md` §Phase 10 dans une
 * configuration versionnée, évaluée par des fonctions pures testées.
 *
 * Règle d'honnêteté structurante : une mesure absente vaut
 * `insufficient_data` — JAMAIS `pass`. Un rapport qui ne peut pas mesurer un
 * SLO doit le déclarer manquant, pas vert.
 *
 * Le branchement à un destinataire réel (e-mail, Slack, pager) est un item
 * humain/ops : le code produit des alertes évaluables, pas un envoi réseau.
 */

export type SloComparator = 'gte' | 'lte' | 'eq';
export type SloUnit = 'ratio' | 'percent' | 'ms' | 'min' | 'count';
export type SloStatus = 'pass' | 'fail' | 'insufficient_data';

/** Clés de mesure reconnues par l'évaluation Phase 10. */
export type Phase10MeasurementKey =
  | 'api_availability_ratio'
  | 'api_read_p95_ms'
  | 'api_write_p95_ms'
  | 'http_5xx_ratio'
  | 'destructive_syncs'
  | 'rls_violations'
  | 'carnet_entry_loss'
  | 'jobs_pending_events'
  | 'jobs_oldest_pending_min';

export interface SloDefinition {
  id: Phase10MeasurementKey;
  label: string;
  target: number;
  comparator: SloComparator;
  unit: SloUnit;
  /** Où la mesure est réellement disponible aujourd'hui (code/table/outil). */
  source: string;
  /** En dessous de cet échantillon, la mesure est jugée non concluante. */
  minSample?: number;
}

export const PHASE10_SLOS: readonly SloDefinition[] = [
  {
    id: 'api_availability_ratio',
    label: 'Disponibilité API principale',
    target: 0.999,
    comparator: 'gte',
    unit: 'ratio',
    source: 'plateforme d’hébergement (Vercel) — non mesurable localement',
  },
  {
    id: 'api_read_p95_ms',
    label: 'Lecture API p95',
    target: 300,
    comparator: 'lte',
    unit: 'ms',
    source: 'logs structurés par route / A15 `conditions` en proxy local',
  },
  {
    id: 'api_write_p95_ms',
    label: 'Écriture API p95',
    target: 500,
    comparator: 'lte',
    unit: 'ms',
    source: 'logs structurés (routes POST) — aucun scénario d’écriture en charge aujourd’hui',
  },
  {
    id: 'http_5xx_ratio',
    label: 'Erreurs 5xx',
    target: 0.01,
    comparator: 'lte',
    unit: 'ratio',
    source: 'plateforme d’hébergement / logs structurés — proxy local A15',
  },
  {
    id: 'destructive_syncs',
    label: 'Synchronisations destructives',
    target: 0,
    comparator: 'eq',
    unit: 'count',
    source: 'journal de sync A13 (`offline_sync_operations`) — compteur ops',
  },
  {
    id: 'rls_violations',
    label: 'Violations RLS',
    target: 0,
    comparator: 'eq',
    unit: 'count',
    source: 'revue pgTAP (Phase 8) + journaux DB — compteur ops',
  },
  {
    id: 'carnet_entry_loss',
    label: 'Perte d’entrée carnet',
    target: 0,
    comparator: 'eq',
    unit: 'count',
    source: 'journal sync/offline (`hike_sessions`, `carnet_moments`) — compteur ops',
  },
  {
    id: 'jobs_pending_events',
    label: 'Jobs en attente (file domaine)',
    target: 50,
    comparator: 'lte',
    unit: 'count',
    source: 'A14 `adventure_domain_events` (mesurable localement)',
  },
  {
    id: 'jobs_oldest_pending_min',
    label: 'Retard maximal d’un job (min)',
    target: 60,
    comparator: 'lte',
    unit: 'min',
    source: 'A14 `adventure_domain_events` (mesurable localement)',
  },
] as const;

export type Phase10Measurements = Partial<Record<Phase10MeasurementKey, number | null>>;

export interface SloEvaluation {
  id: Phase10MeasurementKey;
  label: string;
  target: number;
  comparator: SloComparator;
  unit: SloUnit;
  source: string;
  observed: number | null;
  status: SloStatus;
  reason: string;
}

export interface Phase10SloReport {
  generatedAt: string;
  evaluations: SloEvaluation[];
  failures: SloEvaluation[];
  insufficient: SloEvaluation[];
  alerts: string[];
  /** Aucun SLO en échec (les mesures absentes ne sont PAS un succès). */
  ok: boolean;
  /** Toutes les mesures présentes et aucun échec : seul état « complet ». */
  complete: boolean;
}

function compare(observed: number, definition: SloDefinition): boolean {
  if (definition.comparator === 'gte') return observed >= definition.target;
  if (definition.comparator === 'lte') return observed <= definition.target;
  return observed === definition.target;
}

function formatValue(value: number, unit: SloUnit): string {
  if (unit === 'ratio') return `${(value * 100).toFixed(2)} %`;
  if (unit === 'ms') return `${value} ms`;
  if (unit === 'min') return `${value} min`;
  return String(value);
}

/** Évalue un SLO unique. Mesure absente ou non finie ⇒ `insufficient_data`. */
export function evaluateSlo(
  definition: SloDefinition,
  measurements: Phase10Measurements
): SloEvaluation {
  const raw = measurements[definition.id];
  const base = {
    id: definition.id,
    label: definition.label,
    target: definition.target,
    comparator: definition.comparator,
    unit: definition.unit,
    source: definition.source,
  };
  if (raw == null || typeof raw !== 'number' || !Number.isFinite(raw)) {
    return { ...base, observed: null, status: 'insufficient_data', reason: 'mesure absente' };
  }
  if (!compare(raw, definition)) {
    return {
      ...base,
      observed: raw,
      status: 'fail',
      reason: `observé ${formatValue(raw, definition.unit)} vs cible ${definition.comparator === 'gte' ? '≥' : definition.comparator === 'lte' ? '≤' : '='} ${formatValue(definition.target, definition.unit)}`,
    };
  }
  return {
    ...base,
    observed: raw,
    status: 'pass',
    reason: `observé ${formatValue(raw, definition.unit)} — cible respectée`,
  };
}

/** Évalue l'ensemble des SLO Phase 10 et produit les alertes associées. */
export function evaluatePhase10Slos(
  measurements: Phase10Measurements,
  slos: readonly SloDefinition[] = PHASE10_SLOS,
  generatedAt: string = new Date().toISOString()
): Phase10SloReport {
  const evaluations = slos.map((definition) => evaluateSlo(definition, measurements));
  const failures = evaluations.filter((evaluation) => evaluation.status === 'fail');
  const insufficient = evaluations.filter((evaluation) => evaluation.status === 'insufficient_data');
  const alerts = failures.map(
    (failure) => `[SLO ${failure.id}] ${failure.label} : ${failure.reason} (source : ${failure.source})`
  );
  return {
    generatedAt,
    evaluations,
    failures,
    insufficient,
    alerts,
    ok: failures.length === 0,
    complete: failures.length === 0 && insufficient.length === 0,
  };
}

/**
 * Un échec = alerte immédiate ; un SLO non mesuré = à instrumenter (jamais un
 * acquittement silencieux). Décision lisible pour l'astreinte.
 */
export function alertDecision(report: Phase10SloReport): {
  level: 'none' | 'alert' | 'incomplete';
  page: boolean;
  messages: string[];
} {
  if (report.failures.length > 0) {
    return { level: 'alert', page: true, messages: report.alerts };
  }
  if (report.insufficient.length > 0) {
    return {
      level: 'incomplete',
      page: false,
      messages: report.insufficient.map(
        (evaluation) => `[SLO non mesuré] ${evaluation.id} — instrumentation requise (${evaluation.source})`
      ),
    };
  }
  return { level: 'none', page: false, messages: [] };
}
