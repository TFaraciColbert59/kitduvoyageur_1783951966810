import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AUDIENCES = new Set(['public', 'abonnies', 'club']);

/**
 * Largeur d'audience : `public > club/abonnés > privé`. Une republication ne
 * peut jamais viser plus large que sa source. Toute audience inconnue (ou
 * absente) est traitée comme privée, donc la plus restrictive.
 */
const AUDIENCE_RANK: Record<string, number> = {
  public: 3,
  club: 2,
  abonnies: 2,
  prive: 1,
  private: 1,
};

/**
 * Codes PostgreSQL qui traduisent un refus de validation métier (check,
 * contrainte, trigger, RLS) et non une panne d'infrastructure.
 */
const VALIDATION_ERROR_CODES = new Set([
  '22P02', // invalid_text_representation
  '23502', // not_null_violation
  '23503', // foreign_key_violation
  '23514', // check_violation
  '42501', // insufficient_privilege (RLS)
  'P0001', // raise_exception (triggers métier)
]);

interface RepostBody {
  sourceId?: unknown;
  audience?: unknown;
  clubId?: unknown;
  client_request_id?: unknown;
  clientRequestId?: unknown;
}

interface QueryError {
  code?: string;
  message?: string;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function audienceRank(audience: string): number {
  return AUDIENCE_RANK[audience] ?? 1;
}

function isValidationError(error: QueryError | null | undefined): boolean {
  return Boolean(error?.code && VALIDATION_ERROR_CODES.has(error.code));
}

function fail() {
  return NextResponse.json({ error: 'repost_failed' }, { status: 500 });
}

/**
 * Republication d'une publication communautaire.
 *
 * - 401 sans session ;
 * - 400 si la requête, la source ou l'identifiant de requête sont invalides ;
 * - 403 si la republication élargit l'audience de la source
 *   (`public > club/abonnés > privé`) ;
 * - la source est lue sous RLS : une publication que le demandeur ne peut pas
 *   voir n'existe pas pour cette route ;
 * - `client_request_id` est obligatoire : le rejeu de la même requête est
 *   idempotent grâce à l'index unique `author_id, client_request_id` ;
 * - `reposted_from_id` est aplati vers la source d'origine quand la source est
 *   elle-même une republication **et** que cette racine reste visible sous RLS ;
 *   sinon la source immédiate, elle-même visible, porte l'attribution ;
 * - une source sans contenu est refusée plutôt que relayée vide ;
 * - 500 pour une panne d'infrastructure, 400 pour une validation métier.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: RepostBody | null = null;
  try {
    body = (await req.json()) as RepostBody;
  } catch {
    body = null;
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const sourceId = readString(body.sourceId);
  if (!UUID_PATTERN.test(sourceId)) {
    return NextResponse.json({ error: 'source_invalid' }, { status: 400 });
  }

  const audience = readString(body.audience);
  if (!AUDIENCES.has(audience)) {
    return NextResponse.json({ error: 'audience_invalid' }, { status: 400 });
  }

  const clubId = audience === 'club' ? readString(body.clubId) : '';
  if (audience === 'club' && !UUID_PATTERN.test(clubId)) {
    return NextResponse.json({ error: 'audience_invalid' }, { status: 400 });
  }

  // L'idempotence n'est réelle que si le client fournit un identifiant : sans
  // lui, un double clic créerait deux republications.
  const clientRequestId = readString(body.client_request_id ?? body.clientRequestId);
  if (!clientRequestId) {
    return NextResponse.json(
      { error: 'client_request_id_required' },
      { status: 400 }
    );
  }
  if (!UUID_PATTERN.test(clientRequestId)) {
    return NextResponse.json({ error: 'client_request_id_invalid' }, { status: 400 });
  }

  // Rejeu de la même requête : on renvoie la ligne déjà créée, jamais une
  // seconde republication.
  const { data: existing, error: existingError } = await supabase
    .from('community_posts')
    .select('id')
    .eq('author_id', user.id)
    .eq('client_request_id', clientRequestId)
    .maybeSingle();
  if (existingError) {
    return fail();
  }
  if (existing?.id) {
    return NextResponse.json({ ok: true, id: existing.id, duplicate: true });
  }

  // La RLS de `community_posts` ne renvoie que les sources visibles par le
  // demandeur : une source privée, bloquée ou inexistante est invalide ici.
  // L'audience et `reposted_from_id` sont lus dans la même requête pour
  // pouvoir refuser tout élargissement d'audience et aplatir les chaînes.
  const { data: source, error: sourceError } = await supabase
    .from('community_posts')
    .select('id,title,content,image_url,image_alt,audience,reposted_from_id')
    .eq('id', sourceId)
    .maybeSingle();

  if (sourceError) {
    return fail();
  }
  if (!source) {
    return NextResponse.json({ error: 'source_invalid' }, { status: 400 });
  }

  const sourceAudience = readString(source.audience);
  if (audienceRank(audience) > audienceRank(sourceAudience)) {
    return NextResponse.json({ error: 'audience_escalation' }, { status: 403 });
  }

  const sourceContent = typeof source.content === 'string' ? source.content : '';
  if (!sourceContent.trim()) {
    return NextResponse.json({ error: 'source_empty' }, { status: 400 });
  }

  // Aplatissement : republier une republication pointe vers la publication
  // d'origine, jamais vers l'intermédiaire. La racine n'est retenue que si la
  // RLS la laisse visible pour le demandeur : sinon la carte ne pourrait
  // résoudre ni titre, ni auteur, ni lien et pointerait vers une publication
  // inaccessible. Dans ce cas la source immédiate, déjà lue sous RLS, fait foi.
  let attributionTarget = sourceId;
  const declaredRootId = readString(source.reposted_from_id);
  if (declaredRootId && declaredRootId !== sourceId) {
    const { data: root, error: rootError } = await supabase
      .from('community_posts')
      .select('id')
      .eq('id', declaredRootId)
      .maybeSingle();
    // Une vérification impossible n'autorise pas l'aplatissement : la source
    // immédiate reste l'attribution sûre, sans bloquer le relais.
    if (!rootError && root?.id) {
      attributionTarget = declaredRootId;
    }
  }

  const payload: Record<string, unknown> = {
    author_id: user.id,
    audience,
    club_id: audience === 'club' ? clubId : null,
    reposted_from_id: attributionTarget,
    title: typeof source.title === 'string' ? source.title : '',
    content: sourceContent,
    image_url: typeof source.image_url === 'string' ? source.image_url : '',
    image_alt: typeof source.image_alt === 'string' ? source.image_alt : '',
    post_type: 'share',
    likes_count: 0,
    comments_count: 0,
    client_request_id: clientRequestId,
  };

  const { data: created, error: insertError } = await supabase
    .from('community_posts')
    .insert(payload)
    .select('id')
    .single();

  if (insertError) {
    // Course entre deux requêtes identiques : l'index unique partiel tranche,
    // on relit la ligne gagnante au lieu de renvoyer une erreur.
    if (insertError.code === '23505') {
      const { data: duplicate, error: lookupError } = await supabase
        .from('community_posts')
        .select('id')
        .eq('author_id', user.id)
        .eq('client_request_id', clientRequestId)
        .maybeSingle();
      if (lookupError) {
        return fail();
      }
      if (duplicate?.id) {
        return NextResponse.json({ ok: true, id: duplicate.id, duplicate: true });
      }
      return fail();
    }
    if (isValidationError(insertError)) {
      return NextResponse.json({ error: 'repost_failed' }, { status: 400 });
    }
    return fail();
  }

  return NextResponse.json({
    ok: true,
    id: created?.id,
    repostedFromId: attributionTarget,
  });
}

export default POST;
