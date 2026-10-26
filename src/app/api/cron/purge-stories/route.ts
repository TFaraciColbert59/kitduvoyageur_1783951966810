import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const BATCH_SIZE = 200;

/**
 * GET /api/cron/purge-stories — purge serveur idempotente (Stories V2, phase 06).
 *
 * Remplace à terme l'auto-nettoyage opportuniste côté client :
 * - supprime les stories EXPIRÉES non archivées (`archived_at IS NULL`) par
 *   lots de 200, les plus anciennes d'abord ; une story archivée (archive
 *   voulue, y compris référencée par un Highlight) est préservée ;
 * - retire d'abord les objets Storage (bucket selon la ligne :
 *   `stories-private` V2 ou `carnet-media` legacy) puis les lignes : si un
 *   objet échoue, la ligne reste et le prochain passage réessaie ;
 * - journalise le bilan ; relançable sans effet.
 *
 * Déclencheur EXTERNE : `Authorization: Bearer ${CRON_SECRET}`
 * (planification : cron Vercel ou ordonnanceur ops — jamais côté client).
 */
export async function GET(request: NextRequest) {
  // Comparaison en temps constant (même helper que /api/cron/daily).
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 503 });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1. Lot de stories expirées non archivées (les plus anciennes d'abord).
    const { data: expired, error: selectError } = await supabase
      .from('post_stories')
      .select('id, image_url, storage_bucket, storage_path')
      .lt('expires_at', new Date().toISOString())
      .is('archived_at', null)
      .order('expires_at', { ascending: true })
      .limit(BATCH_SIZE);
    if (selectError) throw selectError;
    if (!expired?.length) return NextResponse.json({ purged: 0, objects: 0, nextBatch: false });

    const privateObjects: string[] = [];
    const legacyObjects: string[] = [];
    for (const row of expired) {
      const r = row as {
        image_url?: string | null;
        storage_bucket?: string | null;
        storage_path?: string | null;
      };
      if (r.storage_path && r.storage_bucket === 'stories-private') {
        privateObjects.push(r.storage_path);
        continue;
      }
      const url = r.image_url || '';
      const marker = '/carnet-media/';
      const index = url.indexOf(marker);
      if (index >= 0) legacyObjects.push(url.slice(index + marker.length));
    }

    // 2. Objets Storage d'abord : si l'objet échoue, la ligne reste (retry).
    if (privateObjects.length > 0) {
      const { error } = await supabase.storage.from('stories-private').remove(privateObjects);
      if (error) throw error;
    }
    if (legacyObjects.length > 0) {
      const { error } = await supabase.storage.from('carnet-media').remove(legacyObjects);
      if (error) throw error;
    }

    // 3. Lignes ensuite.
    const ids = expired.map((row) => (row as { id: string }).id);
    const { error: deleteError } = await supabase.from('post_stories').delete().in('id', ids);
    if (deleteError) throw deleteError;

    console.log(
      `✅ purge-stories: ${ids.length} stories, ${privateObjects.length + legacyObjects.length} objets`
    );
    return NextResponse.json({
      purged: ids.length,
      objects: privateObjects.length + legacyObjects.length,
      nextBatch: ids.length === BATCH_SIZE,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur purge stories';
    console.error('❌ purge-stories:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
