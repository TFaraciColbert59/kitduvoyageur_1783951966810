'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card } from '@/components/ui';
import Icon from '@/components/ui/AppIcon';
import { lkvAlert } from '@/components/ui/dialogs';
import { stripImageMetadata } from '@/lib/media/stripImageMetadata';
import { storyMediaUrl } from '@/lib/stories/media';
import { replyToStory } from '@/lib/stories/reply';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import StoriesArchiveSheet from './StoriesArchiveSheet';
import StoriesViewsSheet from './StoryViewsSheet';
import StoriesViewer, { type StoryOverlay, type StorySlide, type StoryUser } from './StoriesViewer';

type StoryRow = {
  id: string;
  author_id: string;
  image_url: string | null;
  storage_path: string | null;
  caption: string | null;
  created_at: string;
  media_type: 'image' | 'video' | 'text';
  duration_ms: number | null;
  composition: unknown;
  reply_policy: string | null;
};

const AUDIENCES = [
  { value: 'public', label: 'Public' },
  { value: 'followers', label: 'Abonnés' },
  { value: 'close_friends', label: 'Amis proches' },
  { value: 'only_me', label: 'Moi uniquement' },
] as const;
type StoryAudience = (typeof AUDIENCES)[number]['value'];

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_MS = 60000;
const MAX_SLIDES = 5;
const SKELETON_COUNT = 5;

function storyTimeLabel(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `il y a ${hours} h`;
}

/** Sondage de durée vidéo (métadonnées réelles, jamais déclarées par le nom). */
function probeVideo(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      const ms = Math.round((probe.duration || 0) * 1000);
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(ms) && ms > 0 ? ms : null);
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    probe.src = url;
  });
}

/** Composition jsonb v1 → overlays typés du visionneur (texte uniquement). */
function parseTextOverlays(composition: unknown): StoryOverlay[] | undefined {
  if (!Array.isArray(composition)) return undefined;
  const overlays = composition
    .filter(
      (o): o is { type: string; text: string } =>
        Boolean(
          o &&
            typeof o === 'object' &&
            (o as { type?: unknown }).type === 'text' &&
            typeof (o as { text?: unknown }).text === 'string'
        )
    )
    .map((o) => ({ type: 'text' as const, text: o.text.slice(0, 120) }));
  return overlays.length > 0 ? overlays : undefined;
}

/**
 * Stories V2 — barre communautaire : rail iOS (anneaux, vu/non-vu, archives),
 * publication privée multi-slide (photo/vidéo, audience, texte overlay),
 * vues, likes, réponses DM via la messagerie canonique, signalement, blocage.
 *
 * États explicites : squelettes pendant le chargement (jamais un rail vide
 * ambigu), erreur de lecture avec nouvel essai, invitation pour les visiteurs.
 */
