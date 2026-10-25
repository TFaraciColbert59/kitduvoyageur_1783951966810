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

type HighlightRow = {
  id: string;
  title: string;
  position: number;
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
 * Stories V2 (phases 06/07) — « Mes archives » :
 * - l'auteur retrouve ses stories expirées (can_view_story lui donne toujours
 *   accès à ses propres lignes, hors `removed`) et peut les effacer
 *   définitivement (ligne + objet Storage) ;
 * - albums « À la une » (story_highlights) : créer un album, y épingler une
 *   story archivée, supprimer un album (les items cascadent). La visibilité des
 *   stories épinglées reste contrôlée par can_view_story à la lecture.
 *
 * Aucun dialogue natif (garde-fou U-D63) : formulaires en ligne uniquement.
 */
export default function StoriesArchiveSheet({
  currentUser,
  onClose,
}: {
  currentUser?: { id?: string };
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ArchivedRow[]>([]);
  const [highlights, setHighlights] = useState<HighlightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Story ciblée par le mini-formulaire « À la une » (une à la fois).
  const [pinningStoryId, setPinningStoryId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const [archivedRes, highlightsRes] = await Promise.all([
      supabase
        .from('post_stories')
        .select('id, created_at, expires_at, media_type, caption')
        .eq('author_id', currentUser.id)
        .lt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('story_highlights')
        .select('id, title, position')
        .eq('owner_id', currentUser.id)
        .order('position', { ascending: true })
        .limit(50),
    ]);
    if (!archivedRes.error) setRows((archivedRes.data ?? []) as ArchivedRow[]);
    if (!highlightsRes.error) setHighlights((highlightsRes.data ?? []) as HighlightRow[]);
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

  const handleDeleteHighlight = async (id: string) => {
    if (!currentUser?.id) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('story_highlights')
      .delete()
      .eq('id', id)
      .eq('owner_id', currentUser.id);
    if (error) {
      lkvAlert('L’album n’a pas pu être supprimé.');
      return;
    }
    setHighlights((prev) => prev.filter((h) => h.id !== id));
  };

  const pinToHighlight = async (storyId: string, highlight: HighlightRow) => {
    if (!currentUser?.id) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('story_highlight_items')
        .upsert(
          { highlight_id: highlight.id, story_id: storyId, position: 0 },
          { onConflict: 'highlight_id,story_id', ignoreDuplicates: true }
        );
      if (error) throw new Error(error.message);
      lkvAlert(`Épinglée dans « ${highlight.title} ».`);
      setPinningStoryId(null);
      setNewTitle('');
    } catch (err) {
      lkvAlert(err instanceof Error ? err.message : 'Épinglage impossible.');
    } finally {
      setSaving(false);
    }
  };

  const createHighlightAndPin = async (storyId: string) => {
    if (!currentUser?.id) return;
    const title = newTitle.trim().slice(0, 60);
    if (!title) {
      lkvAlert('Donnez un nom à l’album.');
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const position = highlights.length;
      const { data: created, error } = await supabase
        .from('story_highlights')
        .insert({ owner_id: currentUser.id, title, position, cover_story_id: storyId })
        .select('id, title, position')
        .single();
      if (error || !created) throw new Error(error?.message ?? 'Création impossible.');
      const highlight = created as HighlightRow;
      setHighlights((prev) => [...prev, highlight]);
      await pinToHighlight(storyId, highlight);
    } catch (err) {
      lkvAlert(err instanceof Error ? err.message : 'Création impossible.');
      setSaving(false);
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
        className="flex max-h-[85vh] w-full max-w-sm flex-col gap-[var(--space-3)] p-[var(--space-4)]"
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

        {/* Albums À la une */}
        {highlights.length > 0 && (
          <div className="space-y-[var(--space-1)]">
            <p className="text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">
              Albums À la une
            </p>
            <ul className="flex flex-wrap gap-[var(--space-1)]">
              {highlights.map((highlight) => (
                <li
                  key={highlight.id}
                  className="flex items-center gap-[var(--space-1)] rounded-full bg-[color:var(--glass-bg-medium)] px-[var(--space-3)] py-[var(--space-1)]"
                >
                  <span className="max-w-[160px] truncate text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)]">
                    {highlight.title}
                  </span>
                  <button
                    type="button"
                    aria-label={`Supprimer l’album ${highlight.title}`}
                    onClick={() => void handleDeleteHighlight(highlight.id)}
                    className="text-[color:var(--lkv-text-muted)] hover:text-[color:var(--lkv-text-primary)]"
                  >
                    <Icon name="x" size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
          Vos stories de plus de 24 h. Épinglez-les dans un album ou supprimez-les
          définitivement (média inclus).
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
                className="rounded-[var(--lkv-radius-md)] bg-[color:var(--glass-bg-medium)] px-[var(--space-3)] py-[var(--space-2)]"
              >
                <div className="flex items-center justify-between gap-[var(--space-2)]">
                  <span className="min-w-0">
                    <span className="block truncate text-[length:var(--lkv-text-caption)] font-medium text-[color:var(--lkv-text-primary)]">
                      {row.caption || (row.media_type === 'video' ? 'Story vidéo' : 'Story photo')}
                    </span>
                    <span className="block text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                      {archiveDateLabel(row.created_at)} · {row.media_type === 'video' ? 'vidéo' : 'photo'}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-[var(--space-1)]">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={saving}
                      onClick={() => {
                        setPinningStoryId(pinningStoryId === row.id ? null : row.id);
                        setNewTitle('');
                      }}
                    >
                      À la une
                    </Button>
                    <IconButton
                      type="button"
                      variant="glass"
                      aria-label="Supprimer définitivement cette story"
                      disabled={deletingId === row.id}
                      onClick={() => void handleDelete(row.id)}
                    >
                      <Icon name="trash2" size={16} />
                    </IconButton>
                  </span>
                </div>

                {pinningStoryId === row.id && (
                  <div className="mt-[var(--space-2)] space-y-[var(--space-2)] border-t border-[color:var(--glass-border)] pt-[var(--space-2)]">
                    {highlights.length > 0 && (
                      <div className="flex flex-wrap gap-[var(--space-1)]">
                        {highlights.map((highlight) => (
                          <button
                            key={highlight.id}
                            type="button"
                            disabled={saving}
                            onClick={() => void pinToHighlight(row.id, highlight)}
                            className="rounded-full bg-white/10 px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)] ring-1 ring-[color:var(--lkv-border-strong)]"
                          >
                            {highlight.title}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-[var(--space-2)]">
                      <input
                        type="text"
                        value={newTitle}
                        maxLength={60}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Nouvel album (ex. Vercors)"
                        className="min-w-0 flex-1 rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none"
                      />
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={saving || !newTitle.trim()}
                        onClick={() => void createHighlightAndPin(row.id)}
                      >
                        Créer
                      </Button>
                    </div>
                  </div>
                )}
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
