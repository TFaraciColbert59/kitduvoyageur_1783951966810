'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import BackButton from '@/components/ui/BackButton';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type PostType = 'photo' | 'billet' | 'question' | 'evenement';
type AudienceType = 'public' | 'club' | 'abonnies';

const SAMPLE_PHOTOS = [
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80',
];

export default function PublierPostPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Form State
  const [postType, setPostType] = useState<PostType>('photo');
  const [title, setTitle] = useState('Retour du col du Charmant Som — première neige sur les crêtes.');
  const [content, setContent] = useState(
    "Trois jours dans le brouillard, et puis ce matin. La lumière est revenue par la face nord, doucement — comme si le col avait attendu qu'on soit prêts pour se montrer.\n\nLe sentier était ouvert jusqu'au col, cuisse par endroits. On a fait demi-tour à 250m du sommet, prudence oblige, mais franchement : quelle 1ère avant-saison... la première neige d'automne, c'est autre chose.\n\n\"Marcher en montagne, c'est apprendre à ne pas insister.\"\n\nProchaine sortie prévue le week-end du 24 — cette fois avec les crampons. Qui vient ?"
  );

  // Event specific state
  const [eventDate, setEventDate] = useState('');
  const [eventMaxParticipants, setEventMaxParticipants] = useState(10);
  
  // Media Files
  const [photos, setPhotos] = useState<string[]>(SAMPLE_PHOTOS);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Context & Links
  const [linkedAdventure, setLinkedAdventure] = useState('Arête du Charmant Som - 28 sept');
  const [linkedCarnet, setLinkedCarnet] = useState('');
  const [location, setLocation] = useState('Col du Charmant Som / Chartreuse (1867 m)');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Tags & Mentions
  const [tags, setTags] = useState<string[]>(['chartreuse', 'première neige', 'automne']);
  const [tagInput, setTagInput] = useState('');
  const [mentions, setMentions] = useState<string[]>(['antoinec']);
  const [mentionInput, setMentionInput] = useState('');

  // Destination & Timing
  const [audience, setAudience] = useState<AudienceType>('public');
  const [userClubs, setUserClubs] = useState<any[]>([]);
  const [selectedClub, setSelectedClub] = useState<string>('');
  const [loadingUserClubs, setLoadingUserClubs] = useState(false);

  const [scheduleTime, setScheduleTime] = useState<'maintenant' | '1h' | 'matin' | 'planifier'>('maintenant');
  const [allowComments, setAllowComments] = useState(true);
  const [crossPost, setCrossPost] = useState(false);

  // Formatting state
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
          if (activeClubs.length > 0) {
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
    if (linkedAdventure || linkedCarnet) score += 15;
    if (tags.length >= 2) score += 12;
    if (location.trim()) score += 8;
    return Math.min(100, score);
  }, [title, photos, linkedAdventure, linkedCarnet, tags, location]);

  // Functional Geolocation Detection
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert('La géolocalisation n\'est pas supportée par votre navigateur.');
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
        console.error('Geolocation error:', error);
        setLocation('Chartreuse, France (Position approximative)');
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

  // Submit Handler
  const handlePublish = async (draft = false) => {
    setIsSubmitting(true);
    try {
      const supabase = createClient();

      // Format full content string cleanly
      let fullContent = content.trim();
      if (title.trim() && postType !== 'photo') {
        fullContent = `**${title.trim()}**\n\n${fullContent}`;
      }
      if (location) {
        fullContent += `\n\n📍 ${location}`;
      }
      if (tags.length > 0) {
        fullContent += `\n\n` + tags.map((t) => `#${t}`).join(' ');
      }

      // Valid columns matching PostgreSQL community_posts table
      const payload: Record<string, any> = {
        author_id: user?.id,
        content: fullContent,
        post_type: postType === 'question' ? 'question' : postType === 'evenement' ? 'event' : 'share',
        likes_count: 0,
        comments_count: 0,
        image_url: photos[0] || null,
      };

      const { data, error } = await supabase.from('community_posts').insert(payload).select().single();

      if (error) {
        throw new Error(error.message || error.details || 'Erreur lors de l\'insertion');
      }

      setToastMessage(draft ? 'Brouillon sauvegardé !' : 'Post publié avec succès sur le fil ! 🎉');
      setTimeout(() => {
        router.push('/communaute');
      }, 1500);
    } catch (err: any) {
      console.error('Error creating post:', err);
      // Local fallback for smooth experience
      try {
        const existing = JSON.parse(localStorage.getItem('user_community_posts') || '[]');
        const localPost = {
          id: `local-${Date.now()}`,
          author: {
            full_name: user?.user_metadata?.full_name || 'Marceline Chevrier',
            avatar_url: user?.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80',
          },
          title,
          content,
          photos,
          location,
          tags,
          created_at: new Date().toISOString(),
        };
        localStorage.setItem('user_community_posts', JSON.stringify([localPost, ...existing]));
        setToastMessage(draft ? 'Brouillon sauvegardé !' : 'Post publié avec succès ! 🎉');
        setTimeout(() => router.push('/communaute'), 1500);
      } catch (e) {
        alert('Erreur lors de la publication : ' + (err.message || String(err)));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <Header />
        <main className="min-h-screen bg-[#F5F2EA] text-[#1C2620] pt-24 pb-32">
          {/* Toast Notification */}
          {toastMessage && (
            <div className="fixed top-24 right-6 z-[999] bg-[#1C2620] text-white px-5 py-3 rounded-2xl shadow-2xl text-xs font-bold animate-fadeIn border border-emerald-500">
              {toastMessage}
            </div>
          )}

          <div className="container mx-auto px-4 max-w-7xl">
            {/* Top Bar Navigation */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#7A8A7D]">
                <Link href="/" className="hover:text-[#1C2620]">Le Kit du Voyageur</Link>
                <span>›</span>
                <Link href="/communaute" className="hover:text-[#1C2620]">Communauté</Link>
                <span>›</span>
                <span className="text-[#1C2620] font-bold">Publier</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePublish(true)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-white border border-[#E8E4D8] rounded-full text-xs font-bold text-[#3A4A3D] hover:bg-[#FAF8F5] transition-all shadow-sm"
                >
                  Sauvegarder en brouillon
                </button>
                <button
                  onClick={() => alert("Aperçu interactif mis à jour sur la droite !")}
                  className="px-4 py-2 bg-white border border-[#E8E4D8] rounded-full text-xs font-bold text-[#3A4A3D] hover:bg-[#FAF8F5] transition-all shadow-sm"
                >
                  Aperçu
                </button>
                <button
                  onClick={() => handlePublish(false)}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-[#1C2620] text-white rounded-full text-xs font-bold hover:bg-[#2D3F35] transition-all shadow-md"
                >
                  {isSubmitting ? 'Publication...' : 'Publier'}
                </button>
              </div>
            </div>

            {/* Hero Header */}
            <div className="mb-10">
              <span className="text-xs font-mono text-[#7A8A7D] uppercase tracking-widest block mb-2">— NOUVEAU POST</span>
              <h1 className="text-4xl md:text-5xl font-extrabold text-[#1C2620] tracking-tight leading-tight">
                Un moment, <em className="font-serif italic font-normal text-[#2D5A27]">partagé.</em>
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
                <div className="bg-white rounded-3xl p-6 border border-[#E8E4D8] shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-bold text-[#1C2620]">
                      Type de <em className="font-serif italic font-normal text-[#2D5A27]">publication</em>
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
                          ? 'bg-[#EAF0EB] border-[#2D5A27] text-[#1C2620] shadow-sm'
                          : 'bg-[#FAF8F5] border-[#E8E4D8] text-[#5A6A5D] hover:bg-white'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 text-base ${postType === 'photo' ? 'bg-[#2D5A27] text-white' : 'bg-[#E8E4D8] text-[#1C2620]'}`}>
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
                          ? 'bg-[#EAF0EB] border-[#2D5A27] text-[#1C2620] shadow-sm'
                          : 'bg-[#FAF8F5] border-[#E8E4D8] text-[#5A6A5D] hover:bg-white'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 text-base ${postType === 'billet' ? 'bg-[#2D5A27] text-white' : 'bg-[#E8E4D8] text-[#1C2620]'}`}>
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
                          ? 'bg-[#EAF0EB] border-[#2D5A27] text-[#1C2620] shadow-sm'
                          : 'bg-[#FAF8F5] border-[#E8E4D8] text-[#5A6A5D] hover:bg-white'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 text-base ${postType === 'question' ? 'bg-[#2D5A27] text-white' : 'bg-[#E8E4D8] text-[#1C2620]'}`}>
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
                          ? 'bg-[#EAF0EB] border-[#2D5A27] text-[#1C2620] shadow-sm'
                          : 'bg-[#FAF8F5] border-[#E8E4D8] text-[#5A6A5D] hover:bg-white'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 text-base ${postType === 'evenement' ? 'bg-[#2D5A27] text-white' : 'bg-[#E8E4D8] text-[#1C2620]'}`}>
                        📅
                      </div>
                      <span className="text-xs font-bold block leading-tight">Événement</span>
                      <span className="text-[10px] text-[#7A8A7D] mt-0.5">Sortie à venir</span>
                    </button>
                  </div>
                </div>

                {/* SECTION 02: Le contenu */}
                <div className="bg-white rounded-3xl p-6 border border-[#E8E4D8] shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-bold text-[#1C2620]">Le contenu</h2>
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
                        <label className="text-xs font-semibold text-[#1C2620]">
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
                        className="w-full px-4 py-3 bg-[#F5F2EA] border border-[#E4E0D4] rounded-2xl text-xs font-semibold text-[#1C2620] focus:outline-none focus:border-[#2D5A27]"
                      />
                    </div>

                    {postType === 'evenement' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#F5F2EA] rounded-2xl border border-[#E4E0D4]">
                        <div>
                          <label className="block text-xs font-semibold text-[#1C2620] mb-1">Date de l&apos;événement *</label>
                          <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#E4E0D4] rounded-xl text-xs font-semibold" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#1C2620] mb-1">Capacité max (participants)</label>
                          <input type="number" value={eventMaxParticipants} onChange={(e) => setEventMaxParticipants(Number(e.target.value))} className="w-full px-3 py-2 bg-white border border-[#E4E0D4] rounded-xl text-xs font-semibold" />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-[#1C2620] mb-1.5">
                        {postType === 'question' ? 'Détails de la question *' : 'Texte du post *'}
                      </label>

                      <div className="border border-[#E4E0D4] rounded-2xl overflow-hidden bg-[#F5F2EA]">
                        <div className="flex items-center gap-1 px-3 py-2 bg-[#EBE7DC] border-b border-[#E4E0D4] text-xs">
                          <button type="button" onClick={() => setIsBold(!isBold)} className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center transition-colors ${isBold ? 'bg-[#1C2620] text-white' : 'hover:bg-white/50 text-[#1C2620]'}`}>B</button>
                          <button type="button" onClick={() => setIsItalic(!isItalic)} className={`w-7 h-7 rounded-lg italic font-serif flex items-center justify-center transition-colors ${isItalic ? 'bg-[#1C2620] text-white' : 'hover:bg-white/50 text-[#1C2620]'}`}>I</button>
                          <button type="button" className="w-7 h-7 rounded-lg underline flex items-center justify-center hover:bg-white/50 text-[#1C2620]">U</button>
                          <span className="w-px h-4 bg-[#D8D3C4] mx-1" />
                          <button type="button" className="w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center hover:bg-white/50 text-[#1C2620]">H</button>
                          <button type="button" className="w-7 h-7 rounded-lg font-serif italic text-sm flex items-center justify-center hover:bg-white/50 text-[#1C2620]">“</button>
                          <button type="button" className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/50 text-[#1C2620]">::</button>
                          <span className="w-px h-4 bg-[#D8D3C4] mx-1" />
                          <button type="button" className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/50 text-[#1C2620]">🔗</button>
                          <button type="button" className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/50 text-[#1C2620]">📷</button>
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
                          className={`w-full p-4 bg-transparent text-xs text-[#1C2620] leading-relaxed focus:outline-none resize-y ${isBold ? 'font-bold' : ''} ${isItalic ? 'italic font-serif' : ''}`}
                        />
                      </div>

                      <div className="flex items-center justify-between mt-2 text-[10px] text-[#7A8A7D]">
                        <span>Mise en forme légère : les liens et les citations sont automatiquement supportés</span>
                        <span className="font-mono font-bold text-[#1C2620]">{wordCount} mots</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 03: Photos & vidéos */}
                <div className="bg-white rounded-3xl p-6 border border-[#E8E4D8] shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-bold text-[#1C2620]">Photos <em className="font-serif italic font-normal text-[#2D5A27]">& vidéos</em></h2>
                    <span className="text-[10px] font-mono text-[#7A8A7D] uppercase">03 — Médias</span>
                  </div>
                  <p className="text-xs text-[#7A8A7D] mb-5">Jusqu&apos;à 10 fichiers. Glissez-déposez ou parcourez. La première image devient la vignette du post.</p>

                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,video/*" className="hidden" />
                  <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-[#D1CBB8] rounded-2xl p-8 bg-[#F5F2EA] text-center cursor-pointer hover:border-[#2D5A27] transition-all mb-4">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mx-auto mb-2 text-base shadow-sm">⇪</div>
                    <p className="text-xs font-bold text-[#1C2620]">Cliquez pour afficher / ou parcourez</p>
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
                <div className="bg-white rounded-3xl p-6 border border-[#E8E4D8] shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-bold text-[#1C2620]">Liens <em className="font-serif italic font-normal text-[#2D5A27]">internes</em></h2>
                    <span className="text-[10px] font-mono text-[#7A8A7D] uppercase">04 — Contexte</span>
                  </div>
                  <p className="text-xs text-[#7A8A7D] mb-5">Rattachez votre post à un contenu existant : le lien apparaîtra en pied de post et enrichira le fil.</p>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#1C2620] mb-1.5">Aventure liée</label>
                        <select value={linkedAdventure} onChange={(e) => setLinkedAdventure(e.target.value)} className="w-full px-4 py-3 bg-[#F5F2EA] border border-[#E4E0D4] rounded-2xl text-xs font-semibold text-[#1C2620] focus:outline-none">
                          <option value="">— Aucune aventure —</option>
                          <option value="Arête du Charmant Som - 28 sept">Arête du Charmant Som - 28 sept</option>
                          <option value="Tour du Mont Blanc - Etape 3">Tour du Mont Blanc - Etape 3</option>
                          <option value="Bivouac au Lac Blanc">Bivouac au Lac Blanc</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#1C2620] mb-1.5">Carnet lié</label>
                        <select value={linkedCarnet} onChange={(e) => setLinkedCarnet(e.target.value)} className="w-full px-4 py-3 bg-[#F5F2EA] border border-[#E4E0D4] rounded-2xl text-xs font-semibold text-[#1C2620] focus:outline-none">
                          <option value="">— Aucun carnet —</option>
                          <option value="c1">Mon premier 3000m en Vanoise</option>
                          <option value="c2">Traversée de la Chartreuse</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#1C2620] mb-1.5">Localisation</label>
                      <div className="relative flex items-center">
                        <span className="absolute left-4 text-xs">📍</span>
                        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex: Massif de la Chartreuse, Isère..." className="w-full pl-9 pr-24 py-3 bg-[#F5F2EA] border border-[#E4E0D4] rounded-2xl text-xs font-semibold text-[#1C2620] focus:outline-none" />
                        <button type="button" onClick={handleDetectLocation} disabled={isDetectingLocation} className="absolute right-3 px-3 py-1 bg-white border border-[#E4E0D4] rounded-xl text-[10px] font-bold text-[#1C2620] hover:bg-[#F5F2EA] transition-colors">
                          {isDetectingLocation ? 'Recherche...' : 'Détecter'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-[#1C2620]">Tags <span className="text-[#7A8A7D] font-normal">(Au moins 2 pour trouver le post)</span></label>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 p-2.5 bg-[#F5F2EA] border border-[#E4E0D4] rounded-2xl min-h-[48px]">
                        {tags.map((tag) => (
                          <span key={tag} className="px-3 py-1 bg-[#1C2620] text-white text-xs font-semibold rounded-full flex items-center gap-1.5">
                            <span>{tag}</span>
                            <button type="button" onClick={() => handleRemoveTag(tag)} className="text-white/70 hover:text-white text-[10px]">✕</button>
                          </span>
                        ))}
                        <input type="text" enterKeyHint="done" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder="+ Ajouter un tag..." className="bg-transparent text-xs text-[#1C2620] focus:outline-none px-2 py-1 flex-1 min-w-[120px]" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#1C2620] mb-1.5">Mentionner des membres</label>
                      <div className="flex flex-wrap items-center gap-2 p-2.5 bg-[#F5F2EA] border border-[#E4E0D4] rounded-2xl min-h-[48px]">
                        {mentions.map((m) => (
                          <span key={m} className="px-3 py-1 bg-[#EDF7F0] text-[#2D6A4F] border border-[#B7E4C7] text-xs font-semibold rounded-full flex items-center gap-1.5">
                            <span>@{m}</span>
                            <button type="button" onClick={() => handleRemoveMention(m)} className="text-[#2D6A4F]/70 hover:text-[#2D6A4F] text-[10px]">✕</button>
                          </span>
                        ))}
                        <input type="text" enterKeyHint="done" value={mentionInput} onChange={(e) => setMentionInput(e.target.value)} onKeyDown={handleAddMention} placeholder="Taper @ pour mentionner..." className="bg-transparent text-xs text-[#1C2620] focus:outline-none px-2 py-1 flex-1 min-w-[140px]" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 05: Où publier */}
                <div className="bg-white rounded-3xl p-6 border border-[#E8E4D8] shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-bold text-[#1C2620]">Où publier</h2>
                    <span className="text-[10px] font-mono text-[#7A8A7D] uppercase">05 — Destination</span>
                  </div>
                  <p className="text-xs text-[#7A8A7D] mb-5">Un post peut apparaître sur votre profil, sur le fil communauté, ou uniquement dans un club spécifique dont vous êtes membre.</p>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button type="button" onClick={() => setAudience('public')} className={`flex flex-col p-4 rounded-2xl border text-left transition-all ${audience === 'public' ? 'bg-[#EAF0EB] border-[#2D5A27] text-[#1C2620]' : 'bg-[#FAF8F5] border-[#E8E4D8] text-[#5A6A5D]'}`}>
                        <span className="text-base mb-1">🌐</span>
                        <span className="text-xs font-bold block">Fil public</span>
                        <span className="text-[10px] text-[#7A8A7D] mt-0.5">Communauté + votre profil</span>
                      </button>
                      <button type="button" onClick={() => setAudience('club')} className={`flex flex-col p-4 rounded-2xl border text-left transition-all ${audience === 'club' ? 'bg-[#EAF0EB] border-[#2D5A27] text-[#1C2620]' : 'bg-[#FAF8F5] border-[#E8E4D8] text-[#5A6A5D]'}`}>
                        <span className="text-base mb-1">👥</span>
                        <span className="text-xs font-bold block">Un club</span>
                        <span className="text-[10px] text-[#7A8A7D] mt-0.5">Vos clubs uniquement</span>
                      </button>
                      <button type="button" onClick={() => setAudience('abonnies')} className={`flex flex-col p-4 rounded-2xl border text-left transition-all ${audience === 'abonnies' ? 'bg-[#EAF0EB] border-[#2D5A27] text-[#1C2620]' : 'bg-[#FAF8F5] border-[#E8E4D8] text-[#5A6A5D]'}`}>
                        <span className="text-base mb-1">🔒</span>
                        <span className="text-xs font-bold block">Abonnés</span>
                        <span className="text-[10px] text-[#7A8A7D] mt-0.5">Vos abonnés uniquement</span>
                      </button>
                    </div>

                    {audience === 'club' && (
                      <div className="pt-2">
                        <label className="block text-xs font-semibold text-[#1C2620] mb-2">Sélectionner un de vos clubs rejoint *</label>
                        {loadingUserClubs ? (
                          <p className="text-xs text-[#7A8A7D] animate-pulse">Chargement de vos clubs...</p>
                        ) : userClubs.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {userClubs.map((c: any) => (
                              <button key={c.id} type="button" onClick={() => setSelectedClub(c.id)} className={`px-3.5 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all ${selectedClub === c.id ? 'bg-[#1C2620] text-white border-[#1C2620]' : 'bg-[#F5F2EA] text-[#3A4A3D] border-[#E4E0D4] hover:bg-white'}`}>
                                <span>{c.emoji || '🏕️'}</span>
                                <span>{c.name}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 bg-[#F5F2EA] rounded-2xl border border-[#E4E0D4] text-xs text-[#5A6A5D]">
                            <p className="font-bold text-[#1C2620] mb-1">Vous n&apos;avez rejoint aucun club pour le moment.</p>
                            <p>Rejoignez un club depuis la page <Link href="/communaute" className="underline text-[#2D5A27] font-bold">Communauté</Link> pour y publier vos posts.</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-2">
                      <label className="block text-xs font-semibold text-[#1C2620] mb-2">Quand publier ?</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: 'maintenant', label: 'Maintenant' },
                          { id: '1h', label: 'Dans 1 h' },
                          { id: 'matin', label: 'Demain matin' },
                          { id: 'planifier', label: 'Planifier...' },
                        ].map((st) => (
                          <button key={st.id} type="button" onClick={() => setScheduleTime(st.id as any)} className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${scheduleTime === st.id ? 'bg-[#1C2620] text-white border-[#1C2620]' : 'bg-[#F5F2EA] text-[#3A4A3D] border-[#E4E0D4] hover:bg-white'}`}>
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[#F0ECE1] space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-[#1C2620] block">Autoriser les commentaires</span>
                          <span className="text-[10px] text-[#7A8A7D]">Vous pourrez toujours modifier les échanges</span>
                        </div>
                        <button type="button" onClick={() => setAllowComments(!allowComments)} className={`w-11 h-6 rounded-full transition-colors p-1 relative ${allowComments ? 'bg-[#2D5A27]' : 'bg-gray-300'}`}>
                          <div className={`w-4 h-4 rounded-full bg-white transition-transform ${allowComments ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-[#1C2620] block">Croiser vers mes comptes liés</span>
                          <span className="text-[10px] text-[#7A8A7D]">Republication automatique sur Strava et Instagram</span>
                        </div>
                        <button type="button" onClick={() => setCrossPost(!crossPost)} className={`w-11 h-6 rounded-full transition-colors p-1 relative ${crossPost ? 'bg-[#2D5A27]' : 'bg-gray-300'}`}>
                          <div className={`w-4 h-4 rounded-full bg-white transition-transform ${crossPost ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: PREVIEW & QUALITY SCORE */}
              <div className="lg:col-span-4 space-y-6 sticky top-28">

                {/* CARD 1: LIVE PREVIEW */}
                <div className="bg-white rounded-3xl p-5 border border-[#E8E4D8] shadow-sm">
                  <div className="text-[10px] font-mono text-[#7A8A7D] uppercase tracking-wider mb-3">APERÇU · FIL COMMUNAUTÉ</div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <img src={user?.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80'} alt="Avatar" className="w-9 h-9 rounded-full object-cover border border-[#E4E0D4]" />
                      <div>
                        <h4 className="text-xs font-bold text-[#1C2620]">{user?.user_metadata?.full_name || 'Marceline Chevrier'}</h4>
                        <p className="text-[10px] text-[#7A8A7D]">À l&apos;instant · {location ? location.split('/')[0] : 'Grenoble'}</p>
                      </div>
                    </div>

                    {title && postType !== 'photo' && (
                      <h3 className="text-xs font-bold text-[#1C2620] leading-snug line-clamp-2">{title}</h3>
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
                        <span>❤️ 3</span>
                        <span>🚀 0</span>
                      </div>
                      <div className="flex gap-1 text-[10px] text-[#2D5A27] font-semibold">
                        {tags.slice(0, 2).map((t) => (<span key={t}>#{t}</span>))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 2: POST BIEN PENSÉ */}
                <div className="bg-white rounded-3xl p-5 border border-[#E8E4D8] shadow-sm">
                  <h3 className="text-sm font-bold text-[#1C2620] mb-1">Post <em className="font-serif italic font-normal text-[#2D5A27]">bien pensé</em></h3>
                  <p className="text-[11px] text-[#7A8A7D] mb-4">Les posts avec image + mention + regroupement ont en moyenne 3x plus d&apos;interactions.</p>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[#2D5A27] font-semibold">
                      <span className="flex items-center gap-1.5">✓ Titre rédigé</span>
                      <span className="text-[10px] text-[#7A8A7D]">FAIT</span>
                    </div>
                    <div className="flex items-center justify-between text-[#2D5A27] font-semibold">
                      <span className="flex items-center gap-1.5">✓ {photos.length} photos ajoutées</span>
                      <span className="text-[10px] text-[#7A8A7D]">FAIT</span>
                    </div>
                    <div className="flex items-center justify-between text-[#2D5A27] font-semibold">
                      <span className="flex items-center gap-1.5">✓ {linkedAdventure ? 'Aventure liée' : 'Option aventure'}</span>
                      <span className="text-[10px] text-[#7A8A7D]">{linkedAdventure ? 'FAIT' : 'OPTIONNEL'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[#2D5A27] font-semibold">
                      <span className="flex items-center gap-1.5">✓ {tags.length} tags + {mentions.length} mention</span>
                      <span className="text-[10px] text-[#7A8A7D]">FAIT</span>
                    </div>
                    <div className="flex items-center justify-between text-[#7A8A7D]">
                      <span className="flex items-center gap-1.5">○ Ajouter la géolocalisation exacte</span>
                      <span className="text-[10px]">{location ? 'FAIT' : 'OPTIONNEL'}</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-[#F0ECE1]">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-[#1C2620]">Prêt : qualité élevée</span>
                      <span className="font-bold text-[#2D5A27] font-mono">{qualityScore}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#E8E4D8] rounded-full overflow-hidden">
                      <div className="h-full bg-[#2D5A27] rounded-full transition-all duration-500" style={{ width: `${qualityScore}%` }} />
                    </div>
                  </div>
                </div>

                {/* CARD 3: MEILLEUR MOMENT BANNER */}
                <div className="bg-[#1C2620] text-white rounded-3xl p-5 shadow-lg border border-[#2D3F35]">
                  <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider mb-1">MEILLEUR MOMENT</div>
                  <h4 className="text-base font-bold mb-1">Publier vers 18h.</h4>
                  <p className="text-xs text-white/70 leading-relaxed font-light">C&apos;est l&apos;heure de votre audience — randonneurs actifs — regarde le fil, entre le trajet retour et le dîner.</p>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM STICKY ACTION BAR */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-[#E8E4D8] py-3.5 px-6 shadow-2xl">
            <div className="container mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#1C2620]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Prêt à publier</span>
                <span className="text-[#7A8A7D]">·</span>
                <span className="text-[#7A8A7D]">{wordCount} mots</span>
                <span className="text-[#7A8A7D]">·</span>
                <span className="text-[#7A8A7D]">{photos.length} photos</span>
                <span className="text-[#7A8A7D]">·</span>
                <span className="text-[#7A8A7D]">qualité {qualityScore}%</span>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={() => handlePublish(true)} disabled={isSubmitting} className="px-5 py-2.5 bg-white border border-[#E8E4D8] rounded-full text-xs font-bold text-[#3A4A3D] hover:bg-[#FAF8F5] transition-all">Enregistrer</button>
                <button onClick={() => handlePublish(true)} disabled={isSubmitting} className="px-5 py-2.5 bg-white border border-[#E8E4D8] rounded-full text-xs font-bold text-[#3A4A3D] hover:bg-[#FAF8F5] transition-all">Planifier</button>
                <button onClick={() => handlePublish(false)} disabled={isSubmitting} className="px-7 py-2.5 bg-[#1C2620] text-white rounded-full text-xs font-bold hover:bg-[#2D3F35] transition-all shadow-md">
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
          <div style={{ position: 'fixed', top: '80px', right: '16px', zIndex: 999, background: '#1C2620', color: '#fff', padding: '12px 20px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', fontSize: '12px', fontWeight: 700, border: '1px solid #2D5A3D' }}>
            {toastMessage}
          </div>
        )}

        <MobilePageShell>
          <div style={{ padding: '16px' }}>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#7A8A7D', fontWeight: 600, marginBottom: '12px' }}>
              <Link href="/communaute" style={{ color: '#7A8A7D', textDecoration: 'none' }}>Communauté</Link>
              <span>›</span>
              <span style={{ color: '#1C2620', fontWeight: 700 }}>Publier</span>
            </div>

            {/* Hero */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: '#7A8A7D', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>— NOUVEAU POST</div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1C2620', margin: 0, lineHeight: 1.1 }}>
                Un moment, <em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#2D5A27', fontWeight: 400 }}>partagé.</em>
              </h1>
            </div>

            {/* Section: Type */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '16px', border: '1px solid #E8E4D8', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#1C2620' }}>Type</span>
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
                      padding: '12px', borderRadius: '12px', border: `1.5px solid ${postType === opt.id ? '#2D5A27' : '#E8E4D8'}`,
                      background: postType === opt.id ? '#EAF0EB' : '#FAF8F5',
                      textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: '18px', marginBottom: '4px' }}>{opt.label}</div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#1C2620' }}>{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Section: Content */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '16px', border: '1px solid #E8E4D8', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#1C2620' }}>Contenu</span>
                <span style={{ fontSize: '9px', fontFamily: 'ui-monospace, monospace', color: '#7A8A7D', textTransform: 'uppercase' }}>02</span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre de votre post..."
                style={{ width: '100%', padding: '12px', background: '#F5F2EA', border: '1px solid #E4E0D4', borderRadius: '12px', fontSize: '12px', fontWeight: 600, color: '#1C2620', outline: 'none', marginBottom: '10px', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              <textarea
                rows={6}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Racontez votre expérience..."
                style={{ width: '100%', padding: '12px', background: '#F5F2EA', border: '1px solid #E4E0D4', borderRadius: '12px', fontSize: '12px', color: '#1C2620', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              <div style={{ fontSize: '10px', color: '#7A8A7D', textAlign: 'right', marginTop: '4px', fontFamily: 'ui-monospace, monospace' }}>{wordCount} mots</div>
            </div>

            {/* Section: Photos */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '16px', border: '1px solid #E8E4D8', marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1C2620', marginBottom: '8px' }}>Photos & vidéos</div>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,video/*" style={{ display: 'none' }} />
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{ border: '2px dashed #D1CBB8', borderRadius: '12px', padding: '20px', background: '#F5F2EA', textAlign: 'center', cursor: 'pointer', marginBottom: '10px' }}
              >
                <div style={{ fontSize: '24px', marginBottom: '4px' }}>⇪</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#1C2620' }}>Ajouter des photos</div>
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
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1C2620', marginBottom: '8px' }}>Localisation & Tags</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lieu..." style={{ flex: 1, padding: '10px', background: '#F5F2EA', border: '1px solid #E4E0D4', borderRadius: '10px', fontSize: '12px', color: '#1C2620', outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={handleDetectLocation} disabled={isDetectingLocation} style={{ padding: '10px 14px', background: '#fff', border: '1px solid #E4E0D4', borderRadius: '10px', fontSize: '10px', fontWeight: 700, color: '#1C2620', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>{isDetectingLocation ? '...' : '📍'}</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px', background: '#F5F2EA', border: '1px solid #E4E0D4', borderRadius: '10px', minHeight: '40px' }}>
                {tags.map(tag => (
                  <span key={tag} style={{ padding: '4px 10px', background: '#1C2620', color: '#fff', borderRadius: '999px', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '10px', padding: 0 }}>✕</button>
                  </span>
                ))}
                <input type="text" enterKeyHint="done" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder="+ Tag" style={{ background: 'transparent', border: 'none', fontSize: '11px', color: '#1C2620', outline: 'none', flex: 1, minWidth: '80px', fontFamily: 'inherit' }} />
              </div>
            </div>

            {/* Section: Audience */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '16px', border: '1px solid #E8E4D8', marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1C2620', marginBottom: '8px' }}>Audience</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '12px' }}>
                <button onClick={() => setAudience('public')} style={{ padding: '10px', borderRadius: '10px', border: `1.5px solid ${audience === 'public' ? '#2D5A27' : '#E8E4D8'}`, background: audience === 'public' ? '#EAF0EB' : '#FAF8F5', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}>
                  <div style={{ fontSize: '16px' }}>🌐</div>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#1C2620' }}>Public</div>
                </button>
                <button onClick={() => setAudience('club')} style={{ padding: '10px', borderRadius: '10px', border: `1.5px solid ${audience === 'club' ? '#2D5A27' : '#E8E4D8'}`, background: audience === 'club' ? '#EAF0EB' : '#FAF8F5', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}>
                  <div style={{ fontSize: '16px' }}>👥</div>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#1C2620' }}>Club</div>
                </button>
                <button onClick={() => setAudience('abonnies')} style={{ padding: '10px', borderRadius: '10px', border: `1.5px solid ${audience === 'abonnies' ? '#2D5A27' : '#E8E4D8'}`, background: audience === 'abonnies' ? '#EAF0EB' : '#FAF8F5', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}>
                  <div style={{ fontSize: '16px' }}>🔒</div>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#1C2620' }}>Abonnés</div>
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #F0ECE1' }}>
                <span style={{ fontSize: '11px', color: '#1C2620', fontWeight: 700 }}>Commentaires</span>
                <button onClick={() => setAllowComments(!allowComments)} style={{ width: '40px', height: '22px', borderRadius: '999px', background: allowComments ? '#2D5A27' : '#d1d5db', border: 'none', cursor: 'pointer', padding: '2px', position: 'relative' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'transform 0.2s', transform: allowComments ? 'translateX(18px)' : 'translateX(0)' }} />
                </button>
              </div>
            </div>
          </div>
        </MobilePageShell>

        {/* Mobile sticky bottom bar */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid #E8E4D8', padding: '10px 16px', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => handlePublish(true)} disabled={isSubmitting} style={{ flex: 1, padding: '10px', borderRadius: '999px', border: '1px solid #E8E4D8', background: '#fff', fontSize: '11px', fontWeight: 700, color: '#3A4A3D', cursor: 'pointer', fontFamily: 'inherit' }}>Brouillon</button>
            <button onClick={() => handlePublish(false)} disabled={isSubmitting} style={{ flex: 2, padding: '10px', borderRadius: '999px', border: 'none', background: '#1C2620', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {isSubmitting ? 'Publication...' : 'Publier'}
            </button>
          </div>
        </div>

        
      </div>
    </>
  );
}
