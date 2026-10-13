'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card } from '@/components/ui';
import { lkvAlert } from '@/components/ui/dialogs';
import { stripImageMetadata } from '@/lib/media/stripImageMetadata';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import StoriesViewer, { type StoryUser } from './StoriesViewer';

type StoryRow = {
  id: string;
  author_id: string;
  image_url: string;
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
 * F-027 — stories RÉELLES : publication (photo 24 h), lecture des stories non
 * expirées, signalement et blocage depuis le visionneur. Plus aucun exemple
 * local : ce qui s'affiche a été publié par un membre.
 */
export default function CommunityStoriesBar({ currentUser }: { currentUser?: any }) {
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [authors, setAuthors] = useState<Record<string, { name: string }>>({});
  const [viewerStart, setViewerStart] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  // Choix du fichier → feuille de composition (légende) : jamais de dialogue
  // natif (garde-fou U-D63 du dépôt).
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStories = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('post_stories')
      .select('id, author_id, image_url, caption, created_at')
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
      const map: Record<string, { name: string }> = {};
      for (const row of rows) {
        map[row.author_id] = { name: profiles[row.author_id]?.full_name || 'Voyageur' };
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
      users.push({
        id: authorId,
        name: authors[authorId]?.name || 'Voyageur',
        time: storyTimeLabel(rows[rows.length - 1].created_at),
        slides: rows.map((row) => ({
          image: row.image_url,
          caption: row.caption ?? undefined,
          storyId: row.id,
        })),
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
  };

  const cancelPending = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingPreview(null);
    setCaptionDraft('');
  };

  const publishPendingStory = async () => {
    if (!pendingFile || !currentUser?.id) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = (pendingFile.name.split('.').pop() || 'jpg').toLowerCase();
      // A-096 : la story publiée ne conserve pas les métadonnées EXIF/GPS.
      const cleanedFile = await stripImageMetadata(pendingFile);
      const path = `stories/${currentUser.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('carnet-media')
        .upload(path, cleanedFile, { cacheControl: '3600', upsert: false });
      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage.from('carnet-media').getPublicUrl(path);
      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) throw new Error('URL publique introuvable');

      const { error: insertError } = await supabase.from('post_stories').insert({
        author_id: currentUser.id,
        image_url: publicUrl,
        caption: captionDraft.trim() ? captionDraft.trim().slice(0, 280) : null,
        visibility: 'public',
      });
      if (insertError) throw new Error(insertError.message);

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
    const { error } = await supabase
      .from('post_stories')
      .delete()
      .eq('id', slide.storyId)
      .eq('author_id', currentUser.id);
    if (error) {
      lkvAlert('La story n’a pas pu être retirée.');
      return;
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

      {/* P2 — fade iOS en fin de rail : la dernière story s'estompe au lieu
          d'être tronquée nette ; `pr` de fin de course. */}
      <div className="flex w-full items-center gap-[var(--space-2)] overflow-x-auto pb-[var(--space-1)] pr-[28px] [scrollbar-width:none] [-webkit-mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] [&::-webkit-scrollbar]:hidden">
        {currentUser?.id && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            disabled={uploading}
            aria-label="Publier une story (photo, 24 h)"
            onClick={() => fileInputRef.current?.click()}
            icon={
              <span className="flex size-7 items-center justify-center rounded-full border border-dashed border-[color:var(--lkv-border-strong)] text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                +
              </span>
            }
          >
            {uploading ? 'Envoi…' : 'Votre story'}
          </Button>
        )}

        {storyUsers.map((user, index) => (
          <Button
            key={user.id}
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            aria-label={`Voir la story de ${user.name}`}
            onClick={() => setViewerStart(index)}
            icon={
              <span className="flex size-7 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-footnote)] font-bold uppercase text-[color:var(--lkv-text-primary)]">
                {user.name.charAt(0)}
              </span>
            }
          >
            {user.id === currentUser?.id ? 'Votre story' : user.name}
          </Button>
        ))}

        {storyUsers.length === 0 && !currentUser?.id && (
          <span className="shrink-0 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
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
