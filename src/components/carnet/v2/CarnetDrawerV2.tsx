'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { KitItemV2 } from '@/features/community/v2/create/engine/createSchemasV2';
import { KitProductSheetV2 } from '@/features/community/v2/create/kit/KitProductSheetV2';
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
  ChevronLeft,
  Bookmark,
  Send,
  Trash2,
} from 'lucide-react';
import LikeIcon from '@/components/social-kit/LikeIcon';
import { SlotShell, type SlotLens } from '@/components/compte/drawer/SlotShell';
import { CapsuleTabs, type CapsuleTabItem } from '@/components/ui/CapsuleTabs';
import { generatedProductImage } from '@/components/compte/drawer/cards/productImage';
import type {
  CarnetDetail,
  CarnetMomentItem,
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
import { CarnetAltitudeDrawerBody } from './CarnetAltitudeDrawerBody';
import { CarnetPokedexDrawerBody } from './CarnetPokedexDrawerBody';
import { CarnetKitDrawerBody } from './CarnetKitDrawerBody';
import { CarnetChiffresDrawerBody } from './CarnetChiffresDrawerBody';
import { CarnetEquipageDrawerBody } from './CarnetEquipageDrawerBody';

export type CarnetSlotId = 'fil' | 'route' | 'sac' | 'chiffres' | 'equipage';

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
  onDayPick?: (day: number) => void;
}

export type StackIntent =
  | { type: 'lens'; slot: CarnetSlotId; index: number }
  | { type: 'participant'; userId: string }
  | { type: 'etape'; etapeId: string };

