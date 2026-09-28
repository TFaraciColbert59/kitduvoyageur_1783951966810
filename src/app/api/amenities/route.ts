import { NextRequest, NextResponse } from 'next/server';
import { fetchAmenitiesNear } from '@/lib/queries/amenities';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { parseOptionalBbox, VIEWPORT_RATE_LIMIT } from '@/lib/geo/requestViewport';

export const dynamic = 'force-dynamic';

/**
 * GET /api/amenities
 *
 * Amenites REELES (repas, hebergement, commerces) lues dans OpenStreetMap via
 * Overpass, pour la boite demandee.
 *
 * Route SEPAREE de `/api/pois`, et volontairement : Overpass met entre 5 et
 * 25 s pour repondre. Le brancher sur `/api/pois` trainerait la carte
 * interactive et la generation au rythme d un fournisseur public. Ici la
 * preparation appelle cette route EN PARALLELE de l appel au modele, donc le
 * cout est masque, et le cache de 6 h fait que seule la premiere sortie paie.
 *
 * Une panne ne fait pas echouer la requete : la reponse est une liste vide,
 * ce qui ramene l ecran a ses lieux de base (reels) plutot que d afficher
 * une erreur ou, pire, des lieux inventes.
 */
export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'amenities-viewport',
    // Overpass est une ressource publique et mutualisee : on limite le debit
    // pour ne pas etre un client bruyant.
    ...VIEWPORT_RATE_LIMIT,
  });
  if (limited) return limited;

  const viewport = parseOptionalBbox(request.nextUrl.searchParams);
  if (!viewport.ok) return viewport.response;

  // Sans boite, la requete n a pas de sens : demander l amenite de la planete
  // ne rendrait rien et bloquerait le fournisseur pour tout le monde.
  if (!viewport.bbox) {
    return NextResponse.json(
      { status: 'invalid', amenities: [], reason: 'bbox_expected' },
      { status: 400 },
    );
  }

  const amenities = await fetchAmenitiesNear(viewport.bbox);

  return NextResponse.json(
    { status: 'ok', amenities },
    {
      status: 200,
      headers: {
        // Le cache serveur garde deja 6 h ; celui-ci evite surtout qu un
        // aller-retour soit repete pendant la meme preparation.
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600',
      },
    },
  );
}
