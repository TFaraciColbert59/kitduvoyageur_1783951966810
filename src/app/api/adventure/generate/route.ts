import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { createClient } from '@/lib/supabase/server';
import { createDefaultRegistry } from '@/features/adventure-intelligence/server/adapters';
import {
  createSupabaseAdventurePersistence,
  generateAdventure,
} from '@/features/adventure-intelligence/server/generateAdventure';

export const dynamic = 'force-dynamic';

const adventureConstraintSchema = z.object({
  id: z.string().min(1, 'locks[].id est requis'),
  kind: z.enum(['hard', 'soft']),
  label: z.string().min(1, 'locks[].label est requis'),
  value: z.unknown(),
  locked: z.boolean(),
  source: z.enum(['user', 'system', 'safety']),
});

const generateSchema = z.object({
  text: z
    .string()
    .min(10, 'Le texte doit contenir au moins 10 caractères')
    .max(2000, 'Le texte ne peut pas dépasser 2000 caractères'),
  locks: z
    .array(adventureConstraintSchema)
    .max(50, 'Maximum 50 verrous par génération')
    .optional(),
});

function zodDetails(error: z.ZodError): string {
  return error.issues.map((issue) => issue.path.join('.')).join(', ');
}

/**
 * POST /api/adventure/generate — une phrase → AdventurePlan complet.
 * Auth obligatoire (401), validation zod française (400), service requis (503).
 * La persistance et le registre sont injectés côté serveur uniquement.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await createClient();
    const {
      data: { user },
    } = await session.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'Session requise' },
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Corps invalide', details: 'JSON attendu' },
        { status: 400 }
      );
    }

    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Corps invalide', details: zodDetails(parsed.error) },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
    }

    const result = await generateAdventure(
      {
        ownerId: user.id,
        text: parsed.data.text,
        locks: parsed.data.locks,
      },
      {
        registry: createDefaultRegistry(),
        persistence: createSupabaseAdventurePersistence(supabase),
      }
    );

    return NextResponse.json(
      {
        planId: result.plan.id,
        version: result.plan.currentVersion,
        candidates: result.candidates,
        explanation: result.explanation,
        aiUsed: result.aiUsed,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      '[adventure/generate] erreur inattendue:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
