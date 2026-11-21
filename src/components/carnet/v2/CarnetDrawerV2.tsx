'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { KitItemV2 } from '@/features/community/v2/create/engine/createSchemasV2';
import type { PickerProduct } from '@/features/community/create/kit/types';
import '@/features/community/v2/create/create-v2.css';
import {
  Compass,
  MapPin,
  Backpack,
  BarChart2,
  Users,
  Clock,
  Image as ImageIcon,
  Quote,
  Leaf,
  Flag,
  Mountain,
  Moon,
  CloudSun,
  Package,
  Award,
  Scale,
  Route,
  TrendingUp,
  Timer,
  Wallet,
  Radio,
  Share2,
  ChevronLeft,
  ChevronRight,
  Download,
  Bookmark,
  Copy,
  Check,
  Send,
  Trash2,
  Sun,
  Globe,
  Lock,
  X,
} from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import LikeIcon from '@/components/social-kit/LikeIcon';
import { SlotShell, type SlotId, type SlotLens } from '@/components/compte/drawer/SlotShell';
import { CapsuleTabs, type CapsuleTabItem } from '@/components/ui/CapsuleTabs';
import { generatedProductImage } from '@/components/compte/drawer/cards/productImage';
import type {
  CarnetDetail,
  CarnetEtapeDay,
  CarnetNightItem,
  CarnetMomentItem,
  CarnetParticipant,
  KitVerdictType,
} from '@/features/carnet/detail/types';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useCarnetDayReactions } from '@/features/carnet/detail/useCarnetDayReactions';
import { useKitFork } from '@/features/carnet/detail/useKitFork';
import { useCarnetDialog } from './useCarnetDialog';
import {
  AnimatedNumber,
  CarnetMotionRoot,
  LensTransition,
  StackSlideView,
} from './CarnetDrawerMotion';
import { CarnetFilDrawerBody } from './CarnetFilDrawerBody';

const KitProductSheetV2 = dynamic(
  () => import('@/features/community/v2/create/kit/KitProductSheetV2').then((m) => m.KitProductSheetV2),
  { ssr: false }
);
const CarnetAltitudeDrawerBody = dynamic(
  () => import('./CarnetAltitudeDrawerBody').then((m) => m.CarnetAltitudeDrawerBody),
  { ssr: false }
);
const CarnetPokedexDrawerBody = dynamic(
  () => import('./CarnetPokedexDrawerBody').then((m) => m.CarnetPokedexDrawerBody),
  { ssr: false }
);
const CarnetKitDrawerBody = dynamic(
  () => import('./CarnetKitDrawerBody').then((m) => m.CarnetKitDrawerBody),
  { ssr: false }
);
const CarnetChiffresDrawerBody = dynamic(
  () => import('./CarnetChiffresDrawerBody').then((m) => m.CarnetChiffresDrawerBody),
  { ssr: false }
);
const CarnetEquipageDrawerBody = dynamic(
  () => import('./CarnetEquipageDrawerBody').then((m) => m.CarnetEquipageDrawerBody),
  { ssr: false }
);

export type CarnetSlotId = 'fil' | 'route' | 'sac' | 'chiffres' | 'equipage';
export type StackIntent = { type: string; [key: string]: unknown };

/** Seuil (px) au-delà duquel la descente dans une lentille est mémorisée. */
/** Rôles du carnet : les données serveur sont en anglais, l'interface en français. */
function roleLabel(role: string): string {
  if (role === 'author') return 'auteur';
  if (role === 'collaborator') return 'contributeur';
  if (role === 'participant') return 'participant';
  return role;
}

const RESUME_MEMO_MIN = 20;
/** Seuil (px) sous lequel la lentille est considérée « en haut ». */
const RESUME_TOP_MAX = 10;

/**
 * Cascade des lignes du tiroir — maquette `.ds-row` (`sheetRowIn`) :
 * 450 ms `--ease-glass`, pas de 30 ms plafonné au 11e élément.
 */
function rowStyle(index: number): React.CSSProperties {
  return {
    animation: 'lkdv-row-in 450ms var(--ease-glass) both',
    animationDelay: `${Math.min(index, 10) * 30}ms`,
  };
}

/** Le mouvement réduit est déclaratif : la feuille ci-dessous neutralise
 *  l'animation, y compris quand le popover Affichage la force à la main. */
const DRAWER_MOTION_CSS = `
@keyframes lkdv-row-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.lkdv-carnet-drawer [data-carnet-row]{animation:none!important}}
.lkdv-carnet-v2-root[data-reduce-motion='true'] .lkdv-carnet-drawer [data-carnet-row]{animation:none!important}
`;

export interface CarnetDrawerV2Props {
  isOpen: boolean;
  onClose: () => void;
  detail: CarnetDetail;
  activeSlot: CarnetSlotId;
  onSlotChange: (slot: CarnetSlotId) => void;
  activeDay: number;
  onFocusMap?: (lat: number, lng: number, zoom?: number) => void;
  onOpenKitCreate?: (prefill: { name: string; items: KitItemV2[] }) => void;
  onIsland?: (message: string, undo?: () => void) => void;
  userId: string | null;
  onRequireAuth?: () => void;
  onSelectMoment?: (moment: CarnetMomentItem, index: number) => void;
  onOpenStories?: () => void;
  isAccountDrawer?: boolean;
  onObserveSpecies?: (species: { name: string; latin: string }) => void;
  isEditing?: boolean;
  onCreate?: (...args: any[]) => void;
  pinnedIds?: ReadonlySet<string>;
  onContextChange?: (context: any) => void;
  intent?: { nonce: number; view: StackIntent } | null;
  forceError?: unknown;
  onEdit?: (target: any) => void;
  onSettingsSaved?: (changes: Record<string, unknown>) => void;
  onDeleted?: () => void;
  onDayPick?: (day: number) => void;
  isOutdoor?: boolean;
  onToggleOutdoor?: () => void;
  reduceMotion?: boolean;
  onToggleReduceMotion?: () => void;
}

type StackView =
  | { type: 'etape'; etape: CarnetEtapeDay }
  | { type: 'night'; night: CarnetNightItem }
  | {
      type: 'item';
      itemId: string;
      name: string;
      weightG: number | null;
      detailText?: string | null;
    }
  | { type: 'participant'; participant: CarnetParticipant };

