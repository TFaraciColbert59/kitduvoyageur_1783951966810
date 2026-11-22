'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRight,
  Calendar,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Handshake,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  Mountain,
  Package,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import { createClient } from '@/lib/supabase/client';
import {
  AnimatedNumber,
  CLUB_SPRING,
  StackSlideView,
  StaggerCard,
  StaggerList,
} from './ClubDrawerMotion';
import {
  ClubEmptyCard,
  ClubEntityPeek,
  normalizeSearchText,
  useDebouncedValue,
  useLocalStorageState,
  useLongPressPeek,
} from './ClubSharedUi';
import type {
  ClubCordeeDrawerBodyProps,
  ClubGearVaultItem,
  ClubMemberData,
  ClubOutingData,
} from './ClubDrawerTypes';
import type { ClubFeedPostItem } from '../feed/ClubInlineFeed';

type MembersFilter = 'all' | 'role' | 'recent' | 'followed' | 'massif';
type GuidesFilter = 'all' | 'founder' | 'security' | 'encadrant' | 'pro';
type BinomesFilter = 'all' | 'sam' | 'dim' | 'massif' | 'proposed';

function MemberAvatar({
  member,
  size = 40,
  showOnlineDot = false,
  showShield = false,
}: {
  member: Pick<ClubMemberData, 'name' | 'avatarUrl' | 'availableWeekend'>;
  size?: number;
  showOnlineDot?: boolean;
  showShield?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (member.name || 'M').trim().charAt(0).toUpperCase() || 'M';

  return (
    <span className="club-avatar-wrap">
      <span
        className="lkdv-carnet-crew-avatar"
        style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.35)) }}
      >
        {member.avatarUrl && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.avatarUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          initial
        )}
      </span>
      {showOnlineDot && member.availableWeekend ? (
        <span className="club-avatar-dot" title="Disponible ce week-end" />
      ) : null}
      {showShield ? (
        <span className="club-avatar-shield" aria-hidden="true">
          <ShieldCheck size={10} />
        </span>
      ) : null}
    </span>
  );
}

function roleBadgeClass(role: ClubMemberData['role']): string {
  if (role === 'Fondateur') return 'club-badge-forest';
  if (role === 'Guide & Sécurité') return 'club-badge-sage';
  if (role === 'Nouveau') return 'club-badge-sage';
  return 'club-badge-soft';
}

function formatJoinedSince(iso?: string): string | null {
  if (!iso) return null;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(dt);
}

function getNextWeekendLabel(): string {
  const now = new Date();
  const day = now.getDay();
  const daysToSat = (6 - day + 7) % 7 || 7;
  const sat = new Date(now);
  sat.setDate(now.getDate() + daysToSat);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  return `${fmt.format(sat)} – ${fmt.format(sun)}`;
}

function CordeeSkeleton({ mode }: { mode: 'all' | 'guides' | 'binomes' }) {
  if (mode === 'guides') {
    return (
      <div className="club-drawer-pane-content" aria-busy="true">
        <span className="club-skel-block" style={{ height: 64 }} />
        <span className="club-skel-block" style={{ height: 76 }} />
        <span className="club-skel-block" style={{ height: 76 }} />
      </div>
    );
  }
  if (mode === 'binomes') {
    return (
      <div className="club-drawer-pane-content" aria-busy="true">
        <span className="club-skel-block" style={{ height: 68 }} />
        <span className="club-skel-block" style={{ height: 88 }} />
        <span className="club-skel-block" style={{ height: 88 }} />
        <span className="club-skel-block" style={{ height: 88 }} />
      </div>
    );
  }
  return (
    <div className="club-drawer-pane-content" aria-busy="true">
      {Array.from({ length: 5 }).map((_, idx) => (
        <span key={idx} className="club-skel-block" style={{ height: 58 }} />
      ))}
    </div>
  );
}

function MemberRowCard({
  member,
  isSelf,
  canManage,
  onInspect,
  onToggleFollow,
  onOpenProfile,
  onPeek,
}: {
  member: ClubMemberData;
  isSelf: boolean;
  canManage: boolean;
  onInspect: () => void;
  onToggleFollow: () => void;
  onOpenProfile: () => void;
  onPeek: () => void;
}) {
  const { handlers, wasLongPress } = useLongPressPeek(onPeek);
  const joinedLabel = formatJoinedSince(member.joinedAt);
  const isMuted = Boolean(member.mutedUntil && Date.parse(member.mutedUntil) > Date.now());

  return (
    <StaggerCard className="lkdv-carnet-crew-card" role="listitem">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }} {...handlers}>
        <button
          type="button"
          className="lkdv-carnet-crew-main"
          onClick={() => {
            if (wasLongPress()) return;
            onInspect();
          }}
          aria-label={`Ouvrir la fiche de ${member.name}, ${member.role}, ${member.massif}`}
        >
          <MemberAvatar member={member} size={40} showOnlineDot />
          <div className="lkdv-carnet-crew-meta">
            <div className="lkdv-carnet-crew-name-row">
              <b>{member.name}</b>
              <span className={roleBadgeClass(member.role)}>{member.role}</span>
              {member.isProAthlete ? (
                <ShieldCheck size={13} color="#17402c" aria-label="Athlète vérifié" />
              ) : null}
              {isSelf ? <span className="club-badge-forest">Vous</span> : null}
              {canManage && isMuted ? <span className="club-badge-amber">Muet</span> : null}
            </div>
            <div className="lkdv-carnet-crew-stats">
              <span>@{member.handle}</span>
              <span> · {member.massif}</span>
              {member.skills.length > 0 ? <span> · {member.skills.slice(0, 2).join(' · ')}</span> : null}
              {joinedLabel ? <span> · Membre depuis {joinedLabel}</span> : null}
            </div>
          </div>
          <ChevronRight size={15} className="lkdv-carnet-chevron" aria-hidden="true" />
        </button>

        {isSelf ? (
          <button
            type="button"
            className="reseau-btn active club-icon-pill"
            style={{ padding: '0 10px', width: 'auto', fontSize: 11, fontWeight: 700 }}
            onClick={onOpenProfile}
          >
            Mon profil
          </button>
        ) : (
          <button
            type="button"
            className={`reseau-btn ${member.followed ? 'active' : 'primary'} club-icon-pill`}
            onClick={onToggleFollow}
            aria-pressed={Boolean(member.followed)}
            aria-label={member.followed ? `Ne plus suivre ${member.name}` : `Suivre ${member.name}`}
            title={member.followed ? 'Suivi' : 'Suivre'}
          >
            {member.followed ? <UserCheck size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
          </button>
        )}
      </div>
    </StaggerCard>
  );
}

