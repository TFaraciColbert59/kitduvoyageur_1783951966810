import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  ACTIVE_ADVENTURE_COOKIE,
  serializeActiveAdventure,
} from '@/features/hub/context/adventureSchema';
import {
  PrepareActivityAuthError,
  prepareActivityFromTrail,
  type PrepareTrailOutcome,
} from '@/features/trips/server/prepareActivityFromTrail';
import { allowedHostsFromSiteUrl, hasValidSameSiteSignal } from '@/lib/security/sameOrigin';

export const dynamic = 'force-dynamic';

/**
 * `/preparer-sentier/[id]/activer` — finalisation de la préparation.
 *
 * Route Handler requis par Next 15 pour écrire le cookie httpOnly d'aventure
 * active (interdit pendant le rendu d'un Server Component). Ré-exécute
 * `prepareActivityFromTrail` (idempotent : `reused` si l'activité vient d'être
 * créée par la page), pose le cookie réel (id uuid + slug + titre), revalide le
 * hub puis redirige vers `/hub`.
 *
 * F-001 — GET MUTANT : exige un signal d'origine same-site (Referer de la page
 * du parcours, sinon Origin) ; une image ou un lien cross-site est refusé 403.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (
    !hasValidSameSiteSignal({
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
      host: request.headers.get('host') ?? new URL(request.url).host,
      allowedHosts: allowedHostsFromSiteUrl(),
    })
  ) {
    return NextResponse.json({ error: 'Origine non autorisée' }, { status: 403 });
  }

  const { id } = await params;

  let outcome: PrepareTrailOutcome;
  try {
    outcome = await prepareActivityFromTrail(id);
  } catch (error) {
    if (error instanceof PrepareActivityAuthError) {
      return NextResponse.redirect(
        new URL(
          `/connexion?next=${encodeURIComponent(`/preparer-sentier/${id}`)}`,
          request.url
        )
      );
    }
    throw error;
  }

  if (outcome.status === 'unavailable') {
    return NextResponse.redirect(
      new URL(`/preparer-sentier/${encodeURIComponent(id)}`, request.url)
    );
  }

  const response = NextResponse.redirect(new URL('/hub', request.url));
  response.cookies.set(
    ACTIVE_ADVENTURE_COOKIE,
    serializeActiveAdventure({
      nature: 'sortie',
      id: outcome.tripId,
      slug: outcome.slug,
      title: outcome.title,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.VERCEL === '1',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    }
  );
  revalidatePath('/hub', 'layout');
  return response;
}
