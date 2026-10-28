import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const SIGNED_URL_TTL_SECONDS = 120;

/** Seuls ces buckets peuvent être signés par cette route. Les colonnes
 *  `storage_bucket` / `storage_path` sont écrites par le client : sans liste
 *  blanche, un compte pouvait faire signer n'importe quel objet privé
 *  (`user-documents`, `message-attachments`…) via une story forgée. */
const ALLOWED_BUCKETS = new Set(['stories-private']);

/**
 * GET /api/stories/:id/media — accès média contrôlé (Stories V2, P0).
 *
 * - Session obligatoire ; la ligne est lue SOUS RLS (`can_view_story`) : story
 *   invisible ⇒ 404 indistinguable (aucune fuite d'existence pour une story
 *   privée).
 * - Média privé ⇒ URL signée à TTL courte via service_role (aucune URL
 *   durable).
 * - Legacy (image_url publique) ⇒ redirection vers l'URL existante.
 *
 * Observabilité : chaque refus est journalisé côté serveur avec sa cause
 * (jamais exposée au client) pour diagnostiquer un média qui ne s'affiche pas
 * sans deviner (Vercel → Logs → filtrer « stories/media »).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const notFound = () =>
    NextResponse.json(
      { error: 'Story introuvable' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );

  try {
    const supabase = await createClient();
    const { data: story } = await supabase
      .from('post_stories')
      .select('id, author_id, image_url, storage_bucket, storage_path')
      .eq('id', id)
      .maybeSingle();

    if (!story) {
      console.error('[stories/media] refus : ligne invisible ou inexistante', { id });
      return notFound();
    }

    if (story.storage_bucket && story.storage_path) {
      const ownedPath = `${story.author_id}/${''}`;
      if (
        !ALLOWED_BUCKETS.has(story.storage_bucket) ||
        !story.storage_path.startsWith(ownedPath)
      ) {
        console.error('[stories/media] refus : bucket ou chemin hors périmètre', { id });
        return notFound();
      }
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!serviceKey || !url) {
        console.error('[stories/media] refus : configuration service_role manquante');
        return notFound();
      }
      const service = createServiceClient(url, serviceKey, {
        auth: { persistSession: false },
      });
      const { data: signed, error: signError } = await service.storage
        .from(story.storage_bucket)
        .createSignedUrl(story.storage_path, SIGNED_URL_TTL_SECONDS);
      if (signError || !signed?.signedUrl) {
        console.error('[stories/media] refus : URL signée impossible', {
          bucket: story.storage_bucket,
          reason: signError?.message ?? 'vide',
        });
        return notFound();
      }
      return NextResponse.redirect(signed.signedUrl, {
        status: 302,
        headers: { 'Cache-Control': 'private, max-age=60' },
      });
    }

    if (story.image_url) {
      const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
      const allowedPrefix = `${supabaseOrigin}/storage/v1/object/`;
      if (!supabaseOrigin || !story.image_url.startsWith(allowedPrefix)) {
        console.error('[stories/media] refus : image_url hors origine Storage', { id });
        return notFound();
      }
      return NextResponse.redirect(story.image_url, {
        status: 302,
        headers: { 'Cache-Control': 'private, max-age=300' },
      });
    }

    console.error('[stories/media] refus : ligne sans média lisible', { id });
    return notFound();
  } catch (err) {
    console.error(
      '[stories/media] exception',
      err instanceof Error ? err.message : String(err)
    );
    return notFound();
  }
}
