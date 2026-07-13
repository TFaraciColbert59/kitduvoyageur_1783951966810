'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
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
  visibility: 'public' | 'private' | 'friends';
  tags: string[];
  map_points: MapPoint[];
  is_collaborative: boolean;
  likes_count: number;
  comments_count: number;
  favorites_count: number;
  views_count: number;
  verified: boolean;
  created_at: string;
  author?: { full_name: string; avatar_url: string; trust_score: number };
  user_liked?: boolean;
  user_favorited?: boolean;
  user_reaction?: string;
}

interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  day?: number;
}

interface Comment {
  id: string;
  carnet_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: { full_name: string; avatar_url: string };
}

interface CarnetForm {
  title: string;
  destination: string;
  description: string;
  cover_image: string;
  start_date: string;
  end_date: string;
  weather: string;
  route_rating: number;
  visibility: 'public' | 'private' | 'friends';
  tags: string;
  is_collaborative: boolean;
}

const EMPTY_FORM: CarnetForm = {
  title: '',
  destination: '',
  description: '',
  cover_image: '',
  start_date: '',
  end_date: '',
  weather: '',
  route_rating: 8,
  visibility: 'public',
  tags: '',
  is_collaborative: false,
};

const VISIBILITY_OPTS = [
  { value: 'public', label: '🌍 Public', desc: 'Visible par tous' },
  { value: 'friends', label: '👥 Amis', desc: 'Visible par vos abonnés' },
  { value: 'private', label: '🔒 Privé', desc: 'Visible uniquement par vous' },
];

const REACTION_OPTS = [
  { key: 'useful', emoji: '🎒', label: 'Utile' },
  { key: 'security', emoji: '🛡️', label: 'Sécurité' },
  { key: 'bag', emoji: '⚖️', label: 'Léger' },
  { key: 'fire', emoji: '🔥', label: 'Incroyable' },
  { key: 'heart', emoji: '❤️', label: 'Coup de cœur' },
];