type StackView =
  | { type: 'etape'; etapeId: string }
  | { type: 'night'; nightId: string }
  | { type: 'item'; itemId: string }
  | { type: 'participant'; userId: string };

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
  onOpenKitCreate,
  onIsland,
  userId,
  onRequireAuth,
  onSelectMoment,
  isAccountDrawer = false,
  onObserveSpecies,
  onDayPick,
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
  const [stack, setStack] = useState<StackView[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<CarnetDetail['participants'][number] | null>(null);
  const [selectedKitProductIndex, setSelectedKitProductIndex] = useState<number | null>(null);
  const sacKitItems = useMemo(() => {
    if (detail.kit?.items?.length) return detail.kit.items;
    const memberLists = Object.values(detail.memberKits ?? {});
    for (const mk of memberLists) {
      if (mk?.items?.length) return mk.items;
    }
    return [];
  }, [detail.kit, detail.memberKits]);
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
  const { isForked, forkAllItems } = useKitFork({
    carnetId: detail.id,
    userId,
    onRequireAuth,
    onIsland,
  });

  const voice = useVoicePlayer(() => onIsland?.('Aucun enregistrement à écouter pour cette note'));
  const [notifPref, setNotifPref] = useNotifPref(detail.id);
  /* Propositions n° 20 et 41 : suivre le carnet (pas seulement la personne) et
     garder la fréquence de notification sur le compte. Repli local honnête
     quand la table n'est pas encore appliquée ou quand on est invité. */
  const carnetFollow = useCarnetFollow({
    carnetId: detail.id,
    userId,
    isParticipant: isParticipantRole(detail.viewerRole),
  });
  const serverNotif = carnetFollow.persisted && !isParticipantRole(detail.viewerRole);

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
    const isViewerParticipant = isParticipantRole(detail.viewerRole);
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
      if (detail.participants.some((p) => p.userId === userIdWanted)) {
        setStack([{ type: 'participant', userId: userIdWanted }]);
      }
    } else {
      const etapeId = intent.view.etapeId;
      if (detail.etapes.some((e) => e.id === etapeId)) setStack([{ type: 'etape', etapeId }]);
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

  const kitPillNode = showKitPill ? (
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
  ) : null;

  if (!isOpen) return null;

  // Fiches empilées (étape, nuit, objet, voyageur) : relues depuis `detail` à
  // chaque rendu, pour refléter une modification faite depuis la fiche.
  const currentStackItem = stack[stack.length - 1];

  if (currentStackItem) {
    const dateOfDay = (day: number): string | null =>
      detail.days.find((d) => (d.dayNumber ?? d.index) === day)?.date ?? null;
    let title = '';
    let body: React.ReactNode = null;
    if (currentStackItem.type === 'etape') {
      const etape = detail.etapes.find((e) => e.id === currentStackItem.etapeId);
      if (etape) {
        title = [etape.from, etape.to].filter(Boolean).join(' → ') || etape.label;
        const day = detail.days.find((d) => (d.dayNumber ?? d.index) === etape.dayNumber);
        const lastPoint = day?.points.slice(-1)[0];
        /* Même repli que la liste : les chiffres du jour complètent l'étape
           quand la ligne d'étape n'en porte pas (sinon « — » pour tout). */
        const etapeWithStats = {
          ...etape,
          distanceKm: etape.distanceKm ?? day?.distanceKm ?? null,
          elevationM: etape.elevationM ?? day?.elevationM ?? null,
          durationText: etape.durationText ?? formatDuration(day?.durationS ?? null),
        };
        body = (
          <EtapeFiche
            etape={etapeWithStats}
            canEdit={canEdit}
            onShowOnMap={lastPoint ? () => onFocusMap?.(lastPoint.lat, lastPoint.lng, 12) : undefined}
            onEdit={() => onEdit?.({ kind: 'etape', etape, day: etape.dayNumber })}
          />
        );
      }
    } else if (currentStackItem.type === 'night') {
      const night = (detail.nights ?? []).find((n) => n.id === currentStackItem.nightId);
      if (night) {
        title = night.name;
        body = (
          <NightFiche
            night={night}
            date={dateOfDay(night.dayNumber)}
            canEdit={canEdit}
            onShowOnMap={
              night.lat != null && night.lng != null
                ? () => {
                    onFocusMap?.(night.lat as number, night.lng as number, 13);
                    onIsland?.('Caméra centrée sur la nuit');
                  }
                : undefined
            }
            onEdit={() => onEdit?.({ kind: 'nuit', night, day: night.dayNumber })}
          />
        );
      }
    } else if (currentStackItem.type === 'item') {
      const item = detail.kit.items.find((i) => i.id === currentStackItem.itemId);
      if (item) {
        title = item.name;
        body = (
          <ItemFiche
            item={item}
            days={item.joursUtilises ?? []}
            canEdit={canEdit}
            onEdit={() => onEdit?.({ kind: 'verdict', itemId: item.id })}
          />
        );
      }
    } else {
      const participant = detail.participants.find((p) => p.userId === currentStackItem.userId);
      if (participant) {
        title = participant.name || participant.handle || 'Voyageur';
        body = (
          <ParticipantFiche
            detail={detail}
            participant={participant}
            canEdit={canEdit}
            pinnedIds={pinnedIds}
            onSelectMoment={(m, idx) => onSelectMoment?.(m, idx)}
            onEdit={() => onEdit?.({ kind: 'voyageur', participant })}
          />
        );
      }
    }

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
          <b style={{ fontSize: '13.5px', color: 'var(--tint)' }}>{title}</b>
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
        {kitPillNode}
      </div>
    );
  }

  // Tiroir « Carnet » (bouton curseurs de la barre)
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
  const dateOfDay = (day: number): string | null => {
    const iso = detail.days.find((d) => (d.dayNumber ?? d.index) === day)?.date ?? null;
    return iso
      ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
        })
      : null;
  };
  const stackWrap: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '6px 14px',
  };
  const nextDay = activeDay > 0 ? activeDay : Math.max(1, ...detail.days.map((d) => d.dayNumber ?? d.index)) || 1;

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
            onSelectItem={(item) => {
              const idx = sacKitItems.findIndex((k) => k.id === item.id);
              setSelectedKitProductIndex(idx >= 0 ? idx : 0);
            }}
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
                pSpecies.length > 0 ? (
                  <div className="lkdv-carnet-cards-col">
                    {pSpecies.map((sp) => (
                      <div key={sp.id} className="lkdv-carnet-budget-row">
                        <div>
                          <b>{sp.speciesName || sp.title || 'Observation'}</b>
                          {sp.speciesLatin ? <small style={{ fontStyle: 'italic' }}>{sp.speciesLatin}</small> : null}
                        </div>
                        <small>J{sp.dayNumber}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: '8px 0', fontSize: 12.5, color: 'var(--label2)' }}>Aucune observation naturaliste enregistrée pour ce voyageur.</p>
                )
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
                                  onClick={() => {
                                    const idx = sacKitItems.findIndex((k) => k.id === item.id);
                                    setSelectedKitProductIndex(idx >= 0 ? idx : 0);
                                  }}
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

      {selectedKitProductIndex !== null &&
      sacKitItems[selectedKitProductIndex] &&
      typeof document !== 'undefined'
        ? createPortal(
            (() => {
              const item = sacKitItems[selectedKitProductIndex];
              const totalKitWeightG = sacKitItems.reduce(
                (sum, k) => sum + (Number(k.weightG) || 0),
                0
              );
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
                owner: detail.author
                  ? {
                      id: detail.author.id,
                      name: detail.author.name,
                      avatarUrl: detail.author.avatarUrl ?? null,
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
                  positionLabel={`${selectedKitProductIndex + 1} / ${sacKitItems.length}`}
                  hasPrev={selectedKitProductIndex > 0}
                  hasNext={selectedKitProductIndex < sacKitItems.length - 1}
                  onPrev={() =>
                    setSelectedKitProductIndex((i) => (i !== null && i > 0 ? i - 1 : i))
                  }
                  onNext={() =>
                    setSelectedKitProductIndex((i) =>
                      i !== null && i < sacKitItems.length - 1 ? i + 1 : i
                    )
                  }
                  onClose={() => setSelectedKitProductIndex(null)}
                  onAdd={(prod) => {
                    void forkSingleItem(prod.id);
                    setSelectedKitProductIndex(null);
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
