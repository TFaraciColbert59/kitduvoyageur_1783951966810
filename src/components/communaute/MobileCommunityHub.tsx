'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import CommunityPostCard, { CommunityPostItem } from '@/components/communaute/CommunityPostCard';
import CarnetHubCard from '@/components/carnets/CarnetHubCard';
import CommunityStoriesBar from '@/components/communaute/CommunityStoriesBar';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

export type CommunityMobileTab = 'fil' | 'carnets' | 'clubs' | 'groupes' | 'evenements' | 'entraide';

interface MobileCommunityHubProps {
  posts: CommunityPostItem[];
  carnets?: any[];
  clubs?: any[];
  groups?: any[];
  events?: any[];
  activeTab?: CommunityMobileTab;
  onTabChange?: (tab: CommunityMobileTab) => void;
  loading?: boolean;
  user?: any;
  onRefresh?: () => Promise<void> | void;
}

export default function MobileCommunityHub({
  posts = [],
  carnets = [],
  clubs = [],
  groups = [],
  events = [],
  activeTab = 'fil',
  onTabChange,
  loading = false,
  user,
  onRefresh,
}: MobileCommunityHubProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [currentTab, setCurrentTab] = useState<CommunityMobileTab>(activeTab);
  const [carnetFilter, setCarnetFilter] = useState('all');

  const { isRefreshing, pullProgress } = usePullToRefresh(async () => {
    if (onRefresh) {
      triggerHaptic('medium');
      await onRefresh();
    }
  });

  useEffect(() => {
    setCurrentTab(activeTab);
  }, [activeTab]);

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) {
        const tab = e.detail as CommunityMobileTab;
        setCurrentTab(tab);
        if (onTabChange) onTabChange(tab);
      }
    };
    window.addEventListener('community-tab-change', handler);
    return () => window.removeEventListener('community-tab-change', handler);
  }, [onTabChange]);

  const filteredCarnets = carnets.filter((c) => {
    if (carnetFilter === 'all') return true;
    const dest = (c.destination || '').toLowerCase();
    const tags = (c.tags || []).join(' ').toLowerCase();
    return dest.includes(carnetFilter.toLowerCase()) || tags.includes(carnetFilter.toLowerCase());
  });

  return (
    <div className="w-full min-h-screen bg-transparent pb-[calc(140px+env(safe-area-inset-bottom,0px))] px-3.5 pt-[calc(max(env(safe-area-inset-top,0px),12px)+8px)] space-y-3.5 font-sans text-[#17402C]">
      {/* Pull to refresh visual feedback indicator */}
      {(pullProgress > 0 || isRefreshing) && (
        <div
          className="w-full flex items-center justify-center py-2 transition-all overflow-hidden"
          style={{ height: isRefreshing ? '44px' : `${Math.min(pullProgress * 44, 44)}px` }}
        >
          <div className="flex items-center gap-2 px-3 py-1 rounded-full glass-pill text-xs font-medium text-[#17402C] shadow-2xs">
            <div className={`w-3.5 h-3.5 rounded-full border-2 border-[#17402C] border-t-transparent ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-[11px] font-mono">{isRefreshing ? 'Actualisation...' : 'Tirer pour rafraîchir'}</span>
          </div>
        </div>
      )}

      {/* 1. LIVE EXPLORER STORIES BAR */}
      <div className="glass rounded-[1.25rem] p-2.5 border border-white/50 shadow-2xs">
        <CommunityStoriesBar currentUser={user} />
      </div>

      {/* 3. ACTIVE TAB CONTENT STREAM */}
      <div className="space-y-3.5 pt-1">
        {/* ── TAB 1: FIL D'ACTUALITÉ ── */}
        {currentTab === 'fil' && (
          <div className="space-y-3.5">
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="glass p-4 rounded-2xl animate-pulse space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#17402C]/10" />
                      <div className="space-y-1.5 flex-1">
                        <div className="w-28 h-3 bg-[#17402C]/10 rounded" />
                        <div className="w-16 h-2 bg-[#17402C]/5 rounded" />
                      </div>
                    </div>
                    <div className="w-full h-12 bg-[#17402C]/5 rounded-xl" />
                    <div className="w-full h-44 bg-[#17402C]/10 rounded-xl" />
                  </div>
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="py-12 text-center glass p-6 rounded-2xl space-y-2">
                <span className="text-3xl block">🌲</span>
                <h3 className="font-bold text-[#17402C] text-sm">Le fil est calme</h3>
                <p className="text-xs text-[#5A7064]">Soyez le premier à partager votre traversée ou vos conseils !</p>
                <Link
                  href="/carnets/nouveau"
                  className="glass-capsule-btn primary text-xs font-bold !py-1.5 !px-4 inline-block mt-2"
                >
                  Publier un récit
                </Link>
              </div>
            ) : (
              posts.map((post) => (
                <CommunityPostCard key={post.id} post={post} user={user} />
              ))
            )}
          </div>
        )}

        {/* ── TAB 2: CARNETS DE VOYAGE ── */}
        {currentTab === 'carnets' && (
          <div className="space-y-3">
            {/* Massif filter chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {['all', 'Chartreuse', 'Vercors', 'Mont-Blanc', 'Belledonne', 'Vanoise'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setCarnetFilter(m);
                  }}
                  className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full whitespace-nowrap transition-all border ${
                    carnetFilter === m
                      ? 'bg-[#17402C] text-white border-[#17402C] shadow-xs'
                      : 'bg-white/80 text-[#17402C] border-white/70 shadow-2xs'
                  }`}
                >
                  {m === 'all' ? 'Tous les massifs' : m}
                </button>
              ))}
            </div>

            {filteredCarnets.length === 0 ? (
              <div className="py-12 text-center glass p-6 rounded-2xl space-y-2">
                <span className="text-3xl block">📖</span>
                <p className="font-bold text-[#17402C] text-sm">Aucun carnet pour ce massif</p>
                <p className="text-xs text-[#5A7064]">Essayez un autre massif ou filtre.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCarnets.map((carnet) => (
                  <CarnetHubCard key={carnet.id || carnet.title} carnet={carnet} currentUserId={user?.id} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: CLUBS & COLLECTIFS ── */}
        {currentTab === 'clubs' && (
          <div className="space-y-3">
            {clubs.map((c) => (
              <Link
                key={c.id || c.name}
                href={`/clubs/${c.id || encodeURIComponent(c.name)}`}
                className="glass rounded-2xl p-4 border border-white/60 shadow-xs flex items-center justify-between gap-3 block active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-white/80 border border-white flex items-center justify-center text-2xl shrink-0 shadow-2xs">
                    {c.emoji || '🏔️'}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className="font-display font-bold text-sm text-[#17402C] truncate">{c.name}</h4>
                      <span className="glass-pill text-[8.5px] font-mono font-bold text-[#17402C] shrink-0">
                        {c.members_count || 32} m.
                      </span>
                    </div>
                    <p className="text-[11px] text-[#5A7064] line-clamp-1">{c.slogan || c.description}</p>
                    <span className="text-[9.5px] font-mono text-[#5B7F55] font-semibold block">
                      📍 {c.category || 'Montagne & Bivouac'}
                    </span>
                  </div>
                </div>

                <div className="w-7 h-7 rounded-full bg-white/80 flex items-center justify-center text-[#17402C] shrink-0 shadow-2xs">
                  <Icon name="ArrowRightIcon" size={12} />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ── TAB 4: GROUPES D'EXPÉDITION ── */}
        {currentTab === 'groupes' && (
          <div className="space-y-3">
            {groups.map((grp) => (
              <Link
                key={grp.id || grp.name}
                href={`/groupes/${grp.id || encodeURIComponent(grp.name)}`}
                className="glass rounded-2xl p-4 border border-white/60 shadow-xs flex flex-col justify-between space-y-3 block active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="glass-pill text-[9px] font-mono font-bold text-[#17402C]">
                      📍 {grp.massif || 'Alpes'}
                    </span>
                    <h4 className="font-display font-bold text-sm text-[#17402C]">{grp.name}</h4>
                    <p className="text-[11px] text-[#5A7064] line-clamp-2 leading-relaxed">{grp.description}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/80 border border-white text-xl flex items-center justify-center shrink-0 shadow-2xs">
                    {grp.pictogram || '⛺'}
                  </div>
                </div>

                <div className="pt-2.5 border-t border-[#17402C]/5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#5A7064]">
                    <span className="font-bold text-[#17402C]">{grp.spots_left || 2}</span> places dispo
                  </div>

                  <span className="glass-capsule-btn text-[10.5px] font-bold !py-1 !px-2.5">
                    Voir le cockpit →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ── TAB 5: ÉVÉNEMENTS & SORTIES ── */}
        {currentTab === 'evenements' && (
          <div className="space-y-3">
            {events.map((ev) => (
              <div
                key={ev.id || ev.title}
                className="glass rounded-2xl p-4 border border-white/60 shadow-xs flex items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <span className="glass-pill text-[9px] font-mono font-bold text-[#17402C]">
                    📅 {ev.date}
                  </span>
                  <h4 className="font-display font-bold text-sm text-[#17402C] truncate">{ev.title}</h4>
                  <p className="text-[11px] text-[#5A7064] font-mono">📍 {ev.location} · Guide : {ev.guide}</p>
                </div>

                <button
                  onClick={() => {
                    triggerHaptic('success');
                    alert(`Inscription confirmée pour "${ev.title}" !`);
                  }}
                  className="glass-capsule-btn primary text-[10.5px] font-bold !py-1 !px-2.5 shrink-0"
                >
                  S'inscrire
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB 6: ENTRAIDE & Q&A ── */}
        {currentTab === 'entraide' && (
          <div className="space-y-3">
            <div className="glass rounded-2xl p-4 border border-white/60 shadow-xs space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xl">💡</span>
                <h3 className="font-display font-bold text-sm text-[#17402C]">Entraide &amp; Conditions de Sentier</h3>
              </div>
              <p className="text-xs text-[#5A7064] leading-relaxed">
                Posez vos questions sur le débit des sources, l&apos;enneigement des cols et les refuges non gardés.
              </p>
              <div className="p-3 rounded-xl glass-sub-card text-xs text-[#17402C] space-y-1 border border-white/50">
                <span className="font-bold block text-[11px] text-[#17402C]">✓ Réponses validées par les Guides LKDV</span>
                <p className="text-[10.5px] text-[#5A7064]">Chaque info critique est confirmée sur le terrain par les explorateurs référents.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
