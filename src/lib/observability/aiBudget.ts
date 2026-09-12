/**
 * Phase 10 — Budget IA calculable depuis les tables réelles.
 *
 * Source de vérité : `public.ai_usage_daily` (PK `user_id, day`) alimentée par
 * `check_and_increment_ai_quota` — plafonds réels du code : 20 requêtes
 * « heavy » et 100 « fast » par utilisateur et par jour
 * (`supabase/migrations/20260903000000_ai_foundations.sql`).
 *
 * Le **budget monétaire** n'est PAS configuré : les modèles utilisés sont
 * `:free` (coût token nul constaté) et aucun barème contractuel n'existe.
 * L'évaluation retourne donc `insufficient_data` dès que le plafond global ou
 * le coût unitaire manque — jamais un faux « dans le budget ».
 *
 * Les identifiants utilisateurs ne sont jamais exposés en clair dans les
 * sorties : seuls des identifiants masqués apparaissent.
 */

export interface AiUsageDailyRow {
  user_id?: string | null;
  day?: string | null;
  requests_heavy?: number | null;
  requests_fast?: number | null;
  requests_by_feature?: Record<string, number> | null;
}

export interface AiBudgetConfig {
  /** Plafond réel par utilisateur/jour (tier heavy). */
  heavyDailyPerUser: number;
  /** Plafond réel par utilisateur/jour (tier fast). */
  fastDailyPerUser: number;
  /** Plafond global de requêtes/jour — `null` = non configuré. */
  globalDailyRequests: number | null;
  /** Budget monétaire en USD — `null` = non contracté. */
  monetaryBudgetUsd: number | null;
  /** Coût unitaire moyen en USD par requête — `null` = inconnu. */
  costPerRequestUsd: number | null;
  note: string;
}

export const AI_BUDGET_CONFIG: AiBudgetConfig = {
  heavyDailyPerUser: 20,
  fastDailyPerUser: 100,
  globalDailyRequests: null,
  monetaryBudgetUsd: null,
  costPerRequestUsd: null,
  note:
    'Modèles :free → coût token 0 constaté ; plafonds réels par utilisateur ' +
    '(20 heavy / 100 fast par jour). Budget global et barème monétaire : ' +
    'INSUFFICIENT_DATA (item humain/ops).',
};

export interface AiUsageSummary {
  rows: number;
  users: number;
  requestsHeavy: number;
  requestsFast: number;
  totalRequests: number;
  /** Agrégat par feature, clés réelles de `requests_by_feature`. */
  byFeature: Record<string, number>;
  /** Jours couverts (date min/max), `null` si aucun. */
  firstDay: string | null;
  lastDay: string | null;
}

/** Masque un identifiant utilisateur (jamais d'UUID complet dans un rapport). */
export function maskUserId(userId: string | null | undefined): string {
  if (!userId) return 'inconnu';
  return `${userId.slice(0, 8)}…`;
}

/** Agrège `ai_usage_daily` (pur, tolérant aux lignes partielles). */
export function summarizeAiUsage(rows: readonly AiUsageDailyRow[]): AiUsageSummary {
  const byFeature: Record<string, number> = {};
  const users = new Set<string>();
  let requestsHeavy = 0;
  let requestsFast = 0;
  let firstDay: string | null = null;
  let lastDay: string | null = null;

  for (const row of rows) {
    if (row?.user_id) users.add(row.user_id);
    const heavy = Number(row?.requests_heavy ?? 0);
    const fast = Number(row?.requests_fast ?? 0);
    if (Number.isFinite(heavy)) requestsHeavy += heavy;
    if (Number.isFinite(fast)) requestsFast += fast;
    for (const [feature, count] of Object.entries(row?.requests_by_feature ?? {})) {
      const value = Number(count);
      if (Number.isFinite(value)) byFeature[feature] = (byFeature[feature] ?? 0) + value;
    }
    if (row?.day) {
      if (firstDay === null || row.day < firstDay) firstDay = row.day;
      if (lastDay === null || row.day > lastDay) lastDay = row.day;
    }
  }

  return {
    rows: rows.length,
    users: users.size,
    requestsHeavy,
    requestsFast,
    totalRequests: requestsHeavy + requestsFast,
    byFeature,
    firstDay,
    lastDay,
  };
}

