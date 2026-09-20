'use client';
import { lkvAlert } from '@/components/ui/dialogs';

import React, { useState, useMemo, useRef, useEffect, Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AppShell from '@/components/shell/AppShell';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
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

const POST_TYPES: Array<{ id: PostType; emoji: string; title: string; hint: string }> = [
  { id: 'photo', emoji: '🖼️', title: 'Photo / vidéo', hint: 'Instantané ou galerie' },
  { id: 'billet', emoji: '📝', title: 'Billet', hint: 'Texte long, mise en page' },
  { id: 'question', emoji: '⏱️', title: 'Question', hint: 'Demandez aux membres' },
  { id: 'evenement', emoji: '📅', title: 'Événement', hint: 'Sortie à venir' },
];

const AUDIENCES: Array<{ id: AudienceType; emoji: string; title: string; hint: string }> = [
  { id: 'public', emoji: '🌐', title: 'Fil public', hint: 'Communauté + votre profil' },
  { id: 'club', emoji: '👥', title: 'Un club', hint: 'Vos clubs uniquement' },
  { id: 'abonnies', emoji: '🔒', title: 'Abonnés', hint: 'Vos abonnés uniquement' },
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
  const [postType, setPostType] = useState<PostType>('photo');
  const [title, setTitle] = useState(initialClubName ? `Récit dans ${initialClubName}` : '');
  const [content, setContent] = useState('');

  // Event specific state
  const [eventDate, setEventDate] = useState('');
  const [eventMaxParticipants, setEventMaxParticipants] = useState(10);

  // Media Files
  const [photos, setPhotos] = useState<string[]>([]);
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

  // Quality score computation
  const qualityScore = useMemo(() => {
    let score = 20;
    if (title.trim()) score += 20;
    if (photos.length > 0) score += 25;
    if (linkedCarnet) score += 15;
    if (tags.length >= 2) score += 12;
    if (location.trim()) score += 8;
    return Math.min(100, score);
  }, [title, photos, linkedCarnet, tags, location]);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setPhotos([...photos, url]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
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

    setIsSubmitting(true);
    try {
      const supabase = createClient();

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

      // Seules les URLs réellement persistables sont envoyées.
      const firstPersistableImage = photos.find((photo) => /^https?:\/\//i.test(photo)) || null;

      // Target club topic if audience is club
      if (audience === 'club' && selectedClub) {
        if (!user) throw new Error('Authentification requise');
        const clubPayload = {
          club_id: selectedClub,
          author_id: user.id,
          title: title.trim() || 'Récit de voyage',
          content: fullContent,
          image_url: firstPersistableImage,
          likes_count: 0,
          replies_count: 0,
        };

        const { error: clubError } = await supabase.from('club_topics').insert(clubPayload);
        if (clubError) throw clubError;

        setToastMessage('Discussion publiée dans le club avec succès ! 🏕️');
        setTimeout(() => {
          router.push(`/clubs/${selectedClub}`);
        }, 1200);
        return;
      }

      if (!user) throw new Error('Authentification requise');

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
        content: fullContent,
        post_type: postType === 'question' ? 'question' : postType === 'evenement' ? 'event' : 'share',
        likes_count: 0,
        comments_count: 0,
        image_url: firstPersistableImage,
        ...(linkedCarnetId ? { linked_carnet_id: linkedCarnetId, snapshot_exclude_location: stripCoordinates } : {}),
        ...(correlationId ? { correlation_id: correlationId } : {}),
      };

      const { data, error } = await supabase.from('community_posts').insert(payload).select().single();

      if (error) {
        throw new Error(error.message || error.details || 'Erreur lors de l\'insertion');
      }

      // Call rewards engine pipeline to claim points
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

      setToastMessage('Post publié avec succès sur le fil ! 🎉');
      setTimeout(() => {
        router.push('/communaute');
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
    <div className="relative min-h-screen bg-[color:var(--lkv-surface)]/80 pb-32 text-[color:var(--lkv-text-primary)] backdrop-blur-xl md:pb-24 md:pt-24">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="animate-fade-in fixed right-4 top-24 z-[var(--z-toast)] rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-primary)] px-[var(--space-5)] py-[var(--space-3)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-inverted)] shadow-elevation-4">
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
                    <span className={`flex size-9 items-center justify-center rounded-[var(--lkv-radius-sm)] text-base ${postType === type.id ? 'bg-[color:var(--lkv-primary)] text-[color:var(--lkv-text-inverted)]' : 'bg-[color:var(--lkv-surface-muted)] text-[color:var(--lkv-primary)]'}`}>
                      {type.emoji}
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
                  <div className="grid grid-cols-1 gap-[var(--space-4)] rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-muted)] p-[var(--space-4)] sm:grid-cols-2">
                    <div>
                      <label htmlFor="event-date" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">Date de l&apos;événement *</label>
                      <input
                        id="event-date"
                        type="date"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
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

                  <div className="overflow-hidden rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-muted)]">
                    <div className="flex items-center gap-[var(--space-1)] border-b border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-muted)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)]">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-pressed={isBold}
                        aria-label="Gras"
                        onClick={() => setIsBold(!isBold)}
                        className={`size-7 min-h-0 px-0 font-bold ${isBold ? 'bg-[color:var(--lkv-primary)] text-[color:var(--lkv-text-inverted)]' : ''}`}
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
                        className={`size-7 min-h-0 px-0 font-serif italic ${isItalic ? 'bg-[color:var(--lkv-primary)] text-[color:var(--lkv-text-inverted)]' : ''}`}
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
                        🔗
                      </Button>
                      <Button type="button" variant="ghost" size="sm" aria-label="Insérer une image" className="size-7 min-h-0 px-0">
                        📷
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

              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,video/*" className="hidden" />
              <Card
                variant="interactive"
                onClick={() => fileInputRef.current?.click()}
                className="mb-[var(--space-4)] border-2 border-dashed border-[color:var(--lkv-border-strong)] bg-[color:var(--lkv-surface-muted)] p-[var(--space-8)] text-center"
              >
                <div className="mx-auto mb-[var(--space-2)] flex size-10 items-center justify-center rounded-full bg-[color:var(--lkv-surface-card)] text-base">⇪</div>
                <p className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Cliquez pour afficher / ou parcourez</p>
                <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">JPG, PNG, MP4 max 20Mo</p>
              </Card>

              <div className="grid grid-cols-4 gap-[var(--space-3)]">
                {photos.map((src, index) => (
                  <div key={index} className="group relative aspect-[4/3] overflow-hidden rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-black/10">
                    <img src={src} alt="Preview" className="size-full object-cover" />
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
                  className="flex aspect-[4/3] flex-col items-center justify-center border-2 border-dashed border-[color:var(--lkv-border-strong)] bg-[color:var(--lkv-surface-muted)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-muted)]"
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
                  <div className="flex min-h-[48px] flex-wrap items-center gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-muted)] p-[var(--space-2)]">
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
                  <div className="flex min-h-[48px] flex-wrap items-center gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-muted)] p-[var(--space-2)]">
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
                      onClick={() => setAudience(option.id)}
                      className="flex flex-col p-[var(--space-4)] text-left"
                    >
                      <span className="mb-[var(--space-1)] text-base">{option.emoji}</span>
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
                    <div className="flex size-9 items-center justify-center rounded-full bg-[color:var(--lkv-primary)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-inverted)]">
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
                  <div className="relative aspect-[16/9] overflow-hidden rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-surface-muted)]">
                    <img src={photos[0]} alt="Preview" className="size-full object-cover" />
                  </div>
                )}

                <p className="line-clamp-3 text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-secondary)]">{content}</p>

                <div className="flex items-center justify-between border-t border-[color:var(--lkv-border)] pt-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                  <div className="flex items-center gap-[var(--space-3)]">
                    <span>💬 0</span>
                    <span>❤️ 0</span>
                    <span>🚀 0</span>
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
                  <span className="flex items-center gap-[var(--space-1)]">{location ? '✓' : '○'} Ajouter la géolocalisation exacte</span>
                  <span className="text-[length:var(--lkv-text-caption-2)]">{location ? 'FAIT' : 'OPTIONNEL'}</span>
                </div>
              </div>

              <div className="mt-[var(--space-5)] border-t border-[color:var(--lkv-border)] pt-[var(--space-4)]">
                <div className="mb-1.5 flex items-center justify-between text-[length:var(--lkv-text-caption)]">
                  <span className="font-bold text-[color:var(--lkv-text-primary)]">Prêt : qualité élevée</span>
                  <span className="font-mono font-bold text-[color:var(--lkv-text-primary)]">{qualityScore}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--lkv-surface-muted)]">
                  <div className="h-full rounded-full bg-[color:var(--lkv-primary)] transition-all duration-500" style={{ width: `${qualityScore}%` }} />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* BOTTOM STICKY ACTION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-[var(--z-sticky)] border-t border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-paper)]/95 px-[var(--space-6)] py-[var(--space-3)] pb-[max(var(--safe-bottom),var(--space-3))] backdrop-blur-[var(--blur-md)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-[var(--space-4)] sm:flex-row">
          <div className="flex flex-wrap items-center gap-[var(--space-2)] text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">
            <span className="size-2 animate-pulse rounded-full bg-[color:var(--lkv-secondary)]" />
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
        <div className="flex min-h-screen items-center justify-center bg-[color:var(--lkv-surface-paper)]">
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