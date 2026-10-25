import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { createClient } from '@/lib/supabase/server';
import {
  createSupabaseTerrainReportsClient,
  createTerrainReport,
} from '@/features/adventure-intelligence/server/terrainReports';
import {
  reportDirectionSchema,
  terrainPassabilitySchema,
  terrainReportCategorySchema,
  terrainSeveritySchema,
} from '@/features/adventure-intelligence/schemas/live.schema';
import { MAX_PHOTO_BYTES } from '@/features/adventure-intelligence/domain/terrainLive';
import { currentAdventureFeatureFlags } from '@/features/adventure-intelligence/server/featureFlags';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Phase 6 (§9.11) — limite anti-rafale par utilisateur (la modération DB
 *  reste l'autorité métier : 10/h, 3/h pour un compte récent). */
const TERRAIN_REPORTS_LIMIT = 20;
const TERRAIN_REPORTS_WINDOW_MS = 60 * 60_000;

const createReportSchema = z.object({
  category: terrainReportCategorySchema,
  severity: terrainSeveritySchema,
  passability: terrainPassabilitySchema.optional(),
  description: z
    .string()
    .max(1000, 'description ne peut pas dépasser 1000 caractères')
    .optional(),
  photoUrl: z.string().url('photoUrl doit être une URL valide').optional(),
  photoSizeBytes: z
    .number()
    .int('photoSizeBytes doit être un entier')
    .min(0, 'photoSizeBytes doit être positif ou nul')
    .max(MAX_PHOTO_BYTES, 'photoSizeBytes ne peut pas dépasser 5 Mo')
    .optional(),
  lat: z
    .number()
    .min(-90, 'lat doit être compris entre -90 et 90')
    .max(90, 'lat doit être compris entre -90 et 90'),
  lng: z
    .number()
    .min(-180, 'lng doit être compris entre -180 et 180')
    .max(180, 'lng doit être compris entre -180 et 180'),
  gpsAccuracyM: z.number().min(0, 'gpsAccuracyM doit être positif ou nul').optional(),
  direction: reportDirectionSchema.optional(),
  segmentId: z.number().int('segmentId doit être un entier').positive('segmentId doit être positif').optional(),
});

function zodDetails(error: z.ZodError): string {
  return error.issues.map((issue) => issue.path.join('.')).join(', ');
}

/**
 * POST /api/terrain/reports — création d'un signalement Terrain Live.
 * Modération puis anti-doublon (fusion ou rejet motivé). L'identité vient
 * exclusivement de la session ; `source_type` est décidé ici, jamais fourni
 * par le client. Zod 4 sur toutes les entrées, erreurs `{ error, details? }`.
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

    // Phase 6 (§9.11) — failMode `open` : la modération en base (compteurs
    // réels par utilisateur) reste l'autorité ; si Upstash est indisponible,
    // on laisse passer vers cette vérification plutôt que de perdre un
    // signalement terrain légitime.
    const limit = await rateLimit({
      key: `terrain-reports:${user.id}`,
      limit: TERRAIN_REPORTS_LIMIT,
      windowMs: TERRAIN_REPORTS_WINDOW_MS,
      failMode: 'open',
    });
    if (limit.outcome === 'limited') {
      return NextResponse.json(
        { error: 'Trop de requêtes', details: 'terrain_reports_rate_limited' },
        { status: 429, headers: rateLimitHeaders(limit) }
      );
    }

    const flags = await currentAdventureFeatureFlags();
    if (flags.terrain_live !== true) {
      return NextResponse.json({ error: 'Fonctionnalité non activée' }, { status: 503 });
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

    const parsed = createReportSchema.safeParse(body);
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

    const result = await createTerrainReport(
      { userId: user.id, ...parsed.data },
      createSupabaseTerrainReportsClient(supabase)
    );

    if (result.status === 'rejected') {
      return NextResponse.json(
        { error: 'Signalement refusé', details: result.reasons.join(', ') },
        { status: 422 }
      );
    }

    if (result.status === 'merged') {
      return NextResponse.json({
        merged: true,
        reportId: result.mergedWith,
        reason: result.reason,
      });
    }

    return NextResponse.json(
      { reportId: result.reportId, status: result.reportStatus },
      { status: 201 }
    );
  } catch (err) {
    console.error(
      '[terrain/reports] erreur inattendue:',
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