export interface AiBudgetEvaluation {
  status: 'within_budget' | 'quota_exceeded' | 'insufficient_data';
  totals: AiUsageSummary;
  /** Utilisateurs dépassant un plafond réel (identifiants masqués). */
  offenders: { userId: string; day: string | null; tier: 'heavy' | 'fast'; value: number }[];
  checks: { id: string; ok: boolean | null; detail: string }[];
  reason: string;
}

/**
 * Évalue la consommation IA contre les plafonds réels et le budget configuré.
 *
 * - dépassement par utilisateur → `quota_exceeded` (échec certain) ;
 * - sinon budget global ou monétaire non configuré → `insufficient_data` ;
 * - sinon comparaison globale → `within_budget` ou `quota_exceeded`.
 */
export function evaluateAiBudget(
  rows: readonly AiUsageDailyRow[],
  config: AiBudgetConfig = AI_BUDGET_CONFIG
): AiBudgetEvaluation {
  const totals = summarizeAiUsage(rows);
  const offenders: AiBudgetEvaluation['offenders'] = [];

  for (const row of rows) {
    const heavy = Number(row?.requests_heavy ?? 0);
    const fast = Number(row?.requests_fast ?? 0);
    if (Number.isFinite(heavy) && heavy > config.heavyDailyPerUser) {
      offenders.push({
        userId: maskUserId(row?.user_id),
        day: row?.day ?? null,
        tier: 'heavy',
        value: heavy,
      });
    }
    if (Number.isFinite(fast) && fast > config.fastDailyPerUser) {
      offenders.push({
        userId: maskUserId(row?.user_id),
        day: row?.day ?? null,
        tier: 'fast',
        value: fast,
      });
    }
  }

  const checks: AiBudgetEvaluation['checks'] = [];
  const perUserOk = offenders.length === 0;
  checks.push({
    id: 'per_user_daily_quota',
    ok: perUserOk,
    detail: perUserOk
      ? `aucun dépassement (cibles ${config.heavyDailyPerUser} heavy / ${config.fastDailyPerUser} fast par utilisateur et par jour)`
      : `${offenders.length} dépassement(s) de plafond utilisateur`,
  });

  let globalOk: boolean | null = null;
  if (config.globalDailyRequests == null) {
    checks.push({
      id: 'global_daily_requests',
      ok: null,
      detail: 'plafond global non configuré — INSUFFICIENT_DATA',
    });
  } else {
    globalOk = totals.totalRequests <= config.globalDailyRequests;
    checks.push({
      id: 'global_daily_requests',
      ok: globalOk,
      detail: `${totals.totalRequests} requêtes vs plafond ${config.globalDailyRequests}`,
    });
  }

  let monetaryOk: boolean | null = null;
  if (config.monetaryBudgetUsd == null || config.costPerRequestUsd == null) {
    checks.push({
      id: 'monetary_budget_usd',
      ok: null,
      detail: 'budget monétaire ou coût unitaire non configuré — INSUFFICIENT_DATA',
    });
  } else {
    const estimatedCost = totals.totalRequests * config.costPerRequestUsd;
    monetaryOk = estimatedCost <= config.monetaryBudgetUsd;
    checks.push({
      id: 'monetary_budget_usd',
      ok: monetaryOk,
      detail: `${estimatedCost.toFixed(4)} USD estimés vs budget ${config.monetaryBudgetUsd} USD`,
    });
  }

  if (!perUserOk || globalOk === false || monetaryOk === false) {
    return {
      status: 'quota_exceeded',
      totals,
      offenders,
      checks,
      reason: !perUserOk
        ? 'plafond utilisateur dépassé'
        : globalOk === false
          ? 'plafond global de requêtes dépassé'
          : 'budget monétaire estimé dépassé',
    };
  }
  if (globalOk == null || monetaryOk == null) {
    return {
      status: 'insufficient_data',
      totals,
      offenders,
      checks,
      reason: config.note,
    };
  }
  return {
    status: 'within_budget',
    totals,
    offenders,
    checks,
    reason: 'consommation sous les plafonds et budget configurés',
  };
}