export function CarnetDrawerV2({
  isOpen,
  onClose,
  detail,
  activeSlot,
  onSlotChange,
  activeDay,
  onFocusMap,
  onOpenKitCreate,
  onIsland,
  userId,
  onRequireAuth,
  onSelectMoment,
  onOpenStories,
  isAccountDrawer = false,
  onObserveSpecies,
  onDayPick,
  isOutdoor = false,
  onToggleOutdoor,
  reduceMotion = false,
  onToggleReduceMotion,
}: CarnetDrawerV2Props) {
  const { haptic } = useHapticFeedback();
  const router = useRouter();
  const [lensIndexBySlot, setLensIndexBySlot] = useState<Record<CarnetSlotId, number>>({
    fil: 0,
    route: 0,
    sac: 0,
    chiffres: 0,
    equipage: 0,
  });
  const [accountTab, setAccountTab] = useState<number>(0);
  const [stack, setStack] = useState<StackView[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<CarnetDetail['participants'][number] | null>(null);
  const sacKitItems = useMemo(() => {
    if (detail.kit?.items?.length) return detail.kit.items;
    const memberLists = Object.values(detail.memberKits ?? {});
    for (const mk of memberLists) {
      if (mk?.items?.length) return mk.items;
    }
    return [];
  }, [detail.kit, detail.memberKits]);
  type SheetKitItem = (typeof sacKitItems)[number];
  const [selectedKitSheet, setSelectedKitSheet] = useState<{
    items: SheetKitItem[];
    index: number;
    owner?: { id: string; name: string; avatarUrl?: string | null } | null;
  } | null>(null);
  const openKitProductSheet = (
    item: SheetKitItem,
    preferredItems?: SheetKitItem[],
    preferredOwner?: { id: string; name: string; avatarUrl?: string | null } | null
  ) => {
    if (preferredItems && preferredItems.length > 0) {
      const idx = preferredItems.findIndex((k) => k.id === item.id);
      if (idx >= 0) {
        setSelectedKitSheet({ items: preferredItems, index: idx, owner: preferredOwner ?? null });
        return;
      }
    }
    const baseIdx = sacKitItems.findIndex((k) => k.id === item.id);
    if (baseIdx >= 0) {
      setSelectedKitSheet({
        items: sacKitItems,
        index: baseIdx,
        owner: detail.author
          ? { id: detail.author.id, name: detail.author.name, avatarUrl: detail.author.avatarUrl ?? null }
          : null,
      });
      return;
    }
    for (const [memberId, mk] of Object.entries(detail.memberKits ?? {})) {
      const items = mk?.items ?? [];
      const mkIdx = items.findIndex((k) => k.id === item.id);
      if (mkIdx >= 0) {
        const part = detail.participants.find((pt) => pt.userId === memberId || pt.id === memberId);
        setSelectedKitSheet({
          items,
          index: mkIdx,
          owner: part
            ? {
                id: part.userId ?? part.id,
                name: part.name?.trim() || part.handle?.trim() || 'Voyageur',
                avatarUrl: part.avatarUrl ?? null,
              }
            : null,
        });
        return;
      }
    }
    setSelectedKitSheet({ items: [item], index: 0, owner: preferredOwner ?? null });
  };
  const [verdictFilter, setVerdictFilter] = useState<'all' | KitVerdictType>('all');
  const [newCommentText, setNewCommentText] = useState('');
  const [kitJumpUserId, setKitJumpUserId] = useState<string | null>(null);
  const [pokedexProgress, setPokedexProgress] = useState<{
    discovered: number;
    total: number;
  } | null>(null);

  // Reactions : le jour choisi dans la lentille, sinon le jour actif.
  const effectiveDay = activeDay > 0 ? activeDay : 1;
  const [reactionDay, setReactionDay] = useState(effectiveDay);
  useEffect(() => setReactionDay(effectiveDay), [effectiveDay]);
  const reactions = useCarnetDayReactions({
    carnetId: detail.id,
    dayNumber: reactionDay,
    initialLikes: detail.dayReactions?.[reactionDay]?.likesCount ?? 0,
    initialLiked: detail.dayReactions?.[reactionDay]?.userLiked ?? false,
    userId,
    onRequireAuth,
    onIsland,
  });

  // Kit fork hook
  const { isForked, forkItem, forkAllItems } = useKitFork({
    carnetId: detail.id,
    userId,
    onRequireAuth,
    onIsland,
  });

  // Focus piégé, Échap, retour de focus, verrou de scroll (socle §7.2).
  const dialogRef = useCarnetDialog(isOpen, onClose);

  const activeLensIndex = lensIndexBySlot[activeSlot] ?? 0;

  const handleLensChange = useCallback(
    (index: number) => {
      haptic('selection');
      setLensIndexBySlot((prev) => ({ ...prev, [activeSlot]: index }));
    },
    [activeSlot, haptic]
  );

  const pushStack = useCallback(
    (view: StackView) => {
      haptic('light');
      setStack((prev) => [...prev, view]);
    },
    [haptic]
  );

  const popStack = useCallback(() => {
    haptic('light');
    setStack((prev) => prev.slice(0, -1));
  }, [haptic]);

  // Reset stack and selected participant on slot change
  useEffect(() => {
    setStack([]);
    setSelectedParticipant(null);
  }, [activeSlot]);

  // Main 5 slots configuration
  const slotTabs: CapsuleTabItem[] = useMemo(
    () => [
      { id: 'fil', label: 'Fil de bord', icon: <Compass size={17} /> },
      { id: 'route', label: 'Pokédex Nature', icon: <Leaf size={17} /> },
      { id: 'sac', label: 'Sac', icon: <Backpack size={17} /> },
      { id: 'chiffres', label: 'Chiffres', icon: <BarChart2 size={17} /> },
      { id: 'equipage', label: 'Équipage', icon: <Users size={17} /> },
    ],
    []
  );

  // Lenses for each slot
  const slotLenses: Record<CarnetSlotId, SlotLens[]> = useMemo(() => {
    const isVisitor = detail.viewerRole === 'visitor';
    return {
      fil: [
        { id: 'moments', label: 'Global', icon: <Clock size={15} /> },
        { id: 'altitude', label: 'Altitude', icon: <Mountain size={15} /> },
      ],
      route: [
        { id: 'pokedex', label: 'Pokédex', icon: <Leaf size={15} /> },
        { id: 'faune', label: 'Faune', icon: <Compass size={15} /> },
        { id: 'flore', label: 'Flore & Milieux', icon: <Mountain size={15} /> },
      ],
      sac: [
        { id: 'kit', label: 'Kit', icon: <Package size={15} /> },
        { id: 'poids', label: 'Poids', icon: <Scale size={15} /> },
      ],
      chiffres: [
        { id: 'distance', label: 'Distance', icon: <Route size={15} /> },
        { id: 'denivele', label: 'Dénivelé', icon: <TrendingUp size={15} /> },
        { id: 'duree', label: 'Durée', icon: <Timer size={15} /> },
        // Budget is displayed for participants, or for visitors if the carnet members made it public
        ...((!isVisitor || detail.budgetPublic) && detail.budget
          ? [{ id: 'budget', label: 'Budget', icon: <Wallet size={15} /> }]
          : []),
      ],
      equipage: selectedParticipant
        ? [
            { id: 'p-perf', label: 'Perf & Stats', icon: <TrendingUp size={15} /> },
            { id: 'p-pokedex', label: 'Pokédex', icon: <Leaf size={15} /> },
            { id: 'p-kit', label: 'Sac', icon: <Package size={15} /> },
            ...((!isVisitor || detail.budgetPublic) && detail.budget
              ? [{ id: 'p-budget', label: 'Dépenses', icon: <Wallet size={15} /> }]
              : []),
          ]
        : [
            { id: 'participants', label: 'Participants', icon: <Users size={15} /> },
            { id: 'reactions', label: 'Réactions', icon: <LikeIcon size={15} /> },
            { id: 'suivre', label: 'Suivre', icon: <Radio size={15} /> },
          ],
    };
  }, [detail.budget, detail.budgetPublic, detail.viewerRole, selectedParticipant]);

  // Account / Settings Tabs (sans Notifications, qui vit désormais dans la cloche)
  const accountTabs = useMemo(
    () => [
      { id: 'partage', label: 'Partage', icon: <Share2 size={14} aria-hidden="true" /> },
      { id: 'affichage', label: 'Affichage', icon: <Sun size={14} aria-hidden="true" /> },
      { id: 'export', label: 'Export & Infos', icon: <Download size={14} aria-hidden="true" /> },
    ],
    []
  );

  // ---- Lecture : position mémorisée par lentille (`${slot}:${lens.id}`) ----
  const activeLensId = (slotLenses[activeSlot] ?? [])[activeLensIndex]?.id;
  const activeLensKey = activeLensId ? `${activeSlot}:${activeLensId}` : null;
  const scrollMemoRef = useRef<Record<string, number>>({});
  const paneRootRef = useRef<HTMLDivElement | null>(null);
  const [resumePill, setResumePill] = useState<{ key: string; top: number } | null>(null);

  // Le conteneur du tiroir porte aussi le piège de focus de `useCarnetDialog` :
  // un seul nœud, deux références.
  const attachPaneRoot = useCallback(
    (node: HTMLDivElement | null) => {
      paneRootRef.current = node;
      dialogRef.current = node;
    },
    [dialogRef]
  );

  useEffect(() => {
    if (!isOpen || !activeLensKey) {
      setResumePill(null);
      return;
    }
    const root = paneRootRef.current;
    if (!root) return;

    const readPane = () =>
      root.querySelector<HTMLElement>('.lkdv-lens-pane[data-testid="slot-content"]');

    const syncPill = (key: string, top: number) => {
      const saved = scrollMemoRef.current[key] ?? 0;
      // Nulle, ou déjà à la position mémorisée : pas de pilule.
      const visible = saved > 0 && top < RESUME_TOP_MAX && Math.abs(saved - top) > RESUME_TOP_MAX;
      setResumePill((prev) => {
        if (!visible) return prev === null ? prev : null;
        if (prev && prev.key === key && prev.top === saved) return prev;
        return { key, top: saved };
      });
    };

    syncPill(activeLensKey, readPane()?.scrollTop ?? 0);

    const onScroll = (event: Event) => {
      const pane = event.target as HTMLElement | null;
      if (!pane || typeof pane.classList === 'undefined') return;
      if (!pane.classList.contains('lkdv-lens-pane')) return;
      const lensId = pane.getAttribute('data-lens');
      if (!lensId) return;
      const key = `${activeSlot}:${lensId}`;
      if (pane.scrollTop > RESUME_MEMO_MIN) scrollMemoRef.current[key] = pane.scrollTop;
      syncPill(key, pane.scrollTop);
    };

    root.addEventListener('scroll', onScroll, true);
    return () => root.removeEventListener('scroll', onScroll, true);
  }, [isOpen, activeLensKey, activeSlot]);

  const resumeReading = useCallback(() => {
    if (!resumePill) return;
    const root = paneRootRef.current;
    const pane = root?.querySelector<HTMLElement>('.lkdv-lens-pane[data-testid="slot-content"]');
    const manualReduce = Boolean(root?.closest('[data-reduce-motion="true"]'));
    const systemReduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reduce = manualReduce || systemReduce;
    pane?.scrollTo({ top: resumePill.top, behavior: reduce ? 'auto' : 'smooth' });
    haptic('selection');
    setResumePill(null);
  }, [haptic, resumePill]);

  if (!isOpen) return null;

  // Render Stack Views (Fiches)
  const currentStackItem = stack[stack.length - 1];

  if (currentStackItem) {
    return (
      <div
        ref={dialogRef}
        className="lkdv-stack-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Détail du carnet"
        tabIndex={-1}
      >
        <div className="lkdv-stack-header">
          <button type="button" className="lkdv-stack-back" onClick={popStack}>
            <ChevronLeft size={16} />
            <span>Retour</span>
          </button>
          <b style={{ fontSize: '13.5px', color: 'var(--tint, #17402C)' }}>
            {currentStackItem.type === 'etape' && (currentStackItem.etape.label || 'Étape')}
            {currentStackItem.type === 'night' && currentStackItem.night.name}
            {currentStackItem.type === 'item' && currentStackItem.name}
            {currentStackItem.type === 'participant' && currentStackItem.participant.name}
          </b>
        </div>

        <div className="lkdv-stack-body">
          <CarnetMotionRoot>
            <StackSlideView stackKey={`account-${stack.length}`}>
          {currentStackItem.type === 'etape' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px',
                  borderRadius: '16px',
                  background: 'var(--drawer-card-bg)',
                }}
              >
                <div>
                  <small style={{ color: 'var(--label2)' }}>Distance</small>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>
                    {currentStackItem.etape.distanceKm
                      ? `${Number(currentStackItem.etape.distanceKm).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`
                      : '—'}
                  </p>
                </div>
                <div>
                  <small style={{ color: 'var(--label2)' }}>Dénivelé +</small>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>
                    {currentStackItem.etape.elevationM
                      ? `+${currentStackItem.etape.elevationM} m`
                      : '—'}
                  </p>
                </div>
                <div>
                  <small style={{ color: 'var(--label2)' }}>Durée</small>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>
                    {currentStackItem.etape.durationText || '—'}
                  </p>
                </div>
              </div>

              {currentStackItem.etape.note ? (
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '16px',
                    background: 'var(--drawer-card-bg)',
                  }}
                >
                  <b>Récit de l’étape</b>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', lineHeight: 1.4 }}>
                    {currentStackItem.etape.note}
                  </p>
                </div>
              ) : null}
            </div>
          )}

          {currentStackItem.type === 'night' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                style={{
                  padding: '12px',
                  borderRadius: '16px',
                  background: 'var(--drawer-card-bg)',
                }}
              >
                <b>Type d’hébergement</b>
                <p style={{ margin: '4px 0 0', textTransform: 'capitalize' }}>
                  {currentStackItem.night.type}
                </p>
                {currentStackItem.night.altitudeM ? (
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--label2)' }}>
                    Altitude : {currentStackItem.night.altitudeM} m
                  </p>
                ) : null}
                {currentStackItem.night.infos ? (
                  <p style={{ margin: '6px 0 0', fontSize: '12.5px', lineHeight: 1.4 }}>
                    {currentStackItem.night.infos}
                  </p>
                ) : null}
              </div>

              {currentStackItem.night.lat && currentStackItem.night.lng ? (
                <button
                  type="button"
                  style={{
                    height: '38px',
                    borderRadius: '9999px',
                    border: '0',
                    background: 'var(--tint, #17402C)',
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    if (currentStackItem.night.lat && currentStackItem.night.lng) {
                      onFocusMap?.(currentStackItem.night.lat, currentStackItem.night.lng, 13);
                      onIsland?.('Caméra centrée sur le bivouac');
                    }
                  }}
                >
                  <MapPin size={16} />
                  <span>Localiser sur la carte</span>
                </button>
              ) : null}
            </div>
          )}

          {currentStackItem.type === 'item' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                style={{
                  padding: '12px',
                  borderRadius: '16px',
                  background: 'var(--drawer-card-bg)',
                }}
              >
                <b>Poids</b>
                <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
                  {currentStackItem.weightG ? `${currentStackItem.weightG} g` : 'Non renseigné'}
                </p>
                {currentStackItem.detailText ? (
                  <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: 'var(--label2)' }}>
                    {currentStackItem.detailText}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                className="lkdv-pill-reprendre"
                style={{
                  position: 'relative',
                  left: 'auto',
                  bottom: 'auto',
                  alignSelf: 'flex-start',
                }}
                onClick={() => {
                  void forkItem(currentStackItem.itemId);
                }}
              >
                <Package size={14} />
                <span>
                  {isForked(currentStackItem.itemId) ? 'Dans mon sac' : 'Reprendre dans mon sac'}
                </span>
              </button>
            </div>
          )}

          {currentStackItem.type === 'participant' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '16px',
                  background: 'var(--drawer-card-bg)',
                }}
              >
                {currentStackItem.participant.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentStackItem.participant.avatarUrl}
                    alt=""
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'var(--fill)',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Users size={22} />
                  </div>
                )}
                <div>
                  <b style={{ fontSize: '15px' }}>{currentStackItem.participant.name}</b>
                  {currentStackItem.participant.role ? (
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--label2)' }}>
                      {roleLabel(currentStackItem.participant.role)}
                    </p>
                  ) : null}
                </div>
              </div>

              {(detail.memberKits?.[currentStackItem.participant.userId]?.items.length ?? 0) > 0 ||
              (currentStackItem.participant.userId === detail.author?.id &&
                detail.kit.items.length > 0) ? (
                <button
                  type="button"
                  className="lkdv-carnet-btn-primary"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => {
                    setKitJumpUserId(currentStackItem.participant.userId);
                    setStack([]);
                    onSlotChange('sac');
                  }}
                >
                  <Package size={14} />
                  <span>Voir son kit</span>
                </button>
              ) : null}

              <b style={{ fontSize: '13px', margin: '4px 0 0' }}>Médias de ce voyageur</b>
              <div className="lkdv-ig-grid">
                {detail.photoMoments
                  .filter(
                    (m) =>
                      m.authorId === currentStackItem.participant.userId ||
                      m.authorName === currentStackItem.participant.name
                  )
                  .map((m, idx) => (
                    <button
                      key={m.id}
                      type="button"
                      className="lkdv-ig-tile"
                      onClick={() => onSelectMoment?.(m, idx)}
                    >
                      {m.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.imageUrl} alt="" loading="lazy" />
                      ) : null}
                    </button>
                  ))}
              </div>
            </div>
          )}
            </StackSlideView>
          </CarnetMotionRoot>
        </div>
      </div>
    );
  }

  // Render Secondary Account / Carnet Settings Drawer (Design System LKDV V2)
  if (isAccountDrawer) {
    const safeTabIdx = Math.min(accountTab, accountTabs.length - 1);
    const activeAccountTabId = accountTabs[safeTabIdx]?.id ?? 'partage';
    const shareHref = typeof window !== 'undefined' ? window.location.href : '';
    const totalMoments = detail.moments.length;
    const totalSpecies = detail.pokedexEntries?.length ?? 0;
    const totalGear = detail.kit?.items?.length ?? 0;
    const isPublicCarnet = detail.isPublic !== false && detail.visibility !== 'private';

    return (
      <div
        ref={dialogRef}
        className="lkdv-stack-sheet lkdv-cv2c-ps-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Paramètres du carnet"
        tabIndex={-1}
        style={{ background: '#f6f8f7' }}
      >
        <div className="lkdv-cv2c-ps-head">
          <button
            type="button"
            className="lkdv-cv2c-ps-close"
            onClick={onClose}
            aria-label="Fermer les paramètres"
          >
            <X size={16} aria-hidden="true" />
          </button>
          <span
            className="lkdv-cv2c-ps-head-title"
            style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: '0.92rem', color: '#172b24' }}
          >
            Paramètres du carnet
          </span>
          <span style={{ width: 34, flexShrink: 0 }} aria-hidden="true" />
        </div>

        <div style={{ padding: '4px 14px 10px' }}>
          <CapsuleTabs
            items={accountTabs.map((t) => ({
              id: t.id,
              label: t.label,
              icon: t.icon,
            }))}
            activeId={activeAccountTabId}
            onChange={(id) => {
              const idx = accountTabs.findIndex((t) => t.id === id);
              if (idx >= 0) setAccountTab(idx);
            }}
            ariaLabel="Sections des paramètres du carnet"
          />
        </div>

        <div className="lkdv-cv2c-ps-scroll" style={{ paddingTop: 2 }}>
          <CarnetMotionRoot>
            <StackSlideView stackKey={`account-${activeAccountTabId}-${stack.length}`}>
              {activeAccountTabId === 'partage' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="lkdv-cv2c-ps-card" style={{ gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span className="lkdv-cv2c-ps-label" style={{ marginBottom: 0 }}>
                        Carnet d’expédition
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: isPublicCarnet ? 'rgba(22, 163, 74, 0.12)' : 'rgba(100, 116, 139, 0.14)',
                          color: isPublicCarnet ? '#15803d' : '#475569',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                        }}
                      >
                        {isPublicCarnet ? <Globe size={11} aria-hidden="true" /> : <Lock size={11} aria-hidden="true" />}
                        {isPublicCarnet ? 'Public' : 'Privé'}
                      </span>
                    </div>
                    <b style={{ fontSize: '0.92rem', color: '#172b24', lineHeight: 1.3 }}>{detail.title}</b>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: '0.74rem', color: '#56665d' }}>
                      <span>{detail.etapes.length} étape{detail.etapes.length > 1 ? 's' : ''}</span>
                      <span>·</span>
                      <span>{detail.participants.length} participant{detail.participants.length > 1 ? 's' : ''}</span>
                      {detail.distanceKm ? (
                        <>
                          <span>·</span>
                          <span>{Math.round(detail.distanceKm)} km</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="lkdv-cv2c-ps-card" style={{ gap: 10 }}>
                    <span className="lkdv-cv2c-ps-label" style={{ marginBottom: 0 }}>
                      Lien de partage
                    </span>
                    <div
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        background: '#f8faf8',
                        border: '1px solid rgba(23, 64, 44, 0.1)',
                        fontSize: '0.72rem',
                        color: '#56665d',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {shareHref || `/carnets/${detail.id}`}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            void navigator.clipboard.writeText(window.location.href);
                            onIsland?.('Lien copié dans le presse-papier');
                          }
                        }}
                        style={{
                          height: 36,
                          borderRadius: 999,
                          border: 0,
                          background: '#17402c',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          cursor: 'pointer',
                        }}
                      >
                        <Copy size={13} aria-hidden="true" />
                        <span>Copier le lien</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof navigator !== 'undefined' && navigator.share) {
                            void navigator.share({ title: detail.title, url: shareHref }).catch(() => {});
                          } else if (typeof window !== 'undefined') {
                            void navigator.clipboard.writeText(window.location.href);
                            onIsland?.('Lien copié dans le presse-papier');
                          }
                        }}
                        style={{
                          height: 36,
                          borderRadius: 999,
                          border: '1px solid rgba(23, 64, 44, 0.18)',
                          background: '#ffffff',
                          color: '#17402c',
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          cursor: 'pointer',
                        }}
                      >
                        <Share2 size={13} aria-hidden="true" />
                        <span>Partager</span>
                      </button>
                    </div>
                  </div>

                  <div className="lkdv-cv2c-ps-card" style={{ gap: 8 }}>
                    <span className="lkdv-cv2c-ps-label" style={{ marginBottom: 0 }}>
                      Réutiliser l’itinéraire
                    </span>
                    <p style={{ margin: 0, fontSize: '0.76rem', color: '#56665d', lineHeight: 1.4 }}>
                      Ouvrez ce tracé dans le Compas pour planifier votre propre départ avec ces étapes.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push(`/compas?nouvelle=1&etape=ou&carnetId=${encodeURIComponent(detail.id)}`);
                      }}
                      style={{
                        height: 36,
                        borderRadius: 999,
                        border: '1px solid rgba(23, 64, 44, 0.16)',
                        background: '#f8faf8',
                        color: '#17402c',
                        fontWeight: 600,
                        fontSize: '0.78rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <Route size={14} aria-hidden="true" />
                      <span>Reprendre dans le Compas</span>
                    </button>
                  </div>
                </div>
              )}

              {activeAccountTabId === 'affichage' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="lkdv-cv2c-ps-card" style={{ gap: 12 }}>
                    <span className="lkdv-cv2c-ps-label" style={{ marginBottom: 0 }}>
                      Confort de lecture sur le terrain
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <b style={{ display: 'block', fontSize: '0.82rem', color: '#172b24' }}>Mode plein soleil</b>
                        <small style={{ fontSize: '0.72rem', color: '#56665d' }}>
                          Contraste renforcé, texte plus lisible en extérieur
                        </small>
                      </div>
                      <Switch
                        checked={isOutdoor}
                        onCheckedChange={() => {
                          haptic('selection');
                          onToggleOutdoor?.();
                        }}
                        aria-label="Mode plein soleil"
                      />
                    </div>
                    <div
                      style={{
                        height: 1,
                        background: 'rgba(23, 64, 44, 0.08)',
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <b style={{ display: 'block', fontSize: '0.82rem', color: '#172b24' }}>Réduire les animations</b>
                        <small style={{ fontSize: '0.72rem', color: '#56665d' }}>
                          Transitions simplifiées et économie de batterie
                        </small>
                      </div>
                      <Switch
                        checked={reduceMotion}
                        onCheckedChange={() => {
                          haptic('selection');
                          onToggleReduceMotion?.();
                        }}
                        aria-label="Réduire les animations"
                      />
                    </div>
                  </div>

                  <div className="lkdv-cv2c-ps-card" style={{ gap: 8 }}>
                    <span className="lkdv-cv2c-ps-label" style={{ marginBottom: 0 }}>
                      Unités actives
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                      {[
                        { k: 'Distance', v: 'km' },
                        { k: 'Dénivelé', v: 'm D+' },
                        { k: 'Poids', v: 'kg / g' },
                      ].map((u) => (
                        <div
                          key={u.k}
                          style={{
                            padding: '8px',
                            borderRadius: 10,
                            background: '#f8faf8',
                            border: '1px solid rgba(23, 64, 44, 0.08)',
                            textAlign: 'center',
                          }}
                        >
                          <small style={{ display: 'block', fontSize: '0.66rem', color: '#64748b' }}>{u.k}</small>
                          <b style={{ fontSize: '0.78rem', color: '#172b24' }}>{u.v}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeAccountTabId === 'export' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="lkdv-cv2c-ps-card" style={{ gap: 10 }}>
                    <span className="lkdv-cv2c-ps-label" style={{ marginBottom: 0 }}>
                      Données du carnet
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                      {[
                        { k: 'Moments', v: String(totalMoments) },
                        { k: 'Espèces', v: String(totalSpecies) },
                        { k: 'Équipement', v: `${totalGear} objets` },
                        { k: 'Visibilité', v: isPublicCarnet ? 'Public' : 'Privé' },
                      ].map((stat) => (
                        <div
                          key={stat.k}
                          style={{
                            padding: '7px 10px',
                            borderRadius: 10,
                            background: '#f8faf8',
                            border: '1px solid rgba(23, 64, 44, 0.08)',
                          }}
                        >
                          <small style={{ display: 'block', fontSize: '0.66rem', color: '#64748b' }}>{stat.k}</small>
                          <b style={{ fontSize: '0.78rem', color: '#172b24' }}>{stat.v}</b>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lkdv-cv2c-ps-card" style={{ gap: 8 }}>
                    <span className="lkdv-cv2c-ps-label" style={{ marginBottom: 0 }}>
                      Exporter
                    </span>
                    <button
                      type="button"
                      style={{
                        height: 38,
                        borderRadius: 999,
                        border: 0,
                        background: '#17402c',
                        color: '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(detail, null, 2)], {
                          type: 'application/json',
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `carnet-${detail.id}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        onIsland?.('Carnet exporté en JSON');
                      }}
                    >
                      <Download size={14} aria-hidden="true" />
                      <span>Télécharger le JSON complet</span>
                    </button>

                    {(() => {
                      const t = detail.trace as { type?: string; coordinates?: unknown; geometry?: { coordinates?: unknown }; features?: Array<{ geometry?: { coordinates?: unknown } }> } | null;
                      const rawCoords = Array.isArray(t?.coordinates)
                        ? t.coordinates
                        : Array.isArray(t?.geometry?.coordinates)
                          ? t.geometry.coordinates
                          : Array.isArray(t?.features?.[0]?.geometry?.coordinates)
                            ? t.features[0].geometry.coordinates
                            : null;
                      if (!Array.isArray(rawCoords) || rawCoords.length === 0) return null;
                      return (
                        <button
                          type="button"
                          style={{
                            height: 38,
                            borderRadius: 999,
                            border: '1px solid rgba(23, 64, 44, 0.18)',
                            background: '#ffffff',
                            color: '#17402c',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            const pts = rawCoords
                              .filter((c): c is [number, number] => Array.isArray(c) && c.length >= 2)
                              .map((pt) => `<trkpt lat="${pt[1]}" lon="${pt[0]}"></trkpt>`)
                              .join('');
                            const gpx = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Le Kit du Voyageur"><trk><name>${detail.title.replace(/[<>&]/g, '')}</name><trkseg>${pts}</trkseg></trk></gpx>`;
                            const blob = new Blob([gpx], { type: 'application/gpx+xml' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `trace-${detail.id}.gpx`;
                            a.click();
                            URL.revokeObjectURL(url);
                            onIsland?.('Trace GPX téléchargée');
                          }}
                        >
                          <Route size={14} aria-hidden="true" />
                          <span>Télécharger la trace GPX</span>
                        </button>
                      );
                    })()}
                  </div>
                </div>
              )}
            </StackSlideView>
          </CarnetMotionRoot>
        </div>
      </div>
    );
  }

  // Render Main Slot Content (by Slot and Lens)
  const renderCurrentSlotContent = (lens: SlotLens) => {
    switch (activeSlot) {
      case 'fil':
        if (lens.id === 'altitude') {
          return <CarnetAltitudeDrawerBody detail={detail} onFocusMap={onFocusMap} />;
        }
        return (
          <CarnetFilDrawerBody
            detail={detail}
            lensId={lens.id}
            onSelectMoment={onSelectMoment}
            onSelectEtape={(etape) => pushStack({ type: 'etape', etape })}
            onSelectNight={(night) => pushStack({ type: 'night', night })}
          />
        );
      case 'route':
        return (
          <CarnetPokedexDrawerBody
            detail={detail}
            lensId={lens.id}
            currentUserId={userId}
            onObserveSpecies={onObserveSpecies}
            onZoneProgressChange={setPokedexProgress}
          />
        );
      case 'sac':
        return (
          <CarnetKitDrawerBody
            detail={detail}
            lensId={lens.id}
            initialUserId={kitJumpUserId}
            verdictFilter={verdictFilter}
            onVerdictFilterChange={setVerdictFilter}
            onSelectItem={(item) => openKitProductSheet(item)}
            onForkAll={(ids) => {
              void forkAllItems(ids);
            }}
          />
        );
      case 'chiffres':
        return <CarnetChiffresDrawerBody detail={detail} lensId={lens.id} />;
      case 'equipage':
        if (selectedParticipant) {
          const p = selectedParticipant;
          const pName = p.name?.trim() || p.handle?.trim() || 'Voyageur';
          const pMoments = detail.moments.filter(
            (m) => m.authorId === p.userId || m.authorName === p.name
          );
          const pPhotos = detail.photoMoments.filter(
            (m) => m.authorId === p.userId || m.authorName === p.name
          );
          const pSpecies = detail.moments.filter(
            (m) =>
              m.type === 'species' &&
              (m.authorId === p.userId || m.authorName === p.name || (!m.authorId && p.userId === detail.author?.id))
          );
          const pKit =
            detail.memberKits?.[p.userId] ??
            (p.userId === detail.author?.id ? detail.kit : { totalWeightG: null, items: [] });
          const pKitItems = pKit?.items ?? [];
          const pWeightG =
            typeof pKit?.totalWeightG === 'number' && pKit.totalWeightG > 0
              ? pKit.totalWeightG
              : pKitItems.reduce((s, it) => s + (it.weightG ?? 0) * (it.quantity ?? 1), 0);
          const pExpenses = (detail.budget?.items ?? []).filter(
            (it) => it.paidByUserId === p.userId || (!it.paidByUserId && p.userId === detail.author?.id)
          );
          const pPaid = pExpenses.reduce(
            (s, it) => s + (typeof it.amount === 'number' ? it.amount : (it.amountCents ?? 0) / 100),
            0
          );
          const currency = detail.budget?.currency === 'EUR' ? '€' : detail.budget?.currency ?? '€';
          const share = detail.budget
            ? Math.round(
                (typeof detail.budget.perPersonCents === 'number'
                  ? detail.budget.perPersonCents / 100
                  : (detail.budget.total ?? 0) / Math.max(1, detail.participants.length))
              )
            : 0;
          const net = Math.round(pPaid - share);

          return (
            <div className="lkdv-carnet-drawer-pane" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '16px',
                  background: 'var(--drawer-card-bg)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  {p.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatarUrl} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--fill)', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
                      {pName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <b style={{ display: 'block', fontSize: 14, color: 'var(--label)' }}>{pName}</b>
                    {p.role ? <small style={{ fontSize: 11.5, color: 'var(--label2)' }}>{roleLabel(p.role)}</small> : null}
                  </div>
                </div>
                <button
                  type="button"
                  className="lkdv-carnet-btn-soft"
                  style={{ height: 28, padding: '0 10px', fontSize: 11.5 }}
                  onClick={() => {
                    setSelectedParticipant(null);
                    setLensIndexBySlot((prev) => ({ ...prev, equipage: 0 }));
                  }}
                >
                  <ChevronLeft size={13} />
                  <span>Équipage</span>
                </button>
              </div>

              {lens.id === 'p-perf' ? (
                <>
                  <div className="lkdv-carnet-kpi-grid-3">
                    <div className="lkdv-carnet-kpi-mini">
                      <small>Distance</small>
                      <b>{detail.distanceKm ? `${Math.round(detail.distanceKm)} km` : '—'}</b>
                    </div>
                    <div className="lkdv-carnet-kpi-mini">
                      <small>Dénivelé +</small>
                      <b>{detail.elevationM ? `+${Math.round(detail.elevationM)} m` : '—'}</b>
                    </div>
                    <div className="lkdv-carnet-kpi-mini">
                      <small>Moments</small>
                      <b>{pMoments.length}</b>
                    </div>
                  </div>
                  {pPhotos.length > 0 ? (
                    <>
                      <span className="lkdv-carnet-kit-eyebrow">Médias publiés ({pPhotos.length})</span>
                      <div className="lkdv-ig-grid">
                        {pPhotos.map((m, idx) => (
                          <button
                            key={m.id}
                            type="button"
                            className="lkdv-ig-tile"
                            onClick={() => onSelectMoment?.(m, idx)}
                          >
                            {m.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.imageUrl} alt="" loading="lazy" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p style={{ margin: '8px 0', fontSize: 12.5, color: 'var(--label2)' }}>Aucun média partagé pour ce voyageur.</p>
                  )}
                </>
              ) : null}

              {lens.id === 'p-pokedex' ? (
                <CarnetPokedexDrawerBody
                  detail={detail}
                  lensId="pokedex"
                  currentUserId={userId}
                  discoveredOnlyForUserId={p.userId ?? p.id}
                />
              ) : null}

              {lens.id === 'p-kit' ? (
                pKitItems.length > 0 ? (
                  <div className="lkdv-carnet-kit-groups">
                    {Array.from(
                      pKitItems.reduce((acc, item) => {
                        const cat = item.category?.trim() || 'Divers';
                        const arr = acc.get(cat) ?? [];
                        arr.push(item);
                        acc.set(cat, arr);
                        return acc;
                      }, new Map<string, typeof pKitItems>())
                    ).map(([category, groupItems]) => {
                      const catWeightG = groupItems.reduce(
                        (sum, item) => sum + (item.weightG ?? 0) * (item.quantity ?? 1),
                        0
                      );
                      return (
                        <section key={category} className="lkdv-carnet-kit-group">
                          <div className="lkdv-carnet-kit-group-head">
                            <Package size={14} aria-hidden="true" />
                            <span>{category}</span>
                            <small>
                              {groupItems.length} ·{' '}
                              {catWeightG >= 1000
                                ? `${(catWeightG / 1000).toFixed(1).replace('.', ',')} kg`
                                : `${Math.round(catWeightG)} g`}
                            </small>
                          </div>
                          <div className="lkdv-carnet-kit-plus-row">
                            {groupItems.map((item) => {
                              const qty = item.quantity ?? 1;
                              const wG = (item.weightG ?? 0) * qty;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  className="lkdv-carnet-kit-mini-tile"
                                  onClick={() =>
                                    openKitProductSheet(item, pKitItems, {
                                      id: p.userId ?? p.id,
                                      name: pName,
                                      avatarUrl: p.avatarUrl ?? null,
                                    })
                                  }
                                >
                                  <div className="lkdv-carnet-kit-mini-tile-top">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={item.image || generatedProductImage(item.name, category)}
                                      alt=""
                                      loading="lazy"
                                      decoding="async"
                                      style={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: 8,
                                        objectFit: 'cover',
                                        background: 'rgba(23, 64, 44, 0.06)',
                                      }}
                                    />
                                    {qty > 1 ? (
                                      <span className="lkdv-carnet-kit-mini-qty">×{qty}</span>
                                    ) : null}
                                  </div>
                                  <b title={item.name}>{item.name}</b>
                                  <div className="lkdv-carnet-kit-mini-tile-foot">
                                    <small>
                                      {wG > 0
                                        ? wG >= 1000
                                          ? `${(wG / 1000).toFixed(1).replace('.', ',')} kg`
                                          : `${Math.round(wG)} g`
                                        : '—'}
                                    </small>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ margin: '8px 0', fontSize: 12.5, color: 'var(--label2)' }}>Aucun kit partagé pour ce voyageur.</p>
                )
              ) : null}

              {lens.id === 'p-budget' && detail.budget ? (
                <>
                  <div className="lkdv-carnet-kpi-grid-3">
                    <div className="lkdv-carnet-kpi-mini">
                      <small>Avancé</small>
                      <b>{Math.round(pPaid)} {currency}</b>
                    </div>
                    <div className="lkdv-carnet-kpi-mini">
                      <small>Part</small>
                      <b>{share} {currency}</b>
                    </div>
                    <div className="lkdv-carnet-kpi-mini">
                      <small>Solde</small>
                      <b style={{ color: net >= 0 ? '#15803d' : '#b45309' }}>
                        {net >= 0 ? `+${net}` : net} {currency}
                      </b>
                    </div>
                  </div>
                  {pExpenses.length > 0 ? (
                    <div className="lkdv-carnet-cards-col">
                      {pExpenses.map((exp) => (
                        <div key={exp.id} className="lkdv-carnet-budget-row">
                          <div>
                            <b>{exp.label}</b>
                            {exp.category ? <small>{exp.category}</small> : null}
                          </div>
                          <b>{Math.round(exp.amount ?? (exp.amountCents ?? 0) / 100)} {currency}</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: '8px 0', fontSize: 12.5, color: 'var(--label2)' }}>Aucune dépense avancée par ce voyageur.</p>
                  )}
                </>
              ) : null}
            </div>
          );
        }
        return (
          <CarnetEquipageDrawerBody
            detail={detail}
            lensId={lens.id}
            userId={userId}
            reactionDay={reactionDay}
            onReactionDayChange={setReactionDay}
            reactions={reactions}
            newCommentText={newCommentText}
            onNewCommentTextChange={setNewCommentText}
            onSelectParticipant={(participant) => {
              setSelectedParticipant(participant);
              setLensIndexBySlot((prev) => ({ ...prev, equipage: 0 }));
            }}
            onJumpToParticipantKit={(uid) => {
              setKitJumpUserId(uid);
              onSlotChange('sac');
            }}
            onSelectDay={(dayNum) => {
              onDayPick?.(dayNum);
              onClose();
            }}
            onRequireAuth={onRequireAuth}
            onIsland={onIsland}
          />
        );
    }
    return null;
  };

  const currentSlotLenses = slotLenses[activeSlot] || [];
  const currentSlotIndex = slotTabs.findIndex((t) => t.id === activeSlot);

  return (
    <div
      ref={attachPaneRoot}
      className="lkdv-carnet-drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Tiroir de détails du carnet"
      tabIndex={-1}
    >
      <style dangerouslySetInnerHTML={{ __html: DRAWER_MOTION_CSS }} />

      <button type="button" className="lkdv-mgrab" onClick={onClose} aria-label="Fermer le tiroir">
        <span />
      </button>

      <SlotShell
        slot={activeSlot}
        viewer={detail.viewerRole === 'visitor' ? 'visitor' : 'owner'}
        title={slotTabs.find((s) => s.id === activeSlot)?.label || 'Détails'}
        lenses={currentSlotLenses}
        activeLensIndex={activeLensIndex}
        onLensChange={handleLensChange}
        selector={
          <CapsuleTabs
            items={slotTabs}
            activeIndex={currentSlotIndex >= 0 ? currentSlotIndex : 0}
            onIndexChange={(idx) => {
              const nextSlot = slotTabs[idx]?.id as CarnetSlotId;
              if (nextSlot) onSlotChange(nextSlot);
            }}
            ariaLabel="Onglets du carnet"
            size="default"
          />
        }
        renderLens={(lens) => (
          <LensTransition transitionKey={`${activeSlot}:${lens.id}`}>
            {renderCurrentSlotContent(lens)}
          </LensTransition>
        )}
      />

      {/* Pilule de progression Pokédex Nature — tout en bas à gauche du drawer */}
      {activeSlot === 'route' && pokedexProgress ? (
        <div
          className="lkdv-carnet-pokedex-floating-bar"
          aria-label={`${pokedexProgress.discovered} espèces trouvées sur ${pokedexProgress.total} présentes dans la zone`}
        >
          <div className="lkdv-carnet-pokedex-floating-track">
            <div
              className="lkdv-carnet-pokedex-floating-fill"
              style={{
                width: `${Math.min(
                  100,
                  Math.max(
                    pokedexProgress.discovered > 0 ? 4 : 0,
                    Math.round(
                      (pokedexProgress.discovered / Math.max(1, pokedexProgress.total)) * 100,
                    ),
                  ),
                )}%`,
              }}
            />
          </div>
          <span className="lkdv-carnet-pokedex-floating-count">
            <AnimatedNumber value={pokedexProgress.discovered} /> /{' '}
            <AnimatedNumber value={pokedexProgress.total} />
          </span>
        </div>
      ) : null}

      {/* Pilule « Reprendre ce kit » tout en bas à gauche du drawer Sac / Kit */}
      {activeSlot === 'sac' && activeLensId === 'kit' ? (
        <button
          type="button"
          className="lkdv-pill-reprendre"
          style={{ left: '10px', right: 'auto', bottom: '10px', zIndex: 20 }}
          onClick={() => {
            if (onOpenKitCreate) {
              const items: KitItemV2[] = sacKitItems.map((k, idx) => ({
                id: k.id || `carnet-kit-${idx}`,
                name: k.name,
                category: k.category || 'Divers',
                weightG: Number(k.weightG) || 0,
                quantity: 1,
                productId: null,
                ownershipId: null,
                isChecked: true,
              }));
              onOpenKitCreate({
                name: detail.kit?.title || (detail.title ? `Kit · ${detail.title}` : 'Kit du carnet'),
                items,
              });
            } else {
              void forkAllItems(sacKitItems.map((k) => k.id));
            }
          }}
        >
          <Package size={14} aria-hidden="true" />
          <span>Reprendre ce kit</span>
        </button>
      ) : null}

      {/* Pilule « Reprendre le tracé » tout en bas à gauche -> Compas / Itinéraire */}
      {activeSlot === 'chiffres' ? (
        <button
          type="button"
          className="lkdv-pill-reprendre"
          style={{
            left: '10px',
            right: 'auto',
            bottom: '10px',
            zIndex: 20,
          }}
          onClick={() => {
            onClose();
            router.push(`/compas?nouvelle=1&etape=ou&carnetId=${encodeURIComponent(detail.id)}`);
          }}
        >
          <Route size={14} aria-hidden="true" />
          <span>Reprendre le tracé</span>
        </button>
      ) : null}

      {selectedKitSheet &&
      selectedKitSheet.items[selectedKitSheet.index] &&
      typeof document !== 'undefined'
        ? createPortal(
            (() => {
              const sheetItems = selectedKitSheet.items;
              const sheetIdx = selectedKitSheet.index;
              const item = sheetItems[sheetIdx];
              const totalKitWeightG = sheetItems.reduce(
                (sum, k) => sum + (Number(k.weightG) || 0),
                0
              );
              const sheetOwner = selectedKitSheet.owner ?? (detail.author
                ? {
                    id: detail.author.id,
                    name: detail.author.name,
                    avatarUrl: detail.author.avatarUrl ?? null,
                  }
                : null);
              const product: PickerProduct = {
                key: item.id,
                source: 'inventory',
                id: item.id,
                name: item.name,
                brand: null,
                category: item.category ?? null,
                weightG: item.weightG ?? null,
                image: item.image ?? null,
                wear: null,
                conditionLabel: item.verdict ?? null,
                description: item.detail ?? null,
                priceLabel: null,
                owner: sheetOwner
                  ? {
                      id: sheetOwner.id,
                      name: sheetOwner.name,
                      avatarUrl: sheetOwner.avatarUrl ?? null,
                      trustScore: null,
                    }
                  : null,
                cartable: null,
                ownershipId: null,
                productId: null,
              };
              return (
                <KitProductSheetV2
                  product={product}
                  initialCategory={item.category ?? undefined}
                  currentKitWeightG={totalKitWeightG}
                  alreadyInKit={false}
                  positionLabel={`${sheetIdx + 1} / ${sheetItems.length}`}
                  hasPrev={sheetIdx > 0}
                  hasNext={sheetIdx < sheetItems.length - 1}
                  onPrev={() =>
                    setSelectedKitSheet((cur) =>
                      cur && cur.index > 0 ? { ...cur, index: cur.index - 1 } : cur
                    )
                  }
                  onNext={() =>
                    setSelectedKitSheet((cur) =>
                      cur && cur.index < cur.items.length - 1
                        ? { ...cur, index: cur.index + 1 }
                        : cur
                    )
                  }
                  onClose={() => setSelectedKitSheet(null)}
                  onAdd={(prod) => {
                    void forkItem(prod.id);
                    setSelectedKitSheet(null);
                  }}
                />
              );
            })(),
            document.body
          )
        : null}
    </div>
  );
}
