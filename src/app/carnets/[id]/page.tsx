'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import MediaUpload from '@/components/ui/MediaUpload';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CarnetMedia {
  id: string;
  url: string;
  type: string;
  caption: string | null;
  position: number;
}

interface Carnet {
  id: string;
  author_id: string;
  title: string;
  destination: string;
  description: string;
  cover_image: string;
  cover_image_alt: string;
  start_date: string | null;
  end_date: string | null;
  weather: string;
  route_rating: number;
  visibility: string;
  tags: string[];
  map_points: { lat: number; lng: number; label: string; day?: number }[];
  is_collaborative: boolean;
  likes_count: number;
  comments_count: number;
  favorites_count: number;
  views_count: number;
  verified: boolean;
  created_at: string;
  author?: { id?: string; full_name: string; avatar_url: string; trust_score: number };
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author?: { full_name: string; avatar_url: string };
}

const FAKE_CARNETS: Carnet[] = [
  {
    id: 'fake-1',
    author_id: 'fake-author-1',
    title: 'Circuit des Annapurnas — 18 jours en autonomie complète',
    destination: 'Népal, Annapurna',
    description: `Départ de Besisahar le 12 mars, retour à Pokhara le 30. Conditions météo exceptionnelles jusqu'au col Thorong La (5416m), puis tempête de neige les 3 derniers jours.\n\nLe circuit des Annapurnas reste l'un des plus beaux treks au monde. Nous avons opté pour la version intégrale avec le passage du col Thorong La à 5416m d'altitude. La montée depuis Manang est éprouvante mais la vue depuis le col est à couper le souffle.\n\nLes lodges sont confortables jusqu'à Manang, puis plus rustiques. Prévoir des vêtements chauds même en mars — les nuits descendent à -15°C au-dessus de 4000m.`,
    cover_image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1fc94b322-1777501827822.png',
    cover_image_alt: 'Randonneur avec sac à dos sur sentier himalayan avec vue sur Annapurna enneigé',
    start_date: '2026-03-12',
    end_date: '2026-03-30',
    weather: 'Ensoleillé J1–J14, tempête neige J15–J18, -18°C au col Thorong La',
    route_rating: 9.2,
    visibility: 'public',
    tags: ['himalaya', 'autonomie', 'haute-altitude', 'nepal', 'trek'],
    map_points: [
      { lat: 28.3949, lng: 84.1240, label: 'Besisahar — Départ', day: 1 },
      { lat: 28.5333, lng: 84.0167, label: 'Chame', day: 4 },
      { lat: 28.6667, lng: 84.0167, label: 'Manang', day: 8 },
      { lat: 28.7833, lng: 83.9333, label: 'Col Thorong La (5416m)', day: 11 },
      { lat: 28.3833, lng: 83.8167, label: 'Pokhara — Arrivée', day: 18 },
    ],
    is_collaborative: false,
    likes_count: 203,
    comments_count: 34,
    favorites_count: 87,
    views_count: 1420,
    verified: true,
    created_at: '2026-07-01T10:00:00Z',
    author: { id: 'fake-author-1', full_name: 'Thomas Vernet', avatar_url: '', trust_score: 94 },
  },
  {
    id: 'fake-2',
    author_id: 'fake-author-2',
    title: 'GR20 Corse — 15 jours de bout en bout',
    destination: 'France, Corse',
    description: `Le GR20 en juin : chaleur intense en basse altitude, fraîcheur bienvenue au-dessus de 1800m. J'ai opté pour la variante alpine sur 6 étapes — plus technique mais spectaculaire.`,
    cover_image: 'https://img.rocket.new/generatedImages/rocket_gen_img_12782a0e5-1772085588678.png',
    cover_image_alt: 'Randonneuse sur sentier rocheux corse avec vue panoramique sur mer Méditerranée',
    start_date: '2026-06-01',
    end_date: '2026-06-15',
    weather: 'Ensoleillé et chaud (32°C en basse altitude), frais en altitude (12°C)',
    route_rating: 9.5,
    visibility: 'public',
    tags: ['gr20', 'corse', 'france', 'trek'],
    map_points: [
      { lat: 42.5167, lng: 8.8500, label: 'Calenzana — Départ', day: 1 },
      { lat: 41.7500, lng: 9.2833, label: 'Conca — Arrivée', day: 15 },
    ],
    is_collaborative: false,
    likes_count: 156,
    comments_count: 28,
    favorites_count: 63,
    views_count: 980,
    verified: true,
    created_at: '2026-06-20T14:00:00Z',
    author: { id: 'fake-author-2', full_name: 'Camille Rousseau', avatar_url: '', trust_score: 87 },
  },
  {
    id: 'fake-3',
    author_id: 'fake-author-3',
    title: 'Tour du Mont-Blanc — 11 jours, 3 pays',
    destination: 'France / Italie / Suisse',
    description: `Le TMB classique en sens antihoraire, départ et arrivée aux Houches. 11 jours pour boucler les 170 km et 10 000m de dénivelé positif.`,
    cover_image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80',
    cover_image_alt: 'Vue panoramique sur le Mont-Blanc depuis un col alpin avec randonneurs en premier plan',
    start_date: '2026-07-05',
    end_date: '2026-07-16',
    weather: 'Beau temps 8 jours sur 11, orage J6 et J9',
    route_rating: 9.8,
    visibility: 'public',
    tags: ['tmb', 'mont-blanc', 'alpes'],
    map_points: [
      { lat: 45.8833, lng: 6.7833, label: 'Les Houches', day: 1 },
    ],
    is_collaborative: true,
    likes_count: 312,
    comments_count: 52,
    favorites_count: 134,
    views_count: 2100,
    verified: true,
    created_at: '2026-07-18T09:00:00Z',
    author: { id: 'fake-author-3', full_name: 'Marie Dubois', avatar_url: '', trust_score: 91 },
  },
];

