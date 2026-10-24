import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail } from '@/lib/api/respond';
import { buildGpx, loadOutingDetail } from '@/features/compte/server/sorties';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().uuid();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Id.safeParse((await params).id);
  if (!parsed.success) return fail('not_found', 'Sortie introuvable.');
  try {
    const detail = await loadOutingDetail(auth.supabase, auth.user.id, parsed.data);
    if (!detail) return fail('not_found', 'Sortie introuvable.');
    if (detail.points.length < 2) {
      return fail('not_found', 'Aucune trace GPS rattachée à cette sortie.');
    }
    const filename = `${detail.title.replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60) || 'sortie'}.gpx`;
    return new Response(buildGpx(detail), {
      status: 200,
      headers: {
        'Content-Type': 'application/gpx+xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return fail('server', 'Impossible de générer le GPX.');
  }
}
