'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import LikeIcon from '@/components/social-kit/LikeIcon';
import { SlotShell, type SlotId, type SlotLens } from '@/components/compte/drawer/SlotShell';
import { CapsuleTabs, type CapsuleTabItem } from '@/components/ui/CapsuleTabs';
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
  CarnetMotionRoot,
  LensTransition,
  StackSlideView,
} from './CarnetDrawerMotion';
import { CarnetFilDrawerBody } from './CarnetFilDrawerBody';
import { CarnetRouteDrawerBody } from './CarnetRouteDrawerBody';
import { CarnetPokedexDrawerBody } from './CarnetPokedexDrawerBody';
import { CarnetKitDrawerBody } from './CarnetKitDrawerBody';
import { CarnetChiffresDrawerBody } from './CarnetChiffresDrawerBody';
import { CarnetEquipageDrawerBody } from './CarnetEquipageDrawerBody';

export type CarnetSlotId = 'fil' | 'route' | 'sac' | 'chiffres' | 'equipage';

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
  onIsland?: (message: string, undo?: () => void) => void;
  userId: string | null;
  onRequireAuth?: () => void;
  onSelectMoment?: (moment: CarnetMomentItem, index: number) => void;
  onOpenStories?: () => void;
  isAccountDrawer?: boolean;
  onObserveSpecies?: (species: { name: string; latin: string }) => void;
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
  onIsland,
  userId,
  onRequireAuth,
  onSelectMoment,
  onOpenStories,
  isAccountDrawer = false,
  onObserveSpecies,
}: CarnetDrawerV2Props) {
  const { haptic } = useHapticFeedback();
  const [lensIndexBySlot, setLensIndexBySlot] = useState<Record<CarnetSlotId, number>>({
    fil: 0,
    route: 0,
    sac: 0,
    chiffres: 0,
    equipage: 0,
  });
  const [accountTab, setAccountTab] = useState<number>(0);
  const [stack, setStack] = useState<StackView[]>([]);
  const [verdictFilter, setVerdictFilter] = useState<'all' | KitVerdictType>('all');
  const [newCommentText, setNewCommentText] = useState('');
  const [kitJumpUserId, setKitJumpUserId] = useState<string | null>(null);

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

  // Reset stack on slot change
  useEffect(() => {
    setStack([]);
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
        { id: 'moments', label: 'Moments', icon: <Clock size={15} /> },
        { id: 'etapes', label: 'Étapes', icon: <Flag size={15} /> },
        { id: 'medias', label: 'Médias', icon: <ImageIcon size={15} /> },
        { id: 'altitude', label: 'Altitude', icon: <Mountain size={15} /> },
        { id: 'nuits', label: 'Nuits', icon: <Moon size={15} /> },
        { id: 'meteo', label: 'Météo', icon: <CloudSun size={15} /> },
        { id: 'rencontres', label: 'Rencontres', icon: <Quote size={15} /> },
      ],
      route: [
        { id: 'pokedex', label: 'Pokédex', icon: <Leaf size={15} /> },
        { id: 'faune', label: 'Faune', icon: <Compass size={15} /> },
        { id: 'flore', label: 'Flore & Milieux', icon: <Mountain size={15} /> },
      ],
      sac: [
        { id: 'kit', label: 'Kit', icon: <Package size={15} /> },
        { id: 'verdicts', label: 'Verdicts', icon: <Award size={15} /> },
        { id: 'poids', label: 'Poids', icon: <Scale size={15} /> },
      ],
      chiffres: [
        { id: 'distance', label: 'Distance', icon: <Route size={15} /> },
        { id: 'denivele', label: 'Dénivelé', icon: <TrendingUp size={15} /> },
        { id: 'duree', label: 'Durée', icon: <Timer size={15} /> },
        // Budget is only displayed if participant or budget data is available
        ...(!isVisitor && detail.budget
          ? [{ id: 'budget', label: 'Budget', icon: <Wallet size={15} /> }]
          : []),
      ],
      equipage: [
        { id: 'participants', label: 'Participants', icon: <Users size={15} /> },
        { id: 'reactions', label: 'Réactions', icon: <LikeIcon size={15} /> },
        { id: 'suivre', label: 'Suivre', icon: <Radio size={15} /> },
      ],
    };
  }, [detail.budget, detail.viewerRole]);

  // Account / Settings Tabs
  const accountTabs = useMemo(() => {
    const isOwner = detail.isOwner;
    return [
      { id: 'notif', label: 'Notifications' },
      { id: 'part', label: 'Partage' },
      { id: 'param', label: 'Paramètres' },
      ...(isOwner ? [{ id: 'gerer', label: 'Gérer' }] : []),
    ];
  }, [detail.isOwner]);

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
            <StackSlideView stackKey={`${currentStackItem.type}-${stack.length}`}>
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

  // Render Secondary Account Drawer
  if (isAccountDrawer) {
    return (
      <div
        ref={dialogRef}
        className="lkdv-stack-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Paramètres du carnet"
        tabIndex={-1}
      >
        <div className="lkdv-stack-header">
          <button type="button" className="lkdv-stack-back" onClick={onClose}>
            <ChevronLeft size={16} />
            <span>Fermer</span>
          </button>
          <b style={{ fontSize: '13.5px', color: 'var(--tint, #17402C)' }}>Carnet</b>
        </div>

        <div style={{ padding: '8px 12px 0' }}>
          <div
            className="lkdv-day-capsule"
            role="tablist"
            style={{ width: '100%', justifyContent: 'space-around' }}
          >
            {accountTabs.map((tab, idx) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                className="lkdv-day-capsule-btn"
                aria-selected={accountTab === idx}
                onClick={() => setAccountTab(idx)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="lkdv-stack-body">
          <CarnetMotionRoot>
            <StackSlideView stackKey={`${currentStackItem.type}-${stack.length}`}>
          {accountTab === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                style={{
                  padding: '12px',
                  borderRadius: '16px',
                  background: 'var(--drawer-card-bg)',
                }}
              >
                <b>Alertes de progression</b>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--label2)' }}>
                  Recevoir une notification lors de chaque publication d’étape.
                </p>
              </div>
            </div>
          )}

          {accountTab === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                style={{
                  padding: '12px',
                  borderRadius: '16px',
                  background: 'var(--drawer-card-bg)',
                }}
              >
                <b>Lien public</b>
                <p style={{ margin: '4px 0 8px', fontSize: '12px', color: 'var(--label2)' }}>
                  Partagez ce carnet d’expédition avec vos proches.
                </p>
                <button
                  type="button"
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    borderRadius: '9999px',
                    border: '0',
                    background: 'var(--tint, #17402C)',
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      void navigator.clipboard.writeText(window.location.href);
                      onIsland?.('Lien copié dans le presse-papier');
                    }
                  }}
                >
                  <Copy size={13} />
                  <span>Copier le lien</span>
                </button>
              </div>
            </div>
          )}

          {accountTab === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                style={{
                  padding: '12px',
                  borderRadius: '16px',
                  background: 'var(--drawer-card-bg)',
                }}
              >
                <b>Unités</b>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--label2)' }}>
                  Système métrique (km, mètres de dénivelé).
                </p>
              </div>
            </div>
          )}

          {accountTab === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                style={{
                  padding: '12px',
                  borderRadius: '16px',
                  background: 'var(--drawer-card-bg)',
                }}
              >
                <b>Exportation</b>
                <p style={{ margin: '4px 0 8px', fontSize: '12px', color: 'var(--label2)' }}>
                  Téléchargez l’intégralité des données du carnet au format standard JSON.
                </p>
                <button
                  type="button"
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    borderRadius: '9999px',
                    border: '0',
                    background: 'var(--tint, #17402C)',
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
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
                  <Download size={13} />
                  <span>Télécharger le JSON</span>
                </button>
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
        if (
          lens.id === 'etapes' ||
          lens.id === 'altitude' ||
          lens.id === 'nuits' ||
          lens.id === 'meteo'
        ) {
          return (
            <CarnetRouteDrawerBody
              detail={detail}
              lensId={lens.id}
              onSelectEtape={(etape) => pushStack({ type: 'etape', etape })}
              onSelectNight={(night) => pushStack({ type: 'night', night })}
            />
          );
        }
        return (
          <CarnetFilDrawerBody
            detail={detail}
            lensId={lens.id}
            onSelectMoment={onSelectMoment}
          />
        );
      case 'route':
        return (
          <CarnetPokedexDrawerBody
            detail={detail}
            lensId={lens.id}
            onObserveSpecies={onObserveSpecies}
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
            onSelectItem={(item) =>
              pushStack({
                type: 'item',
                itemId: item.id,
                name: item.name,
                weightG: item.weightG,
                detailText: item.detail,
              })
            }
            onForkAll={(ids) => {
              void forkAllItems(ids);
            }}
          />
        );
      case 'chiffres':
        return <CarnetChiffresDrawerBody detail={detail} lensId={lens.id} />;
      case 'equipage':
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
            onSelectParticipant={(participant) => pushStack({ type: 'participant', participant })}
            onJumpToParticipantKit={(uid) => {
              setKitJumpUserId(uid);
              onSlotChange('sac');
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

      {/* Reprise de lecture — au-dessus de la pilule « Reprendre le kit » (30). */}
      {resumePill && resumePill.key === activeLensKey ? (
        <button
          type="button"
          className="lkdv-pill-reprendre lkdv-pill-resume"
          style={{ left: '10px', bottom: '48px', zIndex: 16 }}
          onClick={resumeReading}
          aria-label="Reprendre la lecture"
        >
          <Bookmark size={14} />
          <span>Reprendre</span>
        </button>
      ) : null}
    </div>
  );
}
