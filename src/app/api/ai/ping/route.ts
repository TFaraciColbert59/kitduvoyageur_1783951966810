import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { askAI } from '@/lib/ai/askAI';

export const dynamic = 'force-dynamic';

/**
 * Endpoint de diagnostic du routeur IA (smoke test post-déploiement).
 * Auth admin uniquement (is_admin). Appelle Ultra ET Nano avec un prompt
 * trivial, mesure la latence de chacun. Cache désactivé pour mesurer le
 * réseau réel et ne pas polluer le store.
 */

const PING_SYSTEM = 'Diagnostic technique LKDV. Réponds uniquement "OK".';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', details: 'Session requise' }, { status: 401 });
    }

    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden', details: 'Accès réservé aux administrateurs' },
        { status: 403 }
      );
    }

    const ultraStart = Date.now();
    const ultra = await askAI({
      feature: 'diagnostic',
      tier: 'heavy',
      system: PING_SYSTEM,
      prompt: 'ping ultra',
      maxTokens: 1_024,
      reasoningBudget: 512,
      cacheTtlSeconds: 0,
    });
    const ultraMs = Date.now() - ultraStart;

    const nanoStart = Date.now();
    const nano = await askAI({
      feature: 'diagnostic',
      tier: 'fast',
      system: PING_SYSTEM,
      prompt: 'ping nano',
      maxTokens: 256,
      cacheTtlSeconds: 0,
    });
    const nanoMs = Date.now() - nanoStart;

    return NextResponse.json({
      ultra: { ok: true, ms: ultraMs, degraded: ultra.degraded },
      nano: { ok: true, ms: nanoMs, degraded: nano.degraded },
    });
  } catch (error) {
    console.error('[ai/ping] erreur inattendue:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Diagnostic indisponible' }, { status: 500 });
  }
}
