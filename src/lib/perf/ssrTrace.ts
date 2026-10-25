/**
 * Tracer SSR chronométré (Étape 0 du plan performance) — mesure avant/après
 * des cascades serveur. Actif uniquement si LKDV_TRACE_SSR=1 ; no-op sinon
 * (aucun coût runtime, aucune fuite de données : ne logue que des durées).
 */
export async function traceStage<T>(stage: string, fn: () => Promise<T>): Promise<T> {
  if (process.env.LKDV_TRACE_SSR !== '1') return fn();
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    const ms = Math.round((performance.now() - t0) * 10) / 10;
    // console.error volontaire : next.config.mjs retire console.log/info du
    // bundle de production (removeConsole sauf error/warn) — le tracer doit
    // rester mesurable en prod. Filtrer sur le préfixe [LKDV:SSR].
    console.error(`[LKDV:SSR] ${stage} ${ms}ms`);
  }
}
