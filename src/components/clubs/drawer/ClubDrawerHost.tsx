'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUp,
  Award,
  Backpack,
  BarChart2,
  Bookmark,
  Calendar,
  CalendarCheck,
  CalendarPlus,
  ChevronLeft,
  CloudSun,
  Compass,
  Globe,
  Handshake,
  Layers,
  MessageCircle,
  MessageSquare,
  MessageSquarePlus,
  Mountain,
  Package,
  PlusCircle,
  Route,
  Scale,
  Search,
  Shield,
  ShieldCheck,
  Sliders,
  Tent,
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
import { CapsuleTabs } from '@/components/ui/CapsuleTabs';
import { useDragDismiss } from '@/hooks/gestures/useDragDismiss';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import '@/styles/carnet-v2.css';
import './club-drawers-v2.css';
import { ClubMotionRoot, LensTransition } from './ClubDrawerMotion';
import { useClubDialog } from './useClubDialog';
import { ClubIsland, type ClubIslandToast } from './ClubIsland';
import { ClubExplorerDrawerBody } from './ClubExplorerDrawerBody';
import { ClubCordeeDrawerBody } from './ClubCordeeDrawerBody';
import { ClubSortiesDrawerBody } from './ClubSortiesDrawerBody';
import { ClubCoffreDrawerBody } from './ClubCoffreDrawerBody';
import { ClubCreateDrawerBody } from './ClubCreateDrawerBody';
import type { ClubG02Section } from '../g02/ClubG02Screen';
import type {
  ClubDrawerHostProps,
  ClubDrawerNavOptions,
  ClubMemberData,
  ClubOutingData,
  ClubToastPayload,
  CordeeLensId,
  ExplorerLensId,
  MemberDetailLensId,
} from './ClubDrawerTypes';

export * from './ClubDrawerTypes';

const RESUME_MEMO_MIN = 20;
const RESUME_TOP_MAX = 10;

type ClubStackEntry =
  | { type: 'member'; member: ClubMemberData; returnTab: number; returnSubTab: number }
  | { type: 'outing'; outing: ClubOutingData; returnTab: number; returnSubTab: number };

