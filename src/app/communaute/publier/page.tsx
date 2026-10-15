'use client';
import { lkvAlert } from '@/components/ui/dialogs';
import { stripImageMetadata } from '@/lib/media/stripImageMetadata';
import { MAX_POST_MEDIA } from '@/lib/community/media';
import NativeDateField from '@/components/native/NativeDateField';

import React, { useState, useMemo, useRef, useEffect, Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AppShell from '@/components/shell/AppShell';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/Icon';
import {
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  LoadingState,
  PageHeader,
} from '@/components/ui';

type PostType = 'photo' | 'billet' | 'question' | 'evenement';
type AudienceType = 'public' | 'club' | 'abonnies';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface UserCarnetOption {
  id: string;
  title: string;
  correlation_id: string | null;
  destination?: string | null;
  description?: string | null;
  cover_image?: string | null;
}

const POST_TYPES: Array<{ id: PostType; icon: string; title: string; hint: string }> = [
  { id: 'photo', icon: 'image-plus', title: 'Photo / vidéo', hint: 'Instantané ou galerie' },
  { id: 'billet', icon: 'file-text', title: 'Billet', hint: 'Texte long, mise en page' },
  { id: 'question', icon: 'help-circle', title: 'Question', hint: 'Demandez aux membres' },
  { id: 'evenement', icon: 'calendar', title: 'Événement', hint: 'Sortie à venir' },
];

const AUDIENCES: Array<{ id: AudienceType; icon: string; title: string; hint: string }> = [
  { id: 'public', icon: 'globe', title: 'Fil public', hint: 'Communauté + votre profil' },
  { id: 'club', icon: 'users', title: 'Un club', hint: 'Vos clubs uniquement' },
  { id: 'abonnies', icon: 'lock', title: 'Abonnés', hint: 'Vos abonnés uniquement' },
];

function PublierPostContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialClubId = searchParams?.get('clubId') || '';
  const initialClubName = searchParams?.get('clubName') || '';
  const initialCarnetId = searchParams?.get('carnetId') || '';
  const searchCorrelationId = searchParams?.get('correlationId') || '';
  const { user } = useAuth();

  // Form State — vide par défaut : rien de fictif n'est pré-rempli.
  const [postType, setPostType] = useState<PostType>(
    searchParams?.get('type') === 'question' ? 'question' : 'photo'
  );
  const [title, setTitle] = useState(initialClubName ? `Récit dans ${initialClubName}` : '');
  const [content, setContent] = useState('');

  // Event specific state
  const [eventDate, setEventDate] = useState('');
  const [eventMaxParticipants, setEventMaxParticipants] = useState(10);

  // Media Files — F-014 : chaque photo garde son File et son état d'upload ;
  // la publication n'embarque QUE des URLs publiques durables.
  type PublicationPhoto = {
    id: string;
    fileName: string;
    previewUrl: string;
    file: File;
    uploadedUrl: string | null;
    uploading: boolean;
    failed: boolean;
  };
  const [photos, setPhotos] = useState<PublicationPhoto[]>([]);
  const [sharedKitId, setSharedKitId] = useState('');
  const [publicKits, setPublicKits] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!user?.id) { setPublicKits([]); return; }
    let active = true;
    void createClient().from('materiel_kits').select('id, name')
      .eq('user_id', user.id).eq('is_public', true).order('name')
      .then(({ data, error }) => {
        if (active && !error) setPublicKits((data ?? []) as Array<{ id: string; name: string }>);
      });
    return () => { active = false; };
  }, [user?.id]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Context & Links
  const [linkedCarnet, setLinkedCarnet] = useState(
    UUID_PATTERN.test(initialCarnetId) ? initialCarnetId : ''
  );
  const [userCarnets, setUserCarnets] = useState<UserCarnetOption[]>([]);
  const [location, setLocation] = useState('');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Prépublication : consentement explicite + retrait des coordonnées.
  const [publicationConsent, setPublicationConsent] = useState(false);
  const [stripCoordinates, setStripCoordinates] = useState(true);

  // Tags & Mentions
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [mentionInput, setMentionInput] = useState('');

  // Destination & Timing
  const [audience, setAudience] = useState<AudienceType>(initialClubId ? 'club' : 'public');
  const [userClubs, setUserClubs] = useState<any[]>([]);
  const [selectedClub, setSelectedClub] = useState<string>(initialClubId);
  const [loadingUserClubs, setLoadingUserClubs] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // A-039 : clé d'idempotence stable pour la tentative de publication en cours.
  const publishRequestIdRef = useRef<string | null>(null);
  // A-032 : état visible du brouillon (restauré / enregistré / nettoyé).
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const draftHydratedRef = useRef(false);

  // Formatting state (mise en forme visuelle du champ texte)
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);

  const selectedCarnet = userCarnets.find((c) => c.id === linkedCarnet) ?? null;
  const requiresCarnetConsent = Boolean(linkedCarnet);

  // Fetch Joined Clubs from Supabase
  useEffect(() => {
    async function fetchUserClubs() {
      if (!user) return;
      setLoadingUserClubs(true);
      try {
        const supabase = createClient();
        const { data: memberships } = await supabase
          .from('club_members')
          .select('club_id, role, status, club:clubs(*)')
          .eq('user_id', user.id)
          .eq('status', 'active');

        if (memberships && memberships.length > 0) {
          const activeClubs = memberships.map((m: any) => m.club).filter(Boolean);
          setUserClubs(activeClubs);
          if (activeClubs.length > 0 && !selectedClub) {
            setSelectedClub(activeClubs[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching user clubs:', err);
      } finally {
        setLoadingUserClubs(false);
      }
    }

    fetchUserClubs();
  }, [user, selectedClub]);

  // A-032 — restaurer le brouillon privé de la personne (jamais celui d'un
  // autre compte : la table est filtrée par RLS sur user_id).
  useEffect(() => {
    if (!user?.id || draftHydratedRef.current) return;
    draftHydratedRef.current = true;
    void (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('community_post_drafts')
        .select('title, content, post_type, tags, location, audience, club_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error || !data) return;
      if (!data.content?.trim() && !data.title?.trim()) return;
      if (data.title) setTitle(data.title);
      if (data.content) setContent(data.content);
      if (Array.isArray(data.tags) && data.tags.length > 0) setTags(data.tags);
      if (data.location) setLocation(data.location);
      if (data.audience === 'abonnies') setAudience('abonnies');
      if (data.audience === 'club' && data.club_id) {
        setAudience('club');
        setSelectedClub(data.club_id);
      }
      setDraftNotice('Brouillon restauré — il sera supprimé après publication.');
    })();
  }, [user?.id]);

  // A-032 — sauvegarde automatique (débouncée) tant qu'il y a du contenu.
  useEffect(() => {
    if (!user?.id || !draftHydratedRef.current) return;
    if (!content.trim() && !title.trim()) return;
    const timer = setTimeout(() => {
      void (async () => {
        const supabase = createClient();
        const { error } = await supabase.from('community_post_drafts').upsert(
          {
            user_id: user.id,
            title: title.trim() || null,
            content,
            post_type: postType,
            tags,
            location: location || null,
            audience,
            club_id: audience === 'club' && selectedClub ? selectedClub : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
        if (!error) setDraftNotice('Brouillon enregistré (privé).');
      })();
    }, 900);
    return () => clearTimeout(timer);
  }, [user?.id, content, title, postType, tags, location, audience, selectedClub]);

  // Phase 2 — carnets réels de l'utilisateur : seuls des ids valides peuvent
  // être liés à la publication (linked_carnet_id → carnets(id)).
  useEffect(() => {
    async function fetchUserCarnets() {
      if (!user) return;
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('carnets')
          .select('id, title, correlation_id, destination, description, cover_image')
          .eq('author_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);
        setUserCarnets((data ?? []) as UserCarnetOption[]);
      } catch (err) {
        console.error('Error fetching user carnets:', err);
      }
    }

    fetchUserCarnets();
  }, [user]);

  // Word count computation
  const wordCount = useMemo(() => {
    return content.trim() ? content.trim().split(/\s+/).length : 0;
  }, [content]);

  // Quality score computation — F-035 : la géolocalisation exacte n'est plus
  // récompensée ; un récit utile sans GPS n'est pas « incomplet ».
  const qualityScore = useMemo(() => {
    let score = 20;
    if (title.trim()) score += 20;
    if (photos.length > 0) score += 25;
    if (linkedCarnet) score += 15;
    if (tags.length >= 2) score += 12;
    return Math.min(100, score);
  }, [title, photos, linkedCarnet, tags]);

  // Functional Geolocation Detection
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      lkvAlert('La géolocalisation n\'est pas supportée par votre navigateur.');
      return;
    }
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(4);
        const lng = position.coords.longitude.toFixed(4);
        setLocation(`📍 GPS (${lat}, ${lng}) · Position détectée`);
        setIsDetectingLocation(false);
      },
      (error) => {
        console.warn('Geolocation error:', error?.message || `Code ${error?.code}` || error);
        lkvAlert('Position indisponible. Saisissez le lieu manuellement.');
        setIsDetectingLocation(false);
      },
      { timeout: 8000 }
    );
  };

  // Handlers for Tags & Mentions
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim().toLowerCase())) {
        setTags([...tags, tagInput.trim().toLowerCase()]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleAddMention = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && mentionInput.trim()) {
      e.preventDefault();
      const cleaned = mentionInput.trim().replace(/^@/, '');
      if (!mentions.includes(cleaned)) {
        setMentions([...mentions, cleaned]);
      }
      setMentionInput('');
    }
  };

  const handleRemoveMention = (mentionToRemove: string) => {
    setMentions(mentions.filter((m) => m !== mentionToRemove));
  };

  const uploadPublicationPhoto = async (photo: PublicationPhoto): Promise<string | null> => {
    // This bucket generates permanent PUBLIC URLs. Do not upload content
    // marked followers-only or club-only until private signed media exists.
    if (audience !== 'public') {
      lkvAlert('Les médias sont disponibles uniquement pour les publications publiques pour le moment.');
      setPhotos((previous) => previous.filter((item) => item.id !== photo.id));
      URL.revokeObjectURL(photo.previewUrl);
      return null;
    }
    setPhotos((prev) => prev.map((p) => p.id === photo.id ? { ...p, uploading: true, failed: false } : p));
    const failPhoto = (reason: string) => {
      console.error('Upload photo de publication refusé —', reason, photo.fileName);
      setPhotos((prev) =>
        prev.map((p) => (p.id === photo.id ? { ...p, uploading: false, failed: true } : p))
      );
    };

    try {
      const supabase = createClient();
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        failPhoto('session absente');
        return null;
      }
      if (!photo.file.type.startsWith('image/') && !photo.file.type.startsWith('video/')) {
        failPhoto('format non supporté');
        return null;
      }
      if (photo.file.size > 26214400) {
        failPhoto('fichier au-delà de 25 Mio');
        return null;
      }

      // A-096: re-encoding can change image MIME to JPEG. Use the cleaned
      // file extension rather than leaving a misleading .png path for a JPEG.
      const cleanedFile = await stripImageMetadata(photo.file);
      const ext = (cleanedFile.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `community-posts/${currentUser.id}/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;

      // Bucket public carnet-media : l'URL stockée dans image_url est durable
      // (contrairement à une URL signée qui expirerait).
      const { error } = await supabase.storage
        .from('carnet-media')
        .upload(path, cleanedFile, { cacheControl: '3600', upsert: false });
      if (error) {
        failPhoto(error.message);
        return null;
      }

      const { data: publicUrlData } = supabase.storage.from('carnet-media').getPublicUrl(path);
      const publicUrl = publicUrlData?.publicUrl || null;
      if (!publicUrl) {
        failPhoto('URL publique introuvable');
        return null;
      }

      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id ? { ...p, uploading: false, failed: false, uploadedUrl: publicUrl } : p
        )
      );
      return publicUrl;
    } catch (err) {
      failPhoto(err instanceof Error ? err.message : 'erreur inattendue');
      return null;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (audience !== 'public' && files.length > 0) {
      e.target.value = '';
      lkvAlert('Pour protéger la confidentialité, les photos et vidéos sont réservées aux publications publiques.');
      return;
    }
    e.target.value = '';
    if (!files.length) return;
    const available = Math.max(0, MAX_POST_MEDIA - photos.length);
    if (files.length > available) lkvAlert('Maximum 10 médias par publication.');
    for (const file of files.slice(0, available)) {
      const photo: PublicationPhoto = {
        id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        fileName: file.name, previewUrl: URL.createObjectURL(file), file,
        uploadedUrl: null, uploading: false, failed: false,
      };
      setPhotos((prev) => [...prev, photo]);
      // No public cloud upload until the user explicitly confirms a PUBLIC post.
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Submit Handler — publie uniquement des données réelles ; un échec est
  // affiché et rien n'est simulé localement.
  const handlePublish = async (draft = false) => {
    if (draft) {
      lkvAlert('Les brouillons ne sont pas encore disponibles : la publication est directe.');
      return;
    }
    if (requiresCarnetConsent && !publicationConsent) {
      lkvAlert('Confirmez le consentement de publication avant de publier.');
      return;
    }
    // A PUBLIC storage URL cannot provide private media access control.
    // Disallow mixed audience + public media, linked snapshots, kit or events
    // rather than pretending they would be followers/club private.
    if (audience !== 'public' &&
        (photos.length > 0 || Boolean(linkedCarnet) || Boolean(sharedKitId) || postType === 'evenement')) {
      lkvAlert('Pour protéger votre audience, seules les publications texte peuvent être réservées aux abonnés ou à un club actuellement.');
      return;
    }
    if (audience === 'club' && !selectedClub) {
      lkvAlert('Choisissez un club avant de publier.');
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();

      // Upload after explicit publication only. Private audiences reject media.
      // A failed upload must never create a post containing an object URL.
      const confirmedMediaUrls: string[] = [];
      for (const photo of photos) {
        const uploaded = photo.uploadedUrl || await uploadPublicationPhoto(photo);
        if (!uploaded) throw new Error('Un média n’a pas été transféré. Réessayez ou retirez-le.');
        confirmedMediaUrls.push(uploaded);
      }

      // Format full content string cleanly
      let fullContent = content.trim();
      if (title.trim() && postType !== 'photo') {
        fullContent = `**${title.trim()}**\n\n${fullContent}`;
      }
      if (postType === 'evenement' && eventDate) {
        fullContent += `\n\n📅 ${eventDate}`;
        if (eventMaxParticipants > 0) {
          fullContent += ` · ${eventMaxParticipants} places`;
        }
      }
      if (location) {
        fullContent += `\n\n📍 ${location}`;
      }
      if (tags.length > 0) {
        fullContent += `\n\n` + tags.map((t) => `#${t}`).join(' ');
      }

      // Persist only URLs from this confirmed submission; never local blob previews.
      const mediaUrls = confirmedMediaUrls;
      const firstPersistableImage = mediaUrls[0] ?? null;

      if (!user) throw new Error('Authentification requise');

      // F-022 : résoudre les mentions saisies vers des identifiants réels.
      // Une mention non résolue reste du texte (aucune fausse promesse).
      let mentionIds: string[] = [];
      if (mentions.length > 0) {
        const resolved: Array<string | null> = [];
        for (const handle of mentions) {
          const trimmed = handle.trim();
          if (!trimmed) continue;
          const exact = await supabase
            .from('public_profiles')
            .select('id')
            .ilike('full_name', trimmed)
            .limit(1)
            .maybeSingle();
          let id = exact.data?.id ?? null;
          if (!id) {
            const prefix = await supabase
              .from('public_profiles')
              .select('id')
              .ilike('full_name', `${trimmed}%`)
              .limit(1)
              .maybeSingle();
            id = prefix.data?.id ?? null;
          }
          resolved.push(id);
        }
        mentionIds = [...new Set(resolved.filter((value): value is string => Boolean(value)))];
      }

      // A-039 : clé d'idempotence stable pour toute la tentative en cours
      // (un retry après timeout réutilise la même clé, jamais un doublon).
      if (typeof crypto !== 'undefined' && 'randomUUID' in crypto && !publishRequestIdRef.current) {
        publishRequestIdRef.current = crypto.randomUUID();
      }
      const requestId = publishRequestIdRef.current;

      const deleteDraft = async () => {
        try {
          await supabase.from('community_post_drafts').delete().eq('user_id', user.id);
          publishRequestIdRef.current = null;
          setDraftNotice(null);
          // A-207 : libérer les aperçus locaux après publication.
          photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
        } catch {
          /* best-effort */
        }
      };

      // Club-only and follower-only posts use the RLS-protected community_posts
      // table, never public-read legacy club_topics.

      // F-022 : le format « événement » crée une VRAIE sortie (table events,
      // fiche + inscription join_event), pas seulement une ligne de texte.
      if (postType === 'evenement') {
        if (!eventDate) {
          lkvAlert('Choisissez une date pour publier une sortie.');
          setIsSubmitting(false);
          return;
        }
        const { error: eventError } = await supabase.from('events').insert({
          title: title.trim() || 'Sortie communauté',
          description: content.trim() || null,
          event_date: eventDate,
          max_participants: eventMaxParticipants > 0 ? eventMaxParticipants : 10,
          organizer_id: user.id,
          type: 'rando',
        });
        if (eventError) {
          lkvAlert(`La sortie n’a pas pu être créée : ${eventError.message}`);
          setIsSubmitting(false);
          return;
        }
      }

      // Valid columns matching PostgreSQL community_posts table
      const linkedCarnetId = UUID_PATTERN.test(linkedCarnet) ? linkedCarnet : null;
      const selectedCarnetRow = linkedCarnetId
        ? userCarnets.find((carnet) => carnet.id === linkedCarnetId) ?? null
        : null;
      const correlationId = UUID_PATTERN.test(searchCorrelationId)
        ? searchCorrelationId
        : selectedCarnetRow?.correlation_id && UUID_PATTERN.test(selectedCarnetRow.correlation_id)
          ? selectedCarnetRow.correlation_id
          : null;

      const payload: Record<string, any> = {
        author_id: user.id,
        // These DB fields (and SELECT RLS) must be deployed before frontend.
        audience,
        club_id: audience === 'club' ? selectedClub : null,
        content: fullContent,
        post_type: postType === 'question' ? 'question' : postType === 'evenement' ? 'event' : 'share',
        likes_count: 0,
        comments_count: 0,
        image_url: firstPersistableImage,
        ...(mediaUrls.length > 1 ? { media_urls: mediaUrls } : {}),
        ...(sharedKitId ? { linked_kit_id: sharedKitId } : {}),
        mentions: mentionIds,
        ...(requestId ? { client_request_id: requestId } : {}),
        ...(linkedCarnetId ? { linked_carnet_id: linkedCarnetId, snapshot_exclude_location: stripCoordinates } : {}),
        ...(correlationId ? { correlation_id: correlationId } : {}),
      };

      const { data, error } = await supabase.from('community_posts').insert(payload).select().single();

      const isDuplicate =
        error?.code === '23505' && error.message.includes('request_uniq');
      if (error && !isDuplicate) {
        throw new Error(error.message || error.details || 'Erreur lors de l\'insertion');
      }

      // Call rewards engine pipeline to claim points (seulement à la première
      // création réelle : un rejeu idempotent ne réclame pas deux fois).
      if (data?.id && !isDuplicate) {
        try {
          await fetch('/api/rewards/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action_type: 'post',
              target_id: data.id,
              target_type: 'post',
              metadata: { content: fullContent }
            })
          });
        } catch (rewardsErr) {
          console.warn('Rewards claim error:', rewardsErr);
        }
      }

      await deleteDraft();
      setToastMessage(
        isDuplicate ? 'Publication déjà enregistrée ✓' : audience === 'club' ? 'Publication réservée aux membres enregistrée ✓' : audience === 'abonnies' ? 'Publication réservée aux abonnés enregistrée ✓' : 'Post publié avec succès sur le fil ! 🎉'
      );
      setTimeout(() => {
        router.push(audience === 'club' && selectedClub ? '/clubs/' + selectedClub : '/communaute');
      }, 1500);
    } catch (err: any) {
      console.error('Error creating post:', err);
      lkvAlert('Erreur lors de la publication : ' + (err?.message || String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const publishDisabled = isSubmitting || (requiresCarnetConsent && !publicationConsent);

  return (
    <div className="lkdv-social-compose-screen relative min-h-screen pb-32 text-[color:var(--lkv-text-primary)] md:pb-24 md:pt-24">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="animate-fade-in fixed right-4 top-24 z-[var(--z-toast)] rounded-[var(--lkv-radius-md)] bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] px-[var(--space-5)] py-[var(--space-3)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] shadow-elevation-4">
          {toastMessage}
        </div>
      )}

      <div className="mx-auto w-full max-w-7xl px-[var(--space-4)]">
        {/* Top Bar Navigation */}
        <div className="mb-[var(--space-8)] flex flex-col items-start justify-between gap-[var(--space-4)] sm:flex-row sm:items-center">
          <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-[var(--space-2)] text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-muted)]">
            <Link href="/" className="transition-colors hover:text-[color:var(--lkv-text-primary)]">Le Kit du Voyageur</Link>
            <span aria-hidden="true">›</span>
            <Link href="/communaute" className="transition-colors hover:text-[color:var(--lkv-text-primary)]">Communauté</Link>
            <span aria-hidden="true">›</span>
            <span className="font-bold text-[color:var(--lkv-text-primary)]">Publier</span>
          </nav>

          <Button
            type="button"
            variant="primary"
            loading={isSubmitting}
            disabled={publishDisabled}
            onClick={() => handlePublish(false)}
            className="hidden md:inline-flex"
          >
            {isSubmitting ? 'Publication...' : 'Publier'}
          </Button>
        </div>

        {/* Hero Header */}
        <PageHeader
          variant="large"
          className="mb-[var(--space-10)]"
          title={
            <span>
              Un moment, <em className="font-serif font-normal italic">partagé.</em>
            </span>
          }
          subtitle="Une photo depuis un col, un conseil sur un matériel, une question à la communauté. Les posts vivent quelques jours dans le fil, les carnets restent."
          subtitleLines={0}
        />

        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 items-start gap-[var(--space-8)] lg:grid-cols-12">

          {/* LEFT COLUMN: FORM STEPS */}
          <div className="space-y-[var(--space-6)] lg:col-span-8">

            {/* SECTION 01: Type de publication */}
            <Card className="space-y-[var(--space-4)]">
              <div className="flex items-center justify-between">
                <h2 className="text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">
                  Type de <em className="font-serif font-normal italic">publication</em>
                </h2>
                <span className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase text-[color:var(--lkv-text-muted)]">01 — Format</span>
              </div>
              <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                Choisissez la forme qui correspond à ce que vous voulez partager. Chaque type adapt les champs et le rendu dans le fil.
              </p>

              <div className="grid grid-cols-2 gap-[var(--space-3)] sm:grid-cols-4">
                {POST_TYPES.map((type) => (
                  <Card
                    key={type.id}
                    variant="interactive"
                    selected={postType === type.id}
                    onClick={() => {
                      setPostType(type.id);
                      if (type.id === 'question') {
                        setTags((prev) => (prev.includes('question') ? prev : [...prev, 'question']));
                      }
                    }}
                    className="flex flex-col items-center justify-center gap-[var(--space-2)] p-[var(--space-4)] text-center"
                  >
                    <span className={`flex size-9 items-center justify-center rounded-[var(--lkv-radius-sm)] text-base ${postType === type.id ? 'bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)]' : 'bg-[color:var(--glass-bg-medium)] text-[color:var(--glass-label)]'}`}>
                      <Icon name={type.icon} size={18} />
                    </span>
                    <span className="block text-[length:var(--lkv-text-caption)] font-bold leading-tight">{type.title}</span>
                    <span className="mt-0.5 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{type.hint}</span>
                  </Card>
                ))}
              </div>
            </Card>

            {/* SECTION 02: Le contenu */}
            <Card className="space-y-[var(--space-4)]">
              <div className="flex items-center justify-between">
                <h2 className="text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">Le contenu</h2>
                <span className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase text-[color:var(--lkv-text-muted)]">02 — Ce que vous partagez</span>
              </div>
              <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                {postType === 'question'
                  ? 'Posez une question claire à la communauté outdoor pour obtenir des réponses pertinentes.'
                  : postType === 'evenement'
                  ? 'Proposez une sortie ou une expédition en groupe.'
                  : 'Un mot court engage plus qu\'un long paragraphe. Une image, une phrase — c\'est souvent tout ce qu\'il faut.'}
              </p>

              <div className="space-y-[var(--space-4)]">
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="post-title" className="text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">
                      {postType === 'question'
                        ? 'Intitulé de votre question *'
                        : postType === 'evenement'
                        ? 'Nom de la sortie ou événement *'
                        : 'Titre '}
                      {postType === 'photo' && <span className="font-normal text-[color:var(--lkv-text-muted)]">(Optionnel pour une seule photo)</span>}
                    </label>
                  </div>
                  <input
                    id="post-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      postType === 'question'
                        ? 'Ex: Quelle tente 2 places ultralégère conseiller pour les Alpes ?'
                        : postType === 'evenement'
                        ? 'Ex: Traversée du Charmant Som au coucher du soleil'
                        : 'Donnez un titre à votre post...'
                    }
                    className="w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-4)] py-[var(--space-3)] text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]"
                  />
                </div>

                {postType === 'evenement' && (
                  <div className="grid grid-cols-1 gap-[var(--space-4)] rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-[var(--space-4)] sm:grid-cols-2">
                    <div>
                      <label htmlFor="event-date" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">Date de l&apos;événement *</label>
                      <NativeDateField
                        id="event-date"
                        title="Date de l’événement"
                        value={eventDate}
                        onChange={setEventDate}
                        className="w-full rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] font-semibold"
                      />
                    </div>
                    <div>
                      <label htmlFor="event-capacity" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">Capacité max (participants)</label>
                      <input
                        id="event-capacity"
                        type="number"
                        value={eventMaxParticipants}
                        onChange={(e) => setEventMaxParticipants(Number(e.target.value))}
                        className="w-full rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] font-semibold"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="post-content" className="mb-1.5 block text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">
                    {postType === 'question' ? 'Détails de la question *' : 'Texte du post *'}
                  </label>

                  <div className="overflow-hidden rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)]">
                    <div className="flex items-center gap-[var(--space-1)] border-b border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)]">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-pressed={isBold}
                        aria-label="Gras"
                        onClick={() => setIsBold(!isBold)}
                        className={`size-7 min-h-0 px-0 font-bold ${isBold ? 'bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)]' : ''}`}
                      >
                        B
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-pressed={isItalic}
                        aria-label="Italique"
                        onClick={() => setIsItalic(!isItalic)}
                        className={`size-7 min-h-0 px-0 font-serif italic ${isItalic ? 'bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)]' : ''}`}
                      >
                        I
                      </Button>
                      <Button type="button" variant="ghost" size="sm" aria-label="Souligné" className="size-7 min-h-0 px-0 underline">
                        U
                      </Button>
                      <Divider orientation="vertical" spacing="sm" className="mx-[var(--space-1)] h-4" />
                      <Button type="button" variant="ghost" size="sm" aria-label="Titre" className="size-7 min-h-0 px-0 text-[length:var(--lkv-text-caption-2)] font-bold">
                        H
                      </Button>
                      <Button type="button" variant="ghost" size="sm" aria-label="Citation" className="size-7 min-h-0 px-0 font-serif italic">
                        “
                      </Button>
                      <Button type="button" variant="ghost" size="sm" aria-label="Code" className="size-7 min-h-0 px-0">
                        ::
                      </Button>
                      <Divider orientation="vertical" spacing="sm" className="mx-[var(--space-1)] h-4" />
                      <Button type="button" variant="ghost" size="sm" aria-label="Insérer un lien" className="size-7 min-h-0 px-0">
                        <Icon name="link" size={14} />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" aria-label="Insérer une image" className="size-7 min-h-0 px-0">
                        <Icon name="image-plus" size={14} />
                      </Button>
                    </div>

                    <textarea
                      id="post-content"
                      rows={postType === 'photo' ? 4 : 8}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder={
                        postType === 'question'
                          ? 'Décrivez votre contexte, le budget, votre niveau ou vos contraintes...'
                          : postType === 'evenement'
                          ? 'Précisez l\'itinéraire, l\'équipement requis et le lieu de rdv...'
                          : 'Racontez votre expérience, partagez votre conseil...'
                      }
                      className={`w-full resize-y bg-transparent p-[var(--space-4)] text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none ${isBold ? 'font-bold' : ''} ${isItalic ? 'font-serif italic' : ''}`}
                    />
                  </div>

                  <div className="mt-[var(--space-2)] flex items-center justify-between text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                    <span>Mise en forme légère : les liens et les citations sont automatiquement supportés</span>
                    <span className="font-mono font-bold text-[color:var(--lkv-text-primary)]">{wordCount} mots</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* SECTION 03: Photos & vidéos */}
            <Card className="space-y-[var(--space-4)]">
              <div className="flex items-center justify-between">
                <h2 className="text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">
                  Photos <em className="font-serif font-normal italic">& vidéos</em>
                </h2>
                <span className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase text-[color:var(--lkv-text-muted)]">03 — Médias</span>
              </div>
              <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                Jusqu&apos;à 10 fichiers. Glissez-déposez ou parcourez. La première image devient la vignette du post.
              </p>

              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,video/mp4,video/webm,video/quicktime" multiple className="hidden" />
              <Card
                variant="interactive"
                onClick={() => fileInputRef.current?.click()}
                className="mb-[var(--space-4)] border-2 border-dashed border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-[var(--space-8)] text-center"
              >
                <div className="mx-auto mb-[var(--space-2)] flex size-10 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-base">⇪</div>
                <p className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Cliquez pour afficher / ou parcourez</p>
                <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">JPG, PNG, MP4 max 20Mo</p>
              </Card>

              <div className="grid grid-cols-4 gap-[var(--space-3)]">
                {photos.map((photo, index) => (
                  <div key={photo.id} className="group relative aspect-[4/3] overflow-hidden rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-black/10">
                    {photo.file.type.startsWith('video/') ? (
                      <video src={photo.previewUrl} muted playsInline preload="metadata" className="size-full object-cover" aria-label="Aperçu vidéo" />
                    ) : (
                      <img src={photo.previewUrl} alt="Aperçu de la photo" className="size-full object-cover" />
                    )}
                    {photo.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[length:var(--lkv-text-caption-2)] font-bold text-white">
                        Envoi…
                      </div>
                    )}
                    {photo.failed && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotos((prev) =>
                            prev.map((p) => (p.id === photo.id ? { ...p, uploading: true, failed: false } : p))
                          );
                          void uploadPublicationPhoto({ ...photo, uploading: true, failed: false });
                        }}
                        className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 text-[length:var(--lkv-text-caption-2)] font-bold text-white"
                      >
                        <span>Échec — réessayer</span>
                      </button>
                    )}
                    <IconButton
                      type="button"
                      variant="glass"
                      size="sm"
                      onClick={() => handleRemovePhoto(index)}
                      aria-label="Retirer cette photo"
                      className="absolute right-1 top-1 bg-black/60 text-[color:var(--lkv-text-inverted)] opacity-80 transition-opacity group-hover:opacity-100"
                    >
                      ✕
                    </IconButton>
                  </div>
                ))}
                <Card
                  variant="interactive"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex aspect-[4/3] flex-col items-center justify-center border-2 border-dashed border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-muted)]"
                >
                  <span className="mb-0.5 text-base">+</span>
                  <span className="text-[length:var(--lkv-text-caption-2)]">Ajouter</span>
                </Card>
              </div>
            </Card>

            {/* SECTION 04: Liens internes */}
            <Card className="space-y-[var(--space-4)]">
              <div className="flex items-center justify-between">
                <h2 className="text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">
                  Liens <em className="font-serif font-normal italic">internes</em>
                </h2>
                <span className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase text-[color:var(--lkv-text-muted)]">04 — Contexte</span>
              </div>
              <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                Rattachez votre post à un contenu existant : le lien apparaîtra en pied de post et enrichira le fil.
              </p>

              <div className="space-y-[var(--space-4)]">
                <div>
                  {publicKits.length > 0 && (
                    <div className="mb-4">
                      <label htmlFor="post-shared-kit" className="mb-1.5 block text-sm font-semibold">Kit public reproductible</label>
                      <select id="post-shared-kit" value={sharedKitId} onChange={(event) => setSharedKitId(event.target.value)}
                        className="w-full rounded-xl border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] p-3">
                        <option value="">Aucun kit partagé</option>
                        {publicKits.map((kit) => <option key={kit.id} value={kit.id}>{kit.name}</option>)}
                      </select>
                      <p className="mt-1 text-xs text-[color:var(--lkv-text-muted)]">
                        Les lecteurs pourront copier ce kit dans leur matériel, sans toucher au vôtre.
                      </p>
                    </div>
                  )}
                  <label htmlFor="linked-carnet" className="mb-1.5 block text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">Carnet lié</label>
                  <select
                    id="linked-carnet"
                    value={linkedCarnet}
                    onChange={(e) => { setLinkedCarnet(e.target.value); setPublicationConsent(false); }}
                    className="w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-4)] py-[var(--space-3)] text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]"
                  >
                    <option value="">— Aucun carnet —</option>
                    {userCarnets.map((carnet) => (
                      <option key={carnet.id} value={carnet.id}>
                        {carnet.title}
                      </option>
                    ))}
                  </select>
                  {userCarnets.length === 0 && (
                    <p className="mt-1.5 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                      Aucun carnet disponible — terminez une sortie pour en créer un.
                    </p>
                  )}
                </div>

                {selectedCarnet && (
                  <Card variant="compact" className="space-y-[var(--space-2)]">
                    <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase text-[color:var(--lkv-text-muted)]">Aperçu du carnet publié (instantané)</span>
                    <div className="flex items-center gap-[var(--space-3)]">
                      {selectedCarnet.cover_image && (
                        <img src={selectedCarnet.cover_image} alt="" className="size-14 rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-border)] object-cover" />
                      )}
                      <div className="min-w-0">
                        <h4 className="truncate text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">{selectedCarnet.title}</h4>
                        {selectedCarnet.destination && (
                          <p className="truncate text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">📍 {selectedCarnet.destination}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-[length:var(--lkv-text-caption-2)] leading-relaxed text-[color:var(--lkv-text-secondary)]">
                      La publication crée un instantané figé de ce carnet. Vos modifications ultérieures du carnet privé ne seront pas publiées automatiquement.
                    </p>
                    <label className="flex cursor-pointer items-start gap-[var(--space-2)] pt-[var(--space-1)]">
                      <input
                        type="checkbox"
                        checked={publicationConsent}
                        onChange={(e) => setPublicationConsent(e.target.checked)}
                        className="mt-0.5 accent-[var(--lkv-primary)]"
                      />
                      <span className="text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-text-primary)]">
                        Je consens à publier cet instantané dans le fil communauté.
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-[var(--space-2)]">
                      <input
                        type="checkbox"
                        checked={stripCoordinates}
                        onChange={(e) => setStripCoordinates(e.target.checked)}
                        className="mt-0.5 accent-[var(--lkv-primary)]"
                      />
                      <span className="text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-text-primary)]">
                        Retirer les coordonnées et points de carte de l&apos;instantané.
                      </span>
                    </label>
                  </Card>
                )}

                <div>
                  <label htmlFor="post-location" className="mb-1.5 block text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">Localisation</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-[var(--space-4)] text-[length:var(--lkv-text-caption)]" aria-hidden="true">📍</span>
                    <input
                      id="post-location"
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Ex: Massif de la Chartreuse, Isère..."
                      className="w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] py-[var(--space-3)] pl-9 pr-24 text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={isDetectingLocation}
                      disabled={isDetectingLocation}
                      onClick={handleDetectLocation}
                      className="absolute right-[var(--space-2)]"
                    >
                      Détecter
                    </Button>
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="post-tag-input" className="text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">
                      Tags <span className="font-normal text-[color:var(--lkv-text-muted)]">(Au moins 2 pour trouver le post)</span>
                    </label>
                  </div>
                  <div className="flex min-h-[48px] flex-wrap items-center gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-[var(--space-2)]">
                    {tags.map((tag) => (
                      <Chip key={tag} onClick={() => handleRemoveTag(tag)} aria-label={`Retirer le tag ${tag}`}>
                        <span>{tag}</span>
                        <span aria-hidden="true">✕</span>
                      </Chip>
                    ))}
                    <input
                      id="post-tag-input"
                      type="text"
                      enterKeyHint="done"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      placeholder="+ Ajouter un tag..."
                      className="min-w-[120px] flex-1 bg-transparent px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="post-mention-input" className="mb-1.5 block text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">Mentionner des membres</label>
                  <div className="flex min-h-[48px] flex-wrap items-center gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-[var(--space-2)]">
                    {mentions.map((m) => (
                      <Chip key={m} tone="sage" onClick={() => handleRemoveMention(m)} aria-label={`Retirer la mention ${m}`}>
                        <span>@{m}</span>
                        <span aria-hidden="true">✕</span>
                      </Chip>
                    ))}
                    <input
                      id="post-mention-input"
                      type="text"
                      enterKeyHint="done"
                      value={mentionInput}
                      onChange={(e) => setMentionInput(e.target.value)}
                      onKeyDown={handleAddMention}
                      placeholder="Taper @ pour mentionner..."
                      className="min-w-[140px] flex-1 bg-transparent px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none"
                    />
                  </div>
                  <p className="mt-1 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                    Les mentions reconnues reçoivent une notification — saisissez le nom du profil (ex. « Marie Dupont »).
                  </p>
                </div>
              </div>
            </Card>

            {/* SECTION 05: Où publier */}
            <Card className="space-y-[var(--space-4)]">
              <div className="flex items-center justify-between">
                <h2 className="text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">Où publier</h2>
                <span className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase text-[color:var(--lkv-text-muted)]">05 — Destination</span>
              </div>
              <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                Un post peut apparaître sur votre profil, sur le fil communauté, ou uniquement dans un club spécifique dont vous êtes membre.
              </p>

              <div className="space-y-[var(--space-4)]">
                <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-3">
                  {AUDIENCES.map((option) => (
                    <Card
                      key={option.id}
                      variant="interactive"
                      selected={audience === option.id}
                      onClick={() => {
                        if (option.id !== 'public' && photos.length > 0) {
                          lkvAlert('Retirez les médias de votre brouillon avant de choisir une audience privée.');
                          return;
                        }
                        setAudience(option.id);
                      }}
                      className="flex flex-col p-[var(--space-4)] text-left"
                    >
                      <Icon name={option.icon} size={18} className="mb-[var(--space-1)] text-[color:var(--glass-label)]" />
                      <span className="block text-[length:var(--lkv-text-caption)] font-bold">{option.title}</span>
                      <span className="mt-0.5 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{option.hint}</span>
                    </Card>
                  ))}
                </div>

                {audience === 'club' && (
                  <div className="pt-[var(--space-2)]">
                    <label className="mb-[var(--space-2)] block text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">Sélectionner un de vos clubs rejoint *</label>
                    {loadingUserClubs ? (
                      <LoadingState label="Chargement de vos clubs" />
                    ) : userClubs.length > 0 ? (
                      <div className="flex flex-wrap gap-[var(--space-2)]">
                        {userClubs.map((c: any) => (
                          <Chip
                            key={c.id}
                            selected={selectedClub === c.id}
                            onClick={() => setSelectedClub(c.id)}
                          >
                            <span aria-hidden="true">{c.emoji || '🏕️'}</span>
                            <span>{c.name}</span>
                          </Chip>
                        ))}
                      </div>
                    ) : (
                      <Card variant="compact" className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-secondary)]">
                        <p className="mb-[var(--space-1)] font-bold text-[color:var(--lkv-text-primary)]">Vous n&apos;avez rejoint aucun club pour le moment.</p>
                        <p>Rejoignez un club depuis la page <Link href="/communaute" className="font-bold text-[color:var(--lkv-text-primary)] underline">Communauté</Link> pour y publier vos posts.</p>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* RIGHT COLUMN: PREVIEW & QUALITY SCORE */}
          <div className="space-y-[var(--space-6)] lg:sticky lg:top-28 lg:col-span-4">

            {/* CARD 1: LIVE PREVIEW */}
            <Card className="space-y-[var(--space-3)]">
              <div className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-wider text-[color:var(--lkv-text-muted)]">APERÇU · FIL COMMUNAUTÉ</div>

              <div className="space-y-[var(--space-3)]">
                <div className="flex items-center gap-[var(--space-3)]">
                  {user?.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="Avatar" className="size-9 rounded-full border border-[color:var(--lkv-border)] object-cover" />
                  ) : (
                    <div className="flex size-9 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
                      {(user?.user_metadata?.full_name?.charAt(0) || 'V').toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h4 className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">{user?.user_metadata?.full_name || 'Vous'}</h4>
                    <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">À l&apos;instant{location ? ` · ${location.split('/')[0]}` : ''}</p>
                  </div>
                </div>

                {title && postType !== 'photo' && (
                  <h3 className="line-clamp-2 text-[length:var(--lkv-text-caption)] font-bold leading-snug text-[color:var(--lkv-text-primary)]">{title}</h3>
                )}

                {photos.length > 0 && (
                  <div className="relative aspect-[16/9] overflow-hidden rounded-[var(--lkv-radius-md)] bg-[color:var(--glass-bg-medium)]">
                    <img src={photos[0].previewUrl} alt="Preview" className="size-full object-cover" />
                  </div>
                )}

                <p className="line-clamp-3 text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-secondary)]">{content}</p>

                <div className="flex items-center justify-between border-t border-[color:var(--lkv-border)] pt-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                  <div className="flex items-center gap-[var(--space-3)]">
                    <span className="inline-flex items-center gap-1"><Icon name="message-square" size={12} /> 0</span>
                    <span className="inline-flex items-center gap-1"><Icon name="heart" size={12} /> 0</span>
                    <span className="inline-flex items-center gap-1"><Icon name="share2" size={12} /> 0</span>
                  </div>
                  <div className="flex gap-[var(--space-1)] font-semibold text-[color:var(--lkv-text-primary)]">
                    {tags.slice(0, 2).map((t) => (<span key={t}>#{t}</span>))}
                  </div>
                </div>
              </div>
            </Card>

            {/* CARD 2: POST BIEN PENSÉ */}
            <Card className="space-y-[var(--space-4)]">
              <div>
                <h3 className="text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">
                  Post <em className="font-serif font-normal italic">bien pensé</em>
                </h3>
                <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                  Les posts avec image + mention + regroupement ont en moyenne 3x plus d&apos;interactions.
                </p>
              </div>

              <div className="space-y-[var(--space-2)] text-[length:var(--lkv-text-caption)]">
                <div className="flex items-center justify-between font-semibold text-[color:var(--lkv-text-primary)]">
                  <span className="flex items-center gap-[var(--space-1)]">{title.trim() ? '✓' : '○'} Titre rédigé</span>
                  <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{title.trim() ? 'FAIT' : 'À FAIRE'}</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-[color:var(--lkv-text-primary)]">
                  <span className="flex items-center gap-[var(--space-1)]">{photos.length > 0 ? '✓' : '○'} {photos.length} photos ajoutées</span>
                  <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{photos.length > 0 ? 'FAIT' : 'OPTIONNEL'}</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-[color:var(--lkv-text-primary)]">
                  <span className="flex items-center gap-[var(--space-1)]">{linkedCarnet ? '✓ Carnet lié' : '○ Option carnet'}</span>
                  <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{linkedCarnet ? 'FAIT' : 'OPTIONNEL'}</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-[color:var(--lkv-text-primary)]">
                  <span className="flex items-center gap-[var(--space-1)]">{tags.length > 0 ? '✓' : '○'} {tags.length} tags + {mentions.length} mention</span>
                  <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{tags.length > 0 ? 'FAIT' : 'OPTIONNEL'}</span>
                </div>
                <div className="flex items-center justify-between text-[color:var(--lkv-text-muted)]">
                  <span className="flex items-center gap-[var(--space-1)]">
                    {photos.length > 0
                      ? '✓ Vérifiez qu’une photo ne révèle pas un lieu privé'
                      : '○ Des photos aident les voyageurs (optionnel)'}
                  </span>
                  <span className="text-[length:var(--lkv-text-caption-2)]">{photos.length > 0 ? 'VÉRIFIÉ' : 'OPTIONNEL'}</span>
                </div>
              </div>

              <div className="mt-[var(--space-5)] border-t border-[color:var(--lkv-border)] pt-[var(--space-4)]">
                {/* A-036 : audience explicite avant publication. */}
                <p className="mb-[var(--space-2)] rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                  {audience === 'club' && selectedClub
                    ? 'Audience : réservée aux membres du club sélectionné.'
                    : 'Audience : fil communauté — lisible par tous les membres connectés.'}
                  {draftNotice ? ` · ${draftNotice}` : ''}
                </p>
                <div className="mb-1.5 flex items-center justify-between text-[length:var(--lkv-text-caption)]">
                  <span className="font-bold text-[color:var(--lkv-text-primary)]">Prêt : qualité élevée</span>
                  <span className="font-mono font-bold text-[color:var(--lkv-text-primary)]">{qualityScore}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--btn-tint)]">
                  <div className="h-full rounded-full bg-[color:var(--lkv-primary)] transition-all duration-500" style={{ width: `${qualityScore}%` }} />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* BOTTOM STICKY ACTION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-[var(--z-sticky)] border-t border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] saturate-[var(--glass-sat)] lkv-rim-inset px-[var(--space-6)] py-[var(--space-3)] pb-[max(env(safe-area-inset-bottom),16px)] backdrop-blur-[var(--glass-blur-sm)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-[var(--space-4)] sm:flex-row">
          <div className="flex flex-wrap items-center gap-[var(--space-2)] text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">
            <span className="size-2 animate-pulse rounded-full bg-white" />
            <span>Prêt à publier</span>
            <span className="text-[color:var(--lkv-text-muted)]">·</span>
            <span className="text-[color:var(--lkv-text-muted)]">{wordCount} mots</span>
            <span className="text-[color:var(--lkv-text-muted)]">·</span>
            <span className="text-[color:var(--lkv-text-muted)]">{photos.length} photos</span>
            <span className="text-[color:var(--lkv-text-muted)]">·</span>
            <span className="text-[color:var(--lkv-text-muted)]">qualité {qualityScore}%</span>
          </div>

          <div className="flex items-center gap-[var(--space-3)]">
            <Button
              type="button"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              disabled={publishDisabled}
              onClick={() => handlePublish(false)}
            >
              {isSubmitting ? 'Publication...' : 'Publier maintenant'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function PublierPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[color:var(--glass-bg-medium)]">
          <LoadingState label="Chargement de l'éditeur" />
        </div>
      }
    >
      <AppShell>
        <div className="hidden md:block">
          <Header />
        </div>
        <PublierPostContent />
        <div className="hidden md:block">
          <Footer />
        </div>
      </AppShell>
    </Suspense>
  );
}