export default function CommunityStoriesBar({ currentUser }: { currentUser?: any }) {
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [authors, setAuthors] = useState<Record<string, { name: string; avatar_url?: string }>>({});
  const [viewerStart, setViewerStart] = useState<number | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [viewsSlide, setViewsSlide] = useState<StorySlide | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Choix des fichiers → feuille de composition (légende, texte, audience) :
  // jamais de dialogue natif (garde-fou U-D63 du dépôt).
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [pendingKinds, setPendingKinds] = useState<('image' | 'video')[]>([]);
  const [pendingDurations, setPendingDurations] = useState<(number | null)[]>([]);
  const [captionDraft, setCaptionDraft] = useState('');
  const [textDraft, setTextDraft] = useState('');
  const [audience, setAudience] = useState<StoryAudience>('public');
  // Idempotence de publication : stable pour une même sélection de fichiers,
  // suffixée par index de slide (rejouable après un échec réseau).
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  // États « vu / aimé / suivi » (batchés au chargement, mis à jour localement).
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStories = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      // Visiteur : le rail affiche uniquement l'invitation à se connecter.
      setStories([]);
      setLoading(false);
      return;
    }

    // A-143 + phase 06 : nettoyage des stories expirées de la personne
    // connectée, SAUF celles archivées (archived_at non nul) — le cron serveur
    // fait le reste. La ligne part, et l'objet avec elle (privé V2 ou legacy).
    try {
      const { data: expiredMine } = await supabase
        .from('post_stories')
        .select('id, image_url, storage_bucket, storage_path')
        .eq('author_id', session.user.id)
        .lt('expires_at', new Date().toISOString())
        .is('archived_at', null);
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
      .select('id, author_id, image_url, storage_path, caption, created_at, media_type, duration_ms, composition, reply_policy')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) {
      console.error('Chargement des stories refusé —', error.message);
      setStories([]);
      setLoadError(error.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as StoryRow[];
    setStories(rows);
    setLoadError(null);

    if (rows.length > 0) {
      const ids = rows.map((row) => row.id);
      // États « vu / aimé / suivi » batchés en une passe (jamais une requête
      // par story) ; vu/aimé filtrés sur ma propre personne (l'auteur voit
      // aussi les lignes d'autrui) ; follows lisibles publiquement.
      const [viewsRes, likesRes, followsRes] = await Promise.all([
        supabase.from('story_views').select('story_id, viewer_id').in('story_id', ids),
        supabase.from('story_likes').select('story_id, user_id').in('story_id', ids),
        supabase.from('user_follows').select('following_id').eq('follower_id', session.user.id),
      ]);
      setViewedIds(
        new Set(
          (viewsRes.data ?? [])
            .filter((r) => (r as { viewer_id: string }).viewer_id === session.user.id)
            .map((r) => (r as { story_id: string }).story_id)
        )
      );
      setLikedIds(
        new Set(
          (likesRes.data ?? [])
            .filter((r) => (r as { user_id: string }).user_id === session.user.id)
            .map((r) => (r as { story_id: string }).story_id)
        )
      );
      setFollowedIds(
        new Set((followsRes.data ?? []).map((r) => (r as { following_id: string }).following_id))
      );

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
    setLoading(false);
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
        .map((row): StorySlide | null => {
          const image = storyMediaUrl(row);
          if (!image) return null;
          return {
            image,
            caption: row.caption ?? undefined,
            storyId: row.id,
            mediaType: row.media_type === 'video' ? 'video' : 'image',
            durationMs: row.duration_ms ?? undefined,
            overlays: parseTextOverlays(row.composition),
            replyPolicy:
              row.reply_policy === 'followers' || row.reply_policy === 'off'
                ? row.reply_policy
                : 'everyone',
          };
        })
        .filter((slide): slide is StorySlide => slide !== null);
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

  const cancelPending = useCallback(() => {
    pendingPreviews.forEach((preview) => URL.revokeObjectURL(preview));
    setPendingFiles([]);
    setPendingPreviews([]);
    setPendingKinds([]);
    setPendingDurations([]);
    setCaptionDraft('');
    setTextDraft('');
    setPendingRequestId(null);
  }, [pendingPreviews]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    if (!currentUser?.id) {
      lkvAlert('Connectez-vous pour publier une story.');
      return;
    }
    if (files.length > MAX_SLIDES) {
      lkvAlert(`Story limitée à ${MAX_SLIDES} slides.`);
      return;
    }

    // Stories V2 (phase 03) : validation stricte avant tout upload (taille,
    // lisibilité, durée ≤ 60 s mesurée sur le média réel) — par fichier.
    const accepted: { file: File; kind: 'image' | 'video'; durationMs: number | null }[] = [];
    for (const file of files) {
      if (file.type.startsWith('video/')) {
        if (file.size > MAX_VIDEO_BYTES) {
          lkvAlert('Vidéo limitée à 25 Mo.');
          return;
        }
        const durationMs = await probeVideo(file);
        if (durationMs === null) {
          lkvAlert('Vidéo illisible.');
          return;
        }
        if (durationMs > MAX_VIDEO_MS) {
          lkvAlert('Vidéo limitée à 60 secondes — découpez-la en plusieurs stories.');
          return;
        }
        accepted.push({ file, kind: 'video', durationMs });
      } else if (file.type.startsWith('image/')) {
        if (file.size > MAX_IMAGE_BYTES) {
          lkvAlert('Story limitée à 10 Mo par image.');
          return;
        }
        accepted.push({ file, kind: 'image', durationMs: null });
      } else {
        lkvAlert('Formats acceptés : images et vidéos (MP4, MOV, WebM).');
        return;
      }
    }

    pendingPreviews.forEach((preview) => URL.revokeObjectURL(preview));
    setPendingFiles(accepted.map((a) => a.file));
    setPendingPreviews(accepted.map((a) => URL.createObjectURL(a.file)));
    setPendingKinds(accepted.map((a) => a.kind));
    setPendingDurations(accepted.map((a) => a.durationMs));
    setCaptionDraft('');
    setTextDraft('');
    setAudience('public');
    setPendingRequestId(crypto.randomUUID());
  };

  const publishPendingStory = async () => {
    if (pendingFiles.length === 0 || !currentUser?.id) return;
    setUploading(true);
    try {
      const supabase = createClient();
      // Stories V2 : média PRIVÉ — un id stable par slide + chemin
      // {uid}/{storyId}/…, idempotence client_request_id suffixée par index.
      const requestBase = pendingRequestId ?? crypto.randomUUID();
      const caption = captionDraft.trim() ? captionDraft.trim().slice(0, 280) : null;
      const overlayText = textDraft.trim().slice(0, 120);
      const composition = overlayText ? [{ type: 'text' as const, text: overlayText }] : null;

      for (let i = 0; i < pendingFiles.length; i += 1) {
        const file = pendingFiles[i];
        const isVideo = pendingKinds[i] === 'video';
        const storyId = crypto.randomUUID();
        const requestId = `${requestBase}-${i}`;
        // A-096 : EXIF/GPS retirés sur les images ; vidéos non re-encodées.
        const cleanedFile = isVideo ? file : await stripImageMetadata(file);
        const contentType = cleanedFile.type || (isVideo ? 'video/mp4' : 'image/jpeg');
        const ext = isVideo
          ? (file.name.split('.').pop() || 'mp4').toLowerCase()
          : contentType === 'image/jpeg'
            ? 'jpg'
            : (file.name.split('.').pop() || 'jpg').toLowerCase();
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
          media_type: isVideo ? 'video' : 'image',
          mime_type: contentType,
          duration_ms: isVideo ? pendingDurations[i] ?? null : null,
          composition,
          composition_version: composition ? 1 : null,
          status: 'ready',
          client_request_id: requestId,
          caption: i === 0 ? caption : null,
          visibility: audience,
        });
        if (insertError) {
          // La ligne n'existe pas : retirer l'objet orphelin avant de rendre la main.
          try {
            await supabase.storage.from('stories-private').remove([path]);
          } catch {
            /* l'objet orphelin sera purgé par le cron */
          }
          throw new Error(insertError.message);
        }
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

  // Vue enregistrée après 1 s d'affichage réel (le visionneur déclenche).
  const handleView = useCallback(
    async (slide: StorySlide) => {
      if (!slide.storyId || !currentUser?.id) return;
      const storyId = slide.storyId;
      const supabase = createClient();
      const { error } = await supabase.from('story_views').upsert(
        { story_id: storyId, viewer_id: currentUser.id, last_viewed_at: new Date().toISOString() },
        { onConflict: 'story_id,viewer_id' }
      );
      if (!error) {
        setViewedIds((prev) => new Set(prev).add(storyId));
      }
    },
    [currentUser?.id]
  );

  // Like idempotent (double clic : la clé primaire absorbe).
  const handleToggleLike = useCallback(
    async (slide: StorySlide, liked: boolean) => {
      if (!slide.storyId || !currentUser?.id) return;
      const storyId = slide.storyId;
      const supabase = createClient();
      if (liked) {
        const { error } = await supabase
          .from('story_likes')
          .delete()
          .eq('story_id', storyId)
          .eq('user_id', currentUser.id);
        if (!error) {
          setLikedIds((prev) => {
            const next = new Set(prev);
            next.delete(storyId);
            return next;
          });
        }
      } else {
        const { error } = await supabase
          .from('story_likes')
          .insert({ story_id: storyId, user_id: currentUser.id });
        // 23505 = déjà aimé (double clic) : état final identique.
        if (!error || error.code === '23505') {
          setLikedIds((prev) => new Set(prev).add(storyId));
        }
      }
    },
    [currentUser?.id]
  );

  // Réponse privée via la messagerie canonique (jamais un second système DM).
  const handleReply = useCallback(
    async (slide: StorySlide, author: StoryUser, text: string): Promise<boolean> => {
      if (!currentUser?.id) return false;
      const result = await replyToStory({ slide, author, myUserId: currentUser.id, text });
      lkvAlert(result.ok ? 'Réponse envoyée en message privé.' : (result.error ?? 'Réponse impossible.'));
      return result.ok;
    },
    [currentUser?.id]
  );

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
      /* la ligne est retirée : l'objet orphelin sera purgé par le cron */
    }
    setViewerStart(null);
    await loadStories();
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          void handleFileSelect(e);
        }}
        accept="image/*,video/mp4,video/quicktime,video/webm"
        multiple
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* En-tête de section : le rail ne flotte plus sans contexte. */}
      <div className="lkdv-social-stories-heading mb-[var(--space-2)] flex items-center justify-between">
        <h2 className="text-[length:var(--lkv-text-footnote)] font-bold uppercase tracking-[0.08em] text-[color:var(--lkv-text-muted)]">
          Stories{storyUsers.length > 0 ? ` · ${storyUsers.length}` : ''}
        </h2>
      </div>

      {/* Chargement : squelettes (jamais un rail vide ambigu). */}
      {loading && storyUsers.length === 0 && (
        <div
          className="flex w-full items-start gap-[var(--space-3)]"
          aria-label="Chargement des stories"
        >
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <span
              // eslint-disable-next-line react/no-array-index-key -- squelettes statiques
              key={i}
              className="flex w-[70px] shrink-0 flex-col items-center gap-[6px]"
              aria-hidden="true"
            >
              <span className="size-[64px] animate-pulse rounded-full bg-white/10" />
              <span className="h-[11px] w-10 animate-pulse rounded bg-white/10" />
            </span>
          ))}
        </div>
      )}

      {/* Panne de lecture : explicite + nouvel essai (jamais silencieuse). */}
      {!loading && loadError && storyUsers.length === 0 && (
        <div className="flex w-full flex-wrap items-center gap-[var(--space-2)]">
          <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
            Stories indisponibles pour le moment.
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setLoadError(null);
              setLoading(true);
              void loadStories();
            }}
          >
            Réessayer
          </Button>
        </div>
      )}

      {/* Rail de stories — colonnes 70 px : anneau + avatar 58 px + nom dessous
          (le langage iOS/Instagram attendu ; l'ancienne rangée de pilules ne se
          lisait pas comme des stories). Ma story d'abord, puis « + » (« Votre
          story » si vide, « Ajouter » sinon), puis Archives. Anneau sobre
          quand tout a été vu. Fade iOS en fin de course. */}
      {(!loading || storyUsers.length > 0) && !loadError && (
        <div className="lkdv-social-stories-rail flex w-full items-start gap-[var(--space-3)] overflow-x-auto pb-[var(--space-2)] pr-[28px] [scrollbar-width:none] [-webkit-mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] [&::-webkit-scrollbar]:hidden">
          {storyUsers.map((user, index) => {
            // Anneau vu/non-vu : sobre quand toutes les slides actives ont été vues.
            const seen =
              user.id !== currentUser?.id &&
              user.slides.length > 0 &&
              user.slides.every((s) => Boolean(s.storyId && viewedIds.has(s.storyId)));
            return (
              <React.Fragment key={user.id}>
                <button
                  type="button"
                  aria-label={`Voir la story de ${user.name}`}
                  onClick={() => setViewerStart(index)}
                  className="flex w-[70px] shrink-0 flex-col items-center gap-[6px] outline-none transition-transform active:scale-[0.96]"
                >
                  <span
                    className={
                      seen
                        ? 'rounded-full bg-white/25 p-[2.5px]'
                        : 'rounded-full bg-[conic-gradient(from_210deg,#f9ce34,#ee2a7b,#6228d7,#f9ce34)] p-[2.5px]'
                    }
                  >
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
                    aria-label="Publier une story (photo ou vidéo, 24 h)"
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
            );
          })}

          {myStoryIndex < 0 && currentUser?.id && (
            <button
              type="button"
              disabled={uploading}
              aria-label="Publier une story (photo ou vidéo, 24 h)"
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

          {currentUser?.id && (
            <button
              type="button"
              aria-label="Ouvrir mes archives de stories"
              onClick={() => setArchiveOpen(true)}
              className="flex w-[70px] shrink-0 flex-col items-center gap-[6px] outline-none transition-transform active:scale-[0.96]"
            >
              <span className="flex size-[64px] items-center justify-center rounded-full border border-[color:var(--lkv-border-strong)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--blur-md)]">
                <Icon name="clock" size={20} aria-hidden="true" />
              </span>
              <span className="w-full truncate text-center text-[11px] font-medium leading-tight text-[color:var(--lkv-text-primary)]">
                Archives
              </span>
            </button>
          )}

          {storyUsers.length === 0 && !currentUser?.id && (
            <span className="shrink-0 pt-5 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
              Connectez-vous pour voir les stories de la communauté.
            </span>
          )}
        </div>
      )}

      {viewerStart !== null && storyUsers.length > 0 && (
        <StoriesViewer
          users={storyUsers}
          startUser={Math.min(viewerStart, storyUsers.length - 1)}
          myUserId={currentUser?.id}
          likedStoryIds={likedIds}
          followedAuthorIds={followedIds}
          onClose={() => setViewerStart(null)}
          onView={(slide) => {
            void handleView(slide);
          }}
          onToggleLike={(slide, liked) => {
            void handleToggleLike(slide, liked);
          }}
          onReply={(slide, author, text) => handleReply(slide, author, text)}
          onShowViews={(slide) => setViewsSlide(slide)}
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

      {viewsSlide?.storyId && (
        <StoriesViewsSheet
          storyId={viewsSlide.storyId}
          currentUser={currentUser}
          onClose={() => setViewsSlide(null)}
        />
      )}

      {archiveOpen && (
        <StoriesArchiveSheet currentUser={currentUser} onClose={() => setArchiveOpen(false)} />
      )}

      {/* Feuille de composition : slides + texte + audience + publication
          (aucun dialogue natif). */}
      {pendingFiles.length > 0 && (
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
              Votre story — 24 h{pendingFiles.length > 1 ? ` · ${pendingFiles.length} slides` : ''}
            </h3>
            {pendingPreviews.length > 0 && (
              <div className="flex gap-[var(--space-2)] overflow-x-auto pb-[var(--space-1)]" aria-label="Aperçu des slides">
                {pendingPreviews.map((src, i) => (
                  <span key={`${i}-${src}`} className="relative shrink-0">
                    {pendingKinds[i] === 'video' ? (
                      <video
                        src={src}
                        muted
                        playsInline
                        className="h-24 w-16 rounded-[var(--lkv-radius-md)] object-cover"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- aperçu blob local
                      <img
                        src={src}
                        alt=""
                        className="h-24 w-16 rounded-[var(--lkv-radius-md)] object-cover"
                      />
                    )}
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                  </span>
                ))}
              </div>
            )}
            {pendingKinds.includes('video') && (
              <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                Les vidéos sont lues avec le son, muettes au premier lancement (60 s max chacune).
              </p>
            )}
            <fieldset className="space-y-[var(--space-1)]">
              <legend className="text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">
                Audience
              </legend>
              <div className="flex flex-wrap gap-[var(--space-1)]">
                {AUDIENCES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={audience === option.value}
                    onClick={() => setAudience(option.value)}
                    className={
                      audience === option.value
                        ? 'rounded-full bg-white/15 px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-text-primary)] ring-1 ring-[color:var(--lkv-border-strong)]'
                        : 'rounded-full bg-[color:var(--glass-bg-medium)] px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-muted)]'
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
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
            <label className="block text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">
              Texte sur la story (optionnel)
              <input
                type="text"
                value={textDraft}
                maxLength={120}
                onChange={(e) => setTextDraft(e.target.value)}
                placeholder="Un titre, une humeur…"
                className="mt-1 w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none"
              />
            </label>
            <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
              {audience === 'only_me'
                ? 'Vous seul·e verrez cette story. Média privé, servi uniquement à vous.'
                : 'Média privé, servi uniquement aux personnes autorisées — 24 h.'}
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
