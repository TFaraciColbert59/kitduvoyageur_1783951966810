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
import { CarnetPostGrid } from './CarnetPostGrid';
import { MOMENT_TYPE_LABELS, isMomentType, type MomentType } from '@/features/carnet/detail/momentTypes';
import { dayMetric, selectDayData } from '@/features/carnet/detail/dayView';
import { isParticipantRole } from '@/features/carnet/detail/viewerRole';
import { CarnetAltitude } from './CarnetAltitude';
import { elevationProfileGain } from '@/features/carnet/detail/elevationProfile';

export type CarnetSlotId = 'fil' | 'route' | 'sac' | 'chiffres' | 'equipage';

/** Rôles du carnet : les données serveur sont en anglais, l'interface en français. */
function roleLabel(role: string): string {
  if (role === 'author') return 'auteur';
  if (role === 'collaborator') return 'contributeur';
  if (role === 'participant') return 'participant';
  return role;
}


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
  /** Mode modification : « + Ajouter … » et pilules « Modifier » en place. */
  isEditing?: boolean;
  /** Ouvre la feuille « Créer » (type d'emblée pour « + Ajouter une rencontre »). */
  onCreate?: (type?: MomentType) => void;
  /** Moments épinglés (coche sur les tuiles). */
  pinnedIds?: ReadonlySet<string>;
  /** Slot et lentille actifs, lus par la carte du bas (couches réduites au tiroir). */
  onContextChange?: (context: { slot: CarnetSlotId | 'account'; lensId: string } | null) => void;
  /** Toucher une barre de jour dans Chiffres : change le jour de la fiche. */
  onDayPick?: (day: number) => void;
  /** Ouverture demandée par la carte du haut (pastille À la une) ; `nonce` la rejoue. */
  intent?: { nonce: number; view: StackIntent } | null;
  /** Banc seulement : force l'état d'erreur d'un slot ou d'une lentille. */
  forceError?: { slot?: boolean; lens?: string } | null;
}

export type StackIntent =
  | { type: 'lens'; slot: CarnetSlotId; index: number }
  | { type: 'participant'; userId: string }
  | { type: 'etape'; etapeId: string };

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

/** « + Ajouter … » du mode modification (maquette `edcap`). */
function AddCaption({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="lkdv-ed">
      <button type="button" className="lkdv-edcap" aria-label={label} onClick={onClick}>
        + {label}
      </button>
    </div>
  );
}

/** Carte d'état vide ou d'erreur d'une lentille (`.empty`). */
function LensState({
  tone = 'empty',
  title,
  hint,
  action,
}: {
  tone?: 'empty' | 'error';
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="lkdv-lens-state" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="lkdv-lens-state-gl" aria-hidden="true">
        {tone === 'error' ? '!' : '○'}
      </span>
      <b>{title}</b>
      {hint ? <p>{hint}</p> : null}
      {action}
    </div>
  );
}

/** Une lentille qui plante n'emporte pas les autres : état d'erreur + « Réessayer ». */
class LensBoundary extends React.Component<
  { resetKey: string; fallback: React.ReactNode; children: React.ReactNode },
  { crashed: boolean }
> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.crashed) {
      this.setState({ crashed: false });
    }
  }
  render() {
    return this.state.crashed ? this.props.fallback : this.props.children;
  }
}

