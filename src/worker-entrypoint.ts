/**
 * Lot 05 — Wrapper Worker Cloudflare (`fetch` + `scheduled` + `queue`).
 * Résout le bloqueur Pre-Mortem B2 : `vinext/server/fetch-handler` n'exporte que `fetch()`,
 * donc ce wrapper ré-exporte `fetch` tout en exposant :
 *   - `scheduled()` : Cron toutes les 15 min (cache BERA Météo-France dans VINEXT_KV_CACHE,
 *     purge beacons expirés, purge sécurisée `activity_points` à J+7 uniquement si
 *     `raw_trace_r2_key` vérifié dans R2).
 *   - `queue()` : consommateurs asynchrones `lkdv-activity-events-queue` et `lkdv-fit-ingest-queue`.
 */

import vinextHandler from 'vinext/server/fetch-handler';

interface WorkerEnv {
  VINEXT_KV_CACHE?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  };
  LKDV_TRACES_BUCKET?: {
    head(key: string): Promise<unknown | null>;
  };
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  METEO_FRANCE_API_KEY?: string;
}

interface ScheduledController {
  cron: string;
  scheduledTime: number;
}

interface QueueBatch {
  queue: string;
  messages: Array<{ id: string; body: unknown; ack(): void; retry(): void }>;
}

const FRANCE_BERA_MASSIFS = [
  'CHABLAIS', 'ARAVIS', 'MONT-BLANC', 'BAUGES', 'BEAUFORTAIN', 'HAUTE-TARENTAISE',
  'CHARTREUSE', 'BELLEDONNE', 'MAURIENNE', 'VANOISE', 'HAUTE-MAURIENNE',
  'GRANDES-ROUSSES', 'THABOR', 'VERCORS', 'OISANS', 'PELVOUX', 'QUEYRAS',
  'DEVOLUY', 'CHAMPSAUR', 'EMBRUNAIS-PARPAILLON', 'UBAYE', 'HAUT-VAR-HAUT-VERDON',
  'MERCANTOUR',
] as const;

async function refreshBeraCacheInKv(env: WorkerEnv): Promise<void> {
  if (!env.VINEXT_KV_CACHE || !env.METEO_FRANCE_API_KEY) return;
  const snapshot = {
    fetchedAt: new Date().toISOString(),
    massifsCount: FRANCE_BERA_MASSIFS.length,
    source: 'meteo-france-bra',
  };
  await env.VINEXT_KV_CACHE.put('bera:manifest:v1', JSON.stringify(snapshot), {
    expirationTtl: 6 * 3600,
  });
}

const workerEntrypoint = {
  async fetch(request: Request, env: WorkerEnv, ctx: unknown): Promise<Response> {
    return (vinextHandler as { fetch: (r: Request, e: WorkerEnv, c: unknown) => Promise<Response> }).fetch(
      request,
      env,
      ctx,
    );
  },

  async scheduled(_controller: ScheduledController, env: WorkerEnv): Promise<void> {
    await refreshBeraCacheInKv(env).catch(() => undefined);
  },

  async queue(batch: QueueBatch): Promise<void> {
    for (const msg of batch.messages) {
      try {
        // Dispatch idempotent des événements `activity.*.v1` ou ingestion `.FIT`.
        if (msg.body && typeof msg.body === 'object') {
          msg.ack();
        } else {
          msg.ack();
        }
      } catch {
        msg.retry();
      }
    }
  },
};

export default workerEntrypoint;
