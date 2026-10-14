import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const SIGNED_URL_TTL_SECONDS = 120;

/**
 * GET /api/stories/:id/media — accès média contrôlé (Stories V2, P0).
 *
 * - Session obligatoire (cookies) ; la ligne est lue SOUS RLS
 *   (`can_view_story`) : story invisible ⇒ 404 indistinguable (aucune fuite
 *   d'existence pour une story privée).
 * - Média privé : URL signée à TTL courte via service_role — jamais d'URL
 *   durable, la révocation est vérifiée à chaque ouverture.
 * - Legacy (image_url publique) : redirection vers l'URL existante.
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
      .select('id, image_url, storage_bucket, storage_path')
      .eq('id', id)
      .maybeSingle();

    if (!story) return notFound();

    if (story.storage_bucket && story.storage_path) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!serviceKey || !url) return notFound();
      const service = createServiceClient(url, serviceKey, {
        auth: { persistSession: false },
      });
      const { data: signed } = await service.storage
        .from(story.storage_bucket)
        .createSignedUrl(story.storage_path, SIGNED_URL_TTL_SECONDS);
      if (!signed?.signedUrl) return notFound();
      return NextResponse.redirect(signed.signedUrl, {
        status: 302,
        headers: { 'Cache-Control': 'private, max-age=60' },
      });
    }

    if (story.image_url) {
      return NextResponse.redirect(story.image_url, {
        status: 302,
        headers: { 'Cache-Control': 'private, max-age=300' },
      });
    }

    return notFound();
  } catch {
    return notFound();
  }
}
