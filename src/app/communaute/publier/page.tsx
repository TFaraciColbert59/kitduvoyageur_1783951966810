'use client';
import { lkvAlert } from '@/components/ui/dialogs';

import React, { useState, useMemo, useRef, useEffect, Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import BackButton from '@/components/ui/BackButton';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type PostType = 'photo' | 'billet' | 'question' | 'evenement';
type AudienceType = 'public' | 'club' | 'abonnies';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface UserCarnetOption {
  id: string;
  title: string;
  correlation_id: string | null;
}

interface UserCarnetOption {
  id: string;
  title: string;
  correlation_id: string | null;
  destination?: string | null;
  description?: string | null;
  cover_image?: string | null;
}

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

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <Header />
        <main className="min-h-screen bg-[#F5F2EA] text-[#17402C] pt-24 pb-32">
          {/* Toast Notification */}
          {toastMessage && (
            <div className="fixed top-24 right-6 z-[999] bg-[#17402C] text-white px-5 py-3 rounded-2xl  text-xs font-bold animate-fade-in border border-forest-500">
              {toastMessage}
            </div>
          )}

          <div className="container mx-auto px-4 max-w-7xl">
            {/* Top Bar Navigation */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#7A8A7D]">
                <Link href="/" className="hover:text-[#17402C]">Le Kit du Voyageur</Link>
                <span>›</span>
                <Link href="/communaute" className="hover:text-[#17402C]">Communauté</Link>
                <span>›</span>
                <span className="text-[#17402C] font-bold">Publier</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePublish(false)}
                  disabled={isSubmitting || (requiresCarnetConsent && !publicationConsent)}
                  className="px-6 py-2 bg-[#17402C] text-white rounded-full text-xs font-bold hover:bg-[#2D3F35] transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Publication...' : 'Publier'}
                </button>
              </div>
            </div>

            {/* Hero Header */}
            <div className="mb-10">
              <span className="text-xs font-mono text-[#7A8A7D] uppercase tracking-widest block mb-2">— NOUVEAU POST</span>
              <h1 className="text-4xl md:text-5xl font-extrabold text-[#17402C] tracking-tight leading-tight">
                Un moment, <em className="font-serif italic font-normal text-[#17402C]">partagé.</em>
              </h1>
              <p className="text-sm text-[#5A6A5D] mt-2 max-w-2xl font-light leading-relaxed">
                Une photo depuis un col, un conseil sur un matériel, une question à la communauté.
                Les posts vivent quelques jours dans le fil, les carnets restent.
              </p>
            </div>

            {/* Main 2-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

              {/* LEFT COLUMN: FORM STEPS */}
              <div className="lg:col-span-8 space-y-6">

                {/* SECTION 01: Type de publication */}
                <div className="bg-white rounded-[0.75rem] p-6 border border-[#E8E4D8]  active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-bold text-[#17402C]">
                      Type de <em className="font-serif italic font-normal text-[#17402C]">publication</em>
                    </h2>
                    <span className="text-[10px] font-mono text-[#7A8A7D] uppercase">01 — Format</span>
                  </div>
                  <p className="text-xs text-[#7A8A7D] mb-5">
                    Choisissez la forme qui correspond à ce que vous voulez partager. Chaque type adapt les champs et le rendu dans le fil.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <button
                      type="button"
                      onClick={() => setPostType('photo')}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all ${
                        postType === 'photo'
                          ? 'bg-[#EAF0EB] border-[#17402C] text-[#17402C] '
                          : 'bg-[#EEF3EC] border-[#E8E4D8] text-[#5A6A5D] hover:bg-white'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 text-base ${postType === 'photo' ? 'bg-[#17402C] text-white' : 'bg-[#E8E4D8] text-[#17402C]'}`}>
                        🖼️
                      </div>
                      <span className="text-xs font-bold block leading-tight">Photo / vidéo</span>
                      <span className="text-[10px] text-[#7A8A7D] mt-0.5">Instantané ou galerie</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPostType('billet')}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all ${
                        postType === 'billet'
                          ? 'bg-[#EAF0EB] border-[#17402C] text-[#17402C] '
                          : 'bg-[#EEF3EC] border-[#E8E4D8] text-[#5A6A5D] hover:bg-white'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 text-base ${postType === 'billet' ? 'bg-[#17402C] text-white' : 'bg-[#E8E4D8] text-[#17402C]'}`}>
                        📝
                      </div>
                      <span className="text-xs font-bold block leading-tight">Billet</span>
                      <span className="text-[10px] text-[#7A8A7D] mt-0.5">Texte long, mise en page</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPostType('question');
                        if (!tags.includes('question')) setTags([...tags, 'question']);
                      }}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all ${
                        postType === 'question'
                          ? 'bg-[#EAF0EB] border-[#17402C] text-[#17402C] '
                          : 'bg-[#EEF3EC] border-[#E8E4D8] text-[#5A6A5D] hover:bg-white'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 text-base ${postType === 'question' ? 'bg-[#17402C] text-white' : 'bg-[#E8E4D8] text-[#17402C]'}`}>
                        ⏱️
                      </div>
                      <span className="text-xs font-bold block leading-tight">Question</span>
                      <span className="text-[10px] text-[#7A8A7D] mt-0.5">Demandez aux membres</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPostType('evenement')}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all ${
                        postType === 'evenement'
                          ? 'bg-[#EAF0EB] border-[#17402C] text-[#17402C] '
                          : 'bg-[#EEF3EC] border-[#E8E4D8] text-[#5A6A5D] hover:bg-white'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 text-base ${postType === 'evenement' ? 'bg-[#17402C] text-white' : 'bg-[#E8E4D8] text-[#17402C]'}`}>
                        📅
                      </div>
                      <span className="text-xs font-bold block leading-tight">Événement</span>
                      <span className="text-[10px] text-[#7A8A7D] mt-0.5">Sortie à venir</span>
                    </button>
                  </div>
                </div>

                {/* SECTION 02: Le contenu */}
                <div className="bg-white rounded-[0.75rem] p-6 border border-[#E8E4D8]  active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-bold text-[#17402C]">Le contenu</h2>
                    <span className="text-[10px] font-mono text-[#7A8A7D] uppercase">02 — Ce que vous partagez</span>
                  </div>
                  <p className="text-xs text-[#7A8A7D] mb-5">
                    {postType === 'question'
                      ? 'Posez une question claire à la communauté outdoor pour obtenir des réponses pertinentes.'
                      : postType === 'evenement'
                      ? 'Proposez une sortie ou une expédition en groupe.'
                      : 'Un mot court engage plus qu\'un long paragraphe. Une image, une phrase — c\'est souvent tout ce qu\'il faut.'}
                  </p>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-[#17402C]">
                          {postType === 'question'
                            ? 'Intitulé de votre question *'
                            : postType === 'evenement'
                            ? 'Nom de la sortie ou événement *'
                            : 'Titre '}
                          {postType === 'photo' && <span className="text-[#7A8A7D] font-normal">(Optionnel pour une seule photo)</span>}
                        </label>
                      </div>
                      <input
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
                        className="w-full px-4 py-3 bg-[#F5F2EA] border border-[#E4E0D4] rounded-2xl text-xs font-semibold text-[#17402C] focus:outline-none focus:border-[#17402C]"
                      />
                    </div>

                    {postType === 'evenement' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#F5F2EA] rounded-2xl border border-[#E4E0D4]">
                        <div>
                          <label className="block text-xs font-semibold text-[#17402C] mb-1">Date de l&apos;événement *</label>
                          <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#E4E0D4] rounded-xl text-xs font-semibold" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#17402C] mb-1">Capacité max (participants)</label>
                          <input type="number" value={eventMaxParticipants} onChange={(e) => setEventMaxParticipants(Number(e.target.value))} className="w-full px-3 py-2 bg-white border border-[#E4E0D4] rounded-xl text-xs font-semibold" />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-[#17402C] mb-1.5">
                        {postType === 'question' ? 'Détails de la question *' : 'Texte du post *'}
                      </label>

                      <div className="border border-[#E4E0D4] rounded-2xl overflow-hidden bg-[#F5F2EA]">
                        <div className="flex items-center gap-1 px-3 py-2 bg-[#EBE7DC] border-b border-[#E4E0D4] text-xs">
                          <button type="button" onClick={() => setIsBold(!isBold)} className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center transition-colors ${isBold ? 'bg-[#17402C] text-white' : 'hover:bg-white/50 text-[#17402C]'}`}>B</button>
                          <button type="button" onClick={() => setIsItalic(!isItalic)} className={`w-7 h-7 rounded-lg italic font-serif flex items-center justify-center transition-colors ${isItalic ? 'bg-[#17402C] text-white' : 'hover:bg-white/50 text-[#17402C]'}`}>I</button>
                          <button type="button" className="w-7 h-7 rounded-lg underline flex items-center justify-center hover:bg-white/50 text-[#17402C]">U</button>
                          <span className="w-px h-4 bg-[#D8D3C4] mx-1" />
                          <button type="button" className="w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center hover:bg-white/50 text-[#17402C]">H</button>
                          <button type="button" className="w-7 h-7 rounded-lg font-serif italic text-sm flex items-center justify-center hover:bg-white/50 text-[#17402C]">“</button>
                          <button type="button" className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/50 text-[#17402C]">::</button>
                          <span className="w-px h-4 bg-[#D8D3C4] mx-1" />
                          <button type="button" className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/50 text-[#17402C]">🔗</button>
                          <button type="button" className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/50 text-[#17402C]">📷</button>
                        </div>

                        <textarea
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
                          className={`w-full p-4 bg-transparent text-xs text-[#17402C] leading-relaxed focus:outline-none resize-y ${isBold ? 'font-bold' : ''} ${isItalic ? 'italic font-serif' : ''}`}
                        />
                      </div>

                      <div className="flex items-center justify-between mt-2 text-[10px] text-[#7A8A7D]">
                        <span>Mise en forme légère : les liens et les citations sont automatiquement supportés</span>
                        <span className="font-mono font-bold text-[#17402C]">{wordCount} mots</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 03: Photos & vidéos */}
                <div className="bg-white rounded-[0.75rem] p-6 border border-[#E8E4D8]  active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-bold text-[#17402C]">Photos <em className="font-serif italic font-normal text-[#17402C]">& vidéos</em></h2>
                    <span className="text-[10px] font-mono text-[#7A8A7D] uppercase">03 — Médias</span>
                  </div>
                  <p className="text-xs text-[#7A8A7D] mb-5">Jusqu&apos;à 10 fichiers. Glissez-déposez ou parcourez. La première image devient la vignette du post.</p>

                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,video/*" className="hidden" />
                  <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-[#D1CBB8] rounded-2xl p-8 bg-[#F5F2EA] text-center cursor-pointer hover:border-[#17402C] transition-all mb-4">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mx-auto mb-2 text-base ">⇪</div>
                    <p className="text-xs font-bold text-[#17402C]">Cliquez pour afficher / ou parcourez</p>
                    <p className="text-[10px] text-[#7A8A7D] mt-1">JPG, PNG, MP4 max 20Mo</p>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    {photos.map((src, index) => (
                      <div key={index} className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-black/10 group border border-[#E4E0D4]">
                        <img src={src} alt="Preview" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => handleRemovePhoto(index)} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs opacity-80 group-hover:opacity-100 transition-opacity">✕</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-[4/3] rounded-2xl border-2 border-dashed border-[#D1CBB8] bg-[#F5F2EA] flex flex-col items-center justify-center text-xs text-[#7A8A7D] font-bold hover:bg-white transition-all">
                      <span className="text-base mb-0.5">+</span>
                      <span className="text-[10px]">Ajouter</span>
                    </button>
                  </div>
                </div>

                {/* SECTION 04: Liens internes */}
                <div className="bg-white rounded-[0.75rem] p-6 border border-[#E8E4D8]  active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-bold text-[#17402C]">Liens <em className="font-serif italic font-normal text-[#17402C]">internes</em></h2>
                    <span className="text-[10px] font-mono text-[#7A8A7D] uppercase">04 — Contexte</span>
                  </div>
                  <p className="text-xs text-[#7A8A7D] mb-5">Rattachez votre post à un contenu existant : le lien apparaîtra en pied de post et enrichira le fil.</p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#17402C] mb-1.5">Carnet lié</label>
                      <select value={linkedCarnet} onChange={(e) => { setLinkedCarnet(e.target.value); setPublicationConsent(false); }} className="w-full px-4 py-3 bg-[#F5F2EA] border border-[#E4E0D4] rounded-2xl text-xs font-semibold text-[#17402C] focus:outline-none">
                        <option value="">— Aucun carnet —</option>
                        {userCarnets.map((carnet) => (
                          <option key={carnet.id} value={carnet.id}>
                            {carnet.title}
                          </option>
                        ))}
                      </select>
                      {userCarnets.length === 0 && (
                        <p className="text-[10px] text-[#7A8A7D] mt-1.5">
                          Aucun carnet disponible — terminez une sortie pour en créer un.
                        </p>
                      )}
                    </div>

                    {selectedCarnet && (
                      <div className="p-4 rounded-2xl bg-[#F5F2EA] border border-[#E4E0D4] space-y-2">
                        <span className="text-[10px] font-mono font-bold text-[#7A8A7D] uppercase">Aperçu du carnet publié (instantané)</span>
                        <div className="flex items-center gap-3">
                          {selectedCarnet.cover_image && (
                            <img src={selectedCarnet.cover_image} alt="" className="w-14 h-14 rounded-xl object-cover border border-[#E4E0D4]" />
                          )}
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-[#17402C] truncate">{selectedCarnet.title}</h4>
                            {selectedCarnet.destination && (
                              <p className="text-[10px] text-[#7A8A7D] truncate">📍 {selectedCarnet.destination}</p>
                            )}
                          </div>
                        </div>
                        <p className="text-[10.5px] text-[#5A6A5D] leading-relaxed">
                          La publication crée un instantané figé de ce carnet. Vos modifications ultérieures du carnet privé ne seront pas publiées automatiquement.
                        </p>
                        <label className="flex items-start gap-2 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={publicationConsent}
                            onChange={(e) => setPublicationConsent(e.target.checked)}
                            className="mt-0.5 accent-[#17402C]"
                          />
                          <span className="text-[11px] font-semibold text-[#17402C]">
                            Je consens à publier cet instantané dans le fil communauté.
                          </span>
                        </label>
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={stripCoordinates}
                            onChange={(e) => setStripCoordinates(e.target.checked)}
                            className="mt-0.5 accent-[#17402C]"
                          />
                          <span className="text-[11px] font-semibold text-[#17402C]">
                            Retirer les coordonnées et points de carte de l&apos;instantané.
                          </span>
                        </label>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-[#17402C] mb-1.5">Localisation</label>
                      <div className="relative flex items-center">
                        <span className="absolute left-4 text-xs">📍</span>
                        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex: Massif de la Chartreuse, Isère..." className="w-full pl-9 pr-24 py-3 bg-[#F5F2EA] border border-[#E4E0D4] rounded-2xl text-xs font-semibold text-[#17402C] focus:outline-none" />
                        <button type="button" onClick={handleDetectLocation} disabled={isDetectingLocation} className="absolute right-3 px-3 py-1 bg-white border border-[#E4E0D4] rounded-xl text-[10px] font-bold text-[#17402C] hover:bg-[#F5F2EA] transition-colors">
                          {isDetectingLocation ? 'Recherche...' : 'Détecter'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-[#17402C]">Tags <span className="text-[#7A8A7D] font-normal">(Au moins 2 pour trouver le post)</span></label>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 p-2.5 bg-[#F5F2EA] border border-[#E4E0D4] rounded-2xl min-h-[48px]">
                        {tags.map((tag) => (
                          <span key={tag} className="px-3 py-1 bg-[#17402C] text-white text-xs font-semibold rounded-full flex items-center gap-1.5">
                            <span>{tag}</span>
                            <button type="button" onClick={() => handleRemoveTag(tag)} className="text-white/70 hover:text-white text-[10px]">✕</button>
                          </span>
                        ))}
                        <input type="text" enterKeyHint="done" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder="+ Ajouter un tag..." className="bg-transparent text-xs text-[#17402C] focus:outline-none px-2 py-1 flex-1 min-w-[120px]" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#17402C] mb-1.5">Mentionner des membres</label>
                      <div className="flex flex-wrap items-center gap-2 p-2.5 bg-[#F5F2EA] border border-[#E4E0D4] rounded-2xl min-h-[48px]">
                        {mentions.map((m) => (
                          <span key={m} className="px-3 py-1 bg-[#EDF7F0] text-[#2D6A4F] border border-[#B7E4C7] text-xs font-semibold rounded-full flex items-center gap-1.5">
                            <span>@{m}</span>
                            <button type="button" onClick={() => handleRemoveMention(m)} className="text-[#2D6A4F]/70 hover:text-[#2D6A4F] text-[10px]">✕</button>
                          </span>
                        ))}
                        <input type="text" enterKeyHint="done" value={mentionInput} onChange={(e) => setMentionInput(e.target.value)} onKeyDown={handleAddMention} placeholder="Taper @ pour mentionner..." className="bg-transparent text-xs text-[#17402C] focus:outline-none px-2 py-1 flex-1 min-w-[140px]" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 05: Où publier */}
                <div className="bg-white rounded-[0.75rem] p-6 border border-[#E8E4D8]  active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-bold text-[#17402C]">Où publier</h2>
                    <span className="text-[10px] font-mono text-[#7A8A7D] uppercase">05 — Destination</span>
                  </div>
                  <p className="text-xs text-[#7A8A7D] mb-5">Un post peut apparaître sur votre profil, sur le fil communauté, ou uniquement dans un club spécifique dont vous êtes membre.</p>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button type="button" onClick={() => setAudience('public')} className={`flex flex-col p-4 rounded-2xl border text-left transition-all ${audience === 'public' ? 'bg-[#EAF0EB] border-[#17402C] text-[#17402C]' : 'bg-[#EEF3EC] border-[#E8E4D8] text-[#5A6A5D]'}`}>
                        <span className="text-base mb-1">🌐</span>
                        <span className="text-xs font-bold block">Fil public</span>
                        <span className="text-[10px] text-[#7A8A7D] mt-0.5">Communauté + votre profil</span>
                      </button>
                      <button type="button" onClick={() => setAudience('club')} className={`flex flex-col p-4 rounded-2xl border text-left transition-all ${audience === 'club' ? 'bg-[#EAF0EB] border-[#17402C] text-[#17402C]' : 'bg-[#EEF3EC] border-[#E8E4D8] text-[#5A6A5D]'}`}>
                        <span className="text-base mb-1">👥</span>
                        <span className="text-xs font-bold block">Un club</span>
                        <span className="text-[10px] text-[#7A8A7D] mt-0.5">Vos clubs uniquement</span>
                      </button>
                      <button type="button" onClick={() => setAudience('abonnies')} className={`flex flex-col p-4 rounded-2xl border text-left transition-all ${audience === 'abonnies' ? 'bg-[#EAF0EB] border-[#17402C] text-[#17402C]' : 'bg-[#EEF3EC] border-[#E8E4D8] text-[#5A6A5D]'}`}>
                        <span className="text-base mb-1">🔒</span>
                        <span className="text-xs font-bold block">Abonnés</span>
                        <span className="text-[10px] text-[#7A8A7D] mt-0.5">Vos abonnés uniquement</span>
                      </button>
                    </div>

                    {audience === 'club' && (
                      <div className="pt-2">
                        <label className="block text-xs font-semibold text-[#17402C] mb-2">Sélectionner un de vos clubs rejoint *</label>
                        {loadingUserClubs ? (
                          <p className="text-xs text-[#7A8A7D] animate-pulse">Chargement de vos clubs...</p>
                        ) : userClubs.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {userClubs.map((c: any) => (
                              <button key={c.id} type="button" onClick={() => setSelectedClub(c.id)} className={`px-3.5 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all ${selectedClub === c.id ? 'bg-[#17402C] text-white border-[#17402C]' : 'bg-[#F5F2EA] text-[#3A4A3D] border-[#E4E0D4] hover:bg-white'}`}>
                                <span>{c.emoji || '🏕️'}</span>
                                <span>{c.name}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 bg-[#F5F2EA] rounded-2xl border border-[#E4E0D4] text-xs text-[#5A6A5D]">
                            <p className="font-bold text-[#17402C] mb-1">Vous n&apos;avez rejoint aucun club pour le moment.</p>
                            <p>Rejoignez un club depuis la page <Link href="/communaute" className="underline text-[#17402C] font-bold">Communauté</Link> pour y publier vos posts.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: PREVIEW & QUALITY SCORE */}
              <div className="lg:col-span-4 space-y-6 sticky top-28">

                {/* CARD 1: LIVE PREVIEW */}
                <div className="bg-white rounded-[0.75rem] p-5 border border-[#E8E4D8]  active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
                  <div className="text-[10px] font-mono text-[#7A8A7D] uppercase tracking-wider mb-3">APERÇU · FIL COMMUNAUTÉ</div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      {user?.user_metadata?.avatar_url ? (
                        <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-9 h-9 rounded-full object-cover border border-[#E4E0D4]" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#17402C] text-white flex items-center justify-center text-xs font-bold">
                          {(user?.user_metadata?.full_name?.charAt(0) || 'V').toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-bold text-[#17402C]">{user?.user_metadata?.full_name || 'Vous'}</h4>
                        <p className="text-[10px] text-[#7A8A7D]">À l&apos;instant{location ? ` · ${location.split('/')[0]}` : ''}</p>
                      </div>
                    </div>

                    {title && postType !== 'photo' && (
                      <h3 className="text-xs font-bold text-[#17402C] leading-snug line-clamp-2">{title}</h3>
                    )}

                    {photos.length > 0 && (
                      <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-[#E7E3D6]">
                        <img src={photos[0]} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}

                    <p className="text-xs text-[#5A6A5D] leading-relaxed line-clamp-3">{content}</p>

                    <div className="flex items-center justify-between pt-2 border-t border-[#F0ECE1] text-[11px] text-[#7A8A7D]">
                      <div className="flex items-center gap-3">
                        <span>💬 0</span>
                        <span>❤️ 0</span>
                        <span>🚀 0</span>
                      </div>
                      <div className="flex gap-1 text-[10px] text-[#17402C] font-semibold">
                        {tags.slice(0, 2).map((t) => (<span key={t}>#{t}</span>))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 2: POST BIEN PENSÉ */}
                <div className="bg-white rounded-[0.75rem] p-5 border border-[#E8E4D8]  active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
                  <h3 className="text-sm font-bold text-[#17402C] mb-1">Post <em className="font-serif italic font-normal text-[#17402C]">bien pensé</em></h3>
                  <p className="text-[11px] text-[#7A8A7D] mb-4">Les posts avec image + mention + regroupement ont en moyenne 3x plus d&apos;interactions.</p>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[#17402C] font-semibold">
                      <span className="flex items-center gap-1.5">{title.trim() ? '✓' : '○'} Titre rédigé</span>
                      <span className="text-[10px] text-[#7A8A7D]">{title.trim() ? 'FAIT' : 'À FAIRE'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[#17402C] font-semibold">
                      <span className="flex items-center gap-1.5">{photos.length > 0 ? '✓' : '○'} {photos.length} photos ajoutées</span>
                      <span className="text-[10px] text-[#7A8A7D]">{photos.length > 0 ? 'FAIT' : 'OPTIONNEL'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[#17402C] font-semibold">
                      <span className="flex items-center gap-1.5">{linkedCarnet ? '✓ Carnet lié' : '○ Option carnet'}</span>
                      <span className="text-[10px] text-[#7A8A7D]">{linkedCarnet ? 'FAIT' : 'OPTIONNEL'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[#17402C] font-semibold">
                      <span className="flex items-center gap-1.5">{tags.length > 0 ? '✓' : '○'} {tags.length} tags + {mentions.length} mention</span>
                      <span className="text-[10px] text-[#7A8A7D]">{tags.length > 0 ? 'FAIT' : 'OPTIONNEL'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[#7A8A7D]">
                      <span className="flex items-center gap-1.5">{location ? '✓' : '○'} Ajouter la géolocalisation exacte</span>
                      <span className="text-[10px]">{location ? 'FAIT' : 'OPTIONNEL'}</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-[#F0ECE1]">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-[#17402C]">Prêt : qualité élevée</span>
                      <span className="font-bold text-[#17402C] font-mono">{qualityScore}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#E8E4D8] rounded-full overflow-hidden">
                      <div className="h-full bg-[#17402C] rounded-full transition-all duration-500" style={{ width: `${qualityScore}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM STICKY ACTION BAR */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-[#E8E4D8] py-3.5 px-6 ">
            <div className="container mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#17402C]">
                <span className="w-2 h-2 rounded-full bg-forest-500 animate-pulse" />
                <span>Prêt à publier</span>
                <span className="text-[#7A8A7D]">·</span>
                <span className="text-[#7A8A7D]">{wordCount} mots</span>
                <span className="text-[#7A8A7D]">·</span>
                <span className="text-[#7A8A7D]">{photos.length} photos</span>
                <span className="text-[#7A8A7D]">·</span>
                <span className="text-[#7A8A7D]">qualité {qualityScore}%</span>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={() => handlePublish(false)} disabled={isSubmitting || (requiresCarnetConsent && !publicationConsent)} className="px-7 py-2.5 bg-[#17402C] text-white rounded-full text-xs font-bold hover:bg-[#2D3F35] transition-all disabled:opacity-50">
                  {isSubmitting ? 'Publication...' : 'Publier maintenant'}
                </button>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        {/* Toast Notification (fixed overlay) */}
        {toastMessage && (
          <div style={{ position: 'fixed', top: '80px', right: '16px', zIndex: 999, background: '#17402C', color: '#fff', padding: '12px 20px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', fontSize: '12px', fontWeight: 700, border: '1px solid #17402C' }}>
            {toastMessage}
          </div>
        )}

        <MobilePageShell>
          <div style={{ padding: '16px' }}>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#7A8A7D', fontWeight: 600, marginBottom: '12px' }}>
              <Link href="/communaute" style={{ color: '#7A8A7D', textDecoration: 'none' }}>Communauté</Link>
              <span>›</span>
              <span style={{ color: '#17402C', fontWeight: 700 }}>Publier</span>
            </div>

            {/* Hero */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: '#7A8A7D', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>— NOUVEAU POST</div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#17402C', margin: 0, lineHeight: 1.1 }}>
                Un moment, <em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#17402C', fontWeight: 400 }}>partagé.</em>
              </h1>
            </div>

            {/* Section: Type */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '16px', border: '1px solid #E8E4D8', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#17402C' }}>Type</span>
                <span style={{ fontSize: '9px', fontFamily: 'ui-monospace, monospace', color: '#7A8A7D', textTransform: 'uppercase' }}>01 — Format</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { id: 'photo', label: '🖼️', sub: 'Photo' },
                  { id: 'billet', label: '📝', sub: 'Billet' },
                  { id: 'question', label: '⏱️', sub: 'Question' },
                  { id: 'evenement', label: '📅', sub: 'Événement' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setPostType(opt.id as PostType);
                      if (opt.id === 'question' && !tags.includes('question')) setTags([...tags, 'question']);
                    }}
                    style={{
                      padding: '12px', borderRadius: '12px', border: `1.5px solid ${postType === opt.id ? '#17402C' : '#E8E4D8'}`,
                      background: postType === opt.id ? '#EAF0EB' : '#EEF3EC',
                      textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: '18px', marginBottom: '4px' }}>{opt.label}</div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#17402C' }}>{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Section: Content */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '16px', border: '1px solid #E8E4D8', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#17402C' }}>Contenu</span>
                <span style={{ fontSize: '9px', fontFamily: 'ui-monospace, monospace', color: '#7A8A7D', textTransform: 'uppercase' }}>02</span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre de votre post..."
                style={{ width: '100%', padding: '12px', background: '#F5F2EA', border: '1px solid #E4E0D4', borderRadius: '12px', fontSize: '12px', fontWeight: 600, color: '#17402C', outline: 'none', marginBottom: '10px', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              <textarea
                rows={6}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Racontez votre expérience..."
                style={{ width: '100%', padding: '12px', background: '#F5F2EA', border: '1px solid #E4E0D4', borderRadius: '12px', fontSize: '12px', color: '#17402C', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              <div style={{ fontSize: '10px', color: '#7A8A7D', textAlign: 'right', marginTop: '4px', fontFamily: 'ui-monospace, monospace' }}>{wordCount} mots</div>
            </div>

            {/* Section: Photos */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '16px', border: '1px solid #E8E4D8', marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#17402C', marginBottom: '8px' }}>Photos & vidéos</div>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,video/*" style={{ display: 'none' }} />
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{ border: '2px dashed #D1CBB8', borderRadius: '12px', padding: '20px', background: '#F5F2EA', textAlign: 'center', cursor: 'pointer', marginBottom: '10px' }}
              >
                <div style={{ fontSize: '24px', marginBottom: '4px' }}>⇪</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#17402C' }}>Ajouter des photos</div>
                <div style={{ fontSize: '10px', color: '#7A8A7D' }}>JPG, PNG max 20Mo</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {photos.map((src, index) => (
                  <div key={index} style={{ aspectRatio: '4/3', borderRadius: '10px', overflow: 'hidden', background: 'rgba(0,0,0,0.05)', position: 'relative', border: '1px solid #E4E0D4' }}>
                    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => handleRemovePhoto(index)} style={{ position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Section: Localisation & Tags */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '16px', border: '1px solid #E8E4D8', marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#17402C', marginBottom: '8px' }}>Localisation & Tags</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lieu..." style={{ flex: 1, padding: '10px', background: '#F5F2EA', border: '1px solid #E4E0D4', borderRadius: '10px', fontSize: '12px', color: '#17402C', outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={handleDetectLocation} disabled={isDetectingLocation} style={{ padding: '10px 14px', background: '#fff', border: '1px solid #E4E0D4', borderRadius: '10px', fontSize: '10px', fontWeight: 700, color: '#17402C', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>{isDetectingLocation ? '...' : '📍'}</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px', background: '#F5F2EA', border: '1px solid #E4E0D4', borderRadius: '10px', minHeight: '40px' }}>
                {tags.map(tag => (
                  <span key={tag} style={{ padding: '4px 10px', background: '#17402C', color: '#fff', borderRadius: '999px', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '10px', padding: 0 }}>✕</button>
                  </span>
                ))}
                <input type="text" enterKeyHint="done" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder="+ Tag" style={{ background: 'transparent', border: 'none', fontSize: '11px', color: '#17402C', outline: 'none', flex: 1, minWidth: '80px', fontFamily: 'inherit' }} />
              </div>
            </div>

            {/* Section: Audience */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '16px', border: '1px solid #E8E4D8', marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#17402C', marginBottom: '8px' }}>Audience</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '12px' }}>
                <button onClick={() => setAudience('public')} style={{ padding: '10px', borderRadius: '10px', border: `1.5px solid ${audience === 'public' ? '#17402C' : '#E8E4D8'}`, background: audience === 'public' ? '#EAF0EB' : '#EEF3EC', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}>
                  <div style={{ fontSize: '16px' }}>🌐</div>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#17402C' }}>Public</div>
                </button>
                <button onClick={() => setAudience('club')} style={{ padding: '10px', borderRadius: '10px', border: `1.5px solid ${audience === 'club' ? '#17402C' : '#E8E4D8'}`, background: audience === 'club' ? '#EAF0EB' : '#EEF3EC', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}>
                  <div style={{ fontSize: '16px' }}>👥</div>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#17402C' }}>Club</div>
                </button>
                <button onClick={() => setAudience('abonnies')} style={{ padding: '10px', borderRadius: '10px', border: `1.5px solid ${audience === 'abonnies' ? '#17402C' : '#E8E4D8'}`, background: audience === 'abonnies' ? '#EAF0EB' : '#EEF3EC', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}>
                  <div style={{ fontSize: '16px' }}>🔒</div>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#17402C' }}>Abonnés</div>
                </button>
              </div>
              <div style={{ paddingTop: '8px', borderTop: '1px solid #F0ECE1' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#17402C', marginBottom: '6px' }}>Carnet lié</label>
                <select
                  value={linkedCarnet}
                  onChange={(e) => { setLinkedCarnet(e.target.value); setPublicationConsent(false); }}
                  style={{ width: '100%', padding: '10px', background: '#F5F2EA', border: '1px solid #E4E0D4', borderRadius: '10px', fontSize: '12px', color: '#17402C', fontFamily: 'inherit' }}
                >
                  <option value="">— Aucun carnet —</option>
                  {userCarnets.map((carnet) => (
                    <option key={carnet.id} value={carnet.id}>{carnet.title}</option>
                  ))}
                </select>
                {selectedCarnet && (
                  <div style={{ marginTop: '10px', padding: '10px', background: '#F5F2EA', borderRadius: '10px', border: '1px solid #E4E0D4' }}>
                    <p style={{ margin: 0, fontSize: '10.5px', color: '#5A6A5D', lineHeight: 1.5 }}>
                      La publication crée un instantané figé de ce carnet ; vos modifications privées ultérieures ne seront pas republiées.
                    </p>
                    <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '8px' }}>
                      <input type="checkbox" checked={publicationConsent} onChange={(e) => setPublicationConsent(e.target.checked)} />
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#17402C' }}>Je consens à publier cet instantané.</span>
                    </label>
                    <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '6px' }}>
                      <input type="checkbox" checked={stripCoordinates} onChange={(e) => setStripCoordinates(e.target.checked)} />
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#17402C' }}>Retirer les coordonnées et points de carte.</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        </MobilePageShell>

        {/* Mobile sticky bottom bar */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid #E8E4D8', padding: '10px 16px', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => handlePublish(false)}
              disabled={isSubmitting || (requiresCarnetConsent && !publicationConsent)}
              style={{ flex: 2, padding: '10px', borderRadius: '999px', border: 'none', background: '#17402C', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: isSubmitting || (requiresCarnetConsent && !publicationConsent) ? 0.5 : 1 }}
            >
              {isSubmitting ? 'Publication...' : 'Publier'}
            </button>
          </div>
        </div>

        
      </div>
    </>
  );
}

export default function PublierPostPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F2EA] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#17402C] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PublierPostContent />
    </Suspense>
  );
}