function MembersAllPane({
  loading,
  activeClub,
  members,
  currentUserId,
  blockedSet,
  onInspectMember,
  onToggleFollowMember,
  onSwitchTabAndLens,
  onOpenMemberProfile,
}: {
  loading?: boolean;
  activeClub: ClubCordeeDrawerBodyProps['activeClub'];
  members: ClubMemberData[];
  currentUserId?: string | null;
  blockedSet: ReadonlySet<string>;
  onInspectMember: (member: ClubMemberData) => void;
  onToggleFollowMember: (member: ClubMemberData) => void;
  onSwitchTabAndLens: ClubCordeeDrawerBodyProps['onSwitchTabAndLens'];
  onOpenMemberProfile: (handle: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MembersFilter>('all');
  const [visibleCount, setVisibleCount] = useState(30);
  const [peekMember, setPeekMember] = useState<ClubMemberData | null>(null);
  const virtualRef = useRef<HTMLDivElement | null>(null);
  const debouncedSearch = useDebouncedValue(search, 160);

  const canManage =
    activeClub.viewerRole === 'admin' ||
    activeClub.viewerRole === 'moderator' ||
    /fondateur|admin|modérateur/i.test(activeClub.role);

  const unblockedMembers = useMemo(
    () => members.filter((m) => !blockedSet.has(m.userId || m.id)),
    [blockedSet, members],
  );

  const newArrivals = useMemo(
    () => unblockedMembers.filter((m) => m.isNew7d),
    [unblockedMembers],
  );

  const guidesCount = useMemo(
    () =>
      unblockedMembers.filter(
        (m) => m.role === 'Fondateur' || m.role === 'Guide & Sécurité' || m.role === 'Encadrant',
      ).length,
    [unblockedMembers],
  );

  const binomesCount = useMemo(
    () => unblockedMembers.filter((m) => m.availableWeekend).length,
    [unblockedMembers],
  );

  const filteredMembers = useMemo(() => {
    const q = normalizeSearchText(debouncedSearch);
    const roleRank: Record<ClubMemberData['role'], number> = {
      Fondateur: 0,
      'Guide & Sécurité': 1,
      Encadrant: 2,
      Nouveau: 3,
      'Membre actif': 4,
    };

    const base = unblockedMembers.filter((m) => {
      if (q) {
        const hay = normalizeSearchText(`${m.name} ${m.handle} ${m.massif} ${m.skills.join(' ')}`);
        if (!hay.includes(q)) return false;
      }
      if (filter === 'recent') return Boolean(m.isNew7d);
      if (filter === 'followed') return Boolean(m.followed);
      if (filter === 'massif') {
        return normalizeSearchText(m.massif).includes(normalizeSearchText(activeClub.massif));
      }
      return true;
    });

    return [...base].sort((a, b) => {
      if (filter === 'role' || filter === 'all') {
        const rDiff = roleRank[a.role] - roleRank[b.role];
        if (rDiff !== 0) return rDiff;
      }
      if (filter === 'all') {
        const newDiff = (b.isNew7d ? 1 : 0) - (a.isNew7d ? 1 : 0);
        if (newDiff !== 0) return newDiff;
        const fDiff = (b.followed ? 1 : 0) - (a.followed ? 1 : 0);
        if (fDiff !== 0) return fDiff;
      }
      return a.name.localeCompare(b.name, 'fr');
    });
  }, [activeClub.massif, debouncedSearch, filter, unblockedMembers]);

  const paginatedMembers = useMemo(
    () => filteredMembers.slice(0, visibleCount),
    [filteredMembers, visibleCount],
  );

  const useVirtual = paginatedMembers.length > 40;
  const rowVirtualizer = useVirtualizer({
    count: useVirtual ? paginatedMembers.length : 0,
    getScrollElement: () => virtualRef.current,
    estimateSize: () => 74,
    overscan: 5,
  });

  if (loading && members.length === 0) {
    return <CordeeSkeleton mode="all" />;
  }

  return (
    <div className="club-drawer-pane-content">
      {canManage && activeClub.pendingRequestsCount && activeClub.pendingRequestsCount > 0 ? (
        <button
          type="button"
          className="club-pending-banner"
          onClick={() => onSwitchTabAndLens(4, 3, { g02Section: 'members' })}
        >
          <span>
            {activeClub.pendingRequestsCount} demande{activeClub.pendingRequestsCount > 1 ? 's' : ''} d’adhésion en attente
          </span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </button>
      ) : null}

      {unblockedMembers.length > 0 ? (
        <div className="lkdv-carnet-kpi-grid-3">
          <div className="lkdv-carnet-kpi-mini">
            <small>Actifs</small>
            <b><AnimatedNumber value={unblockedMembers.length} /></b>
          </div>
          <button
            type="button"
            className="lkdv-carnet-kpi-mini"
            style={{ border: 0, textAlign: 'left', cursor: 'pointer' }}
            onClick={() => onSwitchTabAndLens(1, 1)}
          >
            <small>Encadrants</small>
            <b><AnimatedNumber value={guidesCount} /></b>
          </button>
          <button
            type="button"
            className="lkdv-carnet-kpi-mini"
            style={{ border: 0, textAlign: 'left', cursor: 'pointer' }}
            onClick={() => onSwitchTabAndLens(1, 2)}
          >
            <small>Dispo week-end</small>
            <b><AnimatedNumber value={binomesCount} /></b>
          </button>
        </div>
      ) : null}

      <AnimatePresence>
        {newArrivals.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={CLUB_SPRING}
            className="club-new-arrivals-wrap"
          >
            <div className="lkdv-reseau-strip-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: '#17402c' }}>
                <Sparkles size={13} aria-hidden="true" />
                Nouveaux dans la tribu
              </span>
              <span className="club-badge-sage">7j · {newArrivals.length}</span>
            </div>
            <div className="club-new-pills" data-hscroll="true">
              {newArrivals.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="club-new-member-pill"
                  onClick={() => onInspectMember(m)}
                >
                  <MemberAvatar member={m} size={28} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <b style={{ fontSize: 12 }}>{m.name}</b>
                      <span className="club-badge-sage" style={{ fontSize: 9.5, padding: '1px 5px' }}>Nouveau</span>
                    </div>
                    <span style={{ fontSize: 10.5, color: '#56665d' }}>@{m.handle} · {m.massif}</span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {unblockedMembers.length >= 6 ? (
        <div className="club-search-box-v2 is-compact">
          <Search size={14} color="#56665d" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Chercher un membre, @handle ou massif…"
            aria-label="Rechercher un membre de la cordée"
          />
          {search ? (
            <button type="button" className="club-search-clear-btn" onClick={() => setSearch('')} aria-label="Effacer">
              <X size={13} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}

      {unblockedMembers.length > 0 ? (
        <div className="club-filter-rail" data-hscroll="true" role="tablist" aria-label="Filtrer les membres">
          {(
            [
              { id: 'all', label: 'Tous' },
              { id: 'role', label: 'Rôle' },
              { id: 'recent', label: 'Actifs récents' },
              { id: 'followed', label: 'Suivis' },
              { id: 'massif', label: 'Même massif' },
            ] as const
          ).map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`club-filter-pill${active ? ' is-active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {active ? (
                  <motion.span layoutId="club-members-filter-pill" className="club-filter-pill-bg" transition={CLUB_SPRING} />
                ) : null}
                <span className="club-filter-pill-label">{f.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="club-sec-head">
        <div className="club-sec-head-titles">
          <span className="club-sec-eyebrow">Cordée · Équipage</span>
          <b className="club-sec-title">Membres de {activeClub.name}</b>
        </div>
        <span className="lkdv-carnet-chip-soft" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <AnimatedNumber value={filteredMembers.length} />
          {filteredMembers.length !== unblockedMembers.length ? ` / ${unblockedMembers.length}` : ''}
        </span>
      </div>

      {filteredMembers.length === 0 ? (
        <ClubEmptyCard
          icon={<Users size={22} />}
          title="Aucun membre répertorié pour le moment."
          description={
            search || filter !== 'all'
              ? 'Aucun membre ne correspond à ce filtre.'
              : 'Invitez vos compagnons de cordée à rejoindre cette tribu.'
          }
          actions={
            (search || filter !== 'all') ? (
              <button
                type="button"
                className="lkdv-carnet-btn-soft"
                onClick={() => {
                  setSearch('');
                  setFilter('all');
                }}
              >
                Réinitialiser
              </button>
            ) : (
              <button
                type="button"
                className="lkdv-carnet-btn-primary"
                onClick={() => onSwitchTabAndLens(4, 3, { g02Section: 'invites' })}
              >
                Inviter un compagnon
              </button>
            )
          }
        />
      ) : useVirtual ? (
        <div ref={virtualRef} style={{ maxHeight: 380, overflowY: 'auto' }}>
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((vRow) => {
              const m = paginatedMembers[vRow.index];
              const isSelf = Boolean(currentUserId && (m.userId === currentUserId || m.id === currentUserId));
              return (
                <div
                  key={m.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vRow.start}px)`,
                    paddingBottom: 8,
                  }}
                >
                  <MemberRowCard
                    member={m}
                    isSelf={isSelf}
                    canManage={canManage}
                    onInspect={() => onInspectMember(m)}
                    onToggleFollow={() => onToggleFollowMember(m)}
                    onOpenProfile={() => onOpenMemberProfile(m.handle)}
                    onPeek={() => setPeekMember(m)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <StaggerList className="reseau-list" role="list" aria-label="Membres de la cordée">
          {paginatedMembers.map((m) => {
            const isSelf = Boolean(currentUserId && (m.userId === currentUserId || m.id === currentUserId));
            return (
              <MemberRowCard
                key={m.id}
                member={m}
                isSelf={isSelf}
                canManage={canManage}
                onInspect={() => onInspectMember(m)}
                onToggleFollow={() => onToggleFollowMember(m)}
                onOpenProfile={() => onOpenMemberProfile(m.handle)}
                onPeek={() => setPeekMember(m)}
              />
            );
          })}
        </StaggerList>
      )}

      {filteredMembers.length > paginatedMembers.length ? (
        <button
          type="button"
          className="lkdv-carnet-btn-soft"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => setVisibleCount((c) => c + 30)}
        >
          Charger les membres suivants ({paginatedMembers.length} / {filteredMembers.length})
        </button>
      ) : null}

      <button
        type="button"
        className="lkdv-carnet-btn-soft"
        style={{ width: '100%', justifyContent: 'center' }}
        onClick={() => onSwitchTabAndLens(4, 3, { g02Section: 'invites' })}
      >
        <UserPlus size={14} aria-hidden="true" />
        <span>Inviter un compagnon de cordée</span>
      </button>

      <ClubEntityPeek
        open={Boolean(peekMember)}
        title={peekMember?.name || ''}
        subtitle={peekMember ? `@${peekMember.handle} · ${peekMember.role}` : undefined}
        imageUrl={peekMember?.avatarUrl}
        monogram={peekMember?.name.slice(0, 2).toUpperCase()}
        actions={
          peekMember
            ? [
                {
                  id: 'inspect',
                  label: 'Aperçu Cordée',
                  icon: <UserRound size={17} aria-hidden="true" />,
                  onSelect: () => onInspectMember(peekMember),
                },
                {
                  id: 'follow',
                  label: peekMember.followed ? 'Ne plus suivre' : 'Suivre',
                  icon: <UserCheck size={17} aria-hidden="true" />,
                  onSelect: () => onToggleFollowMember(peekMember),
                },
                {
                  id: 'profile',
                  label: 'Ouvrir le profil complet',
                  icon: <ArrowUpRight size={17} aria-hidden="true" />,
                  onSelect: () => onOpenMemberProfile(peekMember.handle),
                },
              ]
            : []
        }
        onClose={() => setPeekMember(null)}
      />
    </div>
  );
}

function MembersGuidesPane({
  loading,
  activeClub,
  members,
  outings,
  blockedSet,
  onInspectMember,
  onToggleFollowMember,
  onSwitchTabAndLens,
}: {
  loading?: boolean;
  activeClub: ClubCordeeDrawerBodyProps['activeClub'];
  members: ClubMemberData[];
  outings: ClubOutingData[];
  blockedSet: ReadonlySet<string>;
  onInspectMember: (member: ClubMemberData) => void;
  onToggleFollowMember: (member: ClubMemberData) => void;
  onSwitchTabAndLens: ClubCordeeDrawerBodyProps['onSwitchTabAndLens'];
}) {
  const [filter, setFilter] = useState<GuidesFilter>('all');
  const [peekGuide, setPeekGuide] = useState<ClubMemberData | null>(null);

  const canManage =
    activeClub.viewerRole === 'admin' ||
    activeClub.viewerRole === 'moderator' ||
    /fondateur|admin|modérateur/i.test(activeClub.role);

  const allGuides = useMemo(() => {
    const rank: Record<string, number> = { Fondateur: 0, 'Guide & Sécurité': 1, Encadrant: 2 };
    return members
      .filter(
        (m) =>
          !blockedSet.has(m.userId || m.id) &&
          (m.role === 'Fondateur' || m.role === 'Guide & Sécurité' || m.role === 'Encadrant'),
      )
      .sort((a, b) => (rank[a.role] ?? 9) - (rank[b.role] ?? 9) || a.name.localeCompare(b.name, 'fr'));
  }, [blockedSet, members]);

  const ledOutingsByHandle = useMemo(() => {
    const map = new Map<string, ClubOutingData[]>();
    for (const o of outings) {
      const key = (o.leaderHandle || '').toLowerCase();
      const arr = map.get(key) ?? [];
      arr.push(o);
      map.set(key, arr);
    }
    return map;
  }, [outings]);

  const filteredGuides = useMemo(() => {
    return allGuides.filter((g) => {
      if (filter === 'founder') return g.role === 'Fondateur';
      if (filter === 'security') return g.role === 'Guide & Sécurité';
      if (filter === 'encadrant') return g.role === 'Encadrant';
      if (filter === 'pro') return Boolean(g.isProAthlete);
      return true;
    });
  }, [allGuides, filter]);

  const leaders = filteredGuides.filter((g) => g.role === 'Fondateur');
  const staff = filteredGuides.filter((g) => g.role !== 'Fondateur');

  if (loading && members.length === 0) {
    return <CordeeSkeleton mode="guides" />;
  }

  const renderGuideCard = (g: ClubMemberData) => {
    const led = ledOutingsByHandle.get((g.handle || '').toLowerCase()) ?? [];
    const nextLed = led.find((o) => o.status === 'upcoming' || o.status === 'live');
    const isFounder = g.role === 'Fondateur';

    return (
      <StaggerCard
        key={g.id}
        className="lkdv-carnet-crew-card"
        style={isFounder ? { boxShadow: 'inset 0 0 0 1.2px rgba(23,64,44,0.34)' } : undefined}
      >
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}
          onContextMenu={(e) => {
            e.preventDefault();
            setPeekGuide(g);
          }}
        >
          <button
            type="button"
            className="lkdv-carnet-crew-main"
            onClick={() => onInspectMember(g)}
          >
            <MemberAvatar member={g} size={44} showShield />
            <div className="lkdv-carnet-crew-meta">
              <div className="lkdv-carnet-crew-name-row">
                <b>{g.name}</b>
                <span className={roleBadgeClass(g.role)}>{g.role}</span>
                {g.isProAthlete ? (
                  <span className="club-badge-forest">★ Pro vérifié</span>
                ) : null}
              </div>
              <div className="lkdv-carnet-crew-stats" style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 3 }}>
                <span>{g.massif}</span>
                <span>· {led.length} sortie{led.length > 1 ? 's' : ''} encadrée{led.length > 1 ? 's' : ''}</span>
                {g.availableWeekend ? (
                  <span className="lkdv-carnet-live-badge is-live" style={{ padding: '1px 7px', fontSize: 10 }}>
                    <span className="lkdv-carnet-live-dot" />
                    Dispo W-E
                  </span>
                ) : null}
              </div>
            </div>
            <ChevronRight size={15} className="lkdv-carnet-chevron" aria-hidden="true" />
          </button>

          {g.skills.length > 0 ? (
            <div className="club-skill-tags">
              {g.skills.slice(0, 3).map((sk) => (
                <span key={sk} className="lkdv-carnet-metric-pill">{sk}</span>
              ))}
            </div>
          ) : null}

          {nextLed ? (
            <button
              type="button"
              className="club-next-outing-chip"
              onClick={() => onSwitchTabAndLens(2, 0, { inspectOuting: nextLed })}
            >
              <Calendar size={11} aria-hidden="true" />
              <span>Prochaine sortie : {nextLed.title} ({nextLed.date})</span>
            </button>
          ) : null}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={g.followed ? 'lkdv-carnet-btn-soft' : 'lkdv-carnet-btn-primary'}
              style={{ height: 32, padding: '0 12px', fontSize: 12, flex: 1, justifyContent: 'center' }}
              onClick={() => onToggleFollowMember(g)}
            >
              {g.followed ? <UserCheck size={13} aria-hidden="true" /> : <UserPlus size={13} aria-hidden="true" />}
              <span>{g.followed ? 'Suivi' : 'Suivre'}</span>
            </button>
            <button
              type="button"
              className="lkdv-carnet-btn-soft"
              style={{ height: 32, padding: '0 12px', fontSize: 12, flex: 1, justifyContent: 'center' }}
              onClick={() => onSwitchTabAndLens(4, 1, { chatDraft: `@${g.handle} ` })}
            >
              <MessageCircle size={13} aria-hidden="true" />
              <span>Contacter</span>
            </button>
          </div>
        </div>
      </StaggerCard>
    );
  };

  return (
    <div className="club-drawer-pane-content" role="region" aria-labelledby="club-guides-heading">
      <div className="lkdv-carnet-pokedex-banner">
        <div className="lkdv-carnet-pokedex-banner-top" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} color="#17402c" aria-hidden="true" />
            <div>
              <b id="club-guides-heading" style={{ fontSize: 13.5, color: '#172b24', display: 'block' }}>
                Référents & Encadrement du club
              </b>
              <span style={{ fontSize: 11.5, color: '#56665d' }}>
                <AnimatedNumber value={allGuides.length} /> encadrant{allGuides.length > 1 ? 's' : ''} actif{allGuides.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="lkdv-carnet-btn-soft"
            style={{ height: 28, padding: '0 10px', fontSize: 11 }}
            onClick={() => onSwitchTabAndLens(2, 1)}
          >
            Bulletin météo
          </button>
        </div>
        {canManage ? (
          <button
            type="button"
            className="lkdv-carnet-btn-soft"
            style={{ height: 30, fontSize: 11.5, alignSelf: 'flex-start' }}
            onClick={() => onSwitchTabAndLens(4, 3, { g02Section: 'members' })}
          >
            Gérer l’équipe
          </button>
        ) : null}
      </div>

      {allGuides.length > 3 ? (
        <div className="club-filter-rail" data-hscroll="true" role="tablist" aria-label="Filtrer les encadrants">
          {(
            [
              { id: 'all', label: 'Tous' },
              { id: 'founder', label: 'Fondateur' },
              { id: 'security', label: 'Sécurité' },
              { id: 'encadrant', label: 'Encadrants' },
              { id: 'pro', label: 'Certifiés Pro' },
            ] as const
          ).map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`club-filter-pill${active ? ' is-active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {active ? (
                  <motion.span layoutId="club-guides-filter-pill" className="club-filter-pill-bg" transition={CLUB_SPRING} />
                ) : null}
                <span className="club-filter-pill-label">{f.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {filteredGuides.length === 0 ? (
        <ClubEmptyCard
          icon={<Shield size={22} />}
          title="Aucun encadrant ou référent identifié"
          description="Les fondateurs, administrateurs et référents sécurité de la tribu apparaîtront ici."
          actions={
            filter !== 'all' ? (
              <button type="button" className="lkdv-carnet-btn-soft" onClick={() => setFilter('all')}>
                Voir toute l’équipe
              </button>
            ) : (
              <button type="button" className="lkdv-carnet-btn-soft" onClick={() => onSwitchTabAndLens(1, 0)}>
                Voir tous les membres
              </button>
            )
          }
        />
      ) : allGuides.length > 3 && leaders.length > 0 && staff.length > 0 ? (
        <StaggerList className="reseau-list">
          <span className="lkdv-carnet-kit-eyebrow" style={{ paddingLeft: 4 }}>
            Direction & Fondateur ({leaders.length})
          </span>
          {leaders.map(renderGuideCard)}
          <span className="lkdv-carnet-kit-eyebrow" style={{ paddingLeft: 4, marginTop: 4 }}>
            Encadrants & Référents sécurité ({staff.length})
          </span>
          {staff.map(renderGuideCard)}
        </StaggerList>
      ) : (
        <StaggerList className="reseau-list">
          {filteredGuides.map(renderGuideCard)}
        </StaggerList>
      )}

      <button
        type="button"
        className="lkdv-sig club-glass-card"
        style={{ border: 0, textAlign: 'left', cursor: 'pointer', width: '100%' }}
        onClick={() => onSwitchTabAndLens(4, 2)}
      >
        <b style={{ fontSize: 12.5, color: '#17402c', display: 'block' }}>Charte & Sécurité de la Tribu</b>
        <span style={{ fontSize: 11.5, color: '#56665d' }}>{activeClub.charter}</span>
      </button>

      <ClubEntityPeek
        open={Boolean(peekGuide)}
        title={peekGuide?.name || ''}
        subtitle={peekGuide ? `@${peekGuide.handle} · ${peekGuide.role}` : undefined}
        imageUrl={peekGuide?.avatarUrl}
        monogram={peekGuide?.name.slice(0, 2).toUpperCase()}
        actions={
          peekGuide
            ? [
                {
                  id: 'inspect',
                  label: 'Ouvrir la fiche complète',
                  icon: <UserRound size={17} aria-hidden="true" />,
                  onSelect: () => onInspectMember(peekGuide),
                },
                {
                  id: 'contact',
                  label: 'Contacter sur le canal',
                  icon: <MessageCircle size={17} aria-hidden="true" />,
                  onSelect: () => onSwitchTabAndLens(4, 1, { chatDraft: `@${peekGuide.handle} ` }),
                },
              ]
            : []
        }
        onClose={() => setPeekGuide(null)}
      />
    </div>
  );
}

function MembersBinomesPane({
  loading,
  activeClub,
  members,
  outings,
  currentUserId,
  blockedSet,
  onInspectMember,
  onProposeBinome,
  onRetractBinome,
  onUpdateMyAvailability,
  onCreateBinomeGroup,
  onSwitchTabAndLens,
  onToast,
}: {
  loading?: boolean;
  activeClub: ClubCordeeDrawerBodyProps['activeClub'];
  members: ClubMemberData[];
  outings: ClubOutingData[];
  currentUserId?: string | null;
  blockedSet: ReadonlySet<string>;
  onInspectMember: (member: ClubMemberData) => void;
  onProposeBinome: ClubCordeeDrawerBodyProps['onProposeBinome'];
  onRetractBinome: ClubCordeeDrawerBodyProps['onRetractBinome'];
  onUpdateMyAvailability: ClubCordeeDrawerBodyProps['onUpdateMyAvailability'];
  onCreateBinomeGroup?: ClubCordeeDrawerBodyProps['onCreateBinomeGroup'];
  onSwitchTabAndLens: ClubCordeeDrawerBodyProps['onSwitchTabAndLens'];
  onToast: ClubCordeeDrawerBodyProps['onToast'];
}) {
  const availKey = `lkdv.clubBinomeAvail.${activeClub.id || 'default'}.${currentUserId || 'guest'}`;
  const proposedKey = `lkdv.clubBinomeProposed.${activeClub.id || 'default'}.${currentUserId || 'guest'}`;

  const [myAvail, setMyAvail] = useLocalStorageState<{
    availableWeekend: boolean;
    days: Array<'sam' | 'dim'>;
    objective: string;
  }>(availKey, {
    availableWeekend: true,
    days: ['sam', 'dim'],
    objective: '',
  });
  const [proposedMap, setProposedMap] = useLocalStorageState<Record<string, { outingId?: string; note?: string }>>(
    proposedKey,
    {},
  );
  const [filter, setFilter] = useState<BinomesFilter>('all');
  const [openFormMemberId, setOpenFormMemberId] = useState<string | null>(null);
  const [selectedOutingId, setSelectedOutingId] = useState('');
  const [proposalNote, setProposalNote] = useState('');
  const [peekPartner, setPeekPartner] = useState<ClubMemberData | null>(null);

  const weekendLabel = useMemo(() => getNextWeekendLabel(), []);
  const upcomingOutings = useMemo(
    () => outings.filter((o) => o.status === 'upcoming' || o.status === 'live'),
    [outings],
  );

  const availablePartners = useMemo(() => {
    const base = members.filter(
      (m) =>
        m.availableWeekend &&
        !blockedSet.has(m.userId || m.id) &&
        (!currentUserId || (m.userId !== currentUserId && m.id !== currentUserId)),
    );

    const scorePartner = (m: ClubMemberData) => {
      let score = 0;
      if (normalizeSearchText(m.massif) === normalizeSearchText(activeClub.massif)) score += 3;
      if ((m.skills ?? []).length > 0) score += 2;
      if (m.followed) score += 1;
      if (outings.some((o) => o.rsvpJoined && o.massif === m.massif)) score += 2;
      return score;
    };

    return base
      .filter((m) => {
        const days = m.availableDays ?? ['sam', 'dim'];
        if (filter === 'sam') return days.includes('sam');
        if (filter === 'dim') return days.includes('dim');
        if (filter === 'massif') return normalizeSearchText(m.massif) === normalizeSearchText(activeClub.massif);
        if (filter === 'proposed') return Boolean(proposedMap[m.id]);
        return true;
      })
      .map((m) => ({ member: m, score: scorePartner(m) }))
      .sort((a, b) => b.score - a.score || a.member.name.localeCompare(b.member.name, 'fr'));
  }, [activeClub.massif, blockedSet, currentUserId, filter, members, outings, proposedMap]);

  if (loading && members.length === 0) {
    return <CordeeSkeleton mode="binomes" />;
  }

  const toggleDay = (d: 'sam' | 'dim') => {
    const nextDays = myAvail.days.includes(d)
      ? myAvail.days.filter((x) => x !== d)
      : [...myAvail.days, d];
    const safeDays: Array<'sam' | 'dim'> = nextDays.length > 0 ? nextDays : [d];
    const next = { ...myAvail, days: safeDays };
    setMyAvail(next);
    void onUpdateMyAvailability(next);
  };

  return (
    <div className="club-drawer-pane-content">
      <div className="club-sec-head">
        <div className="club-sec-head-titles">
          <span className="club-sec-eyebrow">Cordée · Week-end du {weekendLabel}</span>
          <b className="club-sec-title">Binômes disponibles</b>
        </div>
        <span className="lkdv-carnet-chip-soft" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <AnimatedNumber value={availablePartners.length} />
        </span>
      </div>

      <div className="lkdv-carnet-follow-card" style={{ padding: 12 }}>
        <Switch
          checked={myAvail.availableWeekend}
          onCheckedChange={(checked) => {
            const next = { ...myAvail, availableWeekend: checked };
            setMyAvail(next);
            void onUpdateMyAvailability(next);
            onToast({
              title: checked ? 'Disponible ce week-end ✓' : 'Disponibilité masquée',
              subtitle: checked ? `Visible dans ${activeClub.name}` : undefined,
            });
          }}
          label="Je suis disponible ce week-end"
          aria-label="Basculer ma disponibilité pour ce week-end"
        />
        {myAvail.availableWeekend ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['sam', 'dim'] as const).map((d) => {
                const active = myAvail.days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    className={active ? 'club-badge-forest' : 'club-badge-soft'}
                    style={{ border: 0, cursor: 'pointer', padding: '4px 10px' }}
                    onClick={() => toggleDay(d)}
                  >
                    {d.toUpperCase()}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              className="club-inline-input"
              value={myAvail.objective}
              onChange={(e) => setMyAvail((prev) => ({ ...prev, objective: e.target.value }))}
              onBlur={() => void onUpdateMyAvailability(myAvail)}
              placeholder="Mon objectif du week-end (ex : Arête douce, D+ 1100 m)…"
              aria-label="Objectif de sortie pour ce week-end"
            />
          </div>
        ) : null}
      </div>

      <div className="club-filter-rail" data-hscroll="true" role="tablist" aria-label="Filtrer les binômes">
        {(
          [
            { id: 'all', label: 'Tous' },
            { id: 'sam', label: 'Samedi' },
            { id: 'dim', label: 'Dimanche' },
            { id: 'massif', label: 'Même massif' },
            { id: 'proposed', label: 'Proposés' },
          ] as const
        ).map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`club-filter-pill${active ? ' is-active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {active ? (
                <motion.span layoutId="club-binomes-filter-pill" className="club-filter-pill-bg" transition={CLUB_SPRING} />
              ) : null}
              <span className="club-filter-pill-label">{f.label}</span>
            </button>
          );
        })}
      </div>

      {availablePartners.length === 0 ? (
        <ClubEmptyCard
          icon={<Handshake size={22} />}
          title="Aucun binôme disponible pour ce critère"
          description="Activez votre disponibilité week-end ou consultez la liste complète des membres du club."
          actions={
            <>
              <button
                type="button"
                className="lkdv-carnet-btn-primary"
                onClick={() => {
                  const next = { ...myAvail, availableWeekend: true };
                  setMyAvail(next);
                  void onUpdateMyAvailability(next);
                }}
              >
                Me déclarer disponible
              </button>
              <button type="button" className="lkdv-carnet-btn-soft" onClick={() => onSwitchTabAndLens(1, 0)}>
                Tous les membres
              </button>
            </>
          }
        />
      ) : (
        <StaggerList className="reseau-list">
          {availablePartners.map(({ member: m, score }) => {
            const proposed = Boolean(proposedMap[m.id]);
            const isFormOpen = openFormMemberId === m.id;
            const days = m.availableDays ?? ['sam', 'dim'];
            const sameMassif = normalizeSearchText(m.massif) === normalizeSearchText(activeClub.massif);

            return (
              <StaggerCard key={m.id} className="lkdv-carnet-crew-card">
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setPeekPartner(m);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                    <button type="button" className="lkdv-carnet-crew-main" onClick={() => onInspectMember(m)}>
                      <MemberAvatar member={m} size={40} showOnlineDot />
                      <div className="lkdv-carnet-crew-meta">
                        <div className="lkdv-carnet-crew-name-row">
                          <b>{m.name}</b>
                          {(m.role === 'Fondateur' || m.role === 'Guide & Sécurité' || m.role === 'Encadrant') ? (
                            <span className={roleBadgeClass(m.role)}>{m.role}</span>
                          ) : null}
                          {sameMassif ? <span className="club-badge-sage">Même massif</span> : null}
                          {score >= 4 && !sameMassif ? <span className="club-badge-soft">Affinité +</span> : null}
                        </div>
                        <div className="lkdv-carnet-crew-stats" style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
                          <span>{m.massif}</span>
                          {days.map((d) => (
                            <span key={d} className="club-badge-soft" style={{ fontSize: 9.5, padding: '1px 5px' }}>
                              {d.toUpperCase()}
                            </span>
                          ))}
                          {m.carpoolCity ? (
                            <span className="club-badge-soft">
                              <Car size={10} aria-hidden="true" />
                              {m.carpoolCity}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <ChevronRight size={15} className="lkdv-carnet-chevron" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      className={`reseau-btn ${proposed ? 'active' : 'primary'} club-icon-pill`}
                      style={{
                        padding: '0 10px',
                        width: 'auto',
                        fontSize: 11.5,
                        fontWeight: 700,
                        ...(proposed ? { background: '#d3ebd9', color: '#17402c' } : {}),
                      }}
                      aria-expanded={isFormOpen}
                      onClick={async () => {
                        if (proposed) {
                          const prevData = proposedMap[m.id];
                          setProposedMap((prev) => {
                            const copy = { ...prev };
                            delete copy[m.id];
                            return copy;
                          });
                          await onRetractBinome(m);
                          onToast({
                            title: `Proposition retirée (${m.name})`,
                            undo: () => {
                              setProposedMap((prev) => ({ ...prev, [m.id]: prevData }));
                              void onProposeBinome(m, prevData);
                            },
                          });
                          return;
                        }
                        if (!currentUserId) {
                          onToast({ title: 'Connexion requise', subtitle: 'Connectez-vous pour proposer une cordée' });
                          return;
                        }
                        setOpenFormMemberId(isFormOpen ? null : m.id);
                      }}
                    >
                      {proposed ? <Check size={14} aria-hidden="true" /> : <Handshake size={14} aria-hidden="true" />}
                      <span>{proposed ? 'Proposé ✓' : 'Proposer'}</span>
                    </button>
                  </div>

                  {m.seekingObjective ? (
                    <div className="club-objective-box">
                      <Target size={14} style={{ flex: 'none', marginTop: 1 }} aria-hidden="true" />
                      <span>{m.seekingObjective}</span>
                    </div>
                  ) : null}

                  {m.skills.length > 0 ? (
                    <div className="club-skill-tags">
                      {m.skills.slice(0, 3).map((sk) => (
                        <span key={sk} className="lkdv-carnet-metric-pill">{sk}</span>
                      ))}
                    </div>
                  ) : null}

                  <AnimatePresence>
                    {isFormOpen ? (
                      <motion.form
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={CLUB_SPRING}
                        className="club-inline-form"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const payload = {
                            outingId: selectedOutingId || undefined,
                            slot: 'we' as const,
                            note: proposalNote.trim() || undefined,
                          };
                          setProposedMap((prev) => ({ ...prev, [m.id]: payload }));
                          setOpenFormMemberId(null);
                          setProposalNote('');
                          await onProposeBinome(m, payload);
                          onToast({
                            title: `Cordée proposée à ${m.name} ✓`,
                            subtitle: 'Invitation envoyée',
                            undo: () => {
                              setProposedMap((prev) => {
                                const copy = { ...prev };
                                delete copy[m.id];
                                return copy;
                              });
                              void onRetractBinome(m);
                            },
                          });
                        }}
                      >
                        {upcomingOutings.length > 0 ? (
                          <select
                            className="club-inline-select"
                            value={selectedOutingId}
                            onChange={(e) => setSelectedOutingId(e.target.value)}
                            aria-label="Choisir une sortie du club"
                          >
                            <option value="">Sortie libre / à définir ensemble</option>
                            {upcomingOutings.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.title} ({o.date})
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <input
                          type="text"
                          className="club-inline-input"
                          value={proposalNote}
                          onChange={(e) => setProposalNote(e.target.value)}
                          placeholder="Lieu de RDV ou créneau souhaité…"
                          aria-label="Message de proposition de binôme"
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                          {onCreateBinomeGroup ? (
                            <button
                              type="button"
                              className="lkdv-carnet-btn-soft"
                              style={{ height: 30, fontSize: 11.5 }}
                              onClick={() => void onCreateBinomeGroup(m, selectedOutingId || undefined)}
                            >
                              <MessageCircle size={13} aria-hidden="true" />
                              <span>Chat de cordée</span>
                            </button>
                          ) : <span />}
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              type="button"
                              className="lkdv-carnet-btn-soft"
                              style={{ height: 30, fontSize: 11.5 }}
                              onClick={() => setOpenFormMemberId(null)}
                            >
                              Annuler
                            </button>
                            <button type="submit" className="lkdv-carnet-btn-primary" style={{ height: 30, fontSize: 11.5 }}>
                              Envoyer
                            </button>
                          </div>
                        </div>
                      </motion.form>
                    ) : null}
                  </AnimatePresence>
                </div>
              </StaggerCard>
            );
          })}
        </StaggerList>
      )}

      <button
        type="button"
        className="lkdv-carnet-btn-soft"
        style={{ width: '100%', justifyContent: 'center' }}
        onClick={() => onSwitchTabAndLens(4, 3, { g02Section: 'matching' })}
      >
        <Sparkles size={14} aria-hidden="true" />
        <span>Matching activités & traces similaires</span>
      </button>

      <ClubEntityPeek
        open={Boolean(peekPartner)}
        title={peekPartner?.name || ''}
        subtitle={peekPartner ? `@${peekPartner.handle} · ${peekPartner.massif}` : undefined}
        imageUrl={peekPartner?.avatarUrl}
        monogram={peekPartner?.name.slice(0, 2).toUpperCase()}
        actions={
          peekPartner
            ? [
                {
                  id: 'inspect',
                  label: 'Aperçu Cordée',
                  icon: <UserRound size={17} aria-hidden="true" />,
                  onSelect: () => onInspectMember(peekPartner),
                },
                {
                  id: 'propose',
                  label: 'Proposer un binôme',
                  icon: <Handshake size={17} aria-hidden="true" />,
                  onSelect: () => setOpenFormMemberId(peekPartner.id),
                },
              ]
            : []
        }
        onClose={() => setPeekPartner(null)}
      />
    </div>
  );
}

interface PublicCarnetSummary {
  id: string;
  slug: string;
  title: string;
  massif?: string | null;
  distance_km?: number | null;
}

const publicCarnetsCache = new Map<string, PublicCarnetSummary[]>();

function InspectedMemberStackPane({
  lensId,
  active,
  activeClub,
  member,
  roster,
  outings,
  posts,
  vaultGear,
  currentUserId,
  onInspectMember,
  onToggleFollowMember,
  onProposeBinome,
  onChangeMemberRole,
  onBorrowGear,
  onSwitchTabAndLens,
  onOpenMemberProfile,
  onToast,
  onClose,
}: {
  lensId: 'm-stats' | 'm-outings' | 'm-gear' | 'm-media';
  active: boolean;
  activeClub: ClubCordeeDrawerBodyProps['activeClub'];
  member: ClubMemberData;
  roster: ClubMemberData[];
  outings: ClubOutingData[];
  posts: ClubFeedPostItem[];
  vaultGear: ClubGearVaultItem[];
  currentUserId?: string | null;
  onInspectMember: (member: ClubMemberData | null) => void;
  onToggleFollowMember: (member: ClubMemberData) => void;
  onProposeBinome: ClubCordeeDrawerBodyProps['onProposeBinome'];
  onChangeMemberRole?: ClubCordeeDrawerBodyProps['onChangeMemberRole'];
  onBorrowGear?: ClubCordeeDrawerBodyProps['onBorrowGear'];
  onSwitchTabAndLens: ClubCordeeDrawerBodyProps['onSwitchTabAndLens'];
  onOpenMemberProfile: (handle: string) => void;
  onToast: ClubCordeeDrawerBodyProps['onToast'];
  onClose: () => void;
}) {
  const backBtnRef = useRef<HTMLButtonElement | null>(null);
  const [publicCarnets, setPublicCarnets] = useState<PublicCarnetSummary[]>([]);
  const [proposedHere, setProposedHere] = useState(false);

  useEffect(() => {
    if (!active) return;
    backBtnRef.current?.focus({ preventScroll: true });
  }, [active, member.id]);

  // Lazy fetch up to 3 public carnets of inspected member (cached)
  useEffect(() => {
    if (lensId !== 'm-outings' || !active) return;
    const uid = member.userId || member.id;
    if (!uid || !/^[0-9a-f]{8}-/i.test(uid)) return;
    const cached = publicCarnetsCache.get(uid);
    if (cached) {
      setPublicCarnets(cached);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('carnets')
          .select('id, slug, title, massif, distance_km')
          .eq('user_id', uid)
          .eq('visibility', 'public')
          .limit(3);
        if (!cancelled && Array.isArray(data)) {
          publicCarnetsCache.set(uid, data as PublicCarnetSummary[]);
          setPublicCarnets(data as PublicCarnetSummary[]);
        }
      } catch {
        // ignore in offline/test env
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, lensId, member.id, member.userId]);

  const memberOutings = useMemo(
    () =>
      outings.filter(
        (o) => (o.leaderHandle || '').toLowerCase() === (member.handle || '').toLowerCase(),
      ),
    [member.handle, outings],
  );
  const memberGear = useMemo(
    () =>
      vaultGear.filter(
        (g) => (g.ownerHandle || '').toLowerCase() === (member.handle || '').toLowerCase(),
      ),
    [member.handle, vaultGear],
  );
  const memberPosts = useMemo(
    () =>
      posts.filter(
        (p) => (p.authorHandle || '').toLowerCase() === (member.handle || '').toLowerCase(),
      ),
    [member.handle, posts],
  );
  const photoPosts = useMemo(() => memberPosts.filter((p) => Boolean(p.mediaUrl)), [memberPosts]);

  const rosterIndex = roster.findIndex((r) => r.id === member.id);
  const prevMember = rosterIndex > 0 ? roster[rosterIndex - 1] : null;
  const nextMember = rosterIndex >= 0 && rosterIndex < roster.length - 1 ? roster[rosterIndex + 1] : null;

  const isClubAdmin = activeClub.viewerRole === 'admin' || /fondateur|admin/i.test(activeClub.role);
  const joinedLabel = formatJoinedSince(member.joinedAt);
  const viewerLedUpcoming = outings.find((o) => o.status === 'upcoming');

  return (
    <div className="club-drawer-pane-content">
      <div className="club-stack-header">
        <button
          ref={backBtnRef}
          type="button"
          className="club-stack-back"
          onClick={() => onInspectMember(null)}
        >
          <ChevronLeft size={16} aria-hidden="true" />
          <span>Retour</span>
        </button>
        <b className="club-stack-title">Aperçu Cordée · {member.name}</b>
        {roster.length > 1 && rosterIndex >= 0 ? (
          <div className="club-stack-nav-btns">
            <button
              type="button"
              className="reseau-btn active club-icon-pill"
              style={{ minWidth: 28, height: 28 }}
              disabled={!prevMember}
              onClick={() => prevMember && onInspectMember(prevMember)}
              aria-label="Membre précédent"
            >
              <ChevronLeft size={14} aria-hidden="true" />
            </button>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#56665d', fontVariantNumeric: 'tabular-nums' }}>
              {rosterIndex + 1}/{roster.length}
            </span>
            <button
              type="button"
              className="reseau-btn active club-icon-pill"
              style={{ minWidth: 28, height: 28 }}
              disabled={!nextMember}
              onClick={() => nextMember && onInspectMember(nextMember)}
              aria-label="Membre suivant"
            >
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      <StackSlideView stackKey={`member-${member.id}-${lensId}`}>
        <div className="club-glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <MemberAvatar member={member} size={48} showOnlineDot />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                <b style={{ fontSize: 15, color: '#172b24' }}>{member.name}</b>
                <span className={roleBadgeClass(member.role)}>{member.role}</span>
                {member.isNew7d ? <span className="club-badge-sage">Nouveau</span> : null}
                {member.isProAthlete ? <span className="club-badge-forest">★ Pro</span> : null}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11.5, color: '#56665d', marginTop: 2 }}>
                <button
                  type="button"
                  style={{ border: 0, background: 'none', padding: 0, color: '#17402c', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}
                  onClick={async () => {
                    const url = `${window.location.origin}/profil/${member.handle}`;
                    try {
                      await navigator.clipboard?.writeText(url);
                      onToast({ title: `Lien @${member.handle} copié ✓` });
                    } catch {
                      // ignore
                    }
                  }}
                >
                  <span>@{member.handle}</span>
                  <Copy size={11} aria-hidden="true" />
                </button>
                <span>· {member.massif}</span>
                {joinedLabel ? <span>· depuis {joinedLabel}</span> : null}
              </div>
            </div>
          </div>
        </div>

        {lensId === 'm-stats' ? (
          <>
            <div className="lkdv-carnet-kpi-grid-3">
              <div className="lkdv-carnet-kpi-mini">
                <small>Sorties club</small>
                <b><AnimatedNumber value={member.outingsCount ?? memberOutings.length} /></b>
              </div>
              <div className="lkdv-carnet-kpi-mini">
                <small>Publications</small>
                <b><AnimatedNumber value={memberPosts.length} /></b>
              </div>
              <div className="lkdv-carnet-kpi-mini">
                <small>Matériel prêté</small>
                <b><AnimatedNumber value={memberGear.length} /></b>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button
                type="button"
                className={member.followed ? 'lkdv-carnet-btn-soft' : 'lkdv-carnet-btn-primary'}
                onClick={() => onToggleFollowMember(member)}
              >
                {member.followed ? <UserCheck size={14} aria-hidden="true" /> : <UserPlus size={14} aria-hidden="true" />}
                <span>{member.followed ? 'Suivi' : 'Suivre'}</span>
              </button>
              <button
                type="button"
                className={proposedHere ? 'lkdv-carnet-btn-soft' : 'lkdv-carnet-btn-primary'}
                onClick={async () => {
                  setProposedHere(true);
                  await onProposeBinome(member, { slot: 'we' });
                  onToast({ title: `Binôme proposé à ${member.name} ✓` });
                }}
              >
                <Handshake size={14} aria-hidden="true" />
                <span>{proposedHere ? 'Proposé ✓' : 'Proposer un binôme'}</span>
              </button>
              <button
                type="button"
                className="lkdv-carnet-btn-soft"
                onClick={() => onSwitchTabAndLens(4, 1, { chatDraft: `@${member.handle} ` })}
              >
                <MessageCircle size={14} aria-hidden="true" />
                <span>Message / Canal</span>
              </button>
              {viewerLedUpcoming && currentUserId ? (
                <button
                  type="button"
                  className="lkdv-carnet-btn-soft"
                  onClick={async () => {
                    await onProposeBinome(member, { outingId: viewerLedUpcoming.id });
                    onToast({ title: `${member.name} invité sur « ${viewerLedUpcoming.title} » ✓` });
                  }}
                >
                  <Send size={14} aria-hidden="true" />
                  <span>Inviter sur ma sortie</span>
                </button>
              ) : null}
              <button
                type="button"
                className="lkdv-carnet-btn-soft"
                onClick={() => onOpenMemberProfile(member.handle)}
              >
                <span>Profil complet</span>
                <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            </div>

            {member.seekingObjective ? (
              <div className="club-objective-box">
                <Target size={15} style={{ flex: 'none', marginTop: 1 }} aria-hidden="true" />
                <span>Objectif binôme : {member.seekingObjective}</span>
              </div>
            ) : null}

            <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="club-sec-eyebrow">Massif & Compétences</span>
              <div className="club-skill-tags">
                <span className="lkdv-carnet-metric-pill">
                  <MapPin size={11} aria-hidden="true" />
                  {member.massif}
                </span>
                {member.skills.map((sk) => (
                  <span key={sk} className="lkdv-carnet-metric-pill">{sk}</span>
                ))}
              </div>
            </div>

            <div className="lkdv-sig club-glass-card">
              <b style={{ fontSize: 12.5, color: '#17402c', display: 'block' }}>Points communs dans {activeClub.name}</b>
              <span style={{ fontSize: 11.5, color: '#56665d' }}>
                {member.massif === activeClub.massif
                  ? `Même massif d’ancrage (${activeClub.massif})`
                  : `Actif sur ${member.massif}`}
                {member.availableWeekend ? ' · Disponible ce week-end' : ''}
              </span>
            </div>

            {isClubAdmin && onChangeMemberRole && member.role !== 'Fondateur' ? (
              <div className="club-glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#172b24' }}>Gestion club · Rôle</span>
                <select
                  className="club-inline-select"
                  style={{ width: 'auto', minWidth: 140 }}
                  value={member.rawRole || 'member'}
                  onChange={(e) => {
                    const nextRole = e.target.value as 'admin' | 'moderator' | 'member';
                    void onChangeMemberRole(member, nextRole);
                  }}
                  aria-label="Modifier le rôle du membre"
                >
                  <option value="member">Membre actif</option>
                  <option value="moderator">Encadrant / Modérateur</option>
                  <option value="admin">Guide & Sécurité / Admin</option>
                </select>
              </div>
            ) : null}
          </>
        ) : null}

        {lensId === 'm-outings' ? (
          memberOutings.length === 0 && publicCarnets.length === 0 ? (
            <ClubEmptyCard
              icon={<Mountain size={22} />}
              title="Aucune sortie enregistrée"
              description="Les sorties encadrées et carnets publics de ce membre apparaîtront ici."
            />
          ) : (
            <StaggerList className="lkdv-carnet-cards-col">
              {memberOutings.map((o) => (
                <StaggerCard key={o.id}>
                  <button
                    type="button"
                    className="lkdv-carnet-roadbook-card club-glass-card"
                    style={{ width: '100%', border: 0, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onClick={() => onSwitchTabAndLens(2, 0, { inspectOuting: o })}
                  >
                    <div>
                      <b style={{ fontSize: 13.5, display: 'block' }}>{o.title}</b>
                      <span style={{ fontSize: 11.5, color: '#56665d' }}>
                        {o.date} · {o.massif} · {o.km} km · +{o.dplus} m
                      </span>
                    </div>
                    <ArrowUpRight size={15} color="#17402c" aria-hidden="true" />
                  </button>
                </StaggerCard>
              ))}
              {publicCarnets.map((c) => (
                <StaggerCard key={c.id}>
                  <div className="club-glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <b style={{ fontSize: 13 }}>{c.title}</b>
                      <div style={{ fontSize: 11.5, color: '#56665d' }}>
                        Carnet public{c.massif ? ` · ${c.massif}` : ''}{c.distance_km ? ` · ${c.distance_km} km` : ''}
                      </div>
                    </div>
                    <span className="club-badge-sage">Carnet</span>
                  </div>
                </StaggerCard>
              ))}
            </StaggerList>
          )
        ) : null}

        {lensId === 'm-gear' ? (
          memberGear.length === 0 ? (
            <ClubEmptyCard
              icon={<Package size={22} />}
              title="Aucun équipement partagé"
              description="Ce membre n’a pas encore déposé de matériel dans le coffre du club."
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {memberGear.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="lkdv-carnet-kit-mini-tile club-glass-card"
                  style={{ border: 0, textAlign: 'left', cursor: 'pointer', padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }}
                  onClick={() => {
                    if (onBorrowGear && g.available) {
                      onBorrowGear(g.id);
                    } else {
                      onSwitchTabAndLens(3, 0, { highlightGearId: g.id });
                    }
                  }}
                >
                  <b style={{ fontSize: 12, color: '#172b24' }}>{g.name}</b>
                  <small style={{ fontSize: 10.5, color: '#56665d', fontVariantNumeric: 'tabular-nums' }}>
                    {g.weightG} g
                  </small>
                  <span className={g.available ? 'club-badge-sage' : 'club-badge-amber'} style={{ fontSize: 9.5, alignSelf: 'flex-start' }}>
                    {g.available ? 'Emprunter' : 'Prêté'}
                  </span>
                </button>
              ))}
            </div>
          )
        ) : null}

        {lensId === 'm-media' ? (
          memberPosts.length === 0 ? (
            <ClubEmptyCard
              icon={<ImageIcon size={22} />}
              title="Aucune publication dans la tribu"
              description="Les photos de sortie et retours terrain publiés par ce membre apparaîtront ici."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {photoPosts.length > 0 ? (
                <div className="lkdv-ig-grid">
                  {photoPosts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="lkdv-ig-tile"
                      onClick={() => {
                        onClose();
                        document.getElementById(`club-feed-post-${p.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.mediaUrl} alt={p.spot} loading="lazy" />
                    </button>
                  ))}
                </div>
              ) : null}
              {memberPosts.filter((p) => !p.mediaUrl).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="club-glass-card"
                  style={{ border: 0, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  onClick={() => {
                    onClose();
                    document.getElementById(`club-feed-post-${p.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                >
                  <FileText size={15} color="#17402c" aria-hidden="true" />
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 12.5, display: 'block' }}>{p.spot}</b>
                    <span style={{ fontSize: 11.5, color: '#56665d' }}>{p.caption}</span>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : null}
      </StackSlideView>
    </div>
  );
}

export function ClubCordeeDrawerBody(props: ClubCordeeDrawerBodyProps) {
  const blockedSet = useMemo(() => {
    if (!props.blockedUserIds) return new Set<string>();
    return props.blockedUserIds instanceof Set
      ? props.blockedUserIds
      : new Set(props.blockedUserIds);
  }, [props.blockedUserIds]);

  if (props.inspectedMember) {
    const memberLens =
      props.lensId === 'm-outings' ||
      props.lensId === 'm-gear' ||
      props.lensId === 'm-media'
        ? props.lensId
        : 'm-stats';

    return (
      <InspectedMemberStackPane
        lensId={memberLens}
        active={props.active}
        activeClub={props.activeClub}
        member={props.inspectedMember}
        roster={props.filteredRoster && props.filteredRoster.length > 0 ? props.filteredRoster : props.members}
        outings={props.outings}
        posts={props.posts}
        vaultGear={props.vaultGear}
        currentUserId={props.currentUserId}
        onInspectMember={(m) => props.onInspectMember(m)}
        onToggleFollowMember={(m) => props.onToggleFollowMember(m)}
        onProposeBinome={props.onProposeBinome}
        onChangeMemberRole={props.onChangeMemberRole}
        onBorrowGear={props.onBorrowGear}
        onSwitchTabAndLens={props.onSwitchTabAndLens}
        onOpenMemberProfile={props.onOpenMemberProfile}
        onToast={props.onToast}
        onClose={props.onClose}
      />
    );
  }

  if (props.lensId === 'members-guides') {
    return (
      <MembersGuidesPane
        loading={props.loading}
        activeClub={props.activeClub}
        members={props.members}
        outings={props.outings}
        blockedSet={blockedSet}
        onInspectMember={(m) => props.onInspectMember(m, 1)}
        onToggleFollowMember={(m) => void props.onToggleFollowMember(m)}
        onSwitchTabAndLens={props.onSwitchTabAndLens}
      />
    );
  }

  if (props.lensId === 'members-binomes') {
    return (
      <MembersBinomesPane
        loading={props.loading}
        activeClub={props.activeClub}
        members={props.members}
        outings={props.outings}
        currentUserId={props.currentUserId}
        blockedSet={blockedSet}
        onInspectMember={(m) => props.onInspectMember(m, 2)}
        onProposeBinome={props.onProposeBinome}
        onRetractBinome={props.onRetractBinome}
        onUpdateMyAvailability={props.onUpdateMyAvailability}
        onCreateBinomeGroup={props.onCreateBinomeGroup}
        onSwitchTabAndLens={props.onSwitchTabAndLens}
        onToast={props.onToast}
      />
    );
  }

  return (
    <MembersAllPane
      loading={props.loading}
      activeClub={props.activeClub}
      members={props.members}
      currentUserId={props.currentUserId}
      blockedSet={blockedSet}
      onInspectMember={(m) => props.onInspectMember(m, 0)}
      onToggleFollowMember={(m) => void props.onToggleFollowMember(m)}
      onSwitchTabAndLens={props.onSwitchTabAndLens}
      onOpenMemberProfile={props.onOpenMemberProfile}
    />
  );
}

export default ClubCordeeDrawerBody;
