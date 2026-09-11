import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { createClient } from '@/lib/supabase/server';
import {
  MAX_OFFLINE_SYNC_OPERATIONS,
  createSupabaseOfflineSyncClient,
  syncOfflineBatch,
} from '@/features/adventure-intelligence/server/offlineSync';
import type { OfflineOperation } from '@/features/adventure-intelligence/offline/operations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const queueStores = [
  'offline_reports_queue',
  'offline_sessions_queue',
  'offline_decisions_queue',
] as const;

const operationSchema = z.object({
  id: z.string().min(1),
  store: z.enum(queueStores),
  kind: z.string().min(1),
  payload: z.unknown(),
  idempotencyKey: z.string().min(1),
  createdAt: z.string().min(1),
  attempts: z.number().int().min(0).optional(),
  userId: z.string().optional(),
  priority: z.number().int().optional(),
  expiresAt: z.string().optional(),
  lastError: z.string().optional(),
  nextAttemptAt: z.string().optional(),
  deadLetteredAt: z.string().optional(),
});

const syncBodySchema = z.object({
  operations: z.array(operationSchema).max(MAX_OFFLINE_SYNC_OPERATIONS),
});

/**
 * POST /api/adventure/offline/sync — synchronisation batch idempotente des
 * files hors-ligne (sessions, signalements, décisions).
 *
 * L'identité vient exclusivement de la session. Les clés d'idempotence sont
 * celles de `offline/operations.ts` (SHA-256) et sont mémorisées côté serveur :
 * un rejeu est `duplicate`, jamais réappliqué. La propriété du plan est
 * vérifiée explicitement avant toute décision (client service_role).
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
    const parsed = syncBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Corps invalide',
          details: parsed.error.issues.map((issue) => issue.path.join('.')).join(', '),
        },
        { status: 400 }
      );
    }

    const service = getServiceSupabase();
    if (!service) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
    }

    const report = await syncOfflineBatch(
      {
        userId: user.id,
        operations: parsed.data.operations as OfflineOperation[],
      },
      createSupabaseOfflineSyncClient(service)
    );

    // 200 même si des opérations échouent : le client décide du rejeu via le
    // statut par opération (`failed`), jamais via un statut HTTP global.
    return NextResponse.json(report, { status: 200 });
  } catch (error) {
    console.error(
      '[adventure/offline/sync] erreur inattendue:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
