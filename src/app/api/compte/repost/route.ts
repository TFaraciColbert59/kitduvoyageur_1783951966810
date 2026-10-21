import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AUDIENCES = new Set(['public', 'abonnies', 'club']);

interface RepostBody {
  sourceId?: unknown;
  audience?: unknown;
  clubId?: unknown;
  client_request_id?: unknown;
  clientRequestId?: unknown;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Republication d'une publication communautaire.
 *
 * - 401 sans session ;
 * - 400 si la source, l'audience ou l'identifiant de requête sont invalides ;
 * - la copie porte `reposted_from_id` (attribution) et, si le client en fournit
 *   un, `client_request_id` pour que le rejeu de la même requête soit idempotent
 *   (index unique `author_id, client_request_id`).
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

  const rawRequestId = readString(body.client_request_id ?? body.clientRequestId);
  if (rawRequestId && !UUID_PATTERN.test(rawRequestId)) {
    return NextResponse.json({ error: 'client_request_id_invalid' }, { status: 400 });
  }
  const clientRequestId = rawRequestId || null;

  // Rejeu de la même requête : on renvoie la ligne déjà créée, jamais une
  // seconde republication.
  if (clientRequestId) {
    const { data: existing, error: existingError } = await supabase
      .from('community_posts')
      .select('id')
      .eq('author_id', user.id)
      .eq('client_request_id', clientRequestId)
      .maybeSingle();
    if (existingError) {
      return NextResponse.json({ error: 'repost_failed' }, { status: 400 });
    }
    if (existing?.id) {
      return NextResponse.json({ ok: true, id: existing.id, duplicate: true });
    }
  }

  // La RLS de `community_posts` ne renvoie que les sources visibles par
  // l'utilisateur : une source privée ou inexistante est donc invalide ici.
  const { data: source, error: sourceError } = await supabase
    .from('community_posts')
    .select('id,title,content,image_url,image_alt,post_type')
    .eq('id', sourceId)
    .maybeSingle();

  if (sourceError || !source) {
    return NextResponse.json({ error: 'source_invalid' }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    author_id: user.id,
    audience,
    club_id: audience === 'club' ? clubId : null,
    reposted_from_id: source.id,
    title: typeof source.title === 'string' ? source.title : '',
    content: typeof source.content === 'string' ? source.content : '',
    image_url: typeof source.image_url === 'string' ? source.image_url : '',
    image_alt: typeof source.image_alt === 'string' ? source.image_alt : '',
    post_type: 'share',
    likes_count: 0,
    comments_count: 0,
  };
  if (clientRequestId) payload.client_request_id = clientRequestId;

  const { data: created, error: insertError } = await supabase
    .from('community_posts')
    .insert(payload)
    .select('id')
    .single();

  if (insertError) {
    // Course entre deux requêtes identiques : l'index unique partiel tranche,
    // on relit la ligne gagnante au lieu de renvoyer une erreur.
    if (clientRequestId && insertError.code === '23505') {
      const { data: existing } = await supabase
        .from('community_posts')
        .select('id')
        .eq('author_id', user.id)
        .eq('client_request_id', clientRequestId)
        .maybeSingle();
      if (existing?.id) {
        return NextResponse.json({ ok: true, id: existing.id, duplicate: true });
      }
    }
    return NextResponse.json({ error: 'repost_failed' }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    id: created?.id,
    repostedFromId: source.id,
  });
}

export default POST;
