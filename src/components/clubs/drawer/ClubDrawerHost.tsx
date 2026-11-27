'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Backpack,
  BarChart2,
  BarChart3,
  Calendar,
  CalendarPlus,
  Camera,
  Car,
  Check,
  ChevronLeft,
  CloudSun,
  Compass,
  Eye,
  Feather,
  Handshake,
  Leaf,
  MessageCircle,
  MessageSquare,
  MessageSquarePlus,
  Mountain,
  Package,
  PlusCircle,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  type DrawerSecondaryItem,
  type DrawerTab,
} from '@/components/compte/drawer/shell/DrawerShell';
import { SlotShell } from '@/components/compte/drawer/SlotShell';
import { KIT_CARD_CSS } from '@/components/compte/drawer/cards/KitCard';
import { SortMenuButton } from '@/components/ui/drawer/SortMenuButton';
import { CapsuleTabs } from '@/components/ui/CapsuleTabs';
import {
  CollapsibleHeroPreview,
  useScrollCollapsePreview,
} from '@/features/community/v2/create/photo/CollapsibleHeroPreview';
import { useDragDismiss } from '@/hooks/gestures/useDragDismiss';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import '@/styles/carnet-v2.css';
import './club-drawers-v2.css';
import { ClubMotionRoot, LensTransition } from './ClubDrawerMotion';
import { useClubDialog } from './useClubDialog';
import { ClubIsland, type ClubIslandToast } from './ClubIsland';
import { ClubStatsHubDrawerBody, type MemberRoleFilter, type MemberSortMetric } from './ClubStatsHubDrawerBody';
import type { ClubStatsWindow } from './clubStatsTypes';
import { ClubCordeeDrawerBody } from './ClubCordeeDrawerBody';
import { ClubSortiesDrawerBody, type OutingFilterId, type WeatherWindowId } from './ClubSortiesDrawerBody';
import { ClubOutingDetailSheet } from './outing/ClubOutingDetailSheet';
import {
  cleanOutingTitle,
  downloadOutingIcs,
  downloadRealOutingGpx,
} from './outing/outingUtils';
import { ClubCoffreDrawerBody, type KitSeasonFilter, type VaultFilterId, type VaultScopeId } from './ClubCoffreDrawerBody';
import { ClubPokedexDrawerBody } from './ClubPokedexDrawerBody';
import { ClubSalonsDrawerBody } from './ClubSalonsDrawerBody';
import { ClubCreateDrawerBody } from './ClubCreateDrawerBody';
import { ClubAdminDrawerShell } from './admin/ClubAdminDrawerShell';
import { useClubCapabilities } from './admin/useClubCapabilities';
import type { ClubG02Section } from '../g02/ClubG02Screen';
import type {
  ClubDrawerHostProps,
  ClubDrawerNavOptions,
  ClubMemberData,
  ClubOutingData,
  ClubToastPayload,
  CordeeLensId,
  MemberDetailLensId,
} from './ClubDrawerTypes';

export * from './ClubDrawerTypes';

const RESUME_MEMO_MIN = 20;
const RESUME_TOP_MAX = 10;

type ClubStackEntry =
  | { type: 'member'; member: ClubMemberData; returnTab: number; returnSubTab: number }
  | { type: 'outing'; outing: ClubOutingData; returnTab: number; returnSubTab: number };

function memberHasClubRole(member: Pick<ClubMemberData, 'role' | 'rawRole'>): boolean {
  if (
    member.rawRole === 'founder' ||
    member.rawRole === 'admin' ||
    member.rawRole === 'moderator' ||
    member.rawRole === 'volunteer'
  ) {
    return true;
  }
  return (
    member.role === 'Fondateur' ||
    member.role === 'Guide & Sécurité' ||
    member.role === 'Encadrant' ||
    member.role === 'Bénévole'
  );
}

