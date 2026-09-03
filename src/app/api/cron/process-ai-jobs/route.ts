import { NextRequest, NextResponse } from 'next/server';
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
 */

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
      // 1. Feature inconnue ou payload invalide → failed définitif.
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
