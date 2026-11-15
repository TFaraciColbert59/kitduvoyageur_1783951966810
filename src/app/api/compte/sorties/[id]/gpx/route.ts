import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail } from '@/lib/api/respond';
import {
  buildGpx,
  buildTcx,
  loadOutingDetail,
  outingTraceSegments,
} from '@/features/compte/server/sorties';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().uuid();

/**
 * GET /api/compte/sorties/[id]/gpx?format=gpx|tcx|original
 * S1.25 : Export propriétaire (GPX, TCX, ou vérification fichier d'origine).
 * S1.26 : Export d'une trace d'un tiers autorisé (audience partageable / abonné,
 *         trace projetée avec zones de confidentialité respectées).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Id.safeParse((await params).id);
  if (!parsed.success) return fail('not_found', 'Sortie introuvable.');

  const url = new URL(request.url);
  const formatRaw = (url.searchParams.get('format') ?? 'gpx').trim().toLowerCase();
  if (formatRaw !== 'gpx' && formatRaw !== 'tcx' && formatRaw !== 'original') {
    return fail('bad_request', 'Format d’export non pris en charge (gpx, tcx ou original).');
  }

  try {
    const detail = await loadOutingDetail(auth.supabase, auth.user.id, parsed.data);
    if (!detail) return fail('not_found', 'Sortie introuvable.');

    if (formatRaw === 'original') {
      if (!detail.canEdit) {
        return fail('forbidden', 'Seul le propriétaire peut télécharger le fichier d’origine.');
      }
      if (!detail.provenance) {
        return fail('not_found', 'Aucun fichier d’origine importé pour cette sortie.');
      }
      return fail(
        'not_found',
        `Fichier source « ${detail.provenance.fileName ?? detail.provenance.source.toUpperCase()} » non archivé côté serveur (seule l’empreinte ${detail.provenance.fingerprint.slice(0, 18)}… est conservée) : utilise l’export GPX ou TCX.`,
      );
    }

    if (!detail.canEdit && detail.traceFullyMasked) {
      return fail(
        'forbidden',
        'Les réglages de confidentialité de cette sortie ne permettent pas d’exporter sa trace.',
      );
    }

    if (outingTraceSegments(detail).length === 0) {
      return fail('not_found', 'Aucune trace GPS exportable sur cette sortie.');
    }

    const baseName = detail.title.replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60) || 'sortie';
    if (formatRaw === 'tcx') {
      return new Response(buildTcx(detail), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.garmin.tcx+xml; charset=utf-8',
          'Content-Disposition': `attachment; filename="${baseName}.tcx"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return new Response(buildGpx(detail), {
      status: 200,
      headers: {
        'Content-Type': 'application/gpx+xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${baseName}.gpx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return fail('server', 'Impossible de générer le fichier d’export.');
  }
}
