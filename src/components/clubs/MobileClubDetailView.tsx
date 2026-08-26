'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import GlassIconButton from '@/components/ui/GlassIconButton';
import ClubDiscussionCard from '@/components/clubs/ClubDiscussionCard';
import ClubFeaturedEventCard from '@/components/clubs/ClubFeaturedEventCard';
import ClubTeamCard from '@/components/clubs/ClubTeamCard';
import ClubAboutCard from '@/components/clubs/ClubAboutCard';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface MobileClubDetailViewProps {
  club: any;
  topics: any[];
  members: any[];
  events: any[];
  user: any;
  isMember: boolean;
  onJoinToggle: () => Promise<void>;
  joining: boolean;
  onOpenCreatePost: () => void;
  onRefresh: () => void;
}

export default function MobileClubDetailView({
  club,
  topics,
  members,
  events,
  user,
  isMember,
  onJoinToggle,
  joining,
  onOpenCreatePost,
  onRefresh,
}: MobileClubDetailViewProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [activeSection, setActiveSection] = useState<'overview' | 'events' | 'discussions' | 'members' | 'guides'>('overview');

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) {
        setActiveSection(e.detail);
      }
    };
    window.addEventListener('club-detail-tab-change', handler);
    return () => window.removeEventListener('club-detail-tab-change', handler);
  }, []);

  const clubDiscussions = useMemo(() => {
    return topics.map((t: any) => ({
      id: t.id,
      author: t.author?.full_name || 'Membre',
      author_id: t.author_id,
      author_avatar: t.author?.avatar_url,
      time: new Date(t.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      content: t.content,
      likes: t.likes_count || 0,
      replies: t.replies_count || 0,
      is_pinned: t.is_pinned,
      is_guide: t.title?.toLowerCase().includes('guide'),
      title: t.title,
    }));
  }, [topics]);

  const admins = useMemo(() => {
    const list = members.filter((m: any) => m.role === 'admin' || m.role === 'moderator');
    return list.length > 0 ? list : members.slice(0, 3);
  }, [members]);

  const coverUrl = club.cover_image || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&q=80';

  return (
    <div className="md:hidden min-h-screen bg-transparent pb-36 text-[#17402C]">
      {/* IMMERSIVE HERO COVER */}
      <div className="relative w-full h-64 sm:h-72 overflow-hidden bg-[#17402C]">
        <img
          src={coverUrl}
          alt={club.name}
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#17402C] via-[#17402C]/60 to-transparent" />

        {/* Top Controls */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
          <Link
            href="/clubs"
            onClick={() => triggerHaptic('light')}
            className="glass-circle-btn !w-9 !h-9 !text-white !bg-black/30 !border-white/30"
            aria-label="Retour aux clubs"
          >
            ‹
          </Link>
          <div className="flex items-center gap-2">
            <span className="glass-pill text-white border-white/20 font-mono text-[10px] bg-white/10 backdrop-blur-md">
              {club.category || 'Collectif'} · {club.type === 'activite' ? '⚡ Activité' : '🌍 Région'}
            </span>
          </div>
        </div>

        {/* Hero Title & Emoji */}
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-300 block mb-1 font-bold">
            {club.emoji || '🏕️'} COLLECTIF OFFICIEL
          </span>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white leading-tight">
            {club.name}
          </h1>
        </div>
      </div>

      {/* STATS & MEMBERS SUMMARY CARD (Liquid Glass) */}
      <div className="px-4 -mt-3 relative z-20">
        <div className="glass bg-white/90 backdrop-blur-xl p-4 rounded-3xl border border-white shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Stacked Member Avatars */}
              <div className="flex -space-x-2">
                {members.slice(0, 4).map((m: any, i: number) => (
                  <div
                    key={m.id || i}
                    className="w-8 h-8 rounded-full border-2 border-white bg-[#17402C] text-white flex items-center justify-center font-serif italic text-xs font-bold shadow-2xs overflow-hidden"
                    style={{ zIndex: 10 - i }}
                  >
                    {m.user?.avatar_url ? (
                      <img src={m.user.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      m.user?.full_name?.charAt(0) || '👤'
                    )}
                  </div>
                ))}
                {members.length > 4 && (
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-[#5C6B5E] text-white flex items-center justify-center font-mono font-bold text-[10px]">
                    +{members.length - 4}
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-bold text-xs text-[#17402C]">
                  {club.members_count || members.length || 1} membres
                </h4>
                <span className="text-[10px] font-mono text-[#5C6B5E]">
                  {club.active_this_month || 12} actifs ce mois-ci
                </span>
              </div>
            </div>

            {/* Quick Action: Join / Member in Liquid Glass */}
            <button
              type="button"
              disabled={joining}
              onClick={() => {
                triggerHaptic('selection');
                onJoinToggle();
              }}
              className={`glass-capsule-btn !min-h-[36px] !py-1.5 !px-4 !text-xs !font-bold ${
                isMember ? '' : 'primary'
              }`}
            >
              <span>{joining ? '...' : isMember ? '✓ Membre' : '+ Rejoindre'}</span>
            </button>
          </div>

          {club.description && (
            <p className="text-xs text-[#5C6B5E] leading-relaxed pt-1 border-t border-[#17402C]/10">
              {club.description}
            </p>
          )}
        </div>
      </div>

      {/* SECTION CONTENT WITH ANIMATED TRANSITIONS */}
      <div className="p-4 pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="space-y-4"
          >
            {/* OVERVIEW */}
            {activeSection === 'overview' && (
              <div className="space-y-4">
                {/* Quick Metrics */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="glass bg-white/80 p-3 rounded-2xl text-center border border-white">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-[#5C6B5E] mb-1 font-bold">Sorties</p>
                    <p className="font-mono font-bold text-xl text-[#17402C]">{events.length}</p>
                    <p className="text-[9px] text-[#5C6B5E] font-mono">programmées</p>
                  </div>
                  <div className="glass bg-white/80 p-3 rounded-2xl text-center border border-white">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-[#5C6B5E] mb-1 font-bold">Échanges</p>
                    <p className="font-mono font-bold text-xl text-[#17402C]">{topics.length}</p>
                    <p className="text-[9px] text-[#5C6B5E] font-mono">sujets</p>
                  </div>
                  <div className="glass bg-white/80 p-3 rounded-2xl text-center border border-white">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-[#5C6B5E] mb-1 font-bold">Collectif</p>
                    <p className="font-mono font-bold text-xl text-[#17402C]">{members.length}</p>
                    <p className="text-[9px] text-[#5C6B5E] font-mono">aventuriers</p>
                  </div>
                </div>

                {/* About Card */}
                <ClubAboutCard club={club} />

                {/* Prochains Événements Preview */}
                {events.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="font-display font-bold text-sm text-[#17402C]">Prochaines sorties</h3>
                      <button
                        type="button"
                        onClick={() => setActiveSection('events')}
                        className="glass-capsule-btn !min-h-[28px] !py-1 !px-2.5 !text-[10px] !font-bold"
                      >
                        <span>Voir tout →</span>
                      </button>
                    </div>
                    {events.slice(0, 2).map((ev: any) => (
                      <ClubFeaturedEventCard key={ev.id} event={ev} />
                    ))}
                  </div>
                )}

                {/* Discussions Preview */}
                <ClubDiscussionCard
                  clubId={club.id}
                  clubName={club.name}
                  discussions={clubDiscussions.slice(0, 4)}
                  onRefresh={onRefresh}
                  user={user}
                  filterType="all"
                />
              </div>
            )}

            {/* SORTIES / EVENTS */}
            {activeSection === 'events' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-display font-bold text-sm text-[#17402C]">Sorties & Rassemblements</h3>
                  <span className="text-[10px] font-mono text-[#5C6B5E]">{events.length} sorties</span>
                </div>
                {events.length === 0 ? (
                  <div className="py-10 text-center glass bg-white/80 p-6 rounded-3xl border border-white">
                    <span className="text-3xl block mb-1">📅</span>
                    <p className="text-xs text-[#5C6B5E]">Aucune sortie programmée pour le moment.</p>
                  </div>
                ) : (
                  events.map((ev: any) => (
                    <ClubFeaturedEventCard key={ev.id} event={ev} />
                  ))
                )}
              </div>
            )}

            {/* DISCUSSIONS */}
            {activeSection === 'discussions' && (
              <ClubDiscussionCard
                clubId={club.id}
                clubName={club.name}
                discussions={clubDiscussions}
                onRefresh={onRefresh}
                user={user}
                filterType="all"
              />
            )}

            {/* MEMBRES */}
            {activeSection === 'members' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-display font-bold text-sm text-[#17402C]">Membres du collectif</h3>
                  <span className="text-[10px] font-mono text-[#5C6B5E]">{members.length} membres</span>
                </div>
                <ClubTeamCard admins={admins} />
              </div>
            )}

            {/* GUIDES */}
            {activeSection === 'guides' && (
              <ClubDiscussionCard
                clubId={club.id}
                clubName={club.name}
                discussions={clubDiscussions}
                onRefresh={onRefresh}
                user={user}
                filterType="guides"
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
