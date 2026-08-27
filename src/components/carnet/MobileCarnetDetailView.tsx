'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import GlassIconButton from '@/components/ui/GlassIconButton';
import CarnetMap from '@/components/carnet/CarnetMap';
import TimelineJours from '@/components/carnet/TimelineJours';
import MomentCard from '@/components/carnet/MomentCard';
import KitSouvenirCard from '@/components/carnet/KitSouvenirCard';
import SpeciesIdentifier from '@/components/carnet/SpeciesIdentifier';
import CommentsSheet, { CommentData } from '@/components/social/CommentsSheet';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { CarnetData } from '@/lib/mock/carnet-chartreuse';

interface MobileCarnetDetailViewProps {
  data: CarnetData;
  moments: any[];
  kitItems: any[];
  kitIntro: string;
  jours: any[];
  hebergements: any[];
  onDownloadGPX: () => void;
  onExport: () => void;
  distVal: number;
  elevVal: number;
}

const INITIAL_COMMENTS: CommentData[] = [
  {
    id: 'c1',
    author_name: 'Alexandre V.',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
    created_at: 'Il y a 2 jours',
    content: 'Superbe traversée ! Est-ce que le passage par le col était encore enneigé lors de votre bivouac ?',
    likes_count: 3,
    user_liked: false,
  },
  {
    id: 'c2',
    author_name: 'Sophie Martin',
    author_avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100',
    created_at: 'Il y a 1 jour',
    content: 'Merci pour le partage de la trace GPX, je la télécharge directement pour ce week-end !',
    likes_count: 5,
    user_liked: true,
  },
];

