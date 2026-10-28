'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Card, IconButton } from '@/components/ui';
import Icon from '@/components/ui/AppIcon';
import { lkvAlert } from '@/components/ui/dialogs';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';

type ViewRow = {
  viewer_id: string;
  first_viewed_at: string;
  last_viewed_at: string;
};

function viewDateLabel(iso: string): string {
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
 * Stories V2 (phases 05/08) — « Vues de ma story » (auteur uniquement) :
 * - liste des personnes qui ont vu la story (RLS `story_views_read_own_or_author`
 *   ne renvoie au propriétaire que les vues de SES stories) ;
 * - « Masquer » : ajoute la personne à `story_hidden_users` — elle ne verra
 *   plus AUCUNE story de l'auteur (masquage effectif côté can_view_story,
 *   vérifié en production par la matrice d'accès).
 *
 * Aucun dialogue natif (garde-fou U-D63) ; icônes du registre uniquement.
 */
export default function StoryViewsSheet({
  storyId,
  currentUser,
  onClose,
}: {
  storyId: string;
  currentUser?: { id?: string };
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ViewRow[]>([]);
  const [names, setNames] = useState<Record<string, { name: string; avatar_url?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [hidingId, setHidingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from('story_views')
      .select('viewer_id, first_viewed_at, last_viewed_at')
      .eq('story_id', storyId)
      .order('last_viewed_at', { ascending: false })
      .limit(200);
    if (error) {
      setLoading(false);
      return;
    }
    const viewRows = (data ?? []) as ViewRow[];
    setRows(viewRows);
    if (viewRows.length > 0) {
      const profiles = await fetchPublicProfilesWith(
        supabase,
        viewRows.map((r) => r.viewer_id)
      );
      const map: Record<string, { name: string; avatar_url?: string }> = {};
      for (const r of viewRows) {
        map[r.viewer_id] = {
          name: profiles[r.viewer_id]?.full_name || 'Voyageur',
          avatar_url: profiles[r.viewer_id]?.avatar_url ?? undefined,
        };
      }
      setNames(map);
    }
    setLoading(false);
  }, [currentUser?.id, storyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleHide = async (viewerId: string) => {
    if (!currentUser?.id) return;
    setHidingId(viewerId);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('story_hidden_users')
        .upsert(
          { owner_id: currentUser.id, hidden_user_id: viewerId },
          { onConflict: 'owner_id,hidden_user_id', ignoreDuplicates: true }
        );
      if (error) {
        lkvAlert('Le masquage n’a pas pu être enregistré.');
        return;
      }
      setRows((prev) => prev.filter((r) => r.viewer_id !== viewerId));
      lkvAlert(
        `${names[viewerId]?.name ?? 'Ce membre'} ne verra plus vos stories.`
      );
    } finally {
      setHidingId(null);
    }
  };

  return (
    <div
      className="lkdv-story-sheet-layer fixed inset-0 z-[var(--z-modal)] flex items-end justify-center bg-black/55 p-[var(--space-3)] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Vues de ma story"
      onClick={onClose}
    >
      <Card
        className="lkdv-story-sheet flex max-h-[70dvh] w-full flex-col gap-[var(--space-2)] p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lkdv-story-sheet-head">
          <IconButton
            type="button"
            variant="glass"
            aria-label="Fermer les vues"
            onClick={onClose}
          >
            <Icon name="x" size={18} />
          </IconButton>
        </div>

        {loading && (
          <p className="py-[var(--space-4)] text-center text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
            Chargement…
          </p>
        )}

        {!loading && rows.length === 0 && (
          <p className="lkdv-story-sheet-empty">
            Personne n’a encore vu cette story.
          </p>
        )}

        {!loading && rows.length > 0 && (
          <ul className="lkdv-story-sheet-list">
            {rows.map((row) => (
              <li
                key={row.viewer_id}
                className="flex items-center justify-between gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] bg-[color:var(--glass-bg-medium)] px-[var(--space-3)] py-[var(--space-2)]"
              >
                <span className="flex min-w-0 items-center gap-[var(--space-2)]">
                  {names[row.viewer_id]?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- avatar distant (même URL que le reste de l'app)
                    <img
                      src={names[row.viewer_id]?.avatar_url}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--btn-tint)] text-[length:var(--lkv-text-caption)] font-semibold uppercase text-[color:var(--lkv-text-primary)]">
                      {(names[row.viewer_id]?.name || 'V').charAt(0)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-[length:var(--lkv-text-caption)] font-medium text-[color:var(--lkv-text-primary)]">
                      {names[row.viewer_id]?.name || 'Voyageur'}
                    </span>
                    <span className="block text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                      {viewDateLabel(row.last_viewed_at)}
                    </span>
                  </span>
                </span>
                <IconButton
                  type="button"
                  variant="glass"
                  aria-label={`Masquer mes stories à ${names[row.viewer_id]?.name || 'ce membre'}`}
                  disabled={hidingId === row.viewer_id}
                  onClick={() => void handleHide(row.viewer_id)}
                >
                  <Icon name="user-minus" size={16} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}

        <div className="lkdv-story-sheet-foot">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </Card>
    </div>
  );
}