function Boom(): React.ReactElement {
  throw new Error('lentille simulée en échec');
}

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
  isEditing = false,
  onCreate,
  pinnedIds,
  onContextChange,
  onDayPick,
  intent = null,
  forceError = null,
}: CarnetDrawerV2Props) {
  const { haptic } = useHapticFeedback();
  const dayData = useMemo(() => selectDayData(detail, activeDay), [detail, activeDay]);
  const dayPhotoMoments = dayData.photoMoments;
  const canEdit = isEditing && isParticipantRole(detail.viewerRole);
  const [slotRetry, setSlotRetry] = useState(0);
  const [lensRetry, setLensRetry] = useState(0);
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
      { id: 'route', label: 'Route', icon: <MapPin size={17} /> },
      { id: 'sac', label: 'Sac', icon: <Backpack size={17} /> },
      { id: 'chiffres', label: 'Chiffres', icon: <BarChart2 size={17} /> },
      { id: 'equipage', label: 'Équipage', icon: <Users size={17} /> },
    ],
    []
  );

  // Lenses for each slot
  const slotLenses: Record<CarnetSlotId, SlotLens[]> = useMemo(() => {
    const isViewerParticipant = isParticipantRole(detail.viewerRole);
    return {
      fil: [
        { id: 'moments', label: 'Moments', icon: <Clock size={15} /> },
        { id: 'medias', label: 'Médias', icon: <ImageIcon size={15} /> },
        { id: 'rencontres', label: 'Rencontres', icon: <Quote size={15} /> },
        { id: 'nature', label: 'Nature', icon: <Leaf size={15} /> },
      ],
      route: [
        { id: 'etapes', label: 'Étapes', icon: <Flag size={15} /> },
        { id: 'altitude', label: 'Altitude', icon: <Mountain size={15} /> },
        { id: 'nuits', label: 'Nuit', icon: <Moon size={15} /> },
        { id: 'meteo', label: 'Météo et ciel', icon: <CloudSun size={15} /> },
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
        ...(isViewerParticipant
          ? [{ id: 'budget', label: 'Budget', icon: <Wallet size={15} /> }]
          : []),
      ],
      equipage: [
        { id: 'participants', label: 'Participants', icon: <Users size={15} /> },
        { id: 'reactions', label: 'Réactions', icon: <LikeIcon size={15} /> },
        { id: 'suivre', label: 'Suivre', icon: <Radio size={15} /> },
      ],
    };
  }, [detail.viewerRole]);

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

  /* Contexte lu par la carte du bas : slot + lentille actifs (couches réduites). */
  const activeLensId = (slotLenses[activeSlot] ?? [])[activeLensIndex]?.id ?? '';
  useEffect(() => {
    if (!onContextChange) return;
    if (!isOpen) {
      onContextChange(null);
      return;
    }
    onContextChange({ slot: isAccountDrawer ? 'account' : activeSlot, lensId: activeLensId });
  }, [activeLensId, activeSlot, isAccountDrawer, isOpen, onContextChange]);

  /* Ouverture demandée par une pastille « À la une » : fiche voyageur ou étape. */
  const lastIntent = useRef(0);
  useEffect(() => {
    if (!isOpen || !intent || intent.nonce === lastIntent.current) return;
    lastIntent.current = intent.nonce;
    if (intent.view.type === 'lens') {
      const target = intent.view;
      setLensIndexBySlot((prev) => ({ ...prev, [target.slot]: target.index }));
    } else if (intent.view.type === 'participant') {
      const userIdWanted = intent.view.userId;
      const participant = detail.participants.find((p) => p.userId === userIdWanted);
      if (participant) setStack([{ type: 'participant', participant }]);
    } else {
      const etapeId = intent.view.etapeId;
      const etape = detail.etapes.find((e) => e.id === etapeId);
      if (etape) setStack([{ type: 'etape', etape }]);
    }
  }, [detail.etapes, detail.participants, intent, isOpen]);

  /* « Reprendre » : le kit entier, annulable par l'île. Visible dans le slot Sac
     et sur la fiche d'un objet seulement (maquette `syncKitPill`). */
  const kitIds = useMemo(() => detail.kit.items.map((item) => item.id), [detail.kit.items]);
  const kitSaved = kitIds.length > 0 && kitIds.every((id) => isForked(id));
  const slotErrored = Boolean(forceError?.slot) && slotRetry === 0;
  const topOfStack = stack[stack.length - 1];
  const showKitPill =
    isOpen &&
    !isAccountDrawer &&
    kitIds.length > 0 &&
    !slotErrored &&
    (topOfStack ? topOfStack.type === 'item' : activeSlot === 'sac');
  const saveKit = useCallback(async () => {
    if (kitSaved) {
      onIsland?.('Kit enregistré dans ton Compas');
      return;
    }
    await forkAllItems(kitIds);
  }, [forkAllItems, kitIds, kitSaved, onIsland]);

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
                      ? `${currentStackItem.etape.distanceKm} km`
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

              <b style={{ fontSize: '13px', margin: '4px 0 0' }}>Ses moments</b>
              <CarnetPostGrid
                moments={detail.moments.filter(
                  (m) =>
                    m.authorId === currentStackItem.participant.userId ||
                    m.authorName === currentStackItem.participant.name
                )}
                onSelect={(m, idx) => onSelectMoment?.(m, idx)}
                emptyLabel="Ce voyageur n’a pas encore partagé de moment."
                pinnedIds={pinnedIds}
              />
            </div>
          )}
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
        </div>
      </div>
    );
  }

  // Render Main Slot Content (by Slot and Lens)
  const renderCurrentSlotContent = (lens: SlotLens) => {
    switch (activeSlot) {
      case 'fil':
        if (lens.id === 'moments') {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px' }}>
              {dayData.moments.length === 0 ? (
                <LensState
                  title="Aucun moment publié."
                  hint="Ajoute ton premier moment pour le voir apparaître ici."
                  action={
                    canEdit ? (
                      <button type="button" className="lkdv-lens-cta" onClick={() => onCreate?.()}>
                        Ajouter un moment
                      </button>
                    ) : null
                  }
                />
              ) : null}
              {dayData.moments.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  data-carnet-row=""
                  style={{
                    ...rowStyle(idx),
                    display: 'flex',
                    gap: '10px',
                    width: '100%',
                    padding: '10px',
                    border: 0,
                    borderRadius: '16px',
                    background: 'var(--drawer-card-bg)',
                    color: 'inherit',
                    font: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  onClick={() => onSelectMoment?.(m, idx)}
                >
                  {m.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.imageUrl}
                      alt=""
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '10px',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '10px',
                        background: '#DDEBD8',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Clock size={20} color="var(--tint)" />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <b style={{ fontSize: '13px' }}>
                        {isMomentType(m.type) ? (
                          <span className="lkdv-mo-kind">{MOMENT_TYPE_LABELS[m.type]}</span>
                        ) : null}
                        {m.place || m.title || `Jour ${m.dayNumber}`}
                      </b>
                      <span style={{ fontSize: '11px', color: 'var(--label2)' }}>{m.time}</span>
                    </div>
                    {m.caption ? (
                      <p
                        style={{
                          margin: '2px 0 0',
                          fontSize: '12px',
                          color: 'var(--label2)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {m.caption}
                      </p>
                    ) : null}
                  </div>
                </button>
              ))}
              {canEdit ? <AddCaption label="Ajouter un moment" onClick={() => onCreate?.()} /> : null}
            </div>
          );
        }
        if (lens.id === 'medias') {
          return (
            <div style={{ padding: '6px' }}>
              <CarnetPostGrid
                moments={dayPhotoMoments}
                onSelect={(m, idx) => onSelectMoment?.(m, idx)}
                emptyLabel="Pas de photo ni de vidéo pour ce jour."
                pinnedIds={pinnedIds}
              />
              {canEdit ? <AddCaption label="Ajouter des médias" onClick={() => onCreate?.('photo')} /> : null}
            </div>
          );
        }
        if (lens.id === 'rencontres') {
          const encounters = dayData.moments.filter((m) => m.type === 'meet');
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px' }}>
              {encounters.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--label2)', fontSize: '13px' }}>
                  Aucune rencontre répertoriée.
                </p>
              ) : (
                encounters.map((m, idx) => (
                  <div
                    key={m.id}
                    data-carnet-row=""
                    style={{
                      ...rowStyle(idx),
                      padding: '12px',
                      borderRadius: '16px',
                      background: 'var(--drawer-card-bg)',
                    }}
                  >
                    <b>{m.place || m.title || 'Rencontre'}</b>
                    <p style={{ margin: '4px 0 0', fontSize: '12.5px' }}>{m.caption}</p>
                  </div>
                ))
              )}
            </div>
          );
        }
        if (lens.id === 'nature') {
          const natureMoments = dayData.moments.filter((m) => m.type === 'species');
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px' }}>
              {natureMoments.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--label2)', fontSize: '13px' }}>
                  Aucune observation nature consignée.
                </p>
              ) : (
                natureMoments.map((m, idx) => (
                  <div
                    key={m.id}
                    data-carnet-row=""
                    style={{
                      ...rowStyle(idx),
                      padding: '12px',
                      borderRadius: '16px',
                      background: 'var(--drawer-card-bg)',
                    }}
                  >
                    <b>{m.place || m.title || 'Observation'}</b>
                    <p style={{ margin: '4px 0 0', fontSize: '12.5px' }}>{m.caption}</p>
                  </div>
                ))
              )}
            </div>
          );
        }
        break;

      case 'route':
        if (lens.id === 'etapes') {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px' }}>
              {dayData.etapes.map((e, idx) => (
                <button
                  key={e.id}
                  type="button"
                  data-carnet-row=""
                  style={{
                    ...rowStyle(idx),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '12px',
                    border: 0,
                    borderRadius: '16px',
                    background: 'var(--drawer-card-bg)',
                    color: 'inherit',
                    font: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  onClick={() => pushStack({ type: 'etape', etape: e })}
                >
                  <div>
                    <b style={{ fontSize: '13.5px' }}>{e.label}</b>
                    {e.from && e.to ? (
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--label2)' }}>
                        {e.from} → {e.to}
                      </p>
                    ) : null}
                  </div>
                  <ChevronRight size={16} color="var(--accent)" />
                </button>
              ))}
            </div>
          );
        }
        if (lens.id === 'nuits') {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px' }}>
              {dayData.nights.map((n, idx) => (
                <button
                  key={n.id}
                  type="button"
                  data-carnet-row=""
                  style={{
                    ...rowStyle(idx),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '12px',
                    border: 0,
                    borderRadius: '16px',
                    background: 'var(--drawer-card-bg)',
                    color: 'inherit',
                    font: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    pushStack({ type: 'night', night: n });
                    if (n.lat && n.lng) {
                      onFocusMap?.(n.lat, n.lng, 13);
                    }
                  }}
                >
                  <div>
                    <b style={{ fontSize: '13.5px' }}>{n.name}</b>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--label2)' }}>
                      Jour {n.dayNumber} · {n.type} {n.altitudeM ? `(${n.altitudeM} m)` : ''}
                    </p>
                  </div>
                  <ChevronRight size={16} color="var(--accent)" />
                </button>
              ))}
              {dayData.nights.length === 0 ? (
                <div
                  style={{
                    padding: '24px 16px',
                    borderRadius: '16px',
                    background: 'var(--drawer-card-bg)',
                    textAlign: 'center',
                  }}
                >
                  <b style={{ fontSize: '13px' }}>Aucune nuit enregistrée.</b>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--label2)' }}>
                    Les nuits apparaissent ici dès qu’elles sont renseignées sur le terrain.
                  </p>
                </div>
              ) : null}
            </div>
          );
        }
        if (lens.id === 'altitude') {
          const profile = detail.elevationProfile ?? [];
          const profileGain = elevationProfileGain(profile);
          return (
            <div className="lkdv-altitude-card">
              <b>Profil d’altitude du tracé</b>
              <p>
                {profileGain !== null
                  ? `Dénivelé du tracé : +${profileGain} m`
                  : detail.elevationM
                    ? `Dénivelé total positif : +${Math.round(detail.elevationM)} m`
                    : 'Dénivelé total non renseigné'}
              </p>
              {profile.length >= 2 ? (
                <CarnetAltitude
                  points={profile}
                  height={80}
                  interactive
                  label="Profil d’altitude du tracé"
                />
              ) : (
                <p className="lkdv-altitude-empty" role="status">
                  Aucune mesure d’altitude enregistrée pour ce carnet.
                </p>
              )}
            </div>
          );
        }
        if (lens.id === 'meteo') {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px' }}>
              {dayData.etapes.map((e) => (
                <div
                  key={e.id}
                  style={{
                    padding: '12px',
                    borderRadius: '16px',
                    background: 'var(--drawer-card-bg)',
                  }}
                >
                  <b>{e.label}</b>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--label2)' }}>
                    {e.weather || 'Météo stable, ensoleillée avec brume d’altitude.'}
                  </p>
                </div>
              ))}
            </div>
          );
        }
        break;

      case 'sac':
        if (lens.id === 'kit') {
          return (
            <div style={{ position: 'relative', minHeight: '100%', paddingBottom: '48px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: '14px',
                    background: 'rgba(150, 186, 142, 0.25)',
                  }}
                >
                  <b style={{ fontSize: '13px' }}>
                    {activeDay > 0 ? 'Poids cité ce jour' : 'Poids total du sac'}
                  </b>
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>
                    {dayData.kitItems.some((i) => i.weightG)
                      ? `${(
                          dayData.kitItems
                            .filter((i) => i.verdict !== 'manquait')
                            .reduce((sum, i) => sum + (i.weightG ?? 0), 0) / 1000
                        ).toFixed(2)} kg`
                      : '—'}
                  </span>
                </div>

                {dayData.kitItems.length === 0 ? (
                  <LensState title="Aucun matériel." hint="Aucun objet cité ce jour." />
                ) : null}
                {dayData.kitItems.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    data-carnet-row=""
                    style={{
                      ...rowStyle(idx),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '10px 12px',
                      border: 0,
                      borderRadius: '14px',
                      background: 'var(--drawer-card-bg)',
                      color: 'inherit',
                      font: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                    onClick={() =>
                      pushStack({
                        type: 'item',
                        itemId: item.id,
                        name: item.name,
                        weightG: item.weightG,
                        detailText: item.detail,
                      })
                    }
                  >
                    <div>
                      <b style={{ fontSize: '13px' }}>{item.name}</b>
                      {item.weightG ? (
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--label2)' }}>
                          {item.weightG} g
                        </p>
                      ) : null}
                    </div>
                    <ChevronRight size={15} color="var(--accent)" />
                  </button>
                ))}
                {canEdit ? <AddCaption label="Ajouter un objet" onClick={() => onCreate?.('kit')} /> : null}
              </div>
            </div>
          );
        }
        if (lens.id === 'verdicts') {
          const verdictsList = dayData.kitItems.filter((i) => i.verdict);
          const countOf = (f: 'all' | KitVerdictType) =>
            f === 'all' ? verdictsList.length : verdictsList.filter((v) => v.verdict === f).length;
          const filtered = verdictsList.filter((v) => {
            if (verdictFilter === 'all') return true;
            return v.verdict === verdictFilter;
          });

          const VERDICT_LABELS: Record<KitVerdictType, string> = {
            essentiel: 'Essentiel',
            utile: 'Utile',
            jamais_servi: 'Jamais servi',
            defaillant: 'Défaillant',
            manquait: 'Manquait',
            top: 'Top',
            flop: 'Flop',
            neutre: 'Neutre',
          };
          const VERDICT_FALLBACK = { bg: 'var(--fill2)', color: 'var(--label2)' };
          const VERDICT_STYLES: Record<KitVerdictType, { bg: string; color: string }> = {
            essentiel: { bg: 'var(--mint, #E1EBDE)', color: 'var(--good, #3D7A52)' },
            utile: { bg: 'var(--fill2, rgba(23,43,36,.06))', color: 'var(--info, #4B6B7C)' },
            jamais_servi: {
              bg: 'var(--fill2, rgba(23,43,36,.06))',
              color: 'var(--label2, #56665D)',
            },
            defaillant: { bg: 'var(--bad-bg, #F5DDD9)', color: 'var(--bad, #A8443A)' },
            manquait: { bg: 'var(--warn-bg, #FBF1DC)', color: 'var(--warn, #B98A2E)' },
            top: { bg: 'var(--mint, #E1EBDE)', color: 'var(--good, #3D7A52)' },
            flop: { bg: 'var(--bad-bg, #F5DDD9)', color: 'var(--bad, #A8443A)' },
            neutre: {
              bg: 'var(--fill2, rgba(23,43,36,.06))',
              color: 'var(--label2, #56665D)',
            },
          };

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {(
                  ['all', 'essentiel', 'utile', 'jamais_servi', 'defaillant', 'manquait'] as const
                ).map((f) => (
                  <button
                    key={f}
                    type="button"
                    style={{
                      height: '26px',
                      padding: '0 10px',
                      borderRadius: '9999px',
                      border: '0',
                      background:
                        verdictFilter === f ? 'var(--tint, #17402C)' : 'rgba(23, 64, 44, 0.08)',
                      color: verdictFilter === f ? 'var(--tint-ink, #fff)' : 'var(--tint)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    aria-pressed={verdictFilter === f}
                    data-verdict-filter={f}
                    onClick={() => setVerdictFilter(f === verdictFilter ? 'all' : f)}
                  >
                    {f === 'all' ? 'Tous' : VERDICT_LABELS[f]} <b>{countOf(f)}</b>
                  </button>
                ))}
              </div>

              {filtered.length === 0 ? (
                <div
                  style={{
                    padding: '24px 16px',
                    borderRadius: '16px',
                    background: 'var(--drawer-card-bg)',
                    textAlign: 'center',
                  }}
                >
                  <b style={{ fontSize: '13px' }}>Aucun verdict pour ce carnet.</b>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--label2)' }}>
                    Les verdicts se remplissent depuis le terrain, après les sorties.
                  </p>
                </div>
              ) : null}

              {filtered.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '12px',
                    borderRadius: '16px',
                    background: 'var(--drawer-card-bg)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <b>{item.name}</b>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: item.verdict ? (VERDICT_STYLES[item.verdict] ?? VERDICT_FALLBACK).bg : undefined,
                        color: item.verdict ? (VERDICT_STYLES[item.verdict] ?? VERDICT_FALLBACK).color : undefined,
                      }}
                    >
                      {item.verdict ? (VERDICT_LABELS[item.verdict] ?? item.verdict) : '—'}
                    </span>
                  </div>
                  {item.verdictNote ? (
                    <p style={{ margin: '6px 0 0', fontSize: '12px', lineHeight: 1.35 }}>
                      « {item.verdictNote} »
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          );
        }
        if (lens.id === 'poids') {
          return (
            <div
              style={{ padding: '12px', borderRadius: '16px', background: 'var(--drawer-card-bg)' }}
            >
              <b>Répartition du poids du sac</b>
              <p style={{ margin: '4px 0 12px', fontSize: '12px', color: 'var(--label2)' }}>
                {detail.kit.totalWeightG
                  ? `${(detail.kit.totalWeightG / 1000).toFixed(2)} kg au total`
                  : 'Poids non renseigné'}
              </p>
              <div
                style={{
                  height: '120px',
                  borderRadius: '12px',
                  background: 'rgba(23, 64, 44, 0.06)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '12px',
                  color: 'var(--tint)',
                }}
              >
                Anneau de répartition catégorielle
              </div>
            </div>
          );
        }
        break;

      case 'chiffres':
        if (lens.id === 'distance' || lens.id === 'denivele' || lens.id === 'duree') {
          const key = lens.id === 'distance' ? 'distance' : lens.id === 'denivele' ? 'elevation' : 'duration';
          const metric = dayMetric(detail, activeDay, key);
          const fmt = (v: number | null): string => {
            if (v === null) return '—';
            if (key === 'distance') return `${v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
            if (key === 'elevation') return `+${Math.round(v).toLocaleString('fr-FR')} m`;
            return `${Math.floor(v / 60)} h ${String(Math.round(v % 60)).padStart(2, '0')}`;
          };
          const title =
            key === 'distance' ? 'Distance' : key === 'elevation' ? 'Dénivelé positif' : 'Durée de marche';
          const max = Math.max(1, ...metric.rows.map((r) => r.value ?? 0)) * 1.08;
          return (
            <div className="lkdv-metric" data-metric={key}>
              <div className="lkdv-card2">
                <div className="lkdv-h5">
                  {title} · {activeDay > 0 ? `jour ${activeDay}` : 'total'}
                </div>
                <span className="lkdv-big">{fmt(activeDay > 0 ? metric.current : metric.total)}</span>
              </div>
              <div className="lkdv-card2">
                {metric.rows.map((row) => (
                  <button
                    key={row.dayNumber}
                    type="button"
                    className="lkdv-brow"
                    aria-label={`Jour ${row.dayNumber}, ${fmt(row.value)}`}
                    aria-current={row.dayNumber === activeDay ? 'true' : undefined}
                    onClick={() => onDayPick?.(row.dayNumber)}
                  >
                    <b>J{row.dayNumber}</b>
                    <span className="lkdv-btrack">
                      <i
                        className={row.dayNumber === activeDay ? 'cur' : undefined}
                        style={{ width: `${((row.value ?? 0) / max) * 100}%` }}
                      />
                    </span>
                    <span className="lkdv-mono">{fmt(row.value)}</span>
                  </button>
                ))}
              </div>
              <p className="lkdv-mute">
                {activeDay > 0 && metric.deltaPct !== null
                  ? `${metric.deltaPct >= 0 ? '+' : ''}${metric.deltaPct} % par rapport à la moyenne des ${metric.rows.length} jours.`
                  : metric.average !== null
                    ? `Moyenne par jour : ${fmt(metric.average)}`
                    : 'Aucune valeur renseignée pour ce carnet.'}
              </p>
            </div>
          );
        }
        if (lens.id === 'budget' && !detail.budget) {
          return (
            <LensState
              title="Aucune dépense."
              hint="Les dépenses du carnet apparaissent ici."
              action={canEdit ? <AddCaption label="Ajouter une dépense" onClick={() => onCreate?.('spend')} /> : null}
            />
          );
        }
        if (lens.id === 'budget' && detail.budget) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px' }}>
              <div
                style={{
                  padding: '12px',
                  borderRadius: '16px',
                  background: 'var(--drawer-card-bg)',
                }}
              >
                <b>Budget total</b>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: '20px',
                    fontWeight: 700,
                    color: 'var(--tint)',
                  }}
                >
                  {detail.budget.total} {detail.budget.currency}
                </p>
              </div>
              {(activeDay > 0 ? dayData.budgetItems : detail.budget.items).map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    background: 'var(--drawer-card-bg)',
                  }}
                >
                  <span>{item.label}</span>
                  <b>
                    {item.amount} {detail.budget?.currency}
                  </b>
                </div>
              ))}
            </div>
          );
        }
        break;

      case 'equipage':
        if (lens.id === 'participants') {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px' }}>
              {detail.participants.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  data-carnet-row=""
                  style={{
                    ...rowStyle(idx),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '10px 12px',
                    border: 0,
                    borderRadius: '14px',
                    background: 'var(--drawer-card-bg)',
                    color: 'inherit',
                    font: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  onClick={() => pushStack({ type: 'participant', participant: p })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {p.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.avatarUrl}
                        alt=""
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: 'var(--fill)',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        <Users size={16} />
                      </div>
                    )}
                    <div>
                      <b style={{ fontSize: '13px' }}>{p.name}</b>
                      {p.role ? (
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--label2)' }}>
                          {roleLabel(p.role)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <ChevronRight size={15} color="var(--accent)" />
                </button>
              ))}
            </div>
          );
        }
        if (lens.id === 'reactions') {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '6px' }}>
              <div
                role="group"
                aria-label="Jour des réactions"
                style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
              >
                {(detail.days.length > 0 ? detail.days : [{ dayNumber: 1 }]).map((d) => {
                  const n = d.dayNumber ?? 1;
                  const on = n === reactionDay;
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setReactionDay(n)}
                      style={{
                        height: 28,
                        padding: '0 11px',
                        borderRadius: 9999,
                        border: 0,
                        background: on ? 'var(--tint)' : 'rgba(23,64,44,.08)',
                        color: on ? 'var(--tint-ink, #fff)' : 'var(--tint)',
                        font: '600 11px var(--font-sans)',
                        cursor: 'pointer',
                      }}
                    >
                      Jour {n}
                    </button>
                  );
                })}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  borderRadius: '16px',
                  background: 'var(--drawer-card-bg)',
                }}
              >
                <div>
                  <b style={{ fontSize: '14px' }}>Jour {reactionDay}</b>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--label2)' }}>
                    {reactions.likesCount} mention{reactions.likesCount > 1 ? 's' : ''} J’aime
                  </p>
                </div>
                <button
                  type="button"
                  style={{
                    height: '34px',
                    padding: '0 14px',
                    borderRadius: '9999px',
                    border: '0',
                    background: reactions.liked ? '#E0245E' : 'rgba(23, 64, 44, 0.08)',
                    color: reactions.liked ? '#fff' : 'var(--tint)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                  onClick={reactions.toggleLike}
                  aria-pressed={reactions.liked}
                  aria-label={reactions.liked ? 'Retirer mon j’aime du jour' : 'J’aime ce jour'}
                >
                  <LikeIcon size={15} active={reactions.liked} />
                  <span>{reactions.liked ? 'Aimé' : 'J’aime'}</span>
                </button>
              </div>

              <b style={{ fontSize: '13px', margin: '4px 0 0' }}>Commentaires</b>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {reactions.comments.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '14px',
                      background: 'var(--drawer-card-bg)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <b style={{ fontSize: '12px' }}>{c.authorName}</b>
                      {userId && c.authorId === userId ? (
                        <button
                          type="button"
                          style={{
                            border: 0,
                            background: 'none',
                            cursor: 'pointer',
                            color: 'var(--bad)',
                          }}
                          onClick={() => reactions.deleteComment(c.id)}
                          aria-label="Supprimer mon commentaire"
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : null}
                    </div>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', lineHeight: 1.35 }}>
                      {c.content}
                    </p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <input
                  type="text"
                  placeholder="Écrire un mot d’encouragement…"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newCommentText.trim()) {
                      void reactions.addComment(newCommentText);
                      setNewCommentText('');
                    }
                  }}
                  style={{
                    flex: 1,
                    height: '36px',
                    padding: '0 12px',
                    borderRadius: '9999px',
                    border: '0.5px solid rgba(23, 43, 36, 0.2)',
                    background: 'rgba(255, 255, 255, 0.8)',
                    fontSize: '12.5px',
                  }}
                />
                <button
                  type="button"
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    border: 0,
                    background: 'var(--tint, #17402C)',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    if (newCommentText.trim()) {
                      void reactions.addComment(newCommentText);
                      setNewCommentText('');
                    }
                  }}
                  aria-label="Envoyer le commentaire"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          );
        }
        if (lens.id === 'suivre') {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px' }}>
              <div
                style={{
                  padding: '12px',
                  borderRadius: '16px',
                  background: 'var(--drawer-card-bg)',
                }}
              >
                <b>Suivi du carnet</b>
                <p style={{ margin: '4px 0 10px', fontSize: '12px', color: 'var(--label2)' }}>
                  Abonnez-vous aux notifications pour suivre l’aventure pas à pas.
                </p>
                <button
                  type="button"
                  style={{
                    height: '34px',
                    padding: '0 16px',
                    borderRadius: '9999px',
                    border: '0',
                    background: 'var(--tint, #17402C)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    if (!userId) onRequireAuth?.();
                    else onIsland?.('Vous suivez désormais cette expédition');
                  }}
                >
                  Suivre cette expédition
                </button>
              </div>
            </div>
          );
        }
        break;
    }

    return null;
  };

  const currentSlotLenses = slotLenses[activeSlot] || [];
  const currentSlotIndex = slotTabs.findIndex((t) => t.id === activeSlot);

  return (
    <div
      ref={dialogRef}
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
        state={slotErrored ? 'error' : 'ready'}
        errorLabel="Impossible de charger ce carnet."
        onRetry={() => setSlotRetry((n) => n + 1)}
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
          <LensBoundary
            resetKey={`${activeSlot}:${lens.id}:${lensRetry}`}
            fallback={
              <LensState
                tone="error"
                title="Ce volet n’a pas pu s’afficher."
                hint="Les autres volets du carnet restent disponibles."
                action={
                  <button
                    type="button"
                    className="lkdv-lens-cta"
                    onClick={() => setLensRetry((n) => n + 1)}
                  >
                    Réessayer
                  </button>
                }
              />
            }
          >
            {forceError?.lens === `${activeSlot}:${lens.id}` && lensRetry === 0 ? (
              <Boom />
            ) : (
              renderCurrentSlotContent(lens)
            )}
          </LensBoundary>
        )}
      />

      {/* Pilule « Reprendre » : slot Sac et fiche objet seulement (maquette `syncKitPill`). */}
      {showKitPill ? (
        <button
          type="button"
          className="lkdv-pill-reprendre"
          id="kitpill"
          aria-pressed={kitSaved}
          aria-label={kitSaved ? 'Kit enregistré dans ton Compas' : 'Reprendre ce kit'}
          title="Reprendre ce kit"
          onClick={() => void saveKit()}
        >
          <Bookmark size={15} aria-hidden="true" fill={kitSaved ? 'currentColor' : 'none'} />
          <span>Reprendre</span>
        </button>
      ) : null}
    </div>
  );
}
