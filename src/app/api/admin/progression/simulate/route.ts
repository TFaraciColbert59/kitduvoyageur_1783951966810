import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import {
  simulateRules,
  type RuleSimulationSample,
} from '@/features/progression/server/rulePublication';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SAMPLES = 30;
const MAX_COUNT = 100_000;

/**
 * POST /api/admin/progression/simulate — T42 : prévisualisation du barème.
 * Simulation PURE (aucune écriture de solde ni de règle) réservée aux admins :
 * un échantillon de faits donne les XP projetés et les refus expliqués selon
 * le registre fermé. La publication réelle reste une opération journalisée
 * distincte (`progression_rule_publications`).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');
    if (adminError || !isAdmin) {
      return NextResponse.json(
        { error: 'Accès interdit : administrateurs uniquement' },
        { status: 403 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const limited = await enforceRateLimit(user.id, {
      scope: 'admin-progression-simulate',
      limit: 60,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return limited;

    const body = (await req.json().catch(() => null)) as { samples?: unknown } | null;
    const rawSamples = body && Array.isArray(body.samples) ? body.samples : null;
    if (!rawSamples || rawSamples.length === 0 || rawSamples.length > MAX_SAMPLES) {
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
    }

    const samples: RuleSimulationSample[] = [];
    for (const entry of rawSamples) {
      const action =
        typeof (entry as { action?: unknown })?.action === 'string'
          ? (entry as { action: string }).action
          : '';
      const count = Number((entry as { count?: unknown })?.count);
      if (
        !action ||
        action.length > 80 ||
        !Number.isInteger(count) ||
        count < 0 ||
        count > MAX_COUNT
      ) {
        return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
      }
      samples.push({ action, count });
    }

    const report = simulateRules(samples);
    const res = NextResponse.json({ success: true, report });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    console.error('[admin/progression/simulate] erreur inattendue', err);
    return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 });
  }
}
