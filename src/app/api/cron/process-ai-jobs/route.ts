import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { consumeQuota } from '@/lib/ai/quota';
import { askAI } from '@/lib/ai/askAI';
import { sendPushToUser } from '@/lib/ai/pushNotify';
import {
  trailNarrativeJobSchema,
  buildNarrativePrompt,
  buildNarrativeFallback,
  TRAIL_NARRATIVE_SPEC,
} from '@/lib/ai/features/trailNarrative';
import { activityEnrichmentJobSchema } from '@/lib/ai/features/activityEnrichment';
import { processActivityEnrichmentJob } from '@/features/trips/server/activityEnrichment/service';

export const dynamic = 'force-dynamic';

/**
 * Cron IA — traite les jobs ai_jobs 'pending' hors trafic (Chantier C).
 * Déclencheur EXTERNE (GitHub Action / pg_cron + pg_net / Vercel Cron) appelant
 * cette route avec `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Sémantique de reprise : quota dépassé → job re-pending SANS brûler une
 * tentative (retry jusqu'à minuit, jamais d'erreur visible) ; échec provider →
 * attempts+1 puis re-pending (cap 5 tentatives côté SQL) ; succès → done +
 * écriture dans hike_sessions.narratives + web-push « carnet prêt ».
 *
 * `activity-enrichment` (Préparer) délègue à `processActivityEnrichmentJob` :
 * quota → `deferred` (re-pending sans tentative), provider/transport → `retry`
 * (re-pending avec tentative+1, sauf au cap 5 → `failed` terminal + trace
 * `trips.metadata`), échec définitif → `failed` tracé dans `trips.metadata`,
 * succès → `done` + provenance dans les tables du voyage.
 */

/** Cap de tentatives du claim SQL (`claim_pending_ai_jobs`, attempts < 5). */
const MAX_ENRICHMENT_ATTEMPTS = 5;

