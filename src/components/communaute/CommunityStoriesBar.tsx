'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card } from '@/components/ui';
import Icon from '@/components/ui/AppIcon';
import { lkvAlert } from '@/components/ui/dialogs';
import { stripImageMetadata } from '@/lib/media/stripImageMetadata';
import { storyMediaUrl } from '@/lib/stories/media';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import StoriesViewer, { type StoryUser } from './StoriesViewer';

type StoryRow = {
  id: string;
  author_id: string;
  image_url: string | null;
  storage_path: string | null;
  caption: string | null;
  created_at: string;
};

function storyTimeLabel(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `il y a ${hours} h`;
}

/**
 * F-027 + Stories V2 (phase 01) — stories RÉELLES : publication privée
 * (bucket `stories-private`, 24 h), lecture des stories autorisées, signalement
 * et blocage depuis le visionneur. Plus aucun exemple local : ce qui s'affiche
 * a été publié par un membre. Les anciennes stories (URL publique) restent
 * affichées telles quelles.
 */
export default function CommunityStoriesBar({ currentUser }: { currentUser?: any }) {
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [authors, setAuthors] = useState<Record<string, { name: string; avatar_url?: string }>>({});
  const [viewerStart, setViewerStart] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  // Choix du fichier → feuille de composition (légende) : jamais de dialogue
  // natif (garde-fou U-D63 du dépôt).
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');
  // Idempotence de publication : stable pour une même sélection de fichier,
  // réutilisé si l'utilisateur relance après un échec réseau.
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStories = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      // Visiteur : le rail affiche uniquement l'invitation à se connecter.
      setStories([]);
      return;
    }

    // A-143 : auto-nettoyage des stories expirées de la personne connectée —
    // la ligne part, et l'objet avec elle (bucket privé V2 ou legacy
    // carnet-media) — pas de cron requis à ce stade.
    try {
      const { data: expiredMine } = await supabase
        .from('post_stories')
        .select('id, image_url, storage_bucket, storage_path')
        .eq('author_id', session.user.id)
        .lt('expires_at', new Date().toISOString());
      if (expiredMine && expiredMine.length > 0) {
        const privatePaths: string[] = [];
        const legacyPaths: string[] = [];
        for (const row of expiredMine) {
          const r = row as {
            image_url?: string | null;
            storage_bucket?: string | null;
            storage_path?: string | null;
          };
          if (r.storage_path && r.storage_bucket === 'stories-private') {
            privatePaths.push(r.storage_path);
            continue;
          }
          const url = r.image_url || '';
          const marker = '/carnet-media/';
          const index = url.indexOf(marker);
          if (index >= 0) legacyPaths.push(url.slice(index + marker.length));
        }
        if (privatePaths.length > 0) {
          await supabase.storage.from('stories-private').remove(privatePaths);
        }
        if (legacyPaths.length > 0) {
          await supabase.storage.from('carnet-media').remove(legacyPaths);
        }
        await supabase
          .from('post_stories')
          .delete()
          .in('id', expiredMine.map((row) => (row as { id: string }).id));
      }
    } catch (cleanupError) {
      console.warn('Nettoyage des stories expirées ignoré —', cleanupError);
    }

    const { data, error } = await supabase
      .from('post_stories')
      .select('id, author_id, image_url, storage_path, caption, created_at')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) {
      console.error('Chargement des stories refusé —', error.message);
      setStories([]);
      return;
    }

    const rows = (data ?? []) as StoryRow[];
    setStories(rows);

    if (rows.length > 0) {
      const profiles = await fetchPublicProfilesWith(
        supabase,
        rows.map((row) => row.author_id)
      );
      const map: Record<string, { name: string; avatar_url?: string }> = {};
      for (const row of rows) {
        map[row.author_id] = {
          name: profiles[row.author_id]?.full_name || 'Voyageur',
          avatar_url: profiles[row.author_id]?.avatar_url ?? undefined,
        };
      }
      setAuthors(map);
    }
  }, []);

  useEffect(() => {
    void loadStories();
  }, [loadStories]);

  const storyUsers: StoryUser[] = useMemo(() => {
    const byAuthor = new Map<string, StoryRow[]>();
    for (const row of stories) {
      const list = byAuthor.get(row.author_id) ?? [];
      list.push(row);
      byAuthor.set(row.author_id, list);
    }

    const users: StoryUser[] = [];
    for (const [authorId, rows] of byAuthor) {
      // Normalisation média : privé → /api/stories/:id/media (contrôlé),
      // legacy → URL publique conservée. Une ligne sans média lisible est
      // ignorée plutôt que d'afficher un slide vide.
      const slides = rows
        .map((row) => {
          const image = storyMediaUrl(row);
          return image
            ? { image, caption: row.caption ?? undefined, storyId: row.id }
            : null;
        })
        .filter(
          (slide): slide is { image: string; caption?: string; storyId: string } => slide !== null
        );
      if (slides.length === 0) continue;
      users.push({
        id: authorId,
        name: authors[authorId]?.name || 'Voyageur',
        avatarUrl: authors[authorId]?.avatar_url,
        time: storyTimeLabel(rows[rows.length - 1].created_at),
        slides,
      });
    }

    // La personne connectée apparaît en premier (sa story se voit au rail).
    users.sort((a, b) => {
      if (a.id === currentUser?.id) return -1;
      if (b.id === currentUser?.id) return 1;
      return 0;
    });
    return users;
  }, [stories, authors, currentUser?.id]);

  // Position de ma propre story dans le rail : sert à ordonner l'item « + »
  // (après ma story, libellé « Ajouter ») et à éviter deux « Votre story ».
  const myStoryIndex = storyUsers.findIndex((user) => user.id === currentUser?.id);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!currentUser?.id) {
      lkvAlert('Connectez-vous pour publier une story.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      lkvAlert('Formats acceptés : images uniquement (story photo).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      lkvAlert('Story limitée à 10 Mo.');
      return;
    }
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
    setCaptionDraft('');
    setPendingRequestId(crypto.randomUUID());
  };

  const cancelPending = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingPreview(null);
    setCaptionDraft('');
    setPendingRequestId(null);
  };

  const publishPendingStory = async () => {
    if (!pendingFile || !currentUser?.id) return;
    setUploading(true);
    try {
      const supabase = createClient();
      // Stories V2 (P0) : média PRIVÉ — id stable + chemin {uid}/{storyId}/…,
      // idempotence par client_request_id (rejouable après un échec réseau).
      const storyId = crypto.randomUUID();
      const requestId = pendingRequestId ?? crypto.randomUUID();
      // A-096 : la story publiée ne conserve pas les métadonnées EXIF/GPS.
      const cleanedFile = await stripImageMetadata(pendingFile);
      const contentType = cleanedFile.type || 'image/jpeg';
      const ext = contentType === 'image/jpeg'
        ? 'jpg'
        : (pendingFile.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${currentUser.id}/${storyId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('stories-private')
        .upload(path, cleanedFile, { cacheControl: '3600', upsert: false, contentType });
      if (uploadError) throw new Error(uploadError.message);

      const { error: insertError } = await supabase.from('post_stories').insert({
        id: storyId,
        author_id: currentUser.id,
        image_url: null,
        storage_bucket: 'stories-private',
        storage_path: path,
        media_type: 'image',
        mime_type: contentType,
        status: 'ready',
        client_request_id: requestId,
        caption: captionDraft.trim() ? captionDraft.trim().slice(0, 280) : null,
        visibility: 'public',
      });
      if (insertError) {
        // La ligne n'existe pas : retirer l'objet orphelin avant de rendre la main.
        try {
          await supabase.storage.from('stories-private').remove([path]);
        } catch {
          /* l'objet orphelin sera purgé côté serveur */
        }
        throw new Error(insertError.message);
      }

      cancelPending();
      await loadStories();
    } catch (err) {
      console.error('Publication de story refusée —', err);
      lkvAlert(err instanceof Error ? err.message : 'La story n’a pas pu être publiée.');
    } finally {
      setUploading(false);
    }
  };

  const handleReport = async (user: StoryUser, slide: { storyId?: string }) => {
    if (!currentUser?.id) {
      lkvAlert('Connectez-vous pour signaler.');
      return;
    }
    if (!slide.storyId) return;
    const supabase = createClient();
    const { error } = await supabase.from('story_reports').insert({
      story_id: slide.storyId,
      story_author_id: user.id,
      reporter_id: currentUser.id,
      reason: 'Signalement depuis la barre de stories',
    });
    lkvAlert(
      error
        ? 'Le signalement n’a pas pu être enregistré.'
        : 'Merci, cette story a été signalée à la modération.'
    );
  };

  const handleBlock = async (user: StoryUser) => {
    if (!currentUser?.id) {
      lkvAlert('Connectez-vous pour bloquer.');
      return;
    }
    const supabase = createClient();
    const { error } = await supabase
      .from('user_blocks')
      .insert({ blocker_id: currentUser.id, blocked_id: user.id });
    if (error) {
      lkvAlert('Le blocage n’a pas pu être enregistré.');
      return;
    }
    setStories((prev) => prev.filter((row) => row.author_id !== user.id));
    setViewerStart(null);
    lkvAlert(`${user.name} est bloqué·e. Vous ne verrez plus ses stories.`);
  };

  const handleDelete = async (slide: { storyId?: string }) => {
    if (!slide.storyId || !currentUser?.id) return;
    const supabase = createClient();
    // Récupérer la référence média avant suppression (objet + bucket).
    const { data: row } = await supabase
      .from('post_stories')
      .select('image_url, storage_bucket, storage_path')
      .eq('id', slide.storyId)
      .maybeSingle();
    const { error } = await supabase
      .from('post_stories')
      .delete()
      .eq('id', slide.storyId)
      .eq('author_id', currentUser.id);
    if (error) {
      lkvAlert('La story n’a pas pu être retirée.');
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
      /* la ligne est retirée : l'objet orphelin sera purgé plus tard */
    }
    setViewerStart(null);
    await loadStories();
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Rail de stories — colonnes 70 px : anneau + avatar 58 px + nom dessous
          (le langage iOS/Instagram attendu ; l'ancienne rangée de pilules ne se
          lisait pas comme des stories). Ma story d'abord, puis « + » (« Votre
          story » si vide, « Ajouter » sinon). Fade iOS en fin de course. */}
      <div className="flex w-full items-start gap-[var(--space-3)] overflow-x-auto pb-[var(--space-2)] pr-[28px] [scrollbar-width:none] [-webkit-mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] [&::-webkit-scrollbar]:hidden">
        {storyUsers.map((user, index) => (
          <React.Fragment key={user.id}>
            <button
              type="button"
              aria-label={`Voir la story de ${user.name}`}
              onClick={() => setViewerStart(index)}
              className="flex w-[70px] shrink-0 flex-col items-center gap-[6px] outline-none transition-transform active:scale-[0.96]"
            >
              <span className="rounded-full bg-[conic-gradient(from_210deg,#f9ce34,#ee2a7b,#6228d7,#f9ce34)] p-[2.5px]">
                <span className="block rounded-full bg-[color:var(--glass-bg-medium)] p-[2px]">
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- avatars distants (mêmes URLs que le reste de l'app)
                    <img
                      src={user.avatarUrl}
                      alt=""
                      loading="lazy"
                      className="size-[55px] rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex size-[55px] items-center justify-center rounded-full bg-[color:var(--btn-tint)] text-[length:var(--lkv-text-subheadline)] font-semibold uppercase text-[color:var(--lkv-text-primary)]">
                      {user.name.charAt(0)}
                    </span>
                  )}
                </span>
              </span>
              <span className="w-full truncate text-center text-[11px] font-medium leading-tight text-[color:var(--lkv-text-primary)]">
                {user.id === currentUser?.id ? 'Votre story' : user.name}
              </span>
            </button>
            {index === myStoryIndex && currentUser?.id && (
              <button
                type="button"
                disabled={uploading}
                aria-label="Publier une story (photo, 24 h)"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-[70px] shrink-0 flex-col items-center gap-[6px] outline-none transition-transform active:scale-[0.96]"
              >
                <span className="flex size-[64px] items-center justify-center rounded-full border-2 border-dashed border-[color:var(--lkv-border-strong)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--blur-md)]">
                  <Icon name="plus" size={20} aria-hidden="true" />
                </span>
                <span className="w-full truncate text-center text-[11px] font-medium leading-tight text-[color:var(--lkv-text-primary)]">
                  {uploading ? 'Envoi…' : 'Ajouter'}
                </span>
              </button>
            )}
          </React.Fragment>
        ))}

        {myStoryIndex < 0 && currentUser?.id && (
          <button
            type="button"
            disabled={uploading}
            aria-label="Publier une story (photo, 24 h)"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-[70px] shrink-0 flex-col items-center gap-[6px] outline-none transition-transform active:scale-[0.96]"
          >
            <span className="flex size-[64px] items-center justify-center rounded-full border-2 border-dashed border-[color:var(--lkv-border-strong)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--blur-md)]">
              <Icon name="plus" size={20} aria-hidden="true" />
            </span>
            <span className="w-full truncate text-center text-[11px] font-medium leading-tight text-[color:var(--lkv-text-primary)]">
              {uploading ? 'Envoi…' : 'Votre story'}
            </span>
          </button>
        )}

        {storyUsers.length === 0 && !currentUser?.id && (
          <span className="shrink-0 pt-5 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
            Connectez-vous pour voir les stories de la communauté.
          </span>
        )}
      </div>

      {viewerStart !== null && storyUsers.length > 0 && (
        <StoriesViewer
          users={storyUsers}
          startUser={Math.min(viewerStart, storyUsers.length - 1)}
          myUserId={currentUser?.id}
          onClose={() => setViewerStart(null)}
          onReport={(user, slide) => {
            void handleReport(user, slide);
          }}
          onBlock={(user) => {
            void handleBlock(user);
          }}
          onDelete={(slide) => {
            void handleDelete(slide);
          }}
        />
      )}

      {/* Feuille de composition : légende + publication (aucun dialogue natif). */}
      {pendingFile && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center bg-black/60 p-[var(--space-4)] backdrop-blur-[var(--glass-blur-sm)] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Composer une story"
          onClick={cancelPending}
        >
          <Card
            className="w-full max-w-sm space-y-[var(--space-3)] p-[var(--space-4)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
              Votre story — 24 h
            </h3>
            {pendingPreview && (
              // eslint-disable-next-line @next/next/no-img-element -- aperçu blob local
              <img
                src={pendingPreview}
                alt="Aperçu de votre story"
                className="max-h-56 w-full rounded-[var(--lkv-radius-md)] object-cover"
              />
            )}
            <label className="block text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">
              Légende (optionnel)
              <input
                type="text"
                value={captionDraft}
                maxLength={280}
                onChange={(e) => setCaptionDraft(e.target.value)}
                placeholder="Une ligne sur le moment…"
                className="mt-1 w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none"
              />
            </label>
            <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
              Visible par la communauté — 24 h. Média privé, servi uniquement aux personnes autorisées.
            </p>
            <div className="flex justify-end gap-[var(--space-2)]">
              <Button type="button" variant="ghost" size="sm" onClick={cancelPending} disabled={uploading}>
                Annuler
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={() => void publishPendingStory()} disabled={uploading}>
                {uploading ? 'Envoi…' : 'Publier la story'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
