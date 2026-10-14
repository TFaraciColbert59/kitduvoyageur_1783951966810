'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Card, IconButton } from '@/components/ui';
import Icon from '@/components/ui/AppIcon';
import { lkvAlert } from '@/components/ui/dialogs';
import { createClient } from '@/lib/supabase/client';

type ArchivedRow = {
  id: string;
  created_at: string;
  expires_at: string;
  media_type: 'image' | 'video' | 'text';
  caption: string | null;
};

function archiveDateLabel(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * Stories V2 (phase 06) — « Mes archives » : l'auteur retrouve ses stories
 * expirées (can_view_story lui donne toujours accès à ses propres lignes, hors
 * `removed`) et peut les effacer définitivement (ligne + objet Storage).
 *
 * Les lignes encore actives ne sont pas listées ici : le rail s'en charge.
 * Les albums À la une (story_highlights) référencent des lignes existantes ;
 * supprimer une story la retire aussi des albums (cascade).
 */
export default function StoriesArchiveSheet({
  currentUser,
  onClose,
}: {
  currentUser?: { id?: string };
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ArchivedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from('post_stories')
      .select('id, created_at, expires_at, media_type, caption')
      .eq('author_id', currentUser.id)
      .lt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error) setRows((data ?? []) as ArchivedRow[]);
    setLoading(false);
  }, [currentUser?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!currentUser?.id) return;
    setDeletingId(id);
    try {
      const supabase = createClient();
      const { data: row } = await supabase
        .from('post_stories')
        .select('image_url, storage_bucket, storage_path')
        .eq('id', id)
        .maybeSingle();
      const { error } = await supabase
        .from('post_stories')
        .delete()
        .eq('id', id)
        .eq('author_id', currentUser.id);
      if (error) {
        lkvAlert('La story n’a pas pu être supprimée.');
        return;
      }
      const r = row as {
        image_url?: string | null;
        storage_bucket?: string | null;
        storage_path?: string | null;
      } | null;
      try {
        if (r?.storage_path && r.storage_bucket) {
          await supabase.storage.from(r.storage_bucket).remove([r.storage_path]);
        } else if (r?.image_url) {
          const marker = '/carnet-media/';
          const index = r.image_url.indexOf(marker);
          if (index >= 0) {
            await supabase.storage
              .from('carnet-media')
              .remove([r.image_url.slice(index + marker.length)]);
          }
        }
      } catch {
        /* l'objet orphelin sera purgé par le cron */
      }
      setRows((prev) => prev.filter((x) => x.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center bg-black/60 p-[var(--space-4)] backdrop-blur-[var(--glass-blur-sm)] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Mes archives de stories"
      onClick={onClose}
    >
      <Card
        className="flex max-h-[80vh] w-full max-w-sm flex-col gap-[var(--space-3)] p-[var(--space-4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-[var(--space-2)]">
          <h3 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
            Mes archives
          </h3>
          <IconButton
            type="button"
            variant="glass"
            aria-label="Fermer mes archives"
            onClick={onClose}
          >
            <Icon name="x" size={16} />
          </IconButton>
        </div>

        <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
          Vos stories de plus de 24 h, conservées jusqu’à leur purge. La suppression
          est définitive (média inclus).
        </p>

        {loading && (
          <p className="py-[var(--space-4)] text-center text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
            Chargement…
          </p>
        )}

        {!loading && rows.length === 0 && (
          <p className="py-[var(--space-4)] text-center text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
            Aucune story archivée pour le moment.
          </p>
        )}

        {!loading && rows.length > 0 && (
          <ul className="flex-1 space-y-[var(--space-1)] overflow-y-auto">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] bg-[color:var(--glass-bg-medium)] px-[var(--space-3)] py-[var(--space-2)]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[length:var(--lkv-text-caption)] font-medium text-[color:var(--lkv-text-primary)]">
                    {row.caption || (row.media_type === 'video' ? 'Story vidéo' : 'Story photo')}
                  </span>
                  <span className="block text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                    {archiveDateLabel(row.created_at)} · {row.media_type === 'video' ? 'vidéo' : 'photo'}
                  </span>
                </span>
                <IconButton
                  type="button"
                  variant="glass"
                  aria-label="Supprimer définitivement cette story"
                  disabled={deletingId === row.id}
                  onClick={() => void handleDelete(row.id)}
                >
                  <Icon name="trash2" size={16} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </Card>
    </div>
  );
}
