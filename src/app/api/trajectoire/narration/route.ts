import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { deriveTrajectoire } from '@/features/trajectoire/domain/derive';
import { analyzeIntention } from '@/features/trajectoire/domain/intention';
import { DEMO_TRACES } from '@/features/trajectoire/domain/traces';
import { requestModelNarration } from '@/features/trajectoire/narration/modelNarration';
import { clientIpFromHeaders, rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/trajectoire/narration — la narration Nemotron du plan vivant.
 *
 * Le point non negociable de cette route est ce qu'elle ne recoit PAS.
 *
 * Le client envoie `{ intention, t }` : une phrase et une position sur l'axe.
 * Il n'envoie ni budget, ni dangerosite, ni nombre d'etapes. La route
 * RE-DERIVE l'instantane avec le meme moteur pur que l'ecran, puis fait
 * verifier la prose contre cet instantane.
 *
 * Pourquoi ne pas faire confiance au snapshot du client ? Parce que la porte
 * anti-invention compare la narration a l'etat. Si le client envoyait l'etat,
 * un client modifie pourrait envoyer un etat forge — « il y a 17 etapes » —
 * et obtenir la validation d'une phrase inventee. Ici il n'y a aucun etat a
 * forger : la seule source de verite est le moteur, cote serveur.
 *
 * Degradation : toute erreur rend `null` et un 200. Le client garde alors son
 * gabarit deterministe. Jamais de 500 sur un ecran qui doit rester instantane.
 */

/**
 * Deux plafonds, et non un.
 *
 * BURST : absorbe une session qui manipule le curseur sans respirer. La
 * temporisation du hook (280 ms) borne deja le debit a ~3,5 requetes/s ; ce
 * plafond ne protege donc pas l'utilisateur, il protege le budget contre un
 * script. L'ancien plafond de 30/h le touchait lui-meme : sept traversees de
 * curseur suffisaient a le declarer « abuser » alors qu'il explorait.
 *
 * DAILY : c'est le vrai budget de la feature, repris tel quel de
 * `TRAJECTOIRE_NARRATION_SPEC.maxPerUserPerDay`. Il est reimplemente ici parce
 * que le quota de `askAI` ne s'applique pas a cette route : `askAI` ne consomme
 * un quota que si `userId` est fourni, et `userId` doit etre un UUID — or
 * `/trajectoire` est une page de demonstration sans session. Sans ce second
 * plafond, la seule borne restante etait 240 x 24, soit 57 fois le budget que
 * le registre annonce. Inventer un UUID derive de l'IP n'aurait rien corrige :
 * sous un meme NAT, plusieurs utilisateurs se seraient partage le quota, et
 * un compteur unique aurait depose un utilisateur pour tous les autres.
 *
 * Le cache d'une heure d'`askAI` est consulte AVANT le quota : revenir sur une
 * zone deja redecrite ne coute donc rien. 100 provider calls par jour reste
 * tres au-dessus d'une session reelle.
 */
const BURST_LIMIT = 240;
const BURST_WINDOW_MS = 60 * 60_000;
const DAILY_LIMIT = 100;
const DAILY_WINDOW_MS = 24 * 60 * 60_000;

const bodySchema = z.object({
  intention: z.string().trim().min(1).max(500),
  t: z.number().min(0).max(1),
});

export async function POST(request: NextRequest) {
  const identifier = clientIpFromHeaders(request.headers);

  // Le burst d'abord : c'est le refus le plus frequent, donc celui qui parle
  // le plus utilement a l'utilisateur (« ralentis deux secondes »).
  const burst = await rateLimit({
    key: `trajectoire-narration:burst:${identifier}`,
    limit: BURST_LIMIT,
    windowMs: BURST_WINDOW_MS,
    failMode: 'closed',
  });

  if (burst.outcome === 'limited' || burst.outcome === 'unavailable') {
    return NextResponse.json(
      { narration: null },
      {
        status: burst.outcome === 'limited' ? 429 : 503,
        headers: rateLimitHeaders(burst),
      }
    );
  }

  const daily = await rateLimit({
    key: `trajectoire-narration:daily:${identifier}`,
    limit: DAILY_LIMIT,
    windowMs: DAILY_WINDOW_MS,
    failMode: 'closed',
  });

  if (daily.outcome !== 'allowed') {
    return NextResponse.json(
      { narration: null },
      {
        status: daily.outcome === 'limited' ? 429 : 503,
        headers: rateLimitHeaders(daily),
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    // Moteur pur, cote serveur : c'est la seule source de verite du gate.
    const intention = analyzeIntention(parsed.data.intention);
    const snapshot = deriveTrajectoire({
      t: parsed.data.t,
      intention,
      traces: DEMO_TRACES,
    });

    const narration = await requestModelNarration(snapshot, request.signal);

    return NextResponse.json({ narration }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // Un bug ici ne doit pas casser l'ecran : le gabarit prend le relais.
    return NextResponse.json({ narration: null }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