interface ProcessedCounts {
  done: number;
  failed: number;
  deferredQuota: number;
  retryFailed: number;
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Service IA indisponible' }, { status: 503 });
  }

  try {
    const { data: jobs, error: claimError } = await supabase.rpc('claim_pending_ai_jobs', {
      p_limit: 10,
    });
    if (claimError) {
      console.error('[ai/cron] claim en échec:', claimError.message);
      return NextResponse.json({ error: 'Claim indisponible' }, { status: 502 });
    }

    const counts: ProcessedCounts = { done: 0, failed: 0, deferredQuota: 0, retryFailed: 0 };

    for (const job of (jobs ?? []) as {
      id: string;
      user_id: string;
      feature: string;
      payload: unknown;
      attempts: number;
    }[]) {
      // 1. Dispatch par feature ; feature inconnue ou payload invalide → failed.
      if (job.feature === 'activity-enrichment') {
        const parsedEnrichment = activityEnrichmentJobSchema.safeParse(job.payload);
        if (!parsedEnrichment.success) {
          await supabase
            .from('ai_jobs')
            .update({ status: 'failed', result: { error: 'payload invalide' }, processed_at: new Date().toISOString() })
            .eq('id', job.id);
          counts.failed += 1;
          continue;
        }

        // Quota, écritures et provenance sont gérés par le service (validation
        // globale avant toute écriture) ; `deferred` = quota → re-pending SANS
        // brûler une tentative, `retry` = provider/transport → tentative+1
        // puis re-pending (miroir `trail-narrative`), `failed` = définitif
        // (tracé absent, sortie hors schéma, activité introuvable).
        const enrichment = await processActivityEnrichmentJob(job);
        const enrichmentProcessedAt = new Date().toISOString();

        if (enrichment.outcome === 'deferred') {
          await supabase.from('ai_jobs').update({ status: 'pending' }).eq('id', job.id);
          counts.deferredQuota += 1;
          continue;
        }
        if (enrichment.outcome === 'retry') {
          const nextAttempts = job.attempts + 1;
          // Cap 5 (miroir du claim SQL `attempts < 5`) : re-pending à 5 serait un
          // cul-de-sac invisible (jamais réclamé). La 5e tentative est terminale :
          // job `failed` + `trips.metadata.enrichment_status='failed'` pour que le
          // rail serve « version essentielle » et propose « Améliorer ».
          if (nextAttempts >= MAX_ENRICHMENT_ATTEMPTS) {
            await supabase
              .from('ai_jobs')
              .update({
                status: 'failed',
                attempts: nextAttempts,
                result: { error: enrichment.detail ?? 'enrichissement en échec' },
                processed_at: enrichmentProcessedAt,
              })
              .eq('id', job.id);
            await markTripEnrichmentFailed(
              supabase,
              parsedEnrichment.data.tripId,
              enrichment.detail ?? 'enrichissement en échec'
            );
            counts.failed += 1;
            continue;
          }
          await supabase
            .from('ai_jobs')
            .update({ status: 'pending', attempts: nextAttempts, processed_at: enrichmentProcessedAt })
            .eq('id', job.id);
          counts.retryFailed += 1;
          continue;
        }
        if (enrichment.outcome === 'failed') {
          await supabase
            .from('ai_jobs')
            .update({
              status: 'failed',
              result: { error: enrichment.detail ?? 'enrichissement en échec' },
              processed_at: enrichmentProcessedAt,
            })
            .eq('id', job.id);
          counts.failed += 1;
          continue;
        }

        await supabase
          .from('ai_jobs')
          .update({
            status: 'done',
            attempts: job.attempts + 1,
            result: { detail: enrichment.detail ?? null },
            processed_at: enrichmentProcessedAt,
          })
          .eq('id', job.id);
        counts.done += 1;
        continue;
      }

      if (job.feature !== 'trail-narrative') {
        await supabase
          .from('ai_jobs')
          .update({ status: 'failed', result: { error: `feature inconnue: ${job.feature}` }, processed_at: new Date().toISOString() })
          .eq('id', job.id);
        counts.failed += 1;
        continue;
      }
      const parsedPayload = trailNarrativeJobSchema.safeParse(job.payload);
      if (!parsedPayload.success) {
        await supabase
          .from('ai_jobs')
          .update({ status: 'failed', result: { error: 'payload invalide' }, processed_at: new Date().toISOString() })
          .eq('id', job.id);
        counts.failed += 1;
        continue;
      }
      const stats = parsedPayload.data;

      // 2. Quota testé ICI (avant askAI, sans userId passé à askAI — sinon double
      //    consommation). Refusé → re-pending SANS attempts+1 : retry jusqu'à minuit.
      const allowed = await consumeQuota(
        job.user_id,
        TRAIL_NARRATIVE_SPEC.tier,
        'trail-narrative',
        TRAIL_NARRATIVE_SPEC.maxPerUserPerDay
      );
      if (!allowed) {
        await supabase.from('ai_jobs').update({ status: 'pending' }).eq('id', job.id);
        counts.deferredQuota += 1;
        continue;
      }

      // 3. askAI — le fallback interne du registre ne doit JAMAIS arriver ici
      //    (quota déjà consommé), un résultat degraded = provider en panne.
      const { system, prompt } = buildNarrativePrompt(stats);
      const result = await askAI({
        feature: 'trail-narrative',
        tier: TRAIL_NARRATIVE_SPEC.tier,
        system,
        prompt,
        maxTokens: 1_500,
        reasoningBudget: TRAIL_NARRATIVE_SPEC.maxReasoningBudget,
        cacheTtlSeconds: TRAIL_NARRATIVE_SPEC.cacheTtlSeconds,
      });

      const processedAt = new Date().toISOString();

      if (result.degraded) {
        // Provider en panne → réessayable (cap 5 tentatives côté claim).
        await supabase
          .from('ai_jobs')
          .update({ status: 'pending', attempts: job.attempts + 1, processed_at: processedAt })
          .eq('id', job.id);
        counts.retryFailed += 1;
        continue;
      }

      // 4. Succès : écriture du récit + job done + notification « carnet prêt ».
      const { error: sessionError } = await supabase
        .from('hike_sessions')
        .update({
          narratives: {
            recit: result.text,
            model: result.model,
            generated_at: processedAt,
          },
        })
        .eq('id', stats.sessionId);

      if (sessionError) {
        console.error('[ai/cron] écriture hike_sessions:', sessionError.message);
        await supabase
          .from('ai_jobs')
          .update({ status: 'failed', result: { error: sessionError.message }, processed_at: processedAt })
          .eq('id', job.id);
        counts.failed += 1;
        continue;
      }

      await supabase
        .from('ai_jobs')
        .update({
          status: 'done',
          attempts: job.attempts + 1,
          result: { model: result.model, provider: result.provider },
          processed_at: processedAt,
        })
        .eq('id', job.id);

      await sendPushToUser(job.user_id, {
        title: 'Votre carnet est prêt',
        body: `Le récit de votre sortie de ${stats.distanceKm.toFixed(1)} km vient d'être rédigé.`,
      });

      counts.done += 1;
    }

    return NextResponse.json({ ok: true, claimed: (jobs ?? []).length, ...counts });
  } catch (err) {
    console.error('[ai/cron] erreur inattendue:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Traitement interrompu' }, { status: 500 });
  }
}

/**
 * Échec terminal d'enrichissement (cap de tentatives) : fusionne l'état dans
 * `trips.metadata` — même contrat que `service.traceFailure`, mais sans TripRow.
 */
async function markTripEnrichmentFailed(
  supabase: SupabaseClient,
  tripId: string,
  detail: string
): Promise<void> {
  try {
    const { data, error: readError } = await supabase
      .from('trips')
      .select('metadata')
      .eq('id', tripId)
      .maybeSingle();
    if (readError) {
      console.error('[ai/cron] lecture métadonnées activité en échec:', readError.message);
      return;
    }
    const current =
      data && typeof (data as { metadata?: unknown }).metadata === 'object' && data.metadata
        ? ((data as { metadata: Record<string, unknown> }).metadata ?? {})
        : {};
    const { error } = await supabase
      .from('trips')
      .update({
        metadata: {
          ...current,
          enrichment_status: 'failed',
          enrichment_error: detail,
          enrichment_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId);
    if (error) {
      console.error('[ai/cron] trace échec activité en échec:', error.message, tripId);
    }
  } catch (error) {
    console.error('[ai/cron] trace échec activité en erreur inattendue:', error, tripId);
  }
}
