import { NextRequest, NextResponse } from 'next/server';
import { resolveAmenitiesNear } from '@/lib/queries/amenities';
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
 * 45 s pour repondre. Le brancher sur `/api/pois` trainerait la carte
 * interactive et la generation au rythme d un fournisseur public. Ici la
 * preparation appelle cette route EN PARALLELE de l appel au modele, et le
 * cache de 6 h fait que seule la premiere sortie paie.
 *
 * LE DELAI. Mesure du 2026-09-29 sur le corridor de Chamonix, bbox fraiche :
 * 45 956 ms pour dix lieux, dont 45 000_ms de `OVERPASS_TIMEOUT_MS`. Les trois
 * miroirs Overpass etaient injoignables, donc ces dix lieux venaient du repli
 * Photon, disponible en 1,5 a 2,5 s. La route attendait une reponse qui ne
 * viendrait pas pour rendre une reponse deja presente. `resolveAmenitiesNear`
 * arbitre des la premiere reponse UTILE — le repli, quand Overpass est muet —
 * et laisse Overpass remplir le cache s il repond apres coup.
 *
 * LE CREDIT. La reponse nomme le fournisseur qui a reellement produit ces
 * lieux, dans la forme `{ id, name, url }` que `/api/weather` et
 * `/api/elevation` rendent deja. Il vaut `null` quand personne n a repondu :
 * nommer un fournisseur qui n a rien produit serait le meme mensonge qu un
 * `?? 'overpass'`, donc il n y en a pas. C est aussi ce qui distingue une
 * zone reellement sans amenite — Overpass a repondu, liste vide, credit
 * present — d une panne generalisee — personne n a repondu, credit absent.
 *
 * Une panne ne fait donc jamais echouer la requete : elle rend une liste vide
 * SANS SOURCE, ce qui ramene l ecran a ses lieux de base (reels) plutot que
 * d afficher une erreur ou, pire, des lieux inventes.
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

  const { rows: amenities, provider } = await resolveAmenitiesNear(viewport.bbox);

  return NextResponse.json(
    { status: 'ok', amenities, provider },
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
