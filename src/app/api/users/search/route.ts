import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { MAX_SEARCH_QUERY, sanitizeSearchTerm, toPublicUser } from '@/lib/users/publicUser';

export const dynamic = 'force-dynamic';

/**
 * USR-01 — Recherche de personne, pour le tiroir « Avec qui » du preparateur.
 *
 * Deux besoins distincts, une seule source de verite :
 *  - `scope=friends` : les abonnements reels (`user_follows.follower_id`),
 *    qui sont la seule definition de « nos amis » dans ce depot ;
 *  - `scope=all` : n'importe quel profil public, pour inviter quelqu'un qui
 *    n'est pas encore suivi.
 *
 * Trois regles absolues :
 *  1. **Projection publique seulement.** On lit la VUE `public_profiles`, creee
 *     par la migration `a10_f1_public_profiles` exactement pour fermer la fuite
 *     de la table `user_profiles` (email, telephone, role, preferences). Aucune
 *     de ces colonnes n'est donc lisible ici, ni par contournement ni par
 *     jointure : la vue ne les projette pas.
 *  2. **Aucune invention.** Un champ vide devient `null`. On ne remplit jamais
 *     un score de confiance a 0 ni une localisation a une ville choisie.
 *  3. **Aucune erreur silencieuse.** Si la base echoue, la route repond 503.
 *     Renvoyer `[]` ferait croire a « personne ne suit cette personne », qui
 *     est une affirmation fausse.
 */

/** Lecture seule, sans ressource payante : l'anti-rafale peut degrader sans bloquer. */
const RATE_LIMIT = {
  scope: 'users-search',
  limit: 60,
  windowMs: 60_000,
  failMode: 'open' as const,
};

/** Meme plancher que la recherche de lieu : en dessous, le tri n'a aucun sens. */
const MIN_QUERY = 2;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 25;

/** Colonne reellement lisible dans la projection publique. */
const PUBLIC_COLUMNS = 'id, full_name, avatar_url, location, trust_score';

const searchSchema = z.object({
  scope: z.enum(['friends', 'all']).default('all'),
  q: z.string().max(MAX_SEARCH_QUERY).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Authentification requise pour chercher des personnes.' },
      { status: 401 },
    );
  }

  const limited = await enforceRateLimit(user.id, RATE_LIMIT);
  if (limited) return limited;

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = searchSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Recherche invalide.' },
      { status: 400 },
    );
  }

  const { scope, limit } = parsed.data;
  const raw = params.q;
  // Un terme fourni mais vide apres neutralisation ne doit surtout pas
  // degenerer en liste non filtree : on refuse.
  const term = typeof raw === 'string' && raw.length > 0 ? sanitizeSearchTerm(raw) : '';
  if (typeof raw === 'string' && raw.trim().length > 0 && term.length < MIN_QUERY) {
    return NextResponse.json(
      { error: 'Saisis au moins deux caracteres.' },
      { status: 400 },
    );
  }

  let allowedIds: string[] | null = null;
  if (scope === 'friends') {
    const { data: follows, error: followsError } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', user.id);

    if (followsError) {
      return NextResponse.json(
        { error: 'La liste d abonnements est indisponible. Reessaie dans un instant.' },
        { status: 503 },
      );
    }

    allowedIds = [
      ...new Set(
        (follows ?? [])
          .map((row) => (row as { following_id?: unknown }).following_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];

    // Aucun abonnement : la reponse honnete est une liste vide. On ne lance
    // meme pas la requete sur les profils, il n'y a rien a borner.
    if (allowedIds.length === 0) {
      return NextResponse.json({ users: [], scope });
    }
  }

  let query = supabase
    .from('public_profiles')
    .select(PUBLIC_COLUMNS)
    .neq('id', user.id);

  if (allowedIds !== null) query = query.in('id', allowedIds);
  if (term.length >= MIN_QUERY) {
    query = query.or(`full_name.ilike.*${term}*,location.ilike.*${term}*`);
  }

  const { data, error } = await query.order('full_name', { ascending: true }).order('id').limit(limit);

  if (error) {
    return NextResponse.json(
      { error: 'La recherche de personnes est indisponible. Reessaie dans un instant.' },
      { status: 503 },
    );
  }

  const users = (data ?? []).map((row) => toPublicUser(row as Record<string, unknown>));
  return NextResponse.json({ users, scope });
}
