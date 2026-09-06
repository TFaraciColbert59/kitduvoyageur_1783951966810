import { NextRequest, NextResponse } from 'next/server';
import { getAffiliateLinkBySlug, logAffiliateClick } from '@/lib/queries-affiliation';
import { buildAffiliateUrl } from '@/features/affiliation/engine/affiliateEngine';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;

  // 1. Récupérer le lien d'affiliation
  const link = await getAffiliateLinkBySlug(slug);

  if (!link || !link.is_active) {
    return NextResponse.redirect(new URL('/voyages', request.url), 302);
  }

  // 2. Extraire les métadonnées de requête pour la traçabilité éthique RGPD
  const tripId = request.nextUrl.searchParams.get('trip_id') || undefined;
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const referrer = request.headers.get('referer') || undefined;

  // 3. Journaliser le clic avec hachage salé (Minimisation RGPD §5.3)
  const { clickId } = await logAffiliateClick(link.id, {
    tripId,
    ip,
    userAgent,
    referrer,
  });

  // 4. Construire l'URL cible avec marker Travelpayouts et sub_id
  try {
    const finalTargetUrl = buildAffiliateUrl(link.target_url, link.tracking_params, {
      marker: '584920',
      subId: clickId || undefined,
    });

    // 5. Redirection temporaire 307
    return NextResponse.redirect(finalTargetUrl, 307);
  } catch (err) {
    console.error('[/go/[slug]] Erreur lors de la construction d’URL affiliée :', err);
    return NextResponse.redirect(new URL('/voyages', request.url), 302);
  }
}
