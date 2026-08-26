'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import {
  type CompteUserProfile,
  type CompteCarnet,
  type CompteClubItem,
  type CompteBadgeItem,
  type CompteActiviteItem,
} from '@/lib/supabase/queries-compte';

interface PublicMobileProfileViewProps {
  profile: CompteUserProfile;
  carnets: CompteCarnet[];
  clubs: CompteClubItem[];
  badges: CompteBadgeItem[];
  activite: CompteActiviteItem[];
  onShare: () => void;
}

type TabKey = 'tout' | 'carnets' | 'clubs' | 'badges';
type ViewMode = 'grid' | 'list';

export default function PublicMobileProfileView({
  profile,
  carnets,
  clubs,
  badges,
  activite,
  onShare,
}: PublicMobileProfileViewProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [tab, setTab] = useState<TabKey>('tout');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [following, setFollowing] = useState(false);
  const [trustModalOpen, setTrustModalOpen] = useState(false);

  const fullName = `${profile.first_name || 'Voyageur'} ${profile.last_name || ''}`.trim();
  const handleName = `@${profile.first_name?.toLowerCase() || 'voyageur'}`;
  const trustScore = profile.trust_score ?? 50;
  const levelNum = profile.level?.number ?? 'I';
  const levelTitle = profile.level?.title ?? 'Explorateur';
  const sortiesCount = profile.stats?.sorties ?? profile.sorties_count ?? 0;
  const carnetsCount = carnets.length || (profile.stats?.carnets ?? 0);
  const clubsCount = clubs.length || (profile.stats?.clubs ?? 0);

  // Story Highlights basés sur les carnets ou clubs du profil
  const highlights = carnets.slice(0, 5).map((c, i) => ({
    id: c.id,
    label: c.title?.split(' ')[0] || `Étape 0${i + 1}`,
    cover: c.image_url,
  }));

  const handleFollowToggle = () => {
    triggerHaptic(following ? 'selection' : 'success');
    setFollowing(!following);
  };

  return (
    <div className="min-h-screen pb-36 font-sans selection:bg-[#17402C]/10 bg-transparent">
      {/* ══════════════════════════════════════════════════════════════════════
          1. HEADER COMPACT & STATUT (Frosted Liquid Glass)
         ══════════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-30 px-4 pt-[max(10px,env(safe-area-inset-top))] pb-2.5 flex items-center justify-between backdrop-blur-xl border-b border-white/70 bg-white/80 shadow-2xs">
        <Link
          href="/communaute"
          onClick={() => triggerHaptic('light')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 text-xs font-bold text-[#17402C] border border-white shadow-2xs transition-all active:scale-95 cursor-pointer"
        >
          <span className="text-sm font-bold">‹</span>
          <span>Communauté</span>
        </Link>

        <div className="flex items-center gap-1.5">
          <span className="font-display font-extrabold text-sm text-[#17402C] truncate max-w-[140px]">
            {handleName}
          </span>
          <span className="glass-pill font-mono bg-white/80 border-white text-[10px]">
            Niv.{levelNum}
          </span>
        </div>

        <button
          onClick={() => {
            triggerHaptic('light');
            onShare();
          }}
          aria-label="Partager ce profil"
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all bg-white/80 border border-white active:scale-90 shadow-2xs cursor-pointer text-[#17402C]"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          2. COCKPIT IDENTITÉ (Liquid Glass)
         ══════════════════════════════════════════════════════════════════════ */}
      <section className="px-3 pt-3 pb-1">
        <div className="glass rounded-3xl p-4 sm:p-5 border border-white/80 bg-white/85 backdrop-blur-xl shadow-xs">
          <div className="flex items-center gap-4 mb-3">
            {/* Avatar 76px */}
            <div className="relative shrink-0">
              <div
                className="w-[76px] h-[76px] rounded-full overflow-hidden flex items-center justify-center p-[2px] relative shadow-xs"
                style={{
                  background: 'linear-gradient(135deg, #A6C1A0, #17402C)',
                }}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-white/90 flex items-center justify-center">
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar_url} alt={fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold font-serif text-[#17402C]">
                      {profile.first_name?.charAt(0) || 'V'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Statistiques Profil */}
            <div className="flex-1 grid grid-cols-3 gap-1 text-center">
              <button
                onClick={() => {
                  triggerHaptic('selection');
                  setTab('carnets');
                }}
                className="flex flex-col items-center py-1.5 rounded-xl transition-all active:scale-95 hover:bg-white/60 cursor-pointer"
              >
                <span className="text-lg font-bold tracking-tight leading-none text-[#17402C]">
                  {carnetsCount}
                </span>
                <span className="text-[11px] mt-1 font-medium text-[#5A7064]">
                  Carnets
                </span>
              </button>

              <button
                onClick={() => {
                  triggerHaptic('selection');
                  setTab('clubs');
                }}
                className="flex flex-col items-center py-1.5 rounded-xl transition-all active:scale-95 hover:bg-white/60 cursor-pointer"
              >
                <span className="text-lg font-bold tracking-tight leading-none text-[#17402C]">
                  {sortiesCount || clubsCount}
                </span>
                <span className="text-[11px] mt-1 font-medium text-[#5A7064]">
                  Sorties
                </span>
              </button>

              <div className="flex flex-col items-center py-1.5">
                <span className="text-lg font-bold tracking-tight leading-none text-[#17402C]">
                  {badges.length}
                </span>
                <span className="text-[11px] mt-1 font-medium text-[#5A7064]">
                  Badges
                </span>
              </div>
            </div>
          </div>

          {/* Nom & Badges de statut */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-[19px] font-display font-bold tracking-tight text-[#17402C]">
                {fullName}
              </h1>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#17402C">
                <path d="M12 1l2.4 2.2 3.2-.4.8 3.2 3 1.4-1.2 3 1.2 3-3 1.4-.8 3.2-3.2-.4L12 20l-2.4-1.4-3.2.4-.8-3.2-3-1.4 1.2-3-1.2-3 3-1.4.8-3.2 3.2.4L12 1zm-1.2 12.6l6-6-1.4-1.4-4.6 4.6-2-2-1.4 1.4 3.4 3.4z" />
              </svg>
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setTrustModalOpen(true);
                }}
                className="glass-pill cursor-pointer bg-white/80 border-white hover:bg-white transition-all active:scale-95"
              >
                🛡️ Trust {trustScore}/100
              </button>
            </div>

            <p className="text-xs font-mono text-[#5A7064]">
              {handleName} · {levelTitle}
            </p>

            {/* Bio poétique */}
            {profile.bio && (
              <p className="text-sm font-serif italic leading-snug pt-1 text-[#17402C]">
                {profile.bio}
              </p>
            )}

            {/* Localisation */}
            {profile.location && (
              <div className="flex items-center gap-1 text-xs pt-1 text-[#5A7064] font-medium">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>{profile.location}</span>
              </div>
            )}
          </div>

          {/* Boutons d'Action Publics : Suivre & Message & Partager */}
          <div className="flex items-center gap-2 pt-4">
            <button
              onClick={handleFollowToggle}
              className={`flex-1 !py-2.5 text-xs font-bold rounded-full transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                following
                  ? 'bg-white/90 text-[#17402C] border border-white'
                  : 'bg-[#17402C] text-white hover:bg-[#17402C]/90'
              }`}
            >
              <span>{following ? '✓ Abonné' : '+ S\'abonner'}</span>
            </button>

            <Link
              href={`/messagerie?dest=${profile.id}`}
              onClick={() => triggerHaptic('selection')}
              className="glass-capsule-btn secondary flex-1 !py-2.5 text-xs font-bold"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Message
            </Link>

            <button
              onClick={() => {
                triggerHaptic('light');
                onShare();
              }}
              aria-label="Partager"
              className="glass-capsule-btn w-10 !py-2.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          3. RAIL HIGHLIGHTS (Stories / Récits Récents)
         ══════════════════════════════════════════════════════════════════════ */}
      {highlights.length > 0 && (
        <section className="px-3 py-1.5">
          <div className="glass rounded-3xl p-3 border border-white/80 bg-white/80 backdrop-blur-xl shadow-xs">
            <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x">
              {highlights.map((h) => (
                <Link
                  key={h.id}
                  href={`/carnets/${h.id}`}
                  onClick={() => triggerHaptic('light')}
                  className="flex flex-col items-center gap-1 shrink-0 snap-start active:scale-95 transition-transform cursor-pointer"
                  style={{ width: 62 }}
                >
                  <div
                    className="w-[54px] h-[54px] rounded-full p-[2px] relative flex items-center justify-center shadow-2xs"
                    style={{
                      background: 'linear-gradient(145deg, #A6C1A0, #17402C)',
                    }}
                  >
                    <div
                      className="w-full h-full rounded-full bg-cover bg-center border border-white"
                      style={{
                        backgroundImage: h.cover ? `url(${h.cover})` : 'linear-gradient(135deg, #17402C, #365233)',
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-bold truncate w-full text-center text-[#17402C]">
                    {h.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          4. ONGLETS FLOTTANTS & TOGGLE VUE (Segmented Capsule Liquid Glass)
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-[48px] z-20 px-3 py-1.5">
        <div className="glass rounded-2xl p-1 border border-white/80 bg-white/85 backdrop-blur-2xl shadow-xs flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-none">
            {([
              { id: 'tout', label: 'Récits', icon: '⚡' },
              { id: 'carnets', label: 'Carnets', icon: '📖' },
              { id: 'clubs', label: 'Clubs', icon: '⛺' },
              { id: 'badges', label: 'Badges', icon: '🛡️' },
            ] as { id: TabKey; label: string; icon: string }[]).map((t) => {
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    triggerHaptic('selection');
                    setTab(t.id);
                  }}
                  className={`relative px-3 py-1.5 text-xs font-extrabold whitespace-nowrap rounded-xl transition-all cursor-pointer flex items-center gap-1.5 z-10 ${
                    isActive ? 'text-white' : 'text-[#17402C]/70 hover:text-[#17402C] hover:bg-white/40'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="public-tab-active"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      className="absolute inset-0 rounded-xl bg-[#17402C] shadow-xs -z-10"
                    />
                  )}
                  <span className="text-[11px]">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Toggle Grille / Liste */}
          {tab !== 'badges' && (
            <div className="flex items-center gap-0.5 pl-1.5 pr-0.5 border-l border-[#17402C]/10">
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setViewMode('grid');
                }}
                aria-label="Vue Grille"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-[#17402C] text-white shadow-2xs'
                    : 'text-[#17402C]/50 hover:bg-white/60'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </button>
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setViewMode('list');
                }}
                aria-label="Vue Liste"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-[#17402C] text-white shadow-2xs'
                    : 'text-[#17402C]/50 hover:bg-white/60'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <circle cx="4" cy="6" r="1.2" fill="currentColor" />
                  <circle cx="4" cy="12" r="1.2" fill="currentColor" />
                  <circle cx="4" cy="18" r="1.2" fill="currentColor" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          5. CONTENU DES ONGLETS
         ══════════════════════════════════════════════════════════════════════ */}

      {/* ── ONGLET : BADGES & CONFIANCE ── */}
      {tab === 'badges' && (
        <section className="p-3 space-y-3">
          {/* Trust Score Card */}
          <div className="glass p-4 rounded-3xl border border-white/80 bg-white/85 backdrop-blur-xl flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🛡️</span>
              <div>
                <h3 className="text-sm font-bold text-[#17402C]">
                  Indice de Confiance Voyageur
                </h3>
                <p className="text-xs text-[#5A7064]">
                  Vérification d'identité et sorties certifiées.
                </p>
              </div>
            </div>
            <span className="font-mono text-base font-bold text-[#17402C]">
              {trustScore}/100
            </span>
          </div>

          {/* Grille des badges */}
          <div className="grid grid-cols-3 gap-2">
            {badges.length === 0 ? (
              <div className="col-span-3 glass p-6 text-center rounded-2xl bg-white/70 border border-white/70">
                <p className="text-xs text-[#5A7064]">Aucun badge débloqué pour le moment.</p>
              </div>
            ) : (
              badges.map((b) => (
                <div
                  key={b.id}
                  className="glass p-3 rounded-2xl border border-white/80 bg-white/85 backdrop-blur-xl text-center shadow-2xs"
                >
                  <span className="text-2xl">🏅</span>
                  <p className="text-[11px] font-bold mt-1 text-[#17402C] truncate">
                    {b.title}
                  </p>
                  <p className="text-[9px] text-[#5A7064] truncate">
                    Badge certifié
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* ── ONGLET : CLUBS & GROUPES ── */}
      {tab === 'clubs' && (
        <section className="p-3 space-y-2.5">
          {clubs.length === 0 ? (
            <div className="glass p-8 text-center rounded-3xl border border-white/80 bg-white/80 backdrop-blur-xl shadow-xs">
              <p className="text-3xl mb-2">⛺</p>
              <p className="text-xs text-[#5A7064]">Aucun club rejoint pour le moment.</p>
            </div>
          ) : (
            clubs.map((club) => (
              <Link
                key={club.id}
                href={`/clubs/${club.slug || club.id}`}
                onClick={() => triggerHaptic('light')}
                className="glass flex items-center gap-3.5 p-3 rounded-2xl border border-white/80 bg-white/85 backdrop-blur-xl active:scale-[0.98] transition-all shadow-xs cursor-pointer"
              >
                <div
                  className="w-12 h-12 rounded-xl shrink-0 bg-cover bg-center border border-white/60 shadow-2xs"
                  style={{
                    backgroundImage: club.logo_url ? `url(${club.logo_url})` : 'linear-gradient(135deg, #17402C, #365233)',
                  }}
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-[#17402C] truncate">{club.name}</h4>
                  <p className="text-[11px] text-[#5A7064] truncate">📍 {club.detail || 'Outdoor Club'}</p>
                </div>
                <span className="glass-pill bg-white/90 border-white text-[10px]">
                  {club.members_count ?? 1} membres
                </span>
              </Link>
            ))
          )}
        </section>
      )}

      {/* ── ONGLET : CARNETS & RÉCITS (VUE GRILLE OU LISTE) ── */}
      {(tab === 'tout' || tab === 'carnets') && (
        <section>
          {carnets.length === 0 ? (
            <div className="glass m-3 p-10 text-center rounded-3xl border border-white/80 bg-white/80 backdrop-blur-xl shadow-xs">
              <p className="text-4xl mb-2">📖</p>
              <h3 className="font-serif text-base font-bold mb-1 text-[#17402C]">
                Aucun carnet public
              </h3>
              <p className="text-xs text-[#5A7064]">
                Ce voyageur n'a pas encore publié d'expédition publique.
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-3 gap-2.5 p-3">
              {carnets.map((c) => (
                <Link
                  key={c.id}
                  href={`/carnets/${c.id}`}
                  onClick={() => triggerHaptic('light')}
                  className="aspect-square relative bg-cover bg-center overflow-hidden rounded-2xl border border-white/70 shadow-2xs block active:scale-95 transition-all cursor-pointer"
                  style={{
                    backgroundImage: c.image_url ? `url(${c.image_url})` : 'linear-gradient(135deg, #17402C, #365233)',
                    backgroundColor: 'rgba(255,255,255,0.7)',
                  }}
                >
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-md bg-black/40 backdrop-blur-md flex items-center justify-center text-white text-[10px]">
                    📖
                  </div>
                  <div className="absolute bottom-1.5 left-1.5 right-1.5">
                    <p className="text-[10px] font-bold text-white drop-shadow-sm truncate">{c.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-3 space-y-2.5">
              {carnets.map((c) => (
                <Link
                  key={c.id}
                  href={`/carnets/${c.id}`}
                  onClick={() => triggerHaptic('light')}
                  className="glass flex gap-3.5 p-3 rounded-2xl border border-white/80 bg-white/85 backdrop-blur-xl active:scale-[0.98] transition-all shadow-xs cursor-pointer"
                >
                  <div
                    className="w-22 h-22 rounded-xl shrink-0 bg-cover bg-center border border-white/60 shadow-2xs"
                    style={{
                      backgroundImage: c.image_url ? `url(${c.image_url})` : 'linear-gradient(135deg, #17402C, #365233)',
                    }}
                  />
                  <div className="flex-1 flex flex-col justify-between py-0.5">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-[#17402C]">
                        Carnet d'aventure
                      </span>
                      <h4 className="text-sm font-bold leading-tight mt-0.5 text-[#17402C]">
                        {c.title}
                      </h4>
                      <p className="text-xs mt-0.5 font-medium text-[#5A7064]">
                        📍 Expédition outdoor
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="glass-pill bg-white/90 border-white text-[10px]">
                        {c.status || 'Publié'}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="py-8 text-center font-mono text-[10px] uppercase tracking-widest text-[#8FA396]">
            — fin · {carnets.length} carnet{carnets.length > 1 ? 's' : ''} —
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          6. MODALE TRUST SCORE / CONFIANCE
         ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {trustModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTrustModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className="relative w-full max-w-lg rounded-t-3xl p-6 z-10 space-y-4 backdrop-blur-2xl bg-white/95 border-t border-white shadow-2xl"
            >
              <div className="w-12 h-1.5 rounded-full mx-auto -mt-2 mb-2 bg-[#17402C]/15" />
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-[#17402C]">
                    Indice de Confiance
                  </span>
                  <h3 className="text-lg font-bold text-[#17402C]">
                    Score de Confiance : {trustScore}/100
                  </h3>
                </div>
                <button onClick={() => setTrustModalOpen(false)} className="p-1 rounded-full text-[#17402C]/40">
                  ✕
                </button>
              </div>

              <p className="text-xs text-[#5A7064] leading-relaxed">
                Ce score certifie la fiabilité de <strong>{fullName}</strong> au sein de la communauté Le Kit du Voyageur (sorties réalisées, avis vérifiés et respect de la charte outdoor).
              </p>

              <button
                onClick={() => setTrustModalOpen(false)}
                className="glass-capsule-btn primary w-full !py-3 text-xs font-bold"
              >
                Fermer
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