// ─── Modal: Create / Edit ─────────────────────────────────────────────────────
function CarnetModal({
  open,
  onClose,
  onSave,
  initial,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (form: CarnetForm) => void;
  initial?: CarnetForm;
  saving: boolean;
}) {
  const [form, setForm] = useState<CarnetForm>(initial ?? EMPTY_FORM);
  useEffect(() => { setForm(initial ?? EMPTY_FORM); }, [initial, open]);

  if (!open) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set = (k: keyof CarnetForm, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between p-6 border-b border-[#C8C3B0]">
          <h2 className="font-display font-700 text-[#1C2620] text-xl">
            {initial ? 'Modifier le carnet' : 'Nouveau carnet d\'expédition'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#C8C3B0]/40 transition-colors">
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs font-700 text-[#5C6B5E] uppercase tracking-wider block mb-1.5">Titre *</label>
            <input className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30" placeholder="Ex: Circuit des Annapurnas — 18 jours" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-700 text-[#5C6B5E] uppercase tracking-wider block mb-1.5">Destination *</label>
            <input className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30" placeholder="Ex: Népal, Corse, Islande..." value={form.destination} onChange={(e) => set('destination', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-700 text-[#5C6B5E] uppercase tracking-wider block mb-1.5">Date de départ</label>
              <input type="date" className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-700 text-[#5C6B5E] uppercase tracking-wider block mb-1.5">Date de retour</label>
              <input type="date" className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-700 text-[#5C6B5E] uppercase tracking-wider block mb-1.5">Description</label>
            <textarea rows={4} className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30 resize-none" placeholder="Décrivez votre expédition, les conditions, les moments forts..." value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-700 text-[#5C6B5E] uppercase tracking-wider block mb-1.5">URL de la photo de couverture</label>
            <input className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30" placeholder="https://..." value={form.cover_image} onChange={(e) => set('cover_image', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-700 text-[#5C6B5E] uppercase tracking-wider block mb-1.5">Météo</label>
              <input className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30" placeholder="Ex: Ensoleillé, tempête J5..." value={form.weather} onChange={(e) => set('weather', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-700 text-[#5C6B5E] uppercase tracking-wider block mb-1.5">Note parcours ({form.route_rating}/10)</label>
              <input type="range" min={1} max={10} step={0.1} className="w-full mt-2 accent-[#E4501C]" value={form.route_rating} onChange={(e) => set('route_rating', parseFloat(e.target.value))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-700 text-[#5C6B5E] uppercase tracking-wider block mb-1.5">Tags (séparés par des virgules)</label>
            <input className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30" placeholder="himalaya, autonomie, haute-altitude..." value={form.tags} onChange={(e) => set('tags', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-700 text-[#5C6B5E] uppercase tracking-wider block mb-2">Visibilité</label>
            <div className="grid grid-cols-3 gap-2">
              {VISIBILITY_OPTS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => set('visibility', opt.value)} className={`p-3 rounded-xl border-2 text-left transition-all ${form.visibility === opt.value ? 'border-[#E4501C] bg-[#E4501C]/5' : 'border-[#C8C3B0] hover:border-[#E4501C]/40'}`}>
                  <p className="text-sm font-600 text-[#1C2620]">{opt.label}</p>
                  <p className="text-[10px] text-[#5C6B5E] mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-[#C8C3B0]">
            <div>
              <p className="text-sm font-600 text-[#1C2620]">Carnet collaboratif</p>
              <p className="text-xs text-[#5C6B5E]">Permettre à d&apos;autres membres de contribuer</p>
            </div>
            <button type="button" onClick={() => set('is_collaborative', !form.is_collaborative)} className={`w-12 h-6 rounded-full transition-all relative ${form.is_collaborative ? 'bg-[#E4501C]' : 'bg-[#C8C3B0]'}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.is_collaborative ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-[#C8C3B0]">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#C8C3B0] text-sm font-600 text-[#5C6B5E] hover:bg-[#C8C3B0]/20 transition-colors">Annuler</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.title.trim() || !form.destination.trim()} className="flex-1 py-2.5 rounded-xl bg-[#E4501C] text-white text-sm font-700 hover:bg-[#E4501C]/90 transition-colors disabled:opacity-50">
            {saving ? 'Enregistrement...' : initial ? 'Mettre à jour' : 'Publier le carnet'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Full Detail ───────────────────────────────────────────────────────
function CarnetDetailModal({
  carnet,
  onClose,
  onEdit,
  onDelete,
  onLike,
  onFavorite,
  currentUserId,
}: {
  carnet: Carnet | null;
  onClose: () => void;
  onEdit: (c: Carnet) => void;
  onDelete: (c: Carnet) => void;
  onLike: (c: Carnet, reaction: string) => void;
  onFavorite: (c: Carnet) => void;
  currentUserId?: string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!carnet) return;
    setLoadingComments(true);
    supabase
      .from('carnet_comments')
      .select('*, author:user_profiles(full_name, avatar_url)')
      .eq('carnet_id', carnet.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setComments((data as Comment[]) ?? []);
        setLoadingComments(false);
      });
  }, [carnet, supabase]);

  const handleSubmitComment = async () => {
    if (!user || !carnet || !newComment.trim()) return;
    setSubmitting(true);
    const { data } = await supabase
      .from('carnet_comments')
      .insert({ carnet_id: carnet.id, author_id: user.id, content: newComment.trim() })
      .select('*, author:user_profiles(full_name, avatar_url)')
      .single();
    if (data) setComments((prev) => [...prev, data as Comment]);
    setNewComment('');
    setSubmitting(false);
  };

  if (!carnet) return null;

  const isOwner = currentUserId === carnet.author_id;
  const durationDays = carnet.start_date && carnet.end_date
    ? Math.ceil((new Date(carnet.end_date).getTime() - new Date(carnet.start_date).getTime()) / 86400000)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl w-full max-w-3xl my-4 overflow-hidden">
        {/* Cover Hero */}
        <div className="relative h-64 overflow-hidden bg-[#1C2620]">
          {carnet.cover_image ? (
            <Image src={carnet.cover_image} alt={carnet.cover_image_alt || carnet.title} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-7xl">🗺️</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          {/* Top actions */}
          <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
            {carnet.verified && <span className="text-[10px] bg-emerald-500 text-white px-2.5 py-1 rounded-full font-700">✓ Vérifié</span>}
            {carnet.is_collaborative && <span className="text-[10px] bg-blue-500 text-white px-2.5 py-1 rounded-full font-700">👥 Collaboratif</span>}
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-700 ${carnet.visibility === 'public' ? 'bg-white/20 text-white' : carnet.visibility === 'friends' ? 'bg-blue-500/80 text-white' : 'bg-gray-800/80 text-white'}`}>
              {carnet.visibility === 'public' ? '🌍 Public' : carnet.visibility === 'friends' ? '👥 Amis' : '🔒 Privé'}
            </span>
          </div>
          <div className="absolute top-4 right-4 flex gap-2">
            {isOwner && (
              <>
                <button onClick={() => { onClose(); onEdit(carnet); }} className="p-2 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/40 transition-colors">
                  <Icon name="PencilIcon" size={15} className="text-white" />
                </button>
                <button onClick={() => { onClose(); onDelete(carnet); }} className="p-2 bg-red-500/70 backdrop-blur-sm rounded-xl hover:bg-red-500 transition-colors">
                  <Icon name="TrashIcon" size={15} className="text-white" />
                </button>
              </>
            )}
            <button onClick={onClose} className="p-2 bg-black/40 backdrop-blur-sm rounded-xl hover:bg-black/60 transition-colors">
              <Icon name="XMarkIcon" size={18} className="text-white" />
            </button>
          </div>

          {/* Bottom info */}
          <div className="absolute bottom-5 left-5 right-5">
            <p className="text-[10px] font-mono text-[#E4501C] uppercase tracking-wider mb-1">{carnet.destination}</p>
            <h2 className="font-display font-800 text-white text-2xl leading-tight mb-2">{carnet.title}</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#E4501C]/30 flex items-center justify-center text-xs font-700 text-white">
                  {carnet.author?.full_name?.[0] ?? '?'}
                </div>
                <span className="text-white/80 text-sm font-500">{carnet.author?.full_name ?? 'Anonyme'}</span>
              </div>
              <span className="text-white/40">·</span>
              <span className="text-white/60 text-xs">{new Date(carnet.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="max-h-[60vh] overflow-y-auto">
          {/* Key stats */}
          <div className="grid grid-cols-5 divide-x divide-[#C8C3B0] border-b border-[#C8C3B0]">
            {[
              { label: 'Note', value: `${carnet.route_rating}/10`, icon: '⭐' },
              { label: 'Durée', value: durationDays ? `${durationDays}j` : '—', icon: '📅' },
              { label: 'Vues', value: carnet.views_count ?? 0, icon: '👁️' },
              { label: 'Réactions', value: carnet.likes_count, icon: '🎒' },
              { label: 'Favoris', value: carnet.favorites_count, icon: '🔖' },
            ].map((s) => (
              <div key={s.label} className="p-4 text-center">
                <p className="text-base mb-0.5">{s.icon}</p>
                <p className="font-display font-700 text-[#1C2620] text-sm">{s.value}</p>
                <p className="text-[10px] text-[#5C6B5E]">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="p-6 space-y-6">
            {/* Dates */}
            {(carnet.start_date || carnet.end_date) && (
              <div className="flex items-center gap-4 p-4 bg-[#1C2620] rounded-xl">
                <Icon name="CalendarDaysIcon" size={20} className="text-[#E4501C] flex-shrink-0" />
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  {carnet.start_date && (
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Départ</p>
                      <p className="text-white font-600">{new Date(carnet.start_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                  )}
                  {carnet.start_date && carnet.end_date && (
                    <div className="text-white/30 text-xl">→</div>
                  )}
                  {carnet.end_date && (
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Retour</p>
                      <p className="text-white font-600">{new Date(carnet.end_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                  )}
                  {durationDays && (
                    <div className="ml-auto">
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Durée</p>
                      <p className="font-mono font-700 text-[#E4501C] text-lg">{durationDays}j</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            {carnet.description && (
              <div>
                <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider mb-3">Récit d&apos;expédition</p>
                <p className="text-sm text-[#1C2620] leading-relaxed whitespace-pre-line">{carnet.description}</p>
              </div>
            )}

            {/* Weather */}
            {carnet.weather && (
              <div className="flex items-start gap-3 p-4 bg-[#E7E3D6] rounded-xl border border-[#C8C3B0]">
                <Icon name="CloudIcon" size={18} className="text-[#5C6B5E] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider mb-1">Conditions météo</p>
                  <p className="text-sm text-[#1C2620]">{carnet.weather}</p>
                </div>
              </div>
            )}

            {/* Map points */}
            {carnet.map_points?.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider mb-3">Points d&apos;étape</p>
                <div className="space-y-2">
                  {carnet.map_points.map((point, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-[#E7E3D6] rounded-xl border border-[#C8C3B0]">
                      <div className="w-7 h-7 rounded-lg bg-[#E4501C] flex items-center justify-center text-white text-xs font-700 flex-shrink-0">
                        {point.day ?? i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-600 text-[#1C2620]">{point.label}</p>
                        <p className="text-[10px] text-[#5C6B5E] font-mono">{point.lat.toFixed(4)}, {point.lng.toFixed(4)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {carnet.tags?.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {carnet.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-[#1C2620] text-white/70 px-3 py-1.5 rounded-full">#{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 py-3 border-t border-[#C8C3B0]">
              {/* Reactions */}
              <div className="relative">
                <button
                  onClick={() => setShowReactions(!showReactions)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-600 border transition-all ${carnet.user_liked ? 'bg-[#E4501C]/10 border-[#E4501C]/30 text-[#E4501C]' : 'border-[#C8C3B0] text-[#5C6B5E] hover:border-[#E4501C]/30'}`}
                >
                  {carnet.user_reaction ? REACTION_OPTS.find((r) => r.key === carnet.user_reaction)?.emoji : '🎒'}
                  <span>{carnet.likes_count} réactions</span>
                </button>
                {showReactions && (
                  <div className="absolute bottom-full left-0 mb-2 bg-white border border-[#C8C3B0] rounded-xl p-2 flex gap-1 shadow-lg z-10">
                    {REACTION_OPTS.map((r) => (
                      <button key={r.key} onClick={() => { onLike(carnet, r.key); setShowReactions(false); }} title={r.label} className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg hover:bg-[#E7E3D6] transition-colors ${carnet.user_reaction === r.key ? 'bg-[#E4501C]/10' : ''}`}>
                        {r.emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Favorite */}
              <button
                onClick={() => onFavorite(carnet)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-600 border transition-all ${carnet.user_favorited ? 'bg-amber-50 border-amber-300 text-amber-600' : 'border-[#C8C3B0] text-[#5C6B5E] hover:border-amber-300'}`}
              >
                <Icon name={carnet.user_favorited ? 'BookmarkSolidIcon' : 'BookmarkIcon'} size={15} />
                {carnet.favorites_count} favoris
              </button>

              {/* Author link */}
              {carnet.author_id && (
                <Link href={`/profil/${carnet.author_id}`} className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-600 border border-[#C8C3B0] text-[#5C6B5E] hover:text-[#1C2620] transition-all">
                  <Icon name="UserCircleIcon" size={15} />
                  Voir le profil
                </Link>
              )}
            </div>

            {/* Comments */}
            <div>
              <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider mb-3">
                Commentaires ({carnet.comments_count})
              </p>
              {loadingComments ? (
                <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-14 bg-[#C8C3B0]/30 rounded-xl animate-pulse" />)}</div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-[#5C6B5E] text-center py-4">Aucun commentaire. Soyez le premier !</p>
              ) : (
                <div className="space-y-3 mb-4">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#E4501C]/20 flex items-center justify-center text-xs font-700 text-[#E4501C] flex-shrink-0">
                        {c.author?.full_name?.[0] ?? '?'}
                      </div>
                      <div className="flex-1 bg-white rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-700 text-[#1C2620]">{c.author?.full_name ?? 'Anonyme'}</p>
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
                    className="flex-1 bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30"
                    placeholder="Écrire un commentaire..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment(); } }}
                  />
                  <button onClick={handleSubmitComment} disabled={submitting || !newComment.trim()} className="px-4 py-2.5 bg-[#E4501C] text-white rounded-xl text-sm font-600 disabled:opacity-50 hover:bg-[#E4501C]/90 transition-colors">
                    {submitting ? '...' : 'Envoyer'}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-center text-[#5C6B5E] py-2">
                  <Link href="/connexion" className="text-[#E4501C] hover:underline">Connectez-vous</Link> pour commenter
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Delete confirm ────────────────────────────────────────────────────
function DeleteModal({ open, onClose, onConfirm, deleting }: { open: boolean; onClose: () => void; onConfirm: () => void; deleting: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-6 max-w-sm w-full">
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-3">
            <Icon name="TrashIcon" size={24} className="text-red-500" />
          </div>
          <h3 className="font-display font-700 text-[#1C2620] text-lg mb-1">Supprimer ce carnet ?</h3>
          <p className="text-sm text-[#5C6B5E]">Cette action est irréversible. Tous les commentaires et réactions seront supprimés.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#C8C3B0] text-sm font-600 text-[#5C6B5E] hover:bg-[#C8C3B0]/20 transition-colors">Annuler</button>
          <button onClick={onConfirm} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-700 hover:bg-red-600 transition-colors disabled:opacity-50">
            {deleting ? 'Suppression...' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Carnet Card ──────────────────────────────────────────────────────────────
function CarnetCard({
  carnet,
  currentUserId,
  onViewDetail,
  onEdit,
  onDelete,
  onLike,
  onFavorite,
  onShare,
}: {
  carnet: Carnet;
  currentUserId?: string;
  onViewDetail: (c: Carnet) => void;
  onEdit: (c: Carnet) => void;
  onDelete: (c: Carnet) => void;
  onLike: (c: Carnet, reaction: string) => void;
  onFavorite: (c: Carnet) => void;
  onShare: (c: Carnet) => void;
}) {
  const [showReactions, setShowReactions] = useState(false);
  const isOwner = currentUserId === carnet.author_id;
  const durationDays = carnet.start_date && carnet.end_date
    ? Math.ceil((new Date(carnet.end_date).getTime() - new Date(carnet.start_date).getTime()) / 86400000)
    : null;

  return (
    <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
      {/* Cover — clickable to open detail */}
      <button onClick={() => onViewDetail(carnet)} className="w-full relative h-52 overflow-hidden bg-[#C8C3B0] block">
        {carnet.cover_image ? (
          <Image src={carnet.cover_image} alt={carnet.cover_image_alt || carnet.title} fill className="object-cover hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🗺️</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        {/* Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2 flex-wrap">
          {carnet.verified && <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-700">✓ Vérifié</span>}
          {carnet.is_collaborative && <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-700">👥 Collaboratif</span>}
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-700 ${carnet.visibility === 'public' ? 'bg-white/20 text-white' : carnet.visibility === 'friends' ? 'bg-blue-500/80 text-white' : 'bg-gray-800/80 text-white'}`}>
            {carnet.visibility === 'public' ? '🌍' : carnet.visibility === 'friends' ? '👥' : '🔒'} {carnet.visibility}
          </span>
        </div>
        {/* Owner actions */}
        {isOwner && (
          <div className="absolute top-3 right-3 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button onClick={(e) => { e.stopPropagation(); onEdit(carnet); }} className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/40 transition-colors">
              <Icon name="PencilIcon" size={14} className="text-white" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(carnet); }} className="p-1.5 bg-red-500/80 backdrop-blur-sm rounded-lg hover:bg-red-500 transition-colors">
              <Icon name="TrashIcon" size={14} className="text-white" />
            </button>
          </div>
        )}
        {/* Bottom info */}
        <div className="absolute bottom-3 left-4 right-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-white/70 font-mono font-600">{carnet.destination}</span>
            {durationDays && <span className="text-[10px] text-white/60">· {durationDays}j</span>}
          </div>
          <h3 className="font-display font-700 text-white text-base leading-tight line-clamp-2">{carnet.title}</h3>
        </div>
        {/* View detail hint */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2">
            <Icon name="EyeIcon" size={16} className="text-white" />
            <span className="text-white text-sm font-600">Voir les détails</span>
          </div>
        </div>
      </button>

      {/* Body */}
      <div className="p-4">
        {/* Author */}
        <div className="flex items-center gap-3 mb-3">
          <Link href={`/profil/${carnet.author_id}`} className="w-8 h-8 rounded-xl bg-[#E4501C]/20 flex items-center justify-center text-xs font-700 text-[#E4501C] flex-shrink-0 hover:bg-[#E4501C]/30 transition-colors">
            {carnet.author?.full_name?.[0] ?? '?'}
          </Link>
          <div className="flex-1 min-w-0">
            <Link href={`/profil/${carnet.author_id}`} className="text-sm font-600 text-[#1C2620] truncate hover:text-[#E4501C] transition-colors block">{carnet.author?.full_name ?? 'Anonyme'}</Link>
            <p className="text-[10px] text-[#5C6B5E]">Trust {carnet.author?.trust_score ?? 0}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-mono font-700 text-[#E4501C] text-sm">{carnet.route_rating}/10</p>
            <p className="text-[10px] text-[#5C6B5E]">parcours</p>
          </div>
        </div>

        {/* Excerpt */}
        {carnet.description && (
          <p className="text-sm text-[#5C6B5E] mb-3 line-clamp-2">{carnet.description}</p>
        )}

        {/* Weather */}
        {carnet.weather && (
          <div className="flex items-center gap-1.5 text-xs text-[#5C6B5E] mb-3 bg-[#E7E3D6] rounded-xl px-3 py-2">
            <Icon name="CloudIcon" size={12} />
            <span className="truncate">{carnet.weather}</span>
          </div>
        )}

        {/* Tags */}
        {carnet.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {carnet.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="text-[10px] bg-[#E7E3D6] text-[#5C6B5E] px-2 py-0.5 rounded-full">#{tag}</span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-[#C8C3B0]/50">
          {/* Reactions */}
          <div className="relative">
            <button
              onClick={() => setShowReactions(!showReactions)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-600 border transition-all ${carnet.user_liked ? 'bg-[#E4501C]/10 border-[#E4501C]/30 text-[#E4501C]' : 'border-[#C8C3B0] text-[#5C6B5E] hover:border-[#E4501C]/30'}`}
            >
              {carnet.user_reaction ? REACTION_OPTS.find((r) => r.key === carnet.user_reaction)?.emoji : '🎒'}
              <span>{carnet.likes_count}</span>
            </button>
            {showReactions && (
              <div className="absolute bottom-full left-0 mb-2 bg-white border border-[#C8C3B0] rounded-xl p-2 flex gap-1 shadow-lg z-10">
                {REACTION_OPTS.map((r) => (
                  <button key={r.key} onClick={() => { onLike(carnet, r.key); setShowReactions(false); }} title={r.label} className={`w-8 h-8 rounded-lg flex items-center justify-center text-base hover:bg-[#E7E3D6] transition-colors ${carnet.user_reaction === r.key ? 'bg-[#E4501C]/10' : ''}`}>
                    {r.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Comments — opens detail modal */}
          <button
            onClick={() => onViewDetail(carnet)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-600 border border-[#C8C3B0] text-[#5C6B5E] hover:border-[#1C2620]/30 transition-all"
          >
            <Icon name="ChatBubbleLeftIcon" size={13} />
            <span>{carnet.comments_count}</span>
          </button>

          {/* Favorite */}
          <button
            onClick={() => onFavorite(carnet)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-600 border transition-all ${carnet.user_favorited ? 'bg-amber-50 border-amber-300 text-amber-600' : 'border-[#C8C3B0] text-[#5C6B5E] hover:border-amber-300'}`}
          >
            <Icon name={carnet.user_favorited ? 'BookmarkSolidIcon' : 'BookmarkIcon'} size={13} />
            <span>{carnet.favorites_count}</span>
          </button>

          {/* View detail */}
          <button
            onClick={() => onViewDetail(carnet)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-600 bg-[#1C2620] text-white hover:bg-[#1C2620]/80 transition-all"
          >
            <Icon name="EyeIcon" size={13} />
            Détails
          </button>

          {/* Share */}
          <button
            onClick={() => onShare(carnet)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-600 border border-[#C8C3B0] text-[#5C6B5E] hover:border-[#1C2620]/30 transition-all"
          >
            <Icon name="ShareIcon" size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CarnetsPage() {
  const [carnets, setCarnets] = useState<Carnet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'mine' | 'favorites'>('all');
  const [search, setSearch] = useState('');

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editCarnet, setEditCarnet] = useState<Carnet | null>(null);
  const [deleteCarnet, setDeleteCarnet] = useState<Carnet | null>(null);
  const [detailCarnet, setDetailCarnet] = useState<Carnet | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadCarnets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('carnets')
        .select('*, author:user_profiles(full_name, avatar_url, trust_score)')
        .order('created_at', { ascending: false });

      if (filter === 'mine' && user) {
        query = query.eq('author_id', user.id);
      } else if (filter === 'favorites' && user) {
        const { data: favs } = await supabase.from('carnet_favorites').select('carnet_id').eq('user_id', user.id);
        const ids = favs?.map((f) => f.carnet_id) ?? [];
        if (ids.length === 0) { setCarnets([]); setLoading(false); return; }
        query = query.in('id', ids);
      } else {
        query = query.eq('visibility', 'public');
      }

      const { data, error: qErr } = await query;
      if (qErr) throw qErr;

      let likedIds: string[] = [];
      let favIds: string[] = [];
      let reactions: Record<string, string> = {};

      if (user) {
        const [likesResult, favsResult] = await Promise.all([
          supabase.from('carnet_likes').select('carnet_id, reaction').eq('user_id', user.id),
          supabase.from('carnet_favorites').select('carnet_id').eq('user_id', user.id),
        ]);
        const likesData = likesResult.data;
        const favs = favsResult.data;
        likedIds = (likesData as Array<{ carnet_id: string; reaction: string }> | null)?.map((l) => l.carnet_id) ?? [];
        favIds = (favs as Array<{ carnet_id: string }> | null)?.map((f) => f.carnet_id) ?? [];
        reactions = Object.fromEntries(((likesData as Array<{ carnet_id: string; reaction: string }> | null) ?? []).map((l) => [l.carnet_id, l.reaction]));
      }

      setCarnets(
        (data ?? []).map((c) => ({
          ...c,
          map_points: Array.isArray(c.map_points) ? c.map_points : [],
          user_liked: likedIds.includes(c.id),
          user_favorited: favIds.includes(c.id),
          user_reaction: reactions[c.id],
        }))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [supabase, user, filter]);

  useEffect(() => { loadCarnets(); }, [loadCarnets]);

  const handleSave = async (form: CarnetForm) => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        destination: form.destination,
        description: form.description,
        cover_image: form.cover_image,
        cover_image_alt: form.title,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        weather: form.weather,
        route_rating: form.route_rating,
        visibility: form.visibility,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        is_collaborative: form.is_collaborative,
        author_id: user.id,
      };

      if (editCarnet) {
        const { error: uErr } = await supabase.from('carnets').update(payload).eq('id', editCarnet.id);
        if (uErr) throw uErr;
        showToast('Carnet mis à jour !');
      } else {
        const { error: iErr } = await supabase.from('carnets').insert(payload);
        if (iErr) throw iErr;
        showToast('Carnet publié !');
      }
      setShowCreate(false);
      setEditCarnet(null);
      await loadCarnets();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteCarnet) return;
    setDeleting(true);
    await supabase.from('carnets').delete().eq('id', deleteCarnet.id);
    setDeleteCarnet(null);
    setDeleting(false);
    showToast('Carnet supprimé');
    await loadCarnets();
  };

  const handleLike = async (carnet: Carnet, reaction: string) => {
    if (!user) { showToast('Connectez-vous pour réagir'); return; }
    if (carnet.user_liked && carnet.user_reaction === reaction) {
      await supabase.from('carnet_likes').delete().eq('carnet_id', carnet.id).eq('user_id', user.id);
      await supabase.from('carnets').update({ likes_count: Math.max(0, carnet.likes_count - 1) }).eq('id', carnet.id);
      setCarnets((prev) => prev.map((c) => c.id === carnet.id ? { ...c, user_liked: false, user_reaction: undefined, likes_count: Math.max(0, c.likes_count - 1) } : c));
      if (detailCarnet?.id === carnet.id) setDetailCarnet((prev) => prev ? { ...prev, user_liked: false, user_reaction: undefined, likes_count: Math.max(0, prev.likes_count - 1) } : null);
    } else {
      await supabase.from('carnet_likes').upsert({ carnet_id: carnet.id, user_id: user.id, reaction }, { onConflict: 'carnet_id,user_id' });
      if (!carnet.user_liked) {
        await supabase.from('carnets').update({ likes_count: carnet.likes_count + 1 }).eq('id', carnet.id);
        setCarnets((prev) => prev.map((c) => c.id === carnet.id ? { ...c, user_liked: true, user_reaction: reaction, likes_count: c.likes_count + 1 } : c));
        if (detailCarnet?.id === carnet.id) setDetailCarnet((prev) => prev ? { ...prev, user_liked: true, user_reaction: reaction, likes_count: prev.likes_count + 1 } : null);
      } else {
        setCarnets((prev) => prev.map((c) => c.id === carnet.id ? { ...c, user_reaction: reaction } : c));
        if (detailCarnet?.id === carnet.id) setDetailCarnet((prev) => prev ? { ...prev, user_reaction: reaction } : null);
      }
    }
  };

  const handleFavorite = async (carnet: Carnet) => {
    if (!user) { showToast('Connectez-vous pour sauvegarder'); return; }
    if (carnet.user_favorited) {
      await supabase.from('carnet_favorites').delete().eq('carnet_id', carnet.id).eq('user_id', user.id);
      await supabase.from('carnets').update({ favorites_count: Math.max(0, carnet.favorites_count - 1) }).eq('id', carnet.id);
      setCarnets((prev) => prev.map((c) => c.id === carnet.id ? { ...c, user_favorited: false, favorites_count: Math.max(0, c.favorites_count - 1) } : c));
      if (detailCarnet?.id === carnet.id) setDetailCarnet((prev) => prev ? { ...prev, user_favorited: false, favorites_count: Math.max(0, prev.favorites_count - 1) } : null);
      showToast('Retiré des favoris');
    } else {
      await supabase.from('carnet_favorites').insert({ carnet_id: carnet.id, user_id: user.id });
      await supabase.from('carnets').update({ favorites_count: carnet.favorites_count + 1 }).eq('id', carnet.id);
      setCarnets((prev) => prev.map((c) => c.id === carnet.id ? { ...c, user_favorited: true, favorites_count: c.favorites_count + 1 } : c));
      if (detailCarnet?.id === carnet.id) setDetailCarnet((prev) => prev ? { ...prev, user_favorited: true, favorites_count: prev.favorites_count + 1 } : null);
      showToast('Ajouté aux favoris ⭐');
    }
  };

  const handleShare = (carnet: Carnet) => {
    const url = `${window.location.origin}/carnets`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      showToast('Lien copié dans le presse-papier !');
    }
  };

  const filtered = carnets.filter((c) =>
    !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.destination.toLowerCase().includes(search.toLowerCase())
  );

  const editForm: CarnetForm | undefined = editCarnet ? {
    title: editCarnet.title,
    destination: editCarnet.destination,
    description: editCarnet.description,
    cover_image: editCarnet.cover_image,
    start_date: editCarnet.start_date ?? '',
    end_date: editCarnet.end_date ?? '',
    weather: editCarnet.weather,
    route_rating: editCarnet.route_rating,
    visibility: editCarnet.visibility,
    tags: editCarnet.tags?.join(', ') ?? '',
    is_collaborative: editCarnet.is_collaborative,
  } : undefined;

  return (
    <div className="min-h-screen bg-[#E7E3D6] text-[#1C2620]">
      <Header />

      {/* Hero */}
      <section className="bg-[#1C2620] pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <p className="text-[10px] font-mono text-[#E4501C] tracking-[0.2em] uppercase mb-2">Communauté</p>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <h1 className="font-display font-800 text-white text-3xl tracking-tight mb-2">
                Carnets d&apos;expédition
              </h1>
              <p className="text-white/50 text-sm max-w-xl">
                Partagez vos aventures, découvrez les récits de la communauté, réagissez et sauvegardez vos inspirations.
              </p>
            </div>
            <button
              onClick={() => { setEditCarnet(null); setShowCreate(true); }}
              className="flex items-center gap-2 px-5 py-3 bg-[#E4501C] text-white rounded-xl font-700 text-sm hover:bg-[#E4501C]/90 transition-colors self-start lg:self-auto"
            >
              <Icon name="PlusIcon" size={16} />
              Nouveau carnet
            </button>
          </div>
        </div>
      </section>

      {/* Filters */}
      <div className="sticky top-16 z-30 bg-[#1C2620]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-0 overflow-x-auto">
            {[
              { id: 'all', label: 'Tous les carnets', icon: 'GlobeAltIcon' },
              { id: 'mine', label: 'Mes carnets', icon: 'UserIcon' },
              { id: 'favorites', label: 'Mes favoris', icon: 'BookmarkIcon' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as typeof filter)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-600 border-b-2 transition-all whitespace-nowrap ${filter === tab.id ? 'border-[#E4501C] text-[#E4501C]' : 'border-transparent text-white/50 hover:text-white'}`}
              >
                <Icon name={tab.icon} size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="mb-6 relative">
          <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5C6B5E]" />
          <input
            className="w-full bg-[#EDEAE0] border border-[#C8C3B0] rounded-xl pl-10 pr-4 py-3 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30"
            placeholder="Rechercher par titre ou destination..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🗺️</div>
            <p className="font-display font-700 text-[#1C2620] text-xl mb-2">
              {filter === 'mine' ? 'Aucun carnet publié' : filter === 'favorites' ? 'Aucun favori' : 'Aucun carnet trouvé'}
            </p>
            <p className="text-[#5C6B5E] text-sm mb-6">
              {filter === 'mine' ? 'Partagez votre première expédition !' : 'Explorez les carnets de la communauté et sauvegardez vos inspirations.'}
            </p>
            {filter === 'mine' && (
              <button
                onClick={() => { setEditCarnet(null); setShowCreate(true); }}
                className="px-6 py-3 bg-[#E4501C] text-white rounded-xl font-700 text-sm hover:bg-[#E4501C]/90 transition-colors"
              >
                Créer mon premier carnet
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map((c) => (
              <CarnetCard
                key={c.id}
                carnet={c}
                currentUserId={user?.id}
                onViewDetail={setDetailCarnet}
                onEdit={(c) => { setEditCarnet(c); setShowCreate(true); }}
                onDelete={setDeleteCarnet}
                onLike={handleLike}
                onFavorite={handleFavorite}
                onShare={handleShare}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <CarnetModal
        open={showCreate}
        onClose={() => { setShowCreate(false); setEditCarnet(null); }}
        onSave={handleSave}
        initial={editForm}
        saving={saving}
      />
      <CarnetDetailModal
        carnet={detailCarnet}
        onClose={() => setDetailCarnet(null)}
        onEdit={(c) => { setDetailCarnet(null); setEditCarnet(c); setShowCreate(true); }}
        onDelete={(c) => { setDetailCarnet(null); setDeleteCarnet(c); }}
        onLike={handleLike}
        onFavorite={handleFavorite}
        currentUserId={user?.id}
      />
      <DeleteModal
        open={!!deleteCarnet}
        onClose={() => setDeleteCarnet(null)}
        onConfirm={handleDelete}
        deleting={deleting}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1C2620] text-white px-5 py-3 rounded-xl text-sm font-600 shadow-xl">
          {toast}
        </div>
      )}

      <Footer />
    </div>
  );
}

export const dynamic = 'force-dynamic';