const FAKE_COMMENTS: Comment[] = [
  { id: 'c1', content: 'Merci pour ce récit détaillé ! Le passage du col Thorong La m\'a toujours fait peur, mais tu me donnes envie de tenter l\'aventure.', created_at: '2026-07-02T08:30:00Z', author: { full_name: 'Sophie Laurent', avatar_url: '' } },
  { id: 'c2', content: 'Quelle marque de sac de couchage tu recommandes pour les températures négatives ?', created_at: '2026-07-03T14:15:00Z', author: { full_name: 'Pierre Moreau', avatar_url: '' } },
];

export default function CarnetDetailPage() {
  const params = useParams();
  const carnetId = params?.id as string;
  const [carnet, setCarnet] = useState<Carnet | null>(null);
  const [media, setMedia] = useState<CarnetMedia[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!carnetId) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('carnets')
        .select('*, author:user_profiles(id, full_name, avatar_url, trust_score)')
        .eq('id', carnetId)
        .maybeSingle();

      if (data) {
        setCarnet(data as Carnet);
        const { data: commentsData } = await supabase
          .from('carnet_comments')
          .select('*, author:user_profiles(full_name, avatar_url)')
          .eq('carnet_id', carnetId)
          .order('created_at', { ascending: true });
        setComments((commentsData as Comment[]) ?? []);

        // Load media
        const { data: mediaData } = await supabase
          .from('carnet_media')
          .select('*')
          .eq('carnet_id', carnetId)
          .order('position', { ascending: true });
        setMedia((mediaData as CarnetMedia[]) ?? []);
      } else {
        const fake = FAKE_CARNETS.find((c) => c.id === carnetId);
        if (fake) {
          setCarnet(fake);
          setComments(FAKE_COMMENTS);
        }
      }
      setLoading(false);
    };
    load();
  }, [carnetId, supabase]);

  const handleSubmitComment = async () => {
    if (!user || !carnet || !newComment.trim()) return;
    setSubmitting(true);
    if (!carnet.id.startsWith('fake-')) {
      const { data } = await supabase
        .from('carnet_comments')
        .insert({ carnet_id: carnet.id, author_id: user.id, content: newComment.trim() })
        .select('*, author:user_profiles(full_name, avatar_url)')
        .single();
      if (data) setComments((prev) => [...prev, data as Comment]);
    } else {
      setComments((prev) => [...prev, {
        id: `temp-${Date.now()}`,
        content: newComment.trim(),
        created_at: new Date().toISOString(),
        author: { full_name: 'Vous', avatar_url: '' },
      }]);
    }
    setNewComment('');
    setSubmitting(false);
  };

  const handleMediaUpload = async (url: string) => {
    if (!carnet || carnet.id.startsWith('fake-')) return;
    const { data } = await supabase
      .from('carnet_media')
      .insert({ carnet_id: carnet.id, url, type: 'photo', position: media.length })
      .select()
      .single();
    if (data) setMedia((prev) => [...prev, data as CarnetMedia]);
    setShowUpload(false);
  };

  const durationDays = carnet?.start_date && carnet?.end_date
    ? Math.ceil((new Date(carnet.end_date).getTime() - new Date(carnet.start_date).getTime()) / 86400000)
    : null;

  // All gallery images: cover + carnet_media
  const galleryImages = useMemo(() => {
    const imgs: { url: string; alt: string }[] = [];
    if (carnet?.cover_image) imgs.push({ url: carnet.cover_image, alt: carnet.cover_image_alt || carnet.title });
    media.filter((m) => m.type === 'photo').forEach((m) => imgs.push({ url: m.url, alt: m.caption || 'Photo du carnet' }));
    return imgs;
  }, [carnet, media]);

  const isAuthor = user?.id === carnet?.author_id;

  return (
    <div className="min-h-screen bg-[#F5F2E8]">
      {/* Desktop header only */}
      <div className="hidden md:block">
        <Header />
      </div>

      <main className="md:pt-16">
        {loading ? (
          <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
            <div className="h-72 bg-[#C8C3B0]/30 rounded-2xl animate-pulse" />
            <div className="h-8 w-2/3 bg-[#C8C3B0]/30 rounded animate-pulse" />
          </div>
        ) : !carnet ? (
          <div className="max-w-4xl mx-auto px-4 py-20 text-center">
            <p className="text-5xl mb-4">🗺️</p>
            <h1 className="font-display font-bold text-2xl text-[#1C2620] mb-2">Carnet introuvable</h1>
            <Link href="/carnets" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#E4501C] text-white rounded-xl text-sm font-bold hover:bg-[#E4501C]/90 transition-colors">
              ← Retour aux carnets
            </Link>
          </div>
        ) : (
          <>
            {/* ── MOBILE LAYOUT ── */}
            <div className="md:hidden">
              {/* Compact header */}
              <div className="relative h-56 overflow-hidden bg-[#1C2620]">
                {carnet.cover_image && (
                  <Image src={carnet.cover_image} alt={carnet.cover_image_alt || carnet.title} fill className="object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                {/* Badges */}
                <div className="absolute top-4 left-4 flex gap-2">
                  {carnet.verified && <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold">✓ Vérifié</span>}
                  {carnet.is_collaborative && <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">👥 Collab</span>}
                </div>

                {/* Title overlay */}
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-[10px] font-mono text-[#E4501C] uppercase tracking-wider mb-1">{carnet.destination}</p>
                  <h1 className="font-display font-bold text-white text-xl leading-tight line-clamp-2">{carnet.title}</h1>
                  {carnet.author && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-6 h-6 rounded-md bg-[#E4501C]/30 flex items-center justify-center text-xs font-bold text-white">
                        {carnet.author.full_name?.[0] ?? '?'}
                      </div>
                      <span className="text-white/80 text-xs font-medium">{carnet.author.full_name}</span>
                      <span className="text-white/40 text-xs">· Trust {carnet.author.trust_score}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick stats strip */}
              <div className="flex items-center justify-around bg-[#1C2620] px-4 py-2.5 border-b border-white/10">
                {[
                  { icon: '⭐', value: `${carnet.route_rating}/10` },
                  { icon: '📅', value: durationDays ? `${durationDays}j` : '—' },
                  { icon: '👁️', value: carnet.views_count ?? 0 },
                  { icon: '🎒', value: carnet.likes_count },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-sm">{s.icon}</span>
                    <span className="font-mono font-bold text-white text-sm">{s.value}</span>
                  </div>
                ))}
              </div>

              {/* Horizontal media gallery with scroll-snap */}
              {galleryImages.length > 0 && (
                <div className="bg-[#1C2620] pb-3">
                  <div
                    ref={galleryRef}
                    className="flex gap-2 overflow-x-auto px-4 pt-3 pb-1 snap-x snap-mandatory scrollbar-hide"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {galleryImages.map((img, i) => (
                      <div
                        key={i}
                        className="flex-shrink-0 w-48 h-32 rounded-xl overflow-hidden snap-start relative"
                      >
                        <Image src={img.url} alt={img.alt} fill className="object-cover" />
                      </div>
                    ))}
                    {/* Add photo button (author only) */}
                    {isAuthor && !carnet.id.startsWith('fake-') && (
                      <button
                        onClick={() => setShowUpload(true)}
                        className="flex-shrink-0 w-48 h-32 rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-2 snap-start hover:border-[#E4501C]/50 transition-colors"
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        <span className="text-white/40 text-xs">Ajouter</span>
                      </button>
                    )}
                  </div>
                  {/* Scroll dots */}
                  {galleryImages.length > 1 && (
                    <div className="flex justify-center gap-1 mt-1">
                      {galleryImages.map((_, i) => (
                        <div key={i} className="w-1 h-1 rounded-full bg-white/30" />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Upload modal */}
              {showUpload && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
                  <div className="w-full bg-[#F5F2E8] rounded-t-3xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display font-bold text-[#1C2620]">Ajouter une photo</h3>
                      <button onClick={() => setShowUpload(false)} className="w-8 h-8 rounded-full bg-[#C8C3B0]/30 flex items-center justify-center">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1C2620" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <MediaUpload
                      bucket="carnet-media"
                      folder={carnet.id}
                      onUploadComplete={handleMediaUpload}
                      label="Ajouter une photo au carnet"
                    />
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="px-4 py-5 space-y-5">
                {/* Dates */}
                {(carnet.start_date || carnet.end_date) && (
                  <div className="flex items-center gap-3 p-4 bg-[#1C2620] rounded-2xl">
                    <Icon name="CalendarDaysIcon" size={18} className="text-[#E4501C] flex-shrink-0" />
                    <div className="flex flex-wrap gap-4 text-sm">
                      {carnet.start_date && (
                        <div>
                          <p className="text-[9px] text-white/40 uppercase tracking-wider mb-0.5">Départ</p>
                          <p className="text-white font-medium text-sm">{new Date(carnet.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                      )}
                      {carnet.end_date && (
                        <div>
                          <p className="text-[9px] text-white/40 uppercase tracking-wider mb-0.5">Retour</p>
                          <p className="text-white font-medium text-sm">{new Date(carnet.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Description — comfortable reading */}
                {carnet.description && (
                  <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5">
                    <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider mb-3">Récit</p>
                    <p className="text-sm text-[#1C2620] leading-7 whitespace-pre-line">{carnet.description}</p>
                  </div>
                )}

                {/* Weather */}
                {carnet.weather && (
                  <div className="flex items-start gap-3 p-4 bg-[#E7E3D6] rounded-2xl border border-[#C8C3B0]">
                    <Icon name="CloudIcon" size={18} className="text-[#5C6B5E] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[9px] font-mono text-[#5C6B5E] uppercase tracking-wider mb-1">Météo</p>
                      <p className="text-sm text-[#1C2620]">{carnet.weather}</p>
                    </div>
                  </div>
                )}

                {/* Tags */}
                {carnet.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {carnet.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-[#1C2620] text-white/70 px-3 py-1.5 rounded-full">#{tag}</span>
                    ))}
                  </div>
                )}

                {/* Map points */}
                {carnet.map_points?.length > 0 && (
                  <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5">
                    <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider mb-3">Étapes ({carnet.map_points.length})</p>
                    <div className="space-y-2">
                      {carnet.map_points.map((point, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-[#E7E3D6] rounded-xl border border-[#C8C3B0]">
                          <div className="w-7 h-7 rounded-lg bg-[#E4501C] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {point.day ?? i + 1}
                          </div>
                          <p className="text-sm font-medium text-[#1C2620] flex-1">{point.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Comments */}
                <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5">
                  <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider mb-4">
                    Commentaires ({comments.length})
                  </p>
                  {comments.length === 0 ? (
                    <p className="text-sm text-[#5C6B5E] text-center py-3">Aucun commentaire. Soyez le premier !</p>
                  ) : (
                    <div className="space-y-3 mb-4">
                      {comments.map((c) => (
                        <div key={c.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-xl bg-[#E4501C]/20 flex items-center justify-center text-xs font-bold text-[#E4501C] flex-shrink-0">
                            {c.author?.full_name?.[0] ?? '?'}
                          </div>
                          <div className="flex-1 bg-white rounded-xl p-3">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-bold text-[#1C2620]">{c.author?.full_name ?? 'Anonyme'}</p>
                              <p className="text-[10px] text-[#5C6B5E]">{new Date(c.created_at).toLocaleDateString('fr-FR')}</p>
                            </div>
                            <p className="text-sm text-[#5C6B5E]">{c.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {user ? (
                    <div className="flex gap-2">
                      <input
                        className="flex-1 bg-white border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30"
                        placeholder="Commenter..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment(); } }}
                      />
                      <button onClick={handleSubmitComment} disabled={submitting || !newComment.trim()} className="px-4 py-2.5 bg-[#E4501C] text-white rounded-xl text-sm font-medium disabled:opacity-50">
                        {submitting ? '…' : '→'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-center text-[#5C6B5E]">
                      <Link href="/connexion" className="text-[#E4501C] hover:underline">Connectez-vous</Link> pour commenter
                    </p>
                  )}
                </div>
              </div>

              {/* Fixed action bar — above bottom tab bar */}
              <div
                className="fixed left-0 right-0 z-30 flex items-center justify-around px-6 py-3 bg-[#F5F2E8]/95 border-t border-[#C8C3B0] backdrop-blur-sm"
                style={{ bottom: 'calc(56px + env(safe-area-inset-bottom))' }}
              >
                <button
                  onClick={() => setLiked((v) => !v)}
                  className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] justify-center transition-colors ${liked ? 'text-[#E4501C]' : 'text-[#5C6B5E]'}`}
                >
                  <Icon name="HeartIcon" size={20} />
                  <span className="text-[10px] font-medium">{carnet.likes_count + (liked ? 1 : 0)}</span>
                </button>
                <button
                  onClick={() => {
                    const el = document.querySelector('.comment-input');
                    if (el) (el as HTMLElement).focus();
                  }}
                  className="flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] justify-center text-[#5C6B5E]"
                >
                  <Icon name="ChatBubbleLeftIcon" size={20} />
                  <span className="text-[10px] font-medium">{comments.length}</span>
                </button>
                <button
                  onClick={() => setBookmarked((v) => !v)}
                  className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] justify-center transition-colors ${bookmarked ? 'text-[#E4501C]' : 'text-[#5C6B5E]'}`}
                >
                  <Icon name="BookmarkIcon" size={20} />
                  <span className="text-[10px] font-medium">{carnet.favorites_count + (bookmarked ? 1 : 0)}</span>
                </button>
                <Link
                  href={`/ai-configurator?destination=${encodeURIComponent(carnet.destination)}`}
                  className="flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] justify-center text-[#5C6B5E]"
                >
                  <Icon name="SparklesIcon" size={20} />
                  <span className="text-[10px] font-medium">Préparer</span>
                </Link>
              </div>
            </div>

            {/* ── DESKTOP LAYOUT (unchanged) ── */}
            <div className="hidden md:block">
              {/* Cover Hero */}
              <div className="relative h-80 md:h-[420px] overflow-hidden bg-[#1C2620]">
                {carnet.cover_image ? (
                  <Image src={carnet.cover_image} alt={carnet.cover_image_alt || carnet.title} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-8xl">🗺️</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                <div className="absolute top-6 left-6 flex gap-2 flex-wrap">
                  {carnet.verified && <span className="text-xs bg-emerald-500 text-white px-3 py-1 rounded-full font-bold">✓ Vérifié</span>}
                  {carnet.is_collaborative && <span className="text-xs bg-blue-500 text-white px-3 py-1 rounded-full font-bold">👥 Collaboratif</span>}
                </div>
                <div className="absolute top-6 right-6">
                  <Link href="/carnets" className="flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-sm rounded-xl text-white text-sm font-medium hover:bg-black/60 transition-colors">
                    <Icon name="ArrowLeftIcon" size={14} />
                    Retour
                  </Link>
                </div>
                <div className="absolute bottom-8 left-6 right-6 max-w-4xl mx-auto">
                  <p className="text-[11px] font-mono text-[#E4501C] uppercase tracking-wider mb-2">{carnet.destination}</p>
                  <h1 className="font-display font-bold text-white text-3xl md:text-4xl leading-tight mb-4">{carnet.title}</h1>
                  <div className="flex items-center gap-4 flex-wrap">
                    {carnet.author && (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#E4501C]/30 flex items-center justify-center text-sm font-bold text-white">
                          {carnet.author.full_name?.[0] ?? '?'}
                        </div>
                        <span className="text-white/90 text-sm font-medium">{carnet.author.full_name}</span>
                        <span className="text-white/50 text-xs">Trust {carnet.author.trust_score}</span>
                      </div>
                    )}
                    <span className="text-white/40">·</span>
                    <span className="text-white/60 text-sm">{new Date(carnet.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>

              <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
                {/* Stats bar */}
                <div className="grid grid-cols-5 bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl divide-x divide-[#C8C3B0] overflow-hidden">
                  {[
                    { label: 'Note', value: `${carnet.route_rating}/10`, icon: '⭐' },
                    { label: 'Durée', value: durationDays ? `${durationDays}j` : '—', icon: '📅' },
                    { label: 'Vues', value: carnet.views_count ?? 0, icon: '👁️' },
                    { label: 'Réactions', value: carnet.likes_count, icon: '🎒' },
                    { label: 'Favoris', value: carnet.favorites_count, icon: '🔖' },
                  ].map((s) => (
                    <div key={s.label} className="p-4 text-center">
                      <p className="text-xl mb-1">{s.icon}</p>
                      <p className="font-display font-bold text-[#1C2620] text-base">{s.value}</p>
                      <p className="text-[10px] text-[#5C6B5E]">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Media gallery desktop */}
                {galleryImages.length > 1 && (
                  <div>
                    <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider mb-3">Photos ({galleryImages.length})</p>
                    <div className="grid grid-cols-3 gap-3">
                      {galleryImages.slice(1).map((img, i) => (
                        <div key={i} className="relative aspect-video rounded-xl overflow-hidden">
                          <Image src={img.url} alt={img.alt} fill className="object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isAuthor && !carnet.id.startsWith('fake-') && (
                  <div>
                    <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider mb-3">Ajouter des médias</p>
                    <MediaUpload
                      bucket="carnet-media"
                      folder={carnet.id}
                      onUploadComplete={handleMediaUpload}
                      label="Ajouter une photo au carnet"
                    />
                  </div>
                )}

                {carnet.description && (
                  <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-6">
                    <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider mb-4">Récit d&apos;expédition</p>
                    <p className="text-sm text-[#1C2620] leading-relaxed whitespace-pre-line">{carnet.description}</p>
                  </div>
                )}

                {carnet.weather && (
                  <div className="flex items-start gap-4 p-5 bg-[#E7E3D6] rounded-2xl border border-[#C8C3B0]">
                    <Icon name="CloudIcon" size={20} className="text-[#5C6B5E] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider mb-1">Conditions météo</p>
                      <p className="text-sm text-[#1C2620] font-medium">{carnet.weather}</p>
                    </div>
                  </div>
                )}

                {carnet.tags?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider mb-3">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {carnet.tags.map((tag) => (
                        <span key={tag} className="text-sm bg-[#1C2620] text-white/70 px-4 py-1.5 rounded-full">#{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 py-4 border-t border-[#C8C3B0]">
                  <span className="flex items-center gap-2 text-sm text-[#5C6B5E]">
                    <Icon name="HeartIcon" size={16} /> {carnet.likes_count} réactions
                  </span>
                  <span className="flex items-center gap-2 text-sm text-[#5C6B5E]">
                    <Icon name="ChatBubbleLeftIcon" size={16} /> {carnet.comments_count} commentaires
                  </span>
                  <span className="flex items-center gap-2 text-sm text-[#5C6B5E]">
                    <Icon name="BookmarkIcon" size={16} /> {carnet.favorites_count} favoris
                  </span>
                </div>

                {/* Comments desktop */}
                <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-6">
                  <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider mb-5">
                    Commentaires ({comments.length})
                  </p>
                  {comments.length === 0 ? (
                    <p className="text-sm text-[#5C6B5E] text-center py-4">Aucun commentaire. Soyez le premier !</p>
                  ) : (
                    <div className="space-y-4 mb-6">
                      {comments.map((c) => (
                        <div key={c.id} className="flex gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#E4501C]/20 flex items-center justify-center text-sm font-bold text-[#E4501C] flex-shrink-0">
                            {c.author?.full_name?.[0] ?? '?'}
                          </div>
                          <div className="flex-1 bg-white rounded-xl p-4">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-bold text-[#1C2620]">{c.author?.full_name ?? 'Anonyme'}</p>
                              <p className="text-[10px] text-[#5C6B5E]">{new Date(c.created_at).toLocaleDateString('fr-FR')}</p>
                            </div>
                            <p className="text-sm text-[#5C6B5E]">{c.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {user ? (
                    <div className="flex gap-3">
                      <input
                        className="comment-input flex-1 bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30"
                        placeholder="Écrire un commentaire..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment(); } }}
                      />
                      <button onClick={handleSubmitComment} disabled={submitting || !newComment.trim()} className="px-4 py-2.5 bg-[#E4501C] text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-[#E4501C]/90 transition-colors">
                        {submitting ? '...' : 'Envoyer'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-center text-[#5C6B5E] py-2">
                      <Link href="/connexion" className="text-[#E4501C] hover:underline">Connectez-vous</Link> pour commenter
                    </p>
                  )}
                </div>

                {/* Other carnets */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display font-bold text-[#1C2620] text-lg">Autres carnets</h2>
                    <Link href="/carnets" className="text-xs text-[#E4501C] hover:underline">Voir tout →</Link>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {FAKE_CARNETS.filter((c) => c.id !== carnetId).slice(0, 3).map((c) => (
                      <Link key={c.id} href={`/carnets/${c.id}`} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl overflow-hidden hover:shadow-md hover:border-[#E4501C]/30 transition-all group">
                        <div className="relative h-32 overflow-hidden bg-[#C8C3B0]">
                          {c.cover_image && (
                            <Image src={c.cover_image} alt={c.cover_image_alt || c.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                          <div className="absolute bottom-2 left-3 right-3">
                            <p className="text-[10px] text-white/60 font-mono">{c.destination}</p>
                            <p className="font-display font-bold text-white text-xs line-clamp-1">{c.title}</p>
                          </div>
                        </div>
                        <div className="p-3 flex items-center justify-between">
                          <span className="text-xs text-[#5C6B5E]">{c.author?.full_name}</span>
                          <span className="font-mono font-bold text-[#E4501C] text-xs">{c.route_rating}/10</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <div className="hidden md:block">
        <Footer />
      </div>
    </div>
  );
}
