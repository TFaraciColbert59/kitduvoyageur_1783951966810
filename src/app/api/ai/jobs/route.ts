import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Enfilement de jobs IA asynchrones (Chantier C — récit post-randonnée).
 * Le client n'appelle JAMAIS le routeur IA : il dépose un job, le cron
 * (/api/cron/process-ai-jobs) le traite hors trafic. Échec = silencieux côté
 * randonnée (le job est simplement absent — dégradation gracieuse).
 * RLS : INSERT own (auth.uid() = user_id).
 */

const enqueueJobSchema = z.object({
  feature: z.literal('trail-narrative'),
  payload: z.record(z.string(), z.unknown()),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', details: 'Session requise' }, { status: 401 });
    }

    const parsed = enqueueJobSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Corps invalide', details: parsed.error.issues.map((i) => i.path.join('.')).join(', ') },
        { status: 400 }
      );
    }

    const { data: job, error } = await supabase
      .from('ai_jobs')
      .insert({
        user_id: user.id,
        feature: parsed.data.feature,
        payload: parsed.data.payload,
      })
      .select('id')
      .single();

    if (error || !job) {
      console.error('[ai/jobs] insert en échec:', error?.message);
      return NextResponse.json({ error: 'Enfilement indisponible' }, { status: 502 });
    }

    return NextResponse.json({ jobId: job.id }, { status: 202 });
  } catch (err) {
    console.error('[ai/jobs] erreur inattendue:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