export function ClubDrawerHost({
  mode,
  isOpen = true,
  initialTab = 0,
  initialSubTab = 0,
  initialSearch = false,
  initialOutingId,
  initialMemberId,
  initialSection,
  intent,
  syncStatus = 'synced',
  onRetrySync,
  currentUserId = null,
  currentUserHandle = null,
  blockedUserIds,
  isOutdoor = false,
  reduceMotion = false,
  activeClub,
  clubs,
  members,
  outings,
  vaultGear,
  standardKits,
  pokedexItems = [],
  onPokedexObservationCreated,
  challenges,
  chatMessages,
  posts,
  onSelectClub,
  onToggleJoinClub,
  onToggleFollowMember,
  onProposeBinome,
  onRetractBinome,
  onUpdateMyAvailability,
  onChangeMemberRole,
  onToggleMemberStoryPermission,
  onToggleMemberGearPermission,
  onToggleMemberLeaderBadge,
  onCreateBinomeGroup,
  onToggleRsvpOuting,
  onCreateGroupFromOuting,
  onDownloadGpx,
  onFlyToCoords,
  onToggleReserveGear,
  onRequestGearLoan,
  onTransitionGearLoan,
  onCloneStandardKit,
  onSendChatMessage,
  onToggleClubVisibility,
  onCreatePost,
  onCreateOuting,
  onCreateVaultGear,
  onCreateNewClub,
  onToast,
  onOpenRuntimeOverlay,
  onTabChange,
  onClose,
}: ClubDrawerHostProps) {
  const { haptic } = useHapticFeedback();
  const clubCaps = useClubCapabilities(activeClub, currentUserId);
  const canAccessClubAdmin = clubCaps.canAccessAdmin;
  const [internalMode, setInternalMode] = useState<'main' | 'create' | 'settings'>(mode);

  useEffect(() => {
    if (internalMode === 'settings' && !canAccessClubAdmin) {
      setInternalMode('main');
    }
  }, [internalMode, canAccessClubAdmin]);
  const [tab, setTab] = useState<number>(initialSearch ? 0 : Math.min(5, Math.max(0, initialTab)));
  const [outingLensIndex, setOutingLensIndex] = useState<number>(0);
  const [subTabs, setSubTabs] = useState<Record<number, number>>({
    0: initialTab === 0 ? Math.min(3, Math.max(0, initialSubTab)) : 0,
    1: initialTab === 1 ? initialSubTab : 0,
    2: initialTab === 2 ? initialSubTab : 0,
    3: initialTab === 3 ? initialSubTab : 0,
    4: initialTab === 4 ? initialSubTab : 0,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [pokedexKingdomFilter, setPokedexKingdomFilter] = useState<
    'all' | 'faune' | 'flore' | 'geologie'
  >('all');
  const [pokedexOutingFilter, setPokedexOutingFilter] = useState<string>('all');
  const [pokedexDetailOpen, setPokedexDetailOpen] = useState<boolean>(false);
  const [stack, setStack] = useState<ClubStackEntry[]>([]);
  const [inspectedMember, setInspectedMember] = useState<ClubMemberData | null>(null);
  const [memberLensIndex, setMemberLensIndex] = useState(0);
  const isMemberTimelineLens = tab === 1 && Boolean(inspectedMember) && memberLensIndex === 1;
  const [memberHeaderCompact, setMemberHeaderCompact] = useScrollCollapsePreview(
    tab === 1 && Boolean(inspectedMember) && !isMemberTimelineLens,
  );
  const memberHeroTouchYRef = useRef<number | null>(null);

  useEffect(() => {
    setMemberHeaderCompact(memberLensIndex === 1);
  }, [inspectedMember?.id, memberLensIndex, setMemberHeaderCompact]);

  // Permet aussi de replier l'aperçu même sur un contenu court ou en scrollant directement dessus
  useEffect(() => {
    if (tab !== 1 || !inspectedMember || isMemberTimelineLens) return;
    const root = paneRootRef.current;
    if (!root) return;
    const handleWheel = (e: WheelEvent) => {
      if (isMemberTimelineLens) return;
      if (Math.abs(e.deltaY) < 4) return;
      if (e.deltaY > 10) {
        setMemberHeaderCompact(true);
      } else if (e.deltaY < -10) {
        const activePane = root.querySelector('.lkdv-lens-pane[data-testid="slot-content"]') as HTMLElement | null;
        if (!activePane || activePane.scrollTop <= 4) {
          setMemberHeaderCompact(false);
        }
      }
    };
    root.addEventListener('wheel', handleWheel, { passive: true });
    return () => root.removeEventListener('wheel', handleWheel);
  }, [tab, inspectedMember, isMemberTimelineLens, setMemberHeaderCompact]);
  const [inspectedOuting, setInspectedOuting] = useState<ClubOutingData | null>(null);
  const [inspectedPokedexId, setInspectedPokedexId] = useState<string | null>(null);
  const [focusedKitId, setFocusedKitId] = useState<string | null>(null);

  const isTimelineDrawer =
    internalMode === 'main' &&
    ((tab === 2 && (subTabs[2] ?? 0) === 0 && !inspectedOuting) ||
      (tab === 1 && Boolean(inspectedMember) && memberLensIndex === 1));

  useEffect(() => {
    if (!isTimelineDrawer || typeof document === 'undefined') return;
    const phoneEl = document.getElementById('phone');
    if (phoneEl?.classList.contains('map-collapsed')) {
      document.getElementById('club-map-pill')?.click();
    }
  }, [isTimelineDrawer]);
  const [g02Section, setG02Section] = useState<ClubG02Section | undefined>(initialSection);
  const [chatDraftPrefill, setChatDraftPrefill] = useState('');
  const [createPrefillMassif, setCreatePrefillMassif] = useState<string | undefined>(undefined);
  const [localToast, setLocalToast] = useState<ClubIslandToast | null>(null);
  const [statsWindow, setStatsWindow] = useState<ClubStatsWindow>('all');
  const [memberSort, setMemberSort] = useState<MemberSortMetric>('distance');
  const [memberRoleFilter, setMemberRoleFilter] = useState<MemberRoleFilter>('all');
  const [outingFilter, setOutingFilter] = useState<OutingFilterId>('all');
  const [vaultFilter, setVaultFilter] = useState<VaultFilterId>('all');
  const [vaultScope, setVaultScope] = useState<VaultScopeId>('all');
  const [weatherWindow, setWeatherWindow] = useState<WeatherWindowId>('morning');
  const [kitSeason, setKitSeason] = useState<KitSeasonFilter>('all');

  const emitToast = useCallback(
    (payload: ClubToastPayload) => {
      if (onToast) {
        onToast(payload);
        return;
      }
      setLocalToast({
        id: String(Date.now()),
        message: payload.title,
        subtitle: payload.subtitle,
        undo: payload.undo,
      });
    },
    [onToast],
  );

  useEffect(() => {
    setInternalMode(mode);
  }, [mode]);

  const openMemberProfileByHandle = useCallback((handle: string) => {
    const clean = (handle || '').replace(/^@/, '').trim();
    if (!clean || typeof window === 'undefined') return;
    const navFn = (window as unknown as { __lkdvNavigateProfile?: (h: string) => void }).__lkdvNavigateProfile;
    if (typeof navFn === 'function') {
      navFn(clean);
      return;
    }
    window.location.assign(`/profil/${encodeURIComponent(clean)}`);
  }, []);

  // Sync external intent / deep-links
  useEffect(() => {
    if (!intent) return;
    setInternalMode('main');
    const nextTab = Math.min(5, Math.max(0, intent.tab ?? tab));
    if (typeof intent.tab === 'number') setTab(nextTab);
    if (typeof intent.subTab === 'number') {
      setSubTabs((prev) => ({ ...prev, [nextTab]: intent.subTab! }));
    }
    if (intent.initialSection) setG02Section(intent.initialSection);
    if (intent.searchQuery !== undefined) setSearchQuery(intent.searchQuery);

    if (intent.pokedexId) {
      setInspectedPokedexId(intent.pokedexId);
      setInspectedMember(null);
      setInspectedOuting(null);
      setFocusedKitId(null);
      setTab(5);
      setSubTabs((prev) => ({ ...prev, 5: 0 }));
    } else if (intent.kitId) {
      setFocusedKitId(intent.kitId);
      setInspectedPokedexId(null);
      setInspectedOuting(null);
      setInspectedMember(null);
      setTab(3);
      setSubTabs((prev) => ({ ...prev, 3: 1 }));
    } else if (intent.outingId) {
      setInspectedPokedexId(null);
      setFocusedKitId(null);
      const foundOuting = outings.find((o) => o.id === intent.outingId);
      if (foundOuting) {
        setInspectedOuting(foundOuting);
        setInspectedMember(null);
        setTab(2);
        setStack((prev) => [...prev, { type: 'outing', outing: foundOuting, returnTab: nextTab, returnSubTab: intent.subTab ?? 0 }]);
      }
    } else if (intent.memberId) {
      setInspectedPokedexId(null);
      setFocusedKitId(null);
      const foundMember = members.find(
        (m) => m.id === intent.memberId || m.userId === intent.memberId || m.handle === intent.memberId,
      );
      if (foundMember) {
        if (!memberHasClubRole(foundMember)) {
          openMemberProfileByHandle(foundMember.handle);
        } else {
          setInspectedMember(foundMember);
          setMemberLensIndex(0);
          setInspectedOuting(null);
          setTab(1);
          setStack((prev) => [...prev, { type: 'member', member: foundMember, returnTab: nextTab, returnSubTab: intent.subTab ?? 0 }]);
        }
      } else {
        openMemberProfileByHandle(intent.memberId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent?.nonce]);

  // Initial outing/member deep-link on mount
  const appliedInitialDeepLinkRef = useRef(false);
  useEffect(() => {
    if (appliedInitialDeepLinkRef.current) return;
    if (initialOutingId) {
      const found = outings.find((o) => o.id === initialOutingId);
      if (found) {
        appliedInitialDeepLinkRef.current = true;
        setInspectedOuting(found);
        setTab(2);
        setStack([{ type: 'outing', outing: found, returnTab: 2, returnSubTab: 0 }]);
      }
    } else if (initialMemberId) {
      const found = members.find((m) => m.id === initialMemberId || m.userId === initialMemberId);
      if (found) {
        appliedInitialDeepLinkRef.current = true;
        if (!memberHasClubRole(found)) {
          openMemberProfileByHandle(found.handle);
        } else {
          setInspectedMember(found);
          setMemberLensIndex(0);
          setTab(1);
          setStack([{ type: 'member', member: found, returnTab: 1, returnSubTab: 0 }]);
        }
      }
    }
  }, [initialMemberId, initialOutingId, members, openMemberProfileByHandle, outings]);

  const currentSub = subTabs[tab] ?? 0;
  const setSubForTab = useCallback((targetTab: number, idx: number) => {
    setSubTabs((prev) => ({ ...prev, [targetTab]: idx }));
  }, []);

  const popStack = useCallback(() => {
    setStack((prev) => {
      if (prev.length === 0) {
        setInspectedMember(null);
        setInspectedOuting(null);
        return prev;
      }
      const last = prev[prev.length - 1];
      const next = prev.slice(0, -1);
      const nextTop = next[next.length - 1];
      if (nextTop?.type === 'member') {
        setInspectedMember(nextTop.member);
        setInspectedOuting(null);
        setTab(1);
      } else if (nextTop?.type === 'outing') {
        setInspectedOuting(nextTop.outing);
        setInspectedMember(null);
        setTab(2);
      } else {
        setInspectedMember(null);
        setInspectedOuting(null);
        setTab(last.returnTab);
        setSubTabs((s) => ({ ...s, [last.returnTab]: last.returnSubTab }));
      }
      haptic('light');
      return next;
    });
  }, [haptic]);

  const pushMember = useCallback(
    (member: ClubMemberData | null, sourceLens?: number) => {
      if (!member) {
        popStack();
        return;
      }
      if (!memberHasClubRole(member)) {
        openMemberProfileByHandle(member.handle);
        return;
      }
      setStack((prev) => [
        ...prev,
        { type: 'member', member, returnTab: tab, returnSubTab: sourceLens ?? (subTabs[tab] ?? 0) },
      ]);
      setInspectedOuting(null);
      setInspectedMember(member);
      setMemberLensIndex(0);
      if (tab !== 1) setTab(1);
      haptic('light');
    },
    [haptic, openMemberProfileByHandle, popStack, subTabs, tab],
  );

  const pushOuting = useCallback(
    (outing: ClubOutingData | null, sourceLens?: number) => {
      if (!outing) {
        popStack();
        return;
      }
      setStack((prev) => [
        ...prev,
        { type: 'outing', outing, returnTab: tab, returnSubTab: sourceLens ?? (subTabs[tab] ?? 0) },
      ]);
      setInspectedMember(null);
      setInspectedOuting(outing);
      if (tab !== 2) setTab(2);
      haptic('light');
    },
    [haptic, popStack, subTabs, tab],
  );

  const handleEscapeOrClose = useCallback(() => {
    if (stack.length > 0 || inspectedMember || inspectedOuting) {
      if (stack.length > 0) {
        popStack();
      } else {
        setInspectedMember(null);
        setInspectedOuting(null);
        haptic('light');
      }
      return;
    }
    onClose?.();
  }, [haptic, inspectedMember, inspectedOuting, onClose, popStack, stack.length]);

  const dialogRef = useClubDialog(isOpen, handleEscapeOrClose);
  const paneRootRef = useRef<HTMLDivElement | null>(null);
  const attachPaneRoot = useCallback(
    (node: HTMLDivElement | null) => {
      paneRootRef.current = node;
      dialogRef.current = node;
    },
    [dialogRef],
  );

  const { dragProps, handleProps, y, isDragging } = useDragDismiss({
    onDismiss: () => onClose?.(),
    mode: 'handle',
  });

  const handleSwitchTabAndLens = useCallback(
    (targetTab: number, targetLens = 0, options?: ClubDrawerNavOptions) => {
      haptic('selection');
      if (options?.inspectOuting) {
        pushOuting(options.inspectOuting, subTabs[tab] ?? 0);
        setSubTabs((prev) => ({ ...prev, [targetTab]: targetLens }));
        return;
      }
      if (options?.inspectMember) {
        pushMember(options.inspectMember, subTabs[tab] ?? 0);
        return;
      }
      setStack([]);
      setInspectedMember(null);
      setInspectedOuting(null);
      const safeTab = Math.min(5, Math.max(0, targetTab));
      const safeLens = Math.max(0, targetLens);
      setTab(safeTab);
      setSubTabs((prev) => ({ ...prev, [safeTab]: safeLens }));
      if (options?.g02Section) setG02Section(options.g02Section);
      if (options?.chatDraft !== undefined) setChatDraftPrefill(options.chatDraft);
      if (options?.createClubMassif !== undefined) {
        setCreatePrefillMassif(options.createClubMassif);
        setInternalMode('create');
        setTab(3);
      }
    },
    [haptic, pushMember, pushOuting, subTabs, tab],
  );

  // Secondary sub-drawer items (30px floating icon-only pill at bottom-right) per main tab
  const secondaryByTab: Record<number, DrawerSecondaryItem[]> = useMemo(
    () => ({
      0: [
        { id: 'stats-perf', label: 'Score et performance du club', icon: <Activity size={15} aria-hidden="true" /> },
        { id: 'stats-events', label: 'Sorties, terrains et événements', icon: <Compass size={15} aria-hidden="true" /> },
        { id: 'stats-kits', label: 'Kits proposés et coffre matériel', icon: <Backpack size={15} aria-hidden="true" /> },
        { id: 'stats-members', label: 'Efforts membres et pilotage', icon: <TrendingUp size={15} aria-hidden="true" /> },
      ],
      1: inspectedMember
        ? [
            { id: 'm-stats', label: 'Perf & Stats', icon: <BarChart2 size={15} aria-hidden="true" /> },
            { id: 'm-outings', label: 'Sorties', icon: <Calendar size={15} aria-hidden="true" /> },
            { id: 'm-pokedex', label: 'Pokédex', icon: <Leaf size={15} aria-hidden="true" /> },
            { id: 'm-gear', label: 'Sac', icon: <Backpack size={15} aria-hidden="true" /> },
          ]
        : [
            { id: 'members-all', label: 'Tous les membres', icon: <Users size={15} aria-hidden="true" /> },
            { id: 'members-guides', label: 'Encadrants, sécurité & invitations', icon: <ShieldCheck size={15} aria-hidden="true" /> },
            { id: 'members-binomes', label: 'Binômes & matching', icon: <Handshake size={15} aria-hidden="true" /> },
          ],
      2: inspectedOuting
        ? [
            { id: 'outing-overview', label: 'Trace & Orga', icon: <Compass size={15} aria-hidden="true" /> },
            { id: 'outing-transport', label: 'Aller & Retour', icon: <Car size={15} aria-hidden="true" /> },
            { id: 'outing-gear', label: 'Matériel', icon: <Backpack size={15} aria-hidden="true" /> },
            { id: 'outing-pokedex', label: 'Pokédex', icon: <Feather size={15} aria-hidden="true" /> },
            { id: 'outing-memories', label: 'Souvenirs', icon: <Camera size={15} aria-hidden="true" /> },
          ]
        : [
            { id: 'outings-upcoming', label: 'Prochains départs et covoiturage', icon: <Calendar size={15} aria-hidden="true" /> },
            { id: 'outings-tickets', label: 'Aperçu tickets des sorties', icon: <Compass size={15} aria-hidden="true" /> },
          ],
      3: [
        { id: 'vault-items', label: 'Équipements prêtables du coffre', icon: <Package size={15} aria-hidden="true" /> },
        { id: 'vault-kits', label: 'Kits types du club', icon: <Backpack size={15} aria-hidden="true" /> },
        { id: 'vault-challenges', label: 'Défis & classements', icon: <Trophy size={15} aria-hidden="true" /> },
      ],
      4: [
        { id: 'salons-chat', label: 'Salons de discussion', icon: <MessageCircle size={15} aria-hidden="true" /> },
      ],
      5: [
        { id: 'pokedex', label: 'Pokédex', icon: <Leaf size={15} aria-hidden="true" /> },
        { id: 'faune', label: 'Faune', icon: <Compass size={15} aria-hidden="true" /> },
        { id: 'flore', label: 'Flore & Milieux', icon: <Mountain size={15} aria-hidden="true" /> },
      ],
    }),
    [inspectedMember, inspectedOuting],
  );

  const mainTabDefs: Array<Omit<DrawerTab, 'render'> & { badge?: number | boolean }> = useMemo(
    () => [
      { id: 'stats', label: 'Statistiques et performances du club', icon: <BarChart3 size={18} aria-hidden="true" /> },
      {
        id: 'cordee',
        label: 'Membres et cordée du club',
        icon: <Users size={18} aria-hidden="true" />,
      },
      {
        id: 'sorties',
        label: 'Sorties programmées, agenda et météo',
        icon: <Calendar size={18} aria-hidden="true" />,
      },
      { id: 'coffre', label: 'Sac et coffre matériel du club', icon: <Backpack size={18} aria-hidden="true" /> },
      { id: 'salons', label: 'Salons de discussion du club', icon: <MessageCircle size={18} aria-hidden="true" /> },
      { id: 'pokedex', label: 'Pokédex Nature du club', icon: <Leaf size={18} aria-hidden="true" /> },
    ],
    [],
  );

  const activeMainTab = mainTabDefs[tab] ?? mainTabDefs[0];
  const activeSecondaryItems = secondaryByTab[tab] ?? [];
  const activeLensIndex =
    tab === 1 && inspectedMember
      ? memberLensIndex
      : tab === 2 && inspectedOuting
        ? outingLensIndex
        : currentSub;
  const activeLensId = activeSecondaryItems[activeLensIndex]?.id ?? 'stats-perf';

  const bottomRightFilterNode = useMemo(() => {
    if (tab === 0 && activeLensIndex === 1) {
      return (
        <SortMenuButton
          label="Trier et filtrer le classement"
          value={memberSort}
          defaultValue="distance"
          onChange={(val) => setMemberSort(val as MemberSortMetric)}
          options={[]}
          groups={[
            {
              id: 'sort',
              label: 'Trier par',
              value: memberSort,
              defaultValue: 'distance',
              onChange: (val) => setMemberSort(val as MemberSortMetric),
              options: [
                { value: 'distance', label: 'Distance (km)' },
                { value: 'dplus', label: 'Dénivelé (D+)' },
                { value: 'outings', label: 'Sorties club' },
                { value: 'hours', label: 'Temps d’effort (h)' },
                { value: 'contributions', label: 'Contributions' },
              ],
            },
            {
              id: 'role',
              label: 'Rôle',
              value: memberRoleFilter,
              defaultValue: 'all',
              onChange: (val) => setMemberRoleFilter(val as MemberRoleFilter),
              options: [
                { value: 'all', label: 'Tous les membres' },
                { value: 'leaders', label: 'Encadrants & Admins' },
                { value: 'members', label: 'Membres actifs' },
              ],
            },
          ]}
        />
      );
    }
    if (tab === 0) {
      return (
        <SortMenuButton
          label="Filtrer la période"
          value={statsWindow}
          defaultValue="all"
          onChange={(val) => setStatsWindow(val as ClubStatsWindow)}
          options={[
            { value: '7d', label: '7 derniers jours' },
            { value: '30d', label: '30 derniers jours' },
            { value: 'season', label: 'Saison en cours' },
            { value: 'all', label: 'Depuis toujours' },
          ]}
        />
      );
    }
    if (tab === 2 && activeLensIndex === 0 && !inspectedOuting) {
      const upcoming = outings.filter((o) => o.status !== 'completed' && o.status !== 'cancelled');
      return (
        <SortMenuButton
          label="Filtrer les sorties"
          value={outingFilter}
          defaultValue="all"
          onChange={(val) => setOutingFilter(val as OutingFilterId)}
          options={[
            { value: 'all', label: 'Toutes les sorties', count: upcoming.length },
            { value: 'weekend', label: 'Ce week-end' },
            {
              value: 'carpool',
              label: 'Covoiturage dispo',
              count: upcoming.filter((o) => (o.carpoolSeatsLeft ?? 0) > 0).length,
            },
            {
              value: 'joined',
              label: 'Mes inscriptions',
              count: upcoming.filter((o) => o.rsvpJoined).length,
            },
            {
              value: 'available',
              label: 'Places disponibles',
              count: upcoming.filter((o) => o.participantsCount < o.maxParticipants).length,
            },
          ]}
        />
      );
    }
    if (tab === 2 && inspectedOuting) {
      const liveOuting = outings.find((o) => o.id === inspectedOuting.id) ?? inspectedOuting;
      const cleanTitle = cleanOutingTitle(liveOuting.title);
      return (
        <SortMenuButton
          label="Actions de la sortie"
          value="__action__"
          defaultValue="__action__"
          onChange={(act) => {
            if (act === 'map') {
              onFlyToCoords?.(liveOuting.lat, liveOuting.lng, cleanTitle);
            } else if (act === 'gpx') {
              const ok = downloadRealOutingGpx(liveOuting);
              if (ok) {
                emitToast({
                  title: 'Trace GPX 1.1 téléchargée ✓',
                  subtitle: `${liveOuting.km} km · +${liveOuting.dplus} m`,
                });
              } else {
                onDownloadGpx?.(liveOuting);
              }
            } else if (act === 'ics') {
              downloadOutingIcs(liveOuting);
              emitToast({ title: 'Invitation calendrier (.ics) prête ✓' });
            } else if (act === 'salons') {
              setInspectedOuting(null);
              setOutingLensIndex(0);
              setTab(4);
            }
          }}
          options={[
            ...(onFlyToCoords ? [{ value: 'map', label: 'Voir sur la carte 3D' }] : []),
            { value: 'gpx', label: 'Télécharger le GPX' },
            { value: 'ics', label: 'Ajouter au calendrier (.ics)' },
            { value: 'salons', label: 'Ouvrir les salons du club' },
          ]}
        />
      );
    }
    if (tab === 3 && activeLensIndex === 0) {
      const clubCount = vaultGear.filter((g) => g.ownershipScope === 'club').length;
      const memberCount = vaultGear.length - clubCount;
      const reservedCount = vaultGear.filter((g) => g.reservedByMe).length;
      return (
        <SortMenuButton
          label="Filtrer le coffre"
          value={vaultFilter}
          defaultValue="all"
          onChange={(val) => setVaultFilter(val as VaultFilterId)}
          options={[]}
          groups={[
            {
              id: 'scope',
              label: 'Régime',
              value: vaultScope,
              defaultValue: 'all',
              onChange: (val) => setVaultScope(val as VaultScopeId),
              options: [
                { value: 'all', label: 'Tout', count: vaultGear.length },
                { value: 'club', label: 'Parc du club', count: clubCount },
                { value: 'member', label: 'Entraide membres', count: memberCount },
              ],
            },
            {
              id: 'filter',
              label: 'Disponibilité',
              value: vaultFilter,
              defaultValue: 'all',
              onChange: (val) => setVaultFilter(val as VaultFilterId),
              options: [
                { value: 'all', label: 'Tout le coffre', count: vaultGear.length },
                {
                  value: 'available',
                  label: 'Disponibles',
                  count: vaultGear.filter((g) => g.available && !g.reservedByMe).length,
                },
                { value: 'mine', label: 'Mes emprunts', count: reservedCount },
                {
                  value: 'light',
                  label: 'Ultraléger (< 500 g)',
                  count: vaultGear.filter((g) => g.weightG < 500).length,
                },
              ],
            },
          ]}
        />
      );
    }
    if (tab === 3 && activeLensIndex === 1) {
      return (
        <SortMenuButton
          label="Filtrer les kits par saison"
          value={kitSeason}
          defaultValue="all"
          onChange={(val) => setKitSeason(val as KitSeasonFilter)}
          options={[
            { value: 'all', label: 'Toutes saisons' },
            { value: 'summer', label: 'Été · 3 saisons' },
            { value: 'winter', label: 'Hiver · Alpi' },
          ]}
        />
      );
    }
    if (tab === 5 && !pokedexDetailOpen) {
      const outingsWithSightings = outings.filter((o) =>
        pokedexItems.some((s) => s.outingId === o.id),
      );
      const outingOptions = [
        { value: 'all', label: 'Toutes les sorties', count: pokedexItems.length },
        ...outingsWithSightings.map((o) => ({
          value: o.id,
          label: o.title.split(/[—(]/)[0].trim().slice(0, 28),
          count: pokedexItems.filter((s) => s.outingId === o.id).length,
        })),
      ];
      if (activeLensIndex === 0) {
        return (
          <SortMenuButton
            label="Filtrer le Pokédex"
            value={pokedexKingdomFilter}
            defaultValue="all"
            onChange={(val) =>
              setPokedexKingdomFilter(val as 'all' | 'faune' | 'flore' | 'geologie')
            }
            options={[]}
            groups={[
              {
                id: 'kingdom',
                label: 'Règne',
                value: pokedexKingdomFilter,
                defaultValue: 'all',
                onChange: (val) =>
                  setPokedexKingdomFilter(val as 'all' | 'faune' | 'flore' | 'geologie'),
                options: [
                  { value: 'all', label: 'Tout' },
                  { value: 'faune', label: 'Faune' },
                  { value: 'flore', label: 'Flore' },
                  { value: 'geologie', label: 'Milieux' },
                ],
              },
              ...(outingsWithSightings.length > 0
                ? [
                    {
                      id: 'outing',
                      label: 'Sortie du club',
                      value: pokedexOutingFilter,
                      defaultValue: 'all',
                      onChange: (val: string) => setPokedexOutingFilter(val),
                      options: outingOptions,
                    },
                  ]
                : []),
            ]}
          />
        );
      }
      if (outingsWithSightings.length > 0) {
        return (
          <SortMenuButton
            label="Filtrer par sortie du club"
            value={pokedexOutingFilter}
            defaultValue="all"
            onChange={(val) => setPokedexOutingFilter(val)}
            options={outingOptions}
          />
        );
      }
    }
    return null;
  }, [activeLensIndex, inspectedOuting, kitSeason, memberRoleFilter, memberSort, outingFilter, outings, pokedexDetailOpen, pokedexItems, pokedexKingdomFilter, pokedexOutingFilter, statsWindow, tab, vaultFilter, vaultGear, vaultScope, weatherWindow]);

  useEffect(() => {
    onTabChange?.(tab, activeLensId);
  }, [activeLensId, onTabChange, tab]);

  // Edge fade per `${tab}:${lensId}` (UI-16)
  const activeLensKey = `${tab}:${activeLensId}`;

  useEffect(() => {
    if (!isOpen || internalMode !== 'main') return;
    const root = paneRootRef.current;
    if (!root) return;

    const currentPane = root.querySelector<HTMLElement>('.lkdv-lens-pane[data-testid="slot-content"]');
    if (currentPane) {
      currentPane.setAttribute('data-scrolled', currentPane.scrollTop > 8 ? 'true' : 'false');
    }

    const onScroll = (event: Event) => {
      const pane = event.target as HTMLElement | null;
      if (!pane || typeof pane.classList === 'undefined') return;
      if (!pane.classList.contains('lkdv-lens-pane')) return;
      pane.setAttribute('data-scrolled', pane.scrollTop > 8 ? 'true' : 'false');
    };

    root.addEventListener('scroll', onScroll, true);
    return () => root.removeEventListener('scroll', onScroll, true);
  }, [activeLensKey, internalMode, isOpen, tab]);

  // Keyboard shortcuts: Cmd/Ctrl+K, 1..5, Backspace (FN-17)
  const handleRootKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (internalMode !== 'main') return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        haptic('selection');
        if (onOpenRuntimeOverlay) {
          onOpenRuntimeOverlay('club_search');
        }
        return;
      }

      const target = event.target as HTMLElement | null;
      const isTextInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isTextInput) return;

      if (event.key >= '1' && event.key <= '5') {
        const idx = Number(event.key) - 1;
        setStack([]);
        setInspectedMember(null);
        setInspectedOuting(null);
        setTab(idx);
        haptic('selection');
        return;
      }

      if (event.key === 'Backspace' && (stack.length > 0 || inspectedMember || inspectedOuting)) {
        event.preventDefault();
        popStack();
      }
    },
    [haptic, inspectedMember, inspectedOuting, internalMode, popStack, setSubForTab, stack.length],
  );

  if (internalMode === 'create') {
    const createTabs = [
      { id: 'create-post', label: 'Publier dans le club', icon: <MessageSquarePlus size={18} aria-hidden="true" /> },
      { id: 'create-outing', label: 'Proposer une sortie', icon: <CalendarPlus size={18} aria-hidden="true" /> },
      { id: 'create-gear', label: 'Mettre un équipement au coffre commun', icon: <Backpack size={18} aria-hidden="true" /> },
      { id: 'create-club', label: 'Fonder un nouveau club', icon: <PlusCircle size={18} aria-hidden="true" /> },
    ];
    const activeCreateTab = createTabs[tab] ?? createTabs[0];

    return (
      <ClubMotionRoot>
        <motion.div
          ref={attachPaneRoot}
          {...dragProps}
          style={{ y }}
          className="lkdv-carnet-drawer lkdv-club-carnet-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Créer dans le club"
          tabIndex={-1}
          data-club-tab={tab}
          data-club-lens={activeCreateTab.id}
          data-outdoor={isOutdoor ? 'true' : undefined}
          data-reduce-motion={reduceMotion ? 'true' : undefined}
        >
          {onClose ? (
            <button
              type="button"
              className="lkdv-mgrab"
              {...handleProps}
              onClick={() => {
                if (!isDragging) onClose();
              }}
              aria-label="Fermer le tiroir"
            >
              <span />
            </button>
          ) : null}
          <SlotShell
            slot={activeCreateTab.id}
            viewer="owner"
            title={activeCreateTab.label}
            lenses={[
              {
                id: activeCreateTab.id,
                label: activeCreateTab.label,
                icon: activeCreateTab.icon,
              },
            ]}
            activeLensIndex={0}
            onLensChange={() => {}}
            selector={
              <CapsuleTabs
                className="lkdv-slot-selector"
                items={createTabs}
                activeIndex={tab}
                onIndexChange={(next) => {
                  haptic('selection');
                  setTab(next);
                }}
                ariaLabel="Création dans le club"
                size="default"
              />
            }
            renderLens={() => (
              <LensTransition transitionKey={`create:${tab}`}>
                <div className="lkdv-carnet-drawer-pane">
                  <ClubCreateDrawerBody
                    activeTab={tab}
                    activeClub={activeClub}
                    prefillMassif={createPrefillMassif}
                    onTabChange={setTab}
                    onCreatePost={onCreatePost}
                    onCreateOuting={onCreateOuting}
                    onCreateVaultGear={onCreateVaultGear}
                    onCreateNewClub={(p) => {
                      onCreateNewClub(p);
                      setInternalMode('main');
                    }}
                    onToast={emitToast}
                  />
                </div>
              </LensTransition>
            )}
          />
          <ClubIsland toast={localToast} onDismiss={() => setLocalToast(null)} />
        </motion.div>
      </ClubMotionRoot>
    );
  }

  if (internalMode === 'settings' && canAccessClubAdmin) {
    return (
      <ClubMotionRoot>
        <motion.div
          ref={attachPaneRoot}
          {...dragProps}
          style={{ y }}
          onKeyDown={handleRootKeyDown}
          className="lkdv-carnet-drawer lkdv-club-carnet-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Administration du club"
          tabIndex={-1}
          data-outdoor={isOutdoor ? 'true' : undefined}
          data-reduce-motion={reduceMotion ? 'true' : undefined}
        >
          {onClose ? (
            <button
              type="button"
              className="lkdv-mgrab"
              {...handleProps}
              onClick={() => {
                if (!isDragging) onClose();
              }}
              aria-label="Fermer le tiroir"
            >
              <span />
            </button>
          ) : null}
          <ClubAdminDrawerShell
            activeClub={activeClub}
            members={members}
            outings={outings}
            vaultGear={vaultGear}
            challenges={challenges}
            currentUserId={currentUserId}
            onBack={() => setInternalMode('main')}
            onToggleClubVisibility={onToggleClubVisibility}
            onTransitionGearLoan={onTransitionGearLoan}
            onChangeMemberRole={onChangeMemberRole}
            onToggleMemberLeaderBadge={onToggleMemberLeaderBadge}
            onToast={emitToast}
          />
          <ClubIsland toast={localToast} onDismiss={() => setLocalToast(null)} />
        </motion.div>
      </ClubMotionRoot>
    );
  }

  const slotState =
    syncStatus === 'error'
      ? 'error'
      : syncStatus === 'syncing' && clubs.length === 0 && !activeClub.id
        ? 'loading'
        : 'ready';

  return (
    <ClubMotionRoot>
      <motion.div
        ref={attachPaneRoot}
        {...dragProps}
        style={{ y }}
        onKeyDown={handleRootKeyDown}
        onWheelCapture={(e) => {
          if (isTimelineDrawer && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            e.stopPropagation();
          }
        }}
        className="lkdv-carnet-drawer lkdv-club-carnet-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Espace Club & Cordée"
        tabIndex={-1}
        data-club-tab={tab}
        data-club-lens={activeLensId}
        data-timeline-locked={isTimelineDrawer ? 'true' : undefined}
        data-outdoor={isOutdoor ? 'true' : undefined}
        data-reduce-motion={reduceMotion ? 'true' : undefined}
      >
        <style dangerouslySetInnerHTML={{ __html: KIT_CARD_CSS }} />
        {onClose ? (
          <button
            type="button"
            className="lkdv-mgrab"
            {...handleProps}
            onClick={() => {
              if (!isDragging) onClose();
            }}
            aria-label="Fermer le tiroir"
          >
            <span />
          </button>
        ) : null}

        <SlotShell
          slot={activeMainTab?.id ?? 'explorer'}
          viewer="owner"
          title={activeMainTab?.label ?? 'Club'}
          state={slotState}
          onRetry={onRetrySync}
          lenses={activeSecondaryItems.map((s, idx) => ({
            id: s.id ?? String(idx),
            label: s.label,
            icon: s.icon,
          }))}
          activeLensIndex={activeLensIndex}
          onLensChange={(idx) => {
            haptic('selection');
            if (tab === 1 && inspectedMember) {
              setMemberLensIndex(idx);
              return;
            }
            if (tab === 2 && inspectedOuting) {
              setOutingLensIndex(idx);
              return;
            }
            setInspectedMember(null);
            setInspectedOuting(null);
            setSubForTab(tab, idx);
          }}
          selector={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <CapsuleTabs
                    className="lkdv-slot-selector"
                    items={mainTabDefs.map((t) => ({
                      id: t.id,
                      label: t.label,
                      icon: t.icon,
                      badge: t.badge,
                    }))}
                    activeIndex={tab}
                    onIndexChange={(nextTab) => {
                      haptic('selection');
                      setStack([]);
                      setInspectedMember(null);
                      setInspectedOuting(null);
                      setInspectedPokedexId(null);
                      setFocusedKitId(null);
                      setMemberLensIndex(0);
                      setTab(nextTab);
                    }}
                    ariaLabel="Onglets du club"
                    size="default"
                  />
                </div>
              </div>
              {tab === 1 && inspectedMember && !isMemberTimelineLens ? (() => {
                const mName = inspectedMember.name?.trim() || inspectedMember.handle?.trim() || 'Voyageur';
                const normH = (inspectedMember.handle || '').trim().toLowerCase();
                const normN = (inspectedMember.name || '').trim().toLowerCase();
                const isMemberMatch = (h?: string | null, n?: string | null) => {
                  const hh = (h || '').trim().toLowerCase();
                  const nn = (n || '').trim().toLowerCase();
                  if (normH && (hh === normH || nn === normH)) return true;
                  if (normN && (nn === normN || hh === normN)) return true;
                  return false;
                };
                const mPostsCount = Math.max(
                  inspectedMember.postsCount ?? 0,
                  posts.filter((p) => isMemberMatch(p.authorHandle, p.authorName)).length,
                );
                const mOutingsCount = Math.max(
                  inspectedMember.outingsCount ?? 0,
                  outings.filter((o) => isMemberMatch(o.leaderHandle, o.leaderName)).length,
                );
                const mGearCount = Math.max(
                  inspectedMember.gearCount ?? 0,
                  vaultGear.filter((g) => isMemberMatch(g.ownerHandle, g.ownerName)).length,
                );
                const handleLabel = inspectedMember.handle
                  ? `@${inspectedMember.handle.replace(/^@/, '')}`
                  : '';
                const subtitleText = [handleLabel, inspectedMember.carpoolCity || inspectedMember.massif].filter(Boolean).join(' · ');

                const roleBadgeTone =
                  inspectedMember.role === 'Fondateur'
                    ? 'founder'
                    : inspectedMember.role === 'Guide & Sécurité'
                      ? 'guide'
                      : inspectedMember.role === 'Encadrant'
                        ? 'encadrant'
                        : inspectedMember.role === 'Nouveau'
                          ? 'newcomer'
                          : 'member';

                const handleHeroTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
                  if (isMemberTimelineLens) return;
                  memberHeroTouchYRef.current = e.touches[0]?.clientY ?? null;
                };
                const handleHeroTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
                  if (isMemberTimelineLens) return;
                  const startY = memberHeroTouchYRef.current;
                  const curY = e.touches[0]?.clientY;
                  if (startY == null || curY == null) return;
                  const dy = startY - curY;
                  if (dy > 16) {
                    setMemberHeaderCompact(true);
                    memberHeroTouchYRef.current = curY;
                  } else if (dy < -16) {
                    setMemberHeaderCompact(false);
                    memberHeroTouchYRef.current = curY;
                  }
                };

                return (
                  <div
                    style={{ width: '100%' }}
                    onTouchStart={handleHeroTouchStart}
                    onTouchMove={handleHeroTouchMove}
                  >
                    <CollapsibleHeroPreview
                      collapsed={isMemberTimelineLens ? true : memberHeaderCompact}
                      onExpand={() => {
                        if (!isMemberTimelineLens) setMemberHeaderCompact(false);
                      }}
                      title={mName}
                      subtitle={inspectedMember.role || 'Membre'}
                      avatarUrl={inspectedMember.avatarUrl}
                      fallbackText={mName}
                      testId="club-member-hero-preview"
                    >
                      <div
                        className={`lkdv-carnet-card lkdv-cv2c-carnet-ig-editor lkdv-cv2x-carnet-ig-tile lkdv-cv2x-member-ig-tile lkdv-club-member-hero-card${
                          inspectedMember.avatarUrl ? ' has-cover-bg' : ''
                        }`}
                        style={{ borderRadius: 22, overflow: 'hidden' }}
                        data-role-tone={roleBadgeTone}
                      >
                        {inspectedMember.avatarUrl ? (
                          <span className="lkdv-cv2x-carnet-bg" aria-hidden="true">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={inspectedMember.avatarUrl}
                              alt=""
                              className="lkdv-cv2x-carnet-bg-img"
                            />
                            <span className="lkdv-cv2x-carnet-bg-scrim" />
                          </span>
                        ) : null}
                        <span className="lkdv-carnet-card-scroll lkdv-cv2x-tile-link">
                          <span className="lkdv-ig-header">
                            <span className="lkdv-ig-avi-wrap">
                              <span className="lkdv-ig-avi">
                                {inspectedMember.avatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={inspectedMember.avatarUrl}
                                    alt=""
                                    className="lkdv-cv2x-cover-img"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                ) : (
                                  <span className="lkdv-cv2c-ig-avi-initials">
                                    {mName.slice(0, 1).toUpperCase()}
                                  </span>
                                )}
                              </span>
                            </span>
                            <span className="lkdv-ig-stats" role="group" aria-label="Statistiques du profil">
                              <span className="lkdv-ig-stat">
                                <b>{mPostsCount}</b>
                                <span>publications</span>
                              </span>
                              <span className="lkdv-ig-stat">
                                <b>{mOutingsCount}</b>
                                <span>sorties</span>
                              </span>
                              <span className="lkdv-ig-stat">
                                <b>{mGearCount}</b>
                                <span>matos</span>
                              </span>
                            </span>
                          </span>
                          <span className="lkdv-ig-bio">
                            <span className="lkdv-ig-name lkdv-cv2x-carnet-title">{mName}</span>
                            {subtitleText ? (
                              <span className="lkdv-ig-handle-sub lkdv-cv2-meta">{subtitleText}</span>
                            ) : null}
                          </span>
                        </span>
                        <span className="lkdv-cv2x-tile-foot">
                          <span
                            className="lkdv-club-hero-role-pill"
                            data-role-tone={roleBadgeTone}
                          >
                            {inspectedMember.role || 'Membre'}
                          </span>
                          <button
                            type="button"
                            className="lkdv-cv2x-member-cta"
                            onClick={() => pushMember(null)}
                          >
                            <ChevronLeft size={13} />
                            <span>Cordée</span>
                          </button>
                        </span>
                      </div>
                    </CollapsibleHeroPreview>
                  </div>
                );
              })() : null}
            </div>
          }
          bottomRightFilter={bottomRightFilterNode}
          renderLens={(lens, index, active) => (
            <div className="lkdv-carnet-drawer-pane">
              {tab === 0 ? (
                <ClubStatsHubDrawerBody
                  activeSubTab={index}
                  active={active}
                  activeClub={activeClub}
                  members={members}
                  outings={outings}
                  posts={posts}
                  vaultGear={vaultGear}
                  standardKits={standardKits}
                  challenges={challenges}
                  currentUserId={currentUserId}
                  windowKey={statsWindow}
                  onWindowChange={setStatsWindow}
                  memberSort={memberSort}
                  memberRoleFilter={memberRoleFilter}
                  onToggleJoinClub={onToggleJoinClub}
                  onInspectMember={(m) => pushMember(m, index)}
                  onInspectOuting={(o) => pushOuting(o, index)}
                  onOpenMemberProfile={openMemberProfileByHandle}
                  onToggleMemberStoryPermission={onToggleMemberStoryPermission}
                  onSwitchTabAndLens={handleSwitchTabAndLens}
                  onToast={emitToast}
                />
              ) : null}

              {tab === 1 ? (
                inspectedMember && lens.id === 'm-pokedex' ? (
                  <ClubPokedexDrawerBody
                    activeClub={activeClub}
                    lensId="pokedex"
                    pokedexItems={pokedexItems}
                    members={members}
                    outings={outings}
                    currentUserId={currentUserId}
                    discoveredOnlyForUserId={inspectedMember.userId || inspectedMember.id}
                    discoveredOnlyForMemberName={inspectedMember.name}
                    onFlyToCoords={onFlyToCoords}
                    onInspectOuting={(o) => pushOuting(o, index)}
                    onToast={emitToast}
                  />
                ) : (
                  <ClubCordeeDrawerBody
                    lensId={(lens.id as CordeeLensId | MemberDetailLensId) || 'members-all'}
                    active={active}
                    loading={syncStatus === 'syncing'}
                    activeClub={activeClub}
                    members={members}
                    outings={outings}
                    posts={posts}
                    vaultGear={vaultGear}
                    currentUserId={currentUserId}
                    currentUserHandle={currentUserHandle}
                    blockedUserIds={blockedUserIds}
                    inspectedMember={inspectedMember}
                    memberLensIndex={memberLensIndex}
                    onInspectMember={pushMember}
                    onMemberLensChange={setMemberLensIndex}
                    onToggleFollowMember={(m) => onToggleFollowMember(m.userId || m.id || m.handle)}
                    onProposeBinome={
                      onProposeBinome ??
                      (async () => true)
                    }
                    onRetractBinome={onRetractBinome ?? (async () => {})}
                    onUpdateMyAvailability={onUpdateMyAvailability ?? (async () => {})}
                    onChangeMemberRole={onChangeMemberRole}
                    onToggleMemberStoryPermission={onToggleMemberStoryPermission}
                    onCreateBinomeGroup={onCreateBinomeGroup}
                    onBorrowGear={onToggleReserveGear}
                    onSwitchTabAndLens={handleSwitchTabAndLens}
                    onOpenMemberProfile={openMemberProfileByHandle}
                    onToast={emitToast}
                    onClose={() => onClose?.()}
                  />
                )
              ) : null}

              {tab === 2 ? (
                inspectedOuting ? (
                  <ClubOutingDetailSheet
                    activeClub={activeClub}
                    outing={
                      outings.find((o) => o.id === inspectedOuting.id) ?? inspectedOuting
                    }
                    members={members}
                    outings={outings}
                    vaultGear={vaultGear}
                    standardKits={standardKits}
                    pokedexItems={pokedexItems}
                    posts={posts}
                    currentUserId={currentUserId}
                    activeLensIndex={index}
                    onBack={() => {
                      setInspectedOuting(null);
                      setOutingLensIndex(0);
                    }}
                    onToggleRsvpOuting={onToggleRsvpOuting}
                    onDownloadGpx={onDownloadGpx}
                    onFlyToCoords={onFlyToCoords}
                    onRequestGearLoan={onRequestGearLoan}
                    onToggleReserveGear={onToggleReserveGear}
                    onCloneStandardKit={onCloneStandardKit}
                    onOpenClubSalons={() => {
                      setInspectedOuting(null);
                      setOutingLensIndex(0);
                      setTab(4);
                    }}
                    onOpenVaultTab={() => {
                      setInspectedOuting(null);
                      setOutingLensIndex(0);
                      setTab(3);
                    }}
                    onCreatePost={() => {
                      setInternalMode('create');
                      setTab(0);
                    }}
                    onObservationCreated={onPokedexObservationCreated}
                    onInspectMember={(member) => {
                      setInspectedOuting(null);
                      setOutingLensIndex(0);
                      pushMember(member, 0);
                    }}
                    onToast={emitToast}
                  />
                ) : (
                  <ClubSortiesDrawerBody
                    activeSubTab={index}
                    active={active}
                    activeClub={activeClub}
                    outings={outings}
                    members={members}
                    vaultGear={vaultGear}
                    inspectedOuting={null}
                    onInspectOuting={(o) => {
                      setOutingLensIndex(0);
                      pushOuting(o, index);
                    }}
                    onToggleRsvpOuting={onToggleRsvpOuting}
                    onCreateGroupFromOuting={onCreateGroupFromOuting}
                    onDownloadGpx={onDownloadGpx}
                    onFlyToCoords={onFlyToCoords}
                    onSwitchTab={(nextT, nextSub = 0) => handleSwitchTabAndLens(nextT, nextSub)}
                    onToast={emitToast}
                    onOpenRuntimeOverlay={onOpenRuntimeOverlay}
                    currentUserId={currentUserId}
                    initialSection={g02Section ?? 'events'}
                    weatherWindow={weatherWindow}
                    outingFilter={outingFilter}
                  />
                )
              ) : null}

              {tab === 3 ? (
                <ClubCoffreDrawerBody
                  activeSubTab={index}
                  activeClub={activeClub}
                  vaultGear={vaultGear}
                  standardKits={standardKits}
                  members={members}
                  outings={outings}
                  kitSeason={kitSeason}
                  vaultFilter={vaultFilter}
                  vaultScope={vaultScope}
                  focusedKitId={focusedKitId}
                  onToggleReserveGear={onToggleReserveGear}
                  onRequestGearLoan={onRequestGearLoan}
                  onTransitionGearLoan={onTransitionGearLoan}
                  onCloneStandardKit={onCloneStandardKit}
                  onSwitchTab={(nextT, nextSub = 0) => handleSwitchTabAndLens(nextT, nextSub)}
                  onSwitchToCreate={(cTab) => {
                    setInternalMode('create');
                    setTab(cTab);
                  }}
                  onToast={emitToast}
                />
              ) : null}

              {tab === 4 ? (
                <ClubSalonsDrawerBody
                  activeSubTab={index}
                  active={active}
                  activeClub={activeClub}
                  members={members}
                  currentUserId={currentUserId}
                  onSwitchSubTab={(nextSub) =>
                    setSubTabs((prev) => ({ ...prev, 4: nextSub }))
                  }
                  onToggleJoinClub={onToggleJoinClub}
                  onToast={emitToast}
                />
              ) : null}

              {tab === 5 ? (
                <ClubPokedexDrawerBody
                  activeClub={activeClub}
                  lensId={
                    lens.id === 'faune' || lens.id === 'flore' ? lens.id : 'pokedex'
                  }
                  pokedexItems={pokedexItems}
                  members={members}
                  outings={outings}
                  currentUserId={currentUserId}
                  initialPokedexId={inspectedPokedexId}
                  onClearInitialPokedexId={() => setInspectedPokedexId(null)}
                  kingdomFilter={pokedexKingdomFilter}
                  outingFilterId={pokedexOutingFilter}
                  onDetailOpenChange={setPokedexDetailOpen}
                  onFlyToCoords={onFlyToCoords}
                  onInspectOuting={(o) => pushOuting(o, index)}
                  onObservationCreated={onPokedexObservationCreated}
                  onToast={emitToast}
                />
              ) : null}
            </div>
          )}
        />

        {tab === 2 && inspectedOuting ? (() => {
          const liveOuting = outings.find((o) => o.id === inspectedOuting.id) ?? inspectedOuting;
          const joined = Boolean(liveOuting.rsvpJoined);
          return (
            <div className="club-drawer-floating-left">
              <button
                type="button"
                className="club-context-pill"
                aria-pressed={joined}
                onClick={() => onToggleRsvpOuting(liveOuting.id)}
                style={{
                  height: 30,
                  padding: '0 14px',
                  borderRadius: 9999,
                  border: joined
                    ? '0.5px solid rgba(23, 64, 44, 0.28)'
                    : '0.5px solid rgba(23, 64, 44, 0.14)',
                  background: joined
                    ? 'rgba(226, 240, 222, 0.92)'
                    : 'rgba(255, 255, 255, 0.88)',
                  color: joined ? '#17402c' : '#172b24',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow:
                    'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 6px 20px rgba(23, 43, 36, 0.12)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  cursor: 'pointer',
                }}
              >
                {joined ? 'Inscrit' : 'Rejoindre'}
              </button>
            </div>
          );
        })() : null}

        <ClubIsland toast={localToast} onDismiss={() => setLocalToast(null)} />
      </motion.div>
    </ClubMotionRoot>
  );
}

export default ClubDrawerHost;