export default function MobileCarnetDetailView({
  data,
  moments = [],
  kitItems = [],
  kitIntro = '',
  jours = [],
  hebergements = [],
  onDownloadGPX,
  onExport,
  distVal,
  elevVal,
}: MobileCarnetDetailViewProps) {
  const { triggerHaptic } = useHapticFeedback();
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'map' | 'moments' | 'kit' | 'nature'>('overview');
  const [hasLiked, setHasLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(24);
  const [isSaved, setIsSaved] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentData[]>(INITIAL_COMMENTS);
  const [inlineComment, setInlineComment] = useState('');

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('carnet-detail-tab-change', handler);
    return () => window.removeEventListener('carnet-detail-tab-change', handler);
  }, []);

  const metaAny = (data.meta || {}) as any;
  const coverUrl =
    metaAny.coverImage ||
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80';

  const dateRange = data.meta?.dateRange || 'Automne 2026';

  const handleToggleLike = () => {
    triggerHaptic('selection');
    if (hasLiked) {
      setHasLiked(false);
      setLikesCount((prev) => Math.max(0, prev - 1));
    } else {
      setHasLiked(true);
      setLikesCount((prev) => prev + 1);
      toast('Merci pour votre réaction ! ❤️', 'success');
    }
  };

  const handleToggleSave = () => {
    triggerHaptic('selection');
    setIsSaved(!isSaved);
    toast(isSaved ? 'Retiré des favoris' : 'Enregistré dans vos favoris ⭐', 'success');
  };

  const handleAddComment = (content: string, replyToId?: string) => {
    triggerHaptic('selection');
    const newEntry: CommentData = {
      id: `c_${Date.now()}`,
      author_name: user?.user_metadata?.full_name || 'Moi (Voyageur)',
      author_avatar: user?.user_metadata?.avatar_url,
      created_at: "À l'instant",
      content,
      reply_to_id: replyToId,
      likes_count: 0,
      user_liked: false,
    };
    setComments((prev) => [newEntry, ...prev]);
    toast('Commentaire publié avec succès !', 'success');
  };

  const handleLikeComment = (commentId: string, liked?: boolean) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          const nextLiked = liked !== undefined ? liked : !c.user_liked;
          const currentCount = c.likes_count || 0;
          return {
            ...c,
            user_liked: nextLiked,
            likes_count: nextLiked ? currentCount + 1 : Math.max(0, currentCount - 1),
          };
        }
        return c;
      })
    );
  };

  const handleDeleteComment = (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId && c.reply_to_id !== commentId));
    toast('Commentaire supprimé', 'success');
  };

  const handleInlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineComment.trim()) return;
    handleAddComment(inlineComment.trim());
    setInlineComment('');
  };

  return (
    <div className="md:hidden min-h-screen bg-transparent pb-[calc(140px+env(safe-area-inset-bottom,0px))] text-[#17402C]">
      {/* IMMERSIVE COVER HERO */}
      <div className="relative w-full h-64 sm:h-72 overflow-hidden bg-[#17402C]">
        <img
          src={coverUrl}
          alt={data.meta?.titleLine1 || 'Carnet'}
          className="w-full h-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#17402C] via-[#17402C]/60 to-black/30" />

        {/* Top Controls */}
        <div
          className="absolute left-4 right-4 flex items-center justify-between z-10"
          style={{ top: 'calc(max(env(safe-area-inset-top, 0px), 14px) + 8px)' }}
        >
          <Link
            href="/carnets"
            onClick={() => triggerHaptic('light')}
            className="glass-circle-btn !w-10 !h-10 !text-[#17402C] !bg-white/95 !border-white shadow-md flex items-center justify-center font-bold text-lg active:scale-95 transition-transform"
            aria-label="Retour aux carnets"
          >
            ‹
          </Link>

          <div className="flex items-center gap-1.5 max-w-[78%]">
            <span
              className="glass-pill text-[#17402C] font-semibold border-white/90 font-mono text-[10.5px] bg-white/90 backdrop-blur-xl shadow-xs truncate px-3 py-1.5"
              title={data.meta?.itineraire}
            >
              📍 {data.meta?.itineraire || 'Expédition outdoor'}
            </span>
          </div>
        </div>

        {/* Hero Title & Destination */}
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-300 font-bold flex items-center gap-1">
              <span>📖</span> CARNET DE TERRAIN
            </span>
            <span className="text-white/70 font-mono text-[10px]">· {dateRange}</span>
          </div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white leading-tight drop-shadow-md">
            {data.meta?.titleLine1} {data.meta?.titleLine2}
          </h1>
        </div>
      </div>

      {/* STATS & AUTHOR BAR (Liquid Glass) */}
      <div className="px-4 -mt-3 relative z-20">
        <div className="glass bg-white/90 backdrop-blur-xl p-4 rounded-3xl border border-white shadow-xs flex flex-col gap-3">
          {/* Author & Full Interactive Social Actions */}
          <div className="flex items-center justify-between gap-2">
            <Link
              href={metaAny.authorId ? `/profil/${metaAny.authorId}` : '/communaute'}
              onClick={() => triggerHaptic('light')}
              className="flex items-center gap-2.5 min-w-0 group/author cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-[#17402C] text-white flex items-center justify-center font-serif italic text-sm font-bold shadow-xs overflow-hidden shrink-0 group-hover/author:scale-105 transition-transform">
                <img
                  src={metaAny.authorAvatar || (data.meta?.titleLine1?.includes('Ring Road') ? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80' : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80')}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-xs text-[#17402C] truncate group-hover/author:underline">
                  {metaAny.authorName || (data.meta?.titleLine1?.includes('Ring Road') ? 'Marie Dupont' : 'Antoine Duprès')}
                </h4>
                <p className="text-[9.5px] font-mono text-[#5C6B5E] truncate">
                  {metaAny.authorTitle || 'Guide & Explorateur LKDV'}
                </p>
              </div>
            </Link>

            {/* Social & Action Button Group Image 3 */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Like Button */}
              <GlassIconButton
                size="sm"
                onClick={handleToggleLike}
                title="Aimer ce carnet"
                count={likesCount}
                active={hasLiked}
                activeClassName="!bg-rose-50 !border-rose-200 !text-rose-600"
                icon={
                  <motion.svg
                    whileTap={{ scale: 1.3 }}
                    viewBox="0 0 24 24"
                    className="w-3.5 h-3.5"
                    fill={hasLiked ? '#E11D48' : 'none'}
                    stroke={hasLiked ? '#E11D48' : 'currentColor'}
                    strokeWidth="2"
                  >
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  </motion.svg>
                }
              />

              {/* Comment Button */}
              <GlassIconButton
                size="sm"
                onClick={() => {
                  triggerHaptic('selection');
                  setIsCommentsOpen(true);
                }}
                title="Commentaires"
                count={comments.length}
                icon={<Icon name="ChatBubbleLeftIcon" size={13} />}
              />

              {/* Bookmark Button */}
              <GlassIconButton
                size="sm"
                onClick={handleToggleSave}
                title="Enregistrer"
                active={isSaved}
                activeClassName="!bg-amber-50 !border-amber-200 !text-amber-700"
                icon={
                  <Icon
                    name="BookmarkIcon"
                    size={13}
                    className={isSaved ? 'text-amber-700 fill-amber-700' : ''}
                  />
                }
              />

              {/* Share Button */}
              <GlassIconButton
                size="sm"
                onClick={() => {
                  triggerHaptic('light');
                  onExport();
                }}
                title="Partager"
                icon={<Icon name="ShareIcon" size={13} />}
              />
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-[#17402C]/10 text-center">
            <div className="p-2 rounded-2xl bg-white/70 border border-white/80">
              <span className="block font-mono font-bold text-xs text-[#17402C]">{distVal} km</span>
              <span className="text-[8.5px] text-[#5C6B5E] uppercase font-mono font-bold">Distance</span>
            </div>
            <div className="p-2 rounded-2xl bg-white/70 border border-white/80">
              <span className="block font-mono font-bold text-xs text-emerald-800">+{elevVal} m</span>
              <span className="text-[8.5px] text-[#5C6B5E] uppercase font-mono font-bold">Dénivelé</span>
            </div>
            <div className="p-2 rounded-2xl bg-white/70 border border-white/80">
              <span className="block font-mono font-bold text-xs text-[#17402C]">{jours.length} jours</span>
              <span className="text-[8.5px] text-[#5C6B5E] uppercase font-mono font-bold">Durée</span>
            </div>
            <div className="p-2 rounded-2xl bg-white/70 border border-white/80">
              <span className="block font-mono font-bold text-xs text-amber-700">★ 9.4</span>
              <span className="text-[8.5px] text-[#5C6B5E] uppercase font-mono font-bold">Note</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION CONTENT WITH ANIMATED TRANSITIONS */}
      <div className="p-4 pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="space-y-4"
          >
            {/* RÉCIT / OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Récit intro */}
                <div className="glass bg-white/90 backdrop-blur-xl p-4 rounded-3xl border border-white shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="glass-pill text-[9.5px] font-mono font-bold text-emerald-900 bg-emerald-50">
                      🌿 Carnet d'expédition
                    </span>
                    <span className="text-[10px] font-mono text-[#5C6B5E]">
                      {metaAny.difficulty || 'Moyen'}
                    </span>
                  </div>

                  <p className="text-xs text-[#17402C] leading-relaxed font-sans">
                    {data.meta?.subtitleLine1
                      ? `${data.meta.subtitleLine1} ${data.meta.subtitleLine2 || ''}`
                      : "Une traversée immersive à travers des crêtes panoramiques, des nuits en bivouac sous les étoiles et la découverte d'une faune alpine préservée."}
                  </p>

                  <div className="pt-2.5 border-t border-[#17402C]/10 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        setActiveTab('map');
                      }}
                      className="flex-1 glass-capsule-btn primary !min-h-[34px] !py-1 !px-3 !text-xs !font-bold !gap-1.5"
                    >
                      <span>🗺️ Carte & GPX</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        setActiveTab('moments');
                      }}
                      className="flex-1 glass-capsule-btn !min-h-[34px] !py-1 !px-3 !text-xs !font-bold !gap-1.5"
                    >
                      <span>📷 Moments ({moments.length})</span>
                    </button>
                  </div>
                </div>

                {/* Direct Discussion & Comment Posting Card */}
                <div className="glass bg-white/90 backdrop-blur-xl p-4 rounded-3xl border border-white shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">💬</span>
                      <div>
                        <h4 className="font-display font-bold text-xs text-[#17402C]">
                          Discussions & Retours de terrain
                        </h4>
                        <p className="text-[10px] text-[#5C6B5E]">
                          {comments.length} retours de la communauté
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        setIsCommentsOpen(true);
                      }}
                      className="glass-capsule-btn !min-h-[28px] !py-0.5 !px-3 !text-[11px] !font-bold"
                    >
                      <span>Voir tout ({comments.length}) →</span>
                    </button>
                  </div>

                  {/* Direct Inline Comment Form */}
                  <form onSubmit={handleInlineSubmit} className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={inlineComment}
                      onChange={(e) => setInlineComment(e.target.value)}
                      placeholder="Poser une question à l'auteur..."
                      className="flex-1 glass bg-white/90 border border-white/80 rounded-full px-3.5 py-2 text-xs text-[#17402C] placeholder-[#5C6B5E] focus:outline-none focus:ring-1 focus:ring-[#17402C] shadow-2xs font-medium"
                    />
                    <button
                      type="submit"
                      disabled={!inlineComment.trim()}
                      className="glass-capsule-btn primary !min-h-[34px] !py-1 !px-3.5 !text-xs !font-bold disabled:opacity-40"
                    >
                      <span>Publier</span>
                    </button>
                  </form>
                </div>

                {/* Timeline Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-display font-bold text-sm text-[#17402C]">Étapes du parcours</h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('map')}
                      className="glass-capsule-btn !min-h-[28px] !py-1 !px-2.5 !text-[10px] !font-bold"
                    >
                      <span>Carte complète →</span>
                    </button>
                  </div>
                  <TimelineJours jours={jours} hebergements={hebergements} />
                </div>
              </div>
            )}

            {/* CARTE & GPX */}
            {activeTab === 'map' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-display font-bold text-sm text-[#17402C]">Trace GPS & Relief</h3>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      onDownloadGPX();
                    }}
                    className="glass-capsule-btn primary !min-h-[32px] !py-1 !px-3 !text-[11px] !font-bold !gap-1.5"
                  >
                    <span>⬇ GPX</span>
                  </button>
                </div>

                <div className="glass bg-white/90 backdrop-blur-xl p-3 rounded-3xl border border-white shadow-xs overflow-hidden">
                  <CarnetMap
                    traceGeojson={data.traceGeojson}
                    distanceKm={distVal}
                    elevationM={elevVal}
                    destination={data.meta?.itineraire || data.meta?.titleLine1}
                    onDownloadGPX={onDownloadGPX}
                  />
                </div>

                <TimelineJours jours={jours} hebergements={hebergements} />
              </div>
            )}

            {/* MOMENTS & PHOTOS */}
            {activeTab === 'moments' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-display font-bold text-sm text-[#17402C]">Moments &amp; Photographies</h3>
                  <span className="text-[10px] font-mono text-[#5C6B5E]">{moments.length} moments</span>
                </div>

                {moments.length === 0 ? (
                  <div className="py-10 text-center glass bg-white/80 p-6 rounded-3xl border border-white">
                    <span className="text-3xl block mb-1">📷</span>
                    <p className="text-xs text-[#5C6B5E]">Aucun moment photo enregistré.</p>
                  </div>
                ) : (
                  moments.map((m) => <MomentCard key={m.id} moment={m} />)
                )}
              </div>
            )}

            {/* MATÉRIEL */}
            {activeTab === 'kit' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-display font-bold text-sm text-[#17402C]">Équipement emporté</h3>
                  <span className="text-[10px] font-mono text-[#5C6B5E]">{kitItems.length} articles</span>
                </div>
                <KitSouvenirCard intro={kitIntro} items={kitItems} />
              </div>
            )}

            {/* NATURE & SCANNER */}
            {activeTab === 'nature' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-display font-bold text-sm text-[#17402C]">Biodiversité & Nature</h3>
                  <span className="glass-pill text-[9.5px] font-mono font-bold">Nature Scanner IA</span>
                </div>
                <SpeciesIdentifier />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* COMMENTS BOTTOM SHEET DRAWER */}
      <CommentsSheet
        isOpen={isCommentsOpen}
        onClose={() => setIsCommentsOpen(false)}
        title="Commentaires & Retours de terrain"
        comments={comments}
        currentUserId={user?.id}
        onAddComment={handleAddComment}
        onLikeComment={handleLikeComment}
        onDeleteComment={handleDeleteComment}
      />
    </div>
  );
}
