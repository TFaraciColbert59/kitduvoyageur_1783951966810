import { json } from './_http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/media-sharing
 * Carte de service du lot C04. Aucune donnée utilisateur n'est exposée : les
 * routes de calcul reçoivent une projection déjà masquée par le contrat.
 */
export async function GET() {
  return json({
    ok: true,
    version: 1,
    features: {
      gallery: 'K5.06 / S1.21',
      flyover: 'K5.12 / S3.20',
      replay: 'S3.21',
      flyby: 'S3.22',
      protectedPreview: 'K5.28',
      externalShare: 'K5.27 / S5.25',
      projection: 'K7.05 / S6.14',
    },
    endpoints: {
      projection: 'POST /api/media-sharing/projection',
      gallery: 'POST /api/media-sharing/gallery',
      flyover: 'POST /api/media-sharing/flyover',
      flyoverJobs: 'POST /api/media-sharing/flyover/jobs',
      replay: 'POST /api/media-sharing/replay',
      flyby: 'POST /api/media-sharing/flyby',
      preview: 'POST /api/media-sharing/preview',
      previewResolve: 'GET /api/media-sharing/preview/[token]',
      previewRevoke: 'POST /api/media-sharing/preview/revoke',
      externalShare: 'POST /api/media-sharing/external-share',
    },
    transport: {
      persistence: 'in_memory',
      note: 'Les liens et jobs vivent dans le runtime courant ; la persistance base est hors du contrat C04.',
    },
  });
}