function memberHasClubRole(member: Pick<ClubMemberData, 'role' | 'rawRole'>): boolean {
  if (member.rawRole === 'admin' || member.rawRole === 'moderator') return true;
  return (
    member.role === 'Fondateur' ||
    member.role === 'Guide & Sécurité' ||
    member.role === 'Encadrant'
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
  challenges,
  chatMessages,
  posts,
  onSelectClub,
  onToggleJoinClub,
  onToggleFollowMember,
  onProposeBinome,
  onRetractBinome,
  onChangeMemberRole,
  onCreateBinomeGroup,
  onToggleRsvpOuting,
  onCreateGroupFromOuting,
  onDownloadGpx,
  onFlyToCoords,
  onToggleReserveGear,
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
  const [internalMode, setInternalMode] = useState<'main' | 'create'>(mode);
  const [tab, setTab] = useState<number>(initialSearch ? 0 : Math.min(3, Math.max(0, initialTab)));
  const [subTabs, setSubTabs] = useState<Record<number, number>>({
    0: initialSearch ? 2 : initialSubTab,
    1: initialTab === 1 ? initialSubTab : 0,
    2: initialTab === 2 ? initialSubTab : 0,
    3: initialTab === 3 ? initialSubTab : 0,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [stack, setStack] = useState<ClubStackEntry[]>([]);
  const [inspectedMember, setInspectedMember] = useState<ClubMemberData | null>(null);
  const [memberLensIndex, setMemberLensIndex] = useState(0);
  const [inspectedOuting, setInspectedOuting] = useState<ClubOutingData | null>(null);
  const [g02Section, setG02Section] = useState<ClubG02Section | undefined>(initialSection);
  const [chatDraftPrefill, setChatDraftPrefill] = useState('');
  const [createPrefillMassif, setCreatePrefillMassif] = useState<string | undefined>(undefined);
  const [localToast, setLocalToast] = useState<ClubIslandToast | null>(null);

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
    const nextTab = Math.min(3, Math.max(0, intent.tab ?? tab));
    if (typeof intent.tab === 'number') setTab(nextTab);
    if (typeof intent.subTab === 'number') {
      setSubTabs((prev) => ({ ...prev, [nextTab]: intent.subTab! }));
    }
    if (intent.initialSection) setG02Section(intent.initialSection);
    if (intent.searchQuery !== undefined) setSearchQuery(intent.searchQuery);

    if (intent.outingId) {
      const foundOuting = outings.find((o) => o.id === intent.outingId);
      if (foundOuting) {
        setInspectedOuting(foundOuting);
        setInspectedMember(null);
        setTab(2);
        setStack((prev) => [...prev, { type: 'outing', outing: foundOuting, returnTab: nextTab, returnSubTab: intent.subTab ?? 0 }]);
      }
    } else if (intent.memberId) {
      const foundMember = members.find((m) => m.id === intent.memberId || m.userId === intent.memberId);
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
      const safeTab = targetTab >= 4 ? 2 : Math.max(0, targetTab);
      const safeLens = targetTab >= 4 ? 3 : targetLens;
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
        { id: 'my-clubs', label: 'Essentiel du club', icon: <Mountain size={15} aria-hidden="true" /> },
        { id: 'discover-clubs', label: 'Découvrir tous les clubs', icon: <Compass size={15} aria-hidden="true" /> },
        { id: 'search-all', label: 'Recherche unifiée', icon: <Search size={15} aria-hidden="true" /> },
      ],
      1: inspectedMember
        ? [
            { id: 'm-stats', label: 'Perf & Stats', icon: <BarChart2 size={15} aria-hidden="true" /> },
            { id: 'm-outings', label: 'Sorties', icon: <Calendar size={15} aria-hidden="true" /> },
            { id: 'm-gear', label: 'Sac', icon: <Backpack size={15} aria-hidden="true" /> },
            { id: 'm-media', label: 'Contributions', icon: <MessageSquare size={15} aria-hidden="true" /> },
          ]
        : [
            { id: 'members-all', label: 'Tous les membres', icon: <Users size={15} aria-hidden="true" /> },
            { id: 'members-guides', label: 'Encadrants, sécurité & invitations', icon: <ShieldCheck size={15} aria-hidden="true" /> },
            { id: 'members-binomes', label: 'Binômes & matching', icon: <Handshake size={15} aria-hidden="true" /> },
            { id: 'members-salons', label: 'Salons du club', icon: <MessageCircle size={15} aria-hidden="true" /> },
          ],
      2: [
        { id: 'outings-upcoming', label: 'Prochains départs et covoiturage', icon: <Calendar size={15} aria-hidden="true" /> },
        { id: 'outings-weather', label: 'Météo et conditions massif', icon: <CloudSun size={15} aria-hidden="true" /> },
        { id: 'outings-gpx', label: 'Archives, collections & traces GPX', icon: <Route size={15} aria-hidden="true" /> },
      ],
      3: [
        { id: 'vault-items', label: 'Équipements prêtables du coffre', icon: <Package size={15} aria-hidden="true" /> },
        { id: 'vault-kits', label: 'Kits types du club', icon: <Backpack size={15} aria-hidden="true" /> },
        { id: 'vault-weight', label: 'Répartition poids de cordée', icon: <Scale size={15} aria-hidden="true" /> },
        { id: 'vault-challenges', label: 'Défis & classements', icon: <Trophy size={15} aria-hidden="true" /> },
      ],
    }),
    [inspectedMember],
  );

  const newArrivalsCount = useMemo(() => members.filter((m) => m.isNew7d).length, [members]);
  const upcomingOutingsCount = useMemo(
    () => outings.filter((o) => o.status === 'upcoming' || o.status === 'live').length,
    [outings],
  );

  const mainTabDefs: Array<Omit<DrawerTab, 'render'> & { badge?: number | boolean }> = useMemo(
    () => [
      { id: 'explorer', label: 'Clubs et exploration', icon: <Globe size={18} aria-hidden="true" /> },
      {
        id: 'cordee',
        label: 'Membres et cordée du club',
        icon: <Users size={18} aria-hidden="true" />,
        badge: newArrivalsCount > 0 ? newArrivalsCount : undefined,
      },
      {
        id: 'sorties',
        label: 'Sorties programmées, agenda et météo',
        icon: <Calendar size={18} aria-hidden="true" />,
        badge: upcomingOutingsCount > 0 ? upcomingOutingsCount : undefined,
      },
      { id: 'coffre', label: 'Sac et coffre matériel du club', icon: <Backpack size={18} aria-hidden="true" /> },
    ],
    [newArrivalsCount, upcomingOutingsCount],
  );

  const activeMainTab = mainTabDefs[tab] ?? mainTabDefs[0];
  const activeSecondaryItems = secondaryByTab[tab] ?? [];
  const activeLensIndex = tab === 1 && inspectedMember ? memberLensIndex : currentSub;
  const activeLensId = activeSecondaryItems[activeLensIndex]?.id ?? 'my-clubs';

  useEffect(() => {
    onTabChange?.(tab, activeLensId);
  }, [activeLensId, onTabChange, tab]);

  // Scroll memory & edge fade per `${tab}:${lensId}` (FN-04, UI-11, UI-16)
  const scrollMemoRef = useRef<Record<string, number>>({});
  const [resumePill, setResumePill] = useState<{ key: string; top: number } | null>(null);
  const activeLensKey = `${tab}:${activeLensId}`;

  useEffect(() => {
    if (!isOpen || internalMode !== 'main') {
      setResumePill(null);
      return;
    }
    const root = paneRootRef.current;
    if (!root) return;

    const readPane = () =>
      root.querySelector<HTMLElement>('.lkdv-lens-pane[data-testid="slot-content"]');

    const syncPill = (key: string, top: number) => {
      const saved = scrollMemoRef.current[key] ?? 0;
      const visible = saved > 0 && top < RESUME_TOP_MAX && Math.abs(saved - top) > RESUME_TOP_MAX;
      setResumePill((prev) => {
        if (!visible) return prev === null ? prev : null;
        if (prev && prev.key === key && prev.top === saved) return prev;
        return { key, top: saved };
      });
    };

    const currentPane = readPane();
    if (currentPane) {
      currentPane.setAttribute('data-scrolled', currentPane.scrollTop > 8 ? 'true' : 'false');
    }
    syncPill(activeLensKey, currentPane?.scrollTop ?? 0);

    const onScroll = (event: Event) => {
      const pane = event.target as HTMLElement | null;
      if (!pane || typeof pane.classList === 'undefined') return;
      if (!pane.classList.contains('lkdv-lens-pane')) return;
      const lid = pane.getAttribute('data-lens');
      if (!lid) return;
      pane.setAttribute('data-scrolled', pane.scrollTop > 8 ? 'true' : 'false');
      const key = `${tab}:${lid}`;
      if (pane.scrollTop > RESUME_MEMO_MIN) scrollMemoRef.current[key] = pane.scrollTop;
      syncPill(key, pane.scrollTop);
    };

    root.addEventListener('scroll', onScroll, true);
    return () => root.removeEventListener('scroll', onScroll, true);
  }, [activeLensKey, internalMode, isOpen, tab]);

  const resumeReading = useCallback(() => {
    if (!resumePill) return;
    const root = paneRootRef.current;
    const pane = root?.querySelector<HTMLElement>('.lkdv-lens-pane[data-testid="slot-content"]');
    const manualReduce = Boolean(reduceMotion || root?.closest('[data-reduce-motion="true"]'));
    const systemReduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reduce = manualReduce || systemReduce;
    pane?.scrollTo?.({ top: resumePill.top, behavior: reduce ? 'auto' : 'smooth' });
    haptic('selection');
    setResumePill(null);
  }, [haptic, reduceMotion, resumePill]);

  // Keyboard shortcuts: Cmd/Ctrl+K, 1..5, Backspace (FN-17)
  const handleRootKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (internalMode !== 'main') return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setStack([]);
        setInspectedMember(null);
        setInspectedOuting(null);
        setTab(0);
        setSubForTab(0, 2);
        haptic('selection');
        window.setTimeout(() => {
          const el = paneRootRef.current?.querySelector<HTMLInputElement>('[data-autofocus="true"]');
          el?.focus({ preventScroll: true });
        }, 50);
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

      if (event.key >= '1' && event.key <= '4') {
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
        className="lkdv-carnet-drawer lkdv-club-carnet-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Espace Club & Cordée"
        tabIndex={-1}
        data-club-tab={tab}
        data-club-lens={activeLensId}
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
            setInspectedMember(null);
            setInspectedOuting(null);
            setSubForTab(tab, idx);
          }}
          selector={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
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
                  setMemberLensIndex(0);
                  setTab(nextTab);
                }}
                ariaLabel="Onglets du club"
                size="default"
              />
              {tab === 1 && inspectedMember ? (() => {
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
                const mPostsCount = posts.filter((p) => isMemberMatch(p.authorHandle, p.authorName)).length;
                const mOutingsCount =
                  inspectedMember.outingsCount ??
                  outings.filter((o) => isMemberMatch(o.leaderHandle, o.leaderName)).length;
                const mGearCount = vaultGear.filter((g) => isMemberMatch(g.ownerHandle, g.ownerName)).length;
                const handleLabel = inspectedMember.handle
                  ? `@${inspectedMember.handle.replace(/^@/, '')}`
                  : '';
                const subtitleText = [handleLabel, inspectedMember.city].filter(Boolean).join(' · ');

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

                return (
                  <div
                    className={`lkdv-carnet-card lkdv-cv2c-carnet-ig-editor lkdv-cv2x-carnet-ig-tile lkdv-cv2x-member-ig-tile lkdv-club-member-hero-card${
                      inspectedMember.avatarUrl ? ' has-cover-bg' : ''
                    }`}
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
                );
              })() : null}
            </div>
          }
          renderLens={(lens, index, active) => (
            <div className="lkdv-carnet-drawer-pane">
              {tab === 0 ? (
                <ClubExplorerDrawerBody
                  lensId={(lens.id as ExplorerLensId) || 'my-clubs'}
                  active={active}
                  loading={syncStatus === 'syncing'}
                  activeClub={activeClub}
                  clubs={clubs}
                  members={members}
                  outings={outings}
                  posts={posts}
                  vaultGear={vaultGear}
                  currentUserId={currentUserId}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                  onSelectClub={onSelectClub}
                  onToggleJoinClub={onToggleJoinClub}
                  onFlyToCoords={onFlyToCoords}
                  onSwitchLens={(idx) => {
                    haptic('selection');
                    setSubForTab(0, idx);
                  }}
                  onSwitchTabAndLens={handleSwitchTabAndLens}
                  onOpenCreateClub={(prefillMassif) => {
                    setCreatePrefillMassif(prefillMassif);
                    setInternalMode('create');
                    setTab(3);
                  }}
                  onBorrowGear={onToggleReserveGear}
                  onToast={emitToast}
                  onClose={() => onClose?.()}
                />
              ) : null}

              {tab === 1 ? (
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
                  onUpdateMyAvailability={async () => {}}
                  onChangeMemberRole={onChangeMemberRole}
                  onCreateBinomeGroup={onCreateBinomeGroup}
                  onBorrowGear={onToggleReserveGear}
                  onSwitchTabAndLens={handleSwitchTabAndLens}
                  onOpenMemberProfile={openMemberProfileByHandle}
                  onToast={emitToast}
                  onClose={() => onClose?.()}
                />
              ) : null}

              {tab === 2 ? (
                <ClubSortiesDrawerBody
                  activeSubTab={index}
                  active={active}
                  activeClub={activeClub}
                  outings={outings}
                  members={members}
                  vaultGear={vaultGear}
                  inspectedOuting={inspectedOuting}
                  onInspectOuting={(o) => pushOuting(o, index)}
                  onToggleRsvpOuting={onToggleRsvpOuting}
                  onCreateGroupFromOuting={onCreateGroupFromOuting}
                  onDownloadGpx={onDownloadGpx}
                  onFlyToCoords={onFlyToCoords}
                  onSwitchTab={(nextT, nextSub = 0) => handleSwitchTabAndLens(nextT, nextSub)}
                  onToast={emitToast}
                  onOpenRuntimeOverlay={onOpenRuntimeOverlay}
                  currentUserId={currentUserId}
                  initialSection={g02Section ?? 'events'}
                />
              ) : null}

              {tab === 3 ? (
                <ClubCoffreDrawerBody
                  activeSubTab={index}
                  activeClub={activeClub}
                  vaultGear={vaultGear}
                  standardKits={standardKits}
                  members={members}
                  outings={outings}
                  onToggleReserveGear={onToggleReserveGear}
                  onCloneStandardKit={onCloneStandardKit}
                  onSwitchTab={(nextT, nextSub = 0) => handleSwitchTabAndLens(nextT, nextSub)}
                  onSwitchToCreate={(cTab) => {
                    setInternalMode('create');
                    setTab(cTab);
                  }}
                  onToast={emitToast}
                />
              ) : null}
            </div>
          )}
        />

        {resumePill && resumePill.key === activeLensKey ? (
          <div className="club-drawer-floating-left">
            <button
              type="button"
              className="lkdv-club-pill-reprendre"
              onClick={resumeReading}
            >
              <ArrowUp size={13} aria-hidden="true" />
              <span>Reprendre la lecture</span>
            </button>
          </div>
        ) : null}

        <ClubIsland toast={localToast} onDismiss={() => setLocalToast(null)} />
      </motion.div>
    </ClubMotionRoot>
  );
}

export default ClubDrawerHost;
