import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import {
  getProgressionRhythm,
  updateProgressionRhythm,
} from '@/features/progression/server/rhythmService';

export const dynamic = 'force-dynamic';

/**
 * T16 — Préférences privées : objectif hebdomadaire facultatif et pause.
 * Aucune conséquence économique : ni XP, ni mission, ni distinction.
 */
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' } as const;

const updateSchema = z
  .object({
    rhythmId: z.union([z.literal('leger'), z.literal('regulier'), z.literal('intense'), z.null()]).optional(),
    paused: z.boolean().optional(),
  })
  .refine((value) => value.rhythmId !== undefined || value.paused !== undefined, {
    message: 'aucune préférence fournie',
  });

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    const limited = await enforceRateLimit(user.id, {
      scope: 'progression-preferences',
      limit: 60,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return limited;

    const state = await getProgressionRhythm(user.id);
    return NextResponse.json(
      { success: true, preference: state.preference, weekly: state.weekly },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    console.error('[API /api/progression/preferences] GET', err);
    return NextResponse.json({ success: false, error: 'Erreur interne' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    const limited = await enforceRateLimit(user.id, {
      scope: 'progression-preferences',
      limit: 60,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return limited;

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
    }
    const parsed = updateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
    }

    const result = await updateProgressionRhythm(user.id, parsed.data);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.reason },
        { status: result.reason === 'rythme_invalide' ? 400 : 503 }
      );
    }
    return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error('[API /api/progression/preferences] POST', err);
    return NextResponse.json({ success: false, error: 'Erreur interne' }, { status: 500 });
  }
}
