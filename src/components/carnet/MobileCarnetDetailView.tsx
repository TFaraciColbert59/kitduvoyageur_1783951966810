'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Card, EmptyState, IconButton } from '@/components/ui';
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
  distVal?: number;
  elevVal?: number;
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
    <div className="min-h-screen bg-transparent pb-[calc(140px+var(--safe-bottom))] text-[color:var(--lkv-text-primary)] md:hidden">
      <div className="relative h-64 w-full overflow-hidden bg-[color:var(--btn-tint)] sm:h-72">
        <img
          src={coverUrl}
          alt={data.meta?.titleLine1 || 'Carnet'}
          className="h-full w-full object-cover opacity-70"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

        <div className="absolute left-4 right-4 top-[calc(max(var(--safe-top),14px)+8px)] z-10 flex items-center justify-between">
          <Link
            href="/carnets"
            onClick={() => triggerHaptic('light')}
            className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)] shadow-elevation-2 transition-transform active:scale-95 motion-reduce:transition-none"
            aria-label="Retour aux carnets"
          >
            ‹
          </Link>

          <div className="flex max-w-[78%] items-center gap-[var(--space-1)]">
            <span className="min-w-0" title={data.meta?.itineraire}>
              <Badge className="truncate border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] border saturate-[var(--glass-sat)] lkv-rim-inset px-[var(--space-3)] py-[var(--space-1)] font-mono font-semibold text-[color:var(--lkv-text-primary)] backdrop-blur-[var(--glass-blur-sm)]">
                <Icon name="map-pin" size={11} className="inline mr-1 text-[color:var(--glass-label)]" />
                {data.meta?.itineraire || 'Expédition outdoor'}
              </Badge>
            </span>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="mb-[var(--space-1)] flex items-center gap-[var(--space-2)]">
            <span className="flex items-center gap-[var(--space-1)] font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-white/80">
              <Icon name="book-open" size={11} className="inline mr-1 text-white/80" /> CARNET DE TERRAIN
            </span>
            <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-inverted)]/70">· {dateRange}</span>
          </div>
          <h1 className="font-display text-[length:var(--lkv-text-title-sm)] font-extrabold leading-tight text-[color:var(--lkv-text-inverted)] drop-shadow-md sm:text-[length:var(--lkv-text-title-lg)]">
            {data.meta?.titleLine1} {data.meta?.titleLine2}
          </h1>
        </div>
      </div>

      <div className="relative z-20 -mt-[var(--space-3)] px-[var(--space-4)]">
        <Card className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)]">
          <div className="flex items-center justify-between gap-[var(--space-2)]">
            <Link
              href={metaAny.authorId ? `/profil/${metaAny.authorId}` : '/communaute'}
              onClick={() => triggerHaptic('light')}
              className="group/author flex min-w-0 cursor-pointer items-center gap-[var(--space-2)]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn font-serif text-[length:var(--lkv-text-caption)] font-bold italic text-[color:var(--lkv-text-primary)] transition-transform group-hover/author:scale-105 motion-reduce:transition-none">
                <img
                  src={metaAny.authorAvatar || (data.meta?.titleLine1?.includes('Ring Road') ? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80' : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80')}
                  alt={metaAny.authorName || 'Auteur du carnet'}
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="min-w-0">
                <h4 className="truncate text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)] group-hover/author:underline">
                  {metaAny.authorName || (data.meta?.titleLine1?.includes('Ring Road') ? 'Marie Dupont' : 'Antoine Duprès')}
                </h4>
                <p className="truncate font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                  {metaAny.authorTitle || 'Guide & Explorateur LKDV'}
                </p>
              </span>
            </Link>

            <div className="flex shrink-0 items-center gap-[var(--space-1)]">
              <IconButton
                size="sm"
                onClick={handleToggleLike}
                aria-label="Aimer ce carnet"
                variant={hasLiked ? 'solid' : 'glass'}
                aria-pressed={hasLiked || undefined}
                className={`w-auto px-[10px] ${hasLiked ? 'bg-[color:var(--lkv-danger-bg)] text-[color:var(--lkv-danger)]' : ''}`}
              >
                <span className="inline-flex items-center gap-[var(--space-1)]">
                  <motion.svg
                    whileTap={{ scale: 1.3 }}
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5"
                    fill={hasLiked ? 'var(--lkv-danger)' : 'none'}
                    stroke={hasLiked ? 'var(--lkv-danger)' : 'currentColor'}
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  </motion.svg>
                  <span className="tabular-nums">{likesCount}</span>
                </span>
              </IconButton>

              <IconButton
                size="sm"
                onClick={() => {
                  triggerHaptic('selection');
                  setIsCommentsOpen(true);
                }}
                aria-label="Commentaires"
                className="w-auto px-[10px]"
              >
                <span className="inline-flex items-center gap-[var(--space-1)]">
                  <Icon name="ChatBubbleLeftIcon" size={13} aria-hidden="true" />
                  <span className="tabular-nums">{comments.length}</span>
                </span>
              </IconButton>

              <IconButton
                size="sm"
                onClick={handleToggleSave}
                aria-label="Enregistrer"
                variant={isSaved ? 'solid' : 'glass'}
                aria-pressed={isSaved || undefined}
                className={isSaved ? 'bg-[color:var(--lkv-warning-bg)] text-[color:var(--lkv-warning-dark)]' : undefined}
              >
                <Icon
                  name="BookmarkIcon"
                  size={13}
                  className={isSaved ? 'fill-[color:var(--lkv-warning-dark)] text-[color:var(--lkv-warning-dark)]' : ''}
                  aria-hidden="true"
                />
              </IconButton>

              <IconButton
                size="sm"
                onClick={() => {
                  triggerHaptic('light');
                  onExport();
                }}
                aria-label="Partager"
              >
                <Icon name="ShareIcon" size={13} aria-hidden="true" />
              </IconButton>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-[var(--space-1)] border-t border-[color:var(--lkv-primary)]/10 pt-[var(--space-2)] text-center">
            <Card variant="compact" className="p-[var(--space-2)]">
              <span className="block font-mono text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">{distVal != null ? `${distVal} km` : '—'}</span>
              <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase text-[color:var(--lkv-text-muted)]">Distance</span>
            </Card>
            <Card variant="compact" className="p-[var(--space-2)]">
              <span className="block font-mono text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-forest-800)]">{elevVal != null ? `+${elevVal} m` : '—'}</span>
              <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase text-[color:var(--lkv-text-muted)]">Dénivelé</span>
            </Card>
            <Card variant="compact" className="p-[var(--space-2)]">
              <span className="block font-mono text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">{jours.length} jours</span>
              <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase text-[color:var(--lkv-text-muted)]">Durée</span>
            </Card>
            <Card variant="compact" className="p-[var(--space-2)]">
              <span className="block font-mono text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-muted)]">—</span>
              <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase text-[color:var(--lkv-text-muted)]">Note</span>
            </Card>
          </div>
        </Card>
      </div>

      <div className="p-[var(--space-4)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="space-y-[var(--space-4)]"
          >
            {activeTab === 'overview' && (
              <div className="space-y-[var(--space-4)]">
                <Card className="space-y-[var(--space-3)] p-[var(--space-4)]">
                  <div className="flex items-center justify-between">
                    <Badge tone="sage" className="font-mono font-bold">
                      🌿 Carnet d&apos;expédition
                    </Badge>
                    <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                      {metaAny.difficulty || 'Moyen'}
                    </span>
                  </div>

                  <p className="font-sans text-[length:var(--lkv-text-caption-2)] leading-relaxed text-[color:var(--lkv-text-primary)]">
                    {data.meta?.subtitleLine1
                      ? `${data.meta.subtitleLine1} ${data.meta.subtitleLine2 || ''}`
                      : "Une traversée immersive à travers des crêtes panoramiques, des nuits en bivouac sous les étoiles et la découverte d'une faune alpine préservée."}
                  </p>

                  <div className="flex items-center justify-between gap-[var(--space-2)] border-t border-[color:var(--lkv-primary)]/10 pt-[var(--space-2)]">
                    <Button
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        setActiveTab('map');
                      }}
                      className="flex-1"
                    >
                      🗺️ Carte &amp; GPX
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        triggerHaptic('selection');
                        setActiveTab('moments');
                      }}
                      className="flex-1"
                    >
                      📷 Moments ({moments.length})
                    </Button>
                  </div>
                </Card>

                <Card className="space-y-[var(--space-3)] p-[var(--space-4)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-[var(--space-2)]">
                      <span className="text-[length:var(--lkv-text-subheadline)]" aria-hidden>💬</span>
                      <div>
                        <h4 className="font-display text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">
                          Discussions &amp; Retours de terrain
                        </h4>
                        <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                          {comments.length} retours de la communauté
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        triggerHaptic('selection');
                        setIsCommentsOpen(true);
                      }}
                    >
                      Voir tout ({comments.length}) →
                    </Button>
                  </div>

                  <form onSubmit={handleInlineSubmit} className="flex items-center gap-[var(--space-2)] pt-[var(--space-1)]">
                    <input
                      type="text"
                      value={inlineComment}
                      onChange={(e) => setInlineComment(e.target.value)}
                      placeholder="Poser une question à l'auteur..."
                      aria-label="Poser une question à l'auteur"
                      className="min-h-[var(--control-height-md)] flex-1 rounded-full border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]"
                    />
                    <Button type="submit" size="sm" disabled={!inlineComment.trim()}>
                      Publier
                    </Button>
                  </form>
                </Card>

                <div className="space-y-[var(--space-2)]">
                  <div className="flex items-center justify-between px-[var(--space-1)]">
                    <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Étapes du parcours</h3>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setActiveTab('map')}
                    >
                      Carte complète →
                    </Button>
                  </div>
                  <TimelineJours jours={jours} hebergements={hebergements} />
                </div>
              </div>
            )}

            {activeTab === 'map' && (
              <div className="space-y-[var(--space-4)]">
                <div className="flex items-center justify-between px-[var(--space-1)]">
                  <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Trace GPS &amp; Relief</h3>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      triggerHaptic('selection');
                      onDownloadGPX();
                    }}
                  >
                    ⬇ GPX
                  </Button>
                </div>

                <Card className="overflow-hidden p-[var(--space-3)]">
                  <CarnetMap
                    traceGeojson={data.traceGeojson}
                    distanceKm={distVal}
                    elevationM={elevVal}
                    destination={data.meta?.itineraire || data.meta?.titleLine1}
                    onDownloadGPX={onDownloadGPX}
                  />
                </Card>

                <TimelineJours jours={jours} hebergements={hebergements} />
              </div>
            )}

            {activeTab === 'moments' && (
              <div className="space-y-[var(--space-3)]">
                <div className="flex items-center justify-between px-[var(--space-1)]">
                  <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Moments &amp; Photographies</h3>
                  <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{moments.length} moments</span>
                </div>

                {moments.length === 0 ? (
                  <Card className="p-[var(--space-6)]">
                    <EmptyState
                      icon={<Icon name="PhotoIcon" size={22} aria-hidden="true" />}
                      title="Aucun moment photo"
                      description="Aucun moment photo enregistré."
                    />
                  </Card>
                ) : (
                  moments.map((m) => <MomentCard key={m.id} moment={m} />)
                )}
              </div>
            )}

            {activeTab === 'kit' && (
              <div className="space-y-[var(--space-3)]">
                <div className="flex items-center justify-between px-[var(--space-1)]">
                  <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Équipement emporté</h3>
                  <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{kitItems.length} articles</span>
                </div>
                <KitSouvenirCard intro={kitIntro} items={kitItems} />
              </div>
            )}

            {activeTab === 'nature' && (
              <div className="space-y-[var(--space-3)]">
                <div className="flex items-center justify-between px-[var(--space-1)]">
                  <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Biodiversité &amp; Nature</h3>
                  <Badge className="font-mono font-bold">Nature Scanner IA</Badge>
                </div>
                <SpeciesIdentifier />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

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
