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
  ChevronLeft,
  Bookmark,
  Send,
  Trash2,
} from 'lucide-react';
import LikeIcon from '@/components/social-kit/LikeIcon';
import { SlotShell, type SlotLens } from '@/components/compte/drawer/SlotShell';
import { CapsuleTabs, type CapsuleTabItem } from '@/components/ui/CapsuleTabs';
import type {
  CarnetDetail,
  CarnetMomentItem,
  KitVerdictType,
} from '@/features/carnet/detail/types';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useCarnetDayReactions } from '@/features/carnet/detail/useCarnetDayReactions';
import { useKitFork } from '@/features/carnet/detail/useKitFork';
import { useCarnetDialog } from './useCarnetDialog';
import { CarnetPostGrid } from './CarnetPostGrid';
import { CarnetArt } from './CarnetArt';
import type { MomentType } from '@/features/carnet/detail/momentTypes';
import { dayMetric, resolveDayStats, selectDayData } from '@/features/carnet/detail/dayView';
import { isParticipantRole } from '@/features/carnet/detail/viewerRole';
import { CarnetAltitude } from './CarnetAltitude';
import { CarnetBeats, CarnetEveningSummary, CarnetProgression } from './CarnetSuivi';
import { CarnetAccountDrawer, NOTIF_PREFS, useNotifPref } from './CarnetAccountDrawer';
import type { CarnetEditTarget } from './CarnetEditSheet';
import {
  CrewCard,
  EditPill,
  EtapeRows,
  KitTiles,
  MomentCard,
  NightCards,
  VerdictList,
  WeightDonut,
  momentsOfParticipant,
  useVoicePlayer,
} from './CarnetLenses';
import { EtapeFiche, ItemFiche, NightFiche, ParticipantFiche } from './CarnetFiches';
import { MOMENT_TYPE_ICONS } from './CarnetMomentTile';
import { relativeTime } from '@/features/carnet/detail/useCarnetNotifications';
import { CARNET_NOTIFY_MODES, useCarnetFollow } from '@/features/carnet/detail/useCarnetFollow';
import { elevationProfileGain } from '@/features/carnet/detail/elevationProfile';

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
  /** Ouvre la feuille d'édition (étape, nuit, verdict, voyageur, moment). */
  onEdit?: (target: CarnetEditTarget) => void;
  /** Réglages écrits sur `carnets` (tiroir « Carnet ») : l'écran les reporte sur la fiche. */
  onSettingsSaved?: (changes: Record<string, string | boolean>) => void;
  onDeleted?: () => void;
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
  onIsland,
  userId,
  onRequireAuth,
  onSelectMoment,
  isAccountDrawer = false,
  isEditing = false,
  onCreate,
  pinnedIds,
  onContextChange,
  onDayPick,
  intent = null,
  forceError = null,
  onEdit,
  onSettingsSaved,
  onDeleted,
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
        const lastPoint = detail.days.find((d) => (d.dayNumber ?? d.index) === etape.dayNumber)?.points.slice(-1)[0];
        body = (
          <EtapeFiche
            etape={etape}
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
          {body ?? (
            <LensState title="Cet élément n’existe plus." hint="Il a été supprimé ou modifié depuis." />
          )}
        </div>
        {kitPillNode}
      </div>
    );
  }

  // Tiroir « Carnet » (bouton curseurs de la barre)
  if (isAccountDrawer) {
    return (
      <CarnetAccountDrawer
        detail={detail}
        userId={userId}
        dialogRef={dialogRef}
        onClose={onClose}
        onIsland={onIsland}
        onRequireAuth={onRequireAuth}
        onSettingsSaved={(changes) => onSettingsSaved?.(changes)}
        onDeleted={() => onDeleted?.()}
      />
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
        if (lens.id === 'moments' && activeDay === 0 && detail.days.length > 0) {
          const stats = resolveDayStats(detail);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '6px 14px' }}>
              <h3 className="lkdv-h5">Une carte postale par jour</h3>
              {[...detail.days]
                .sort((a, b) => (a.dayNumber ?? a.index) - (b.dayNumber ?? b.index))
                .map((day) => {
                  const n = day.dayNumber ?? day.index;
                  const etape = detail.etapes.find((e) => e.dayNumber === n);
                  const stat = stats.find((x) => x.dayNumber === n);
                  const image =
                    day.moments.find((m) => m.imageUrl)?.imageUrl ?? detail.coverImage ?? null;
                  const date = day.date
                    ? new Date(`${day.date}T12:00:00Z`).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        timeZone: 'UTC',
                      })
                    : null;
                  return (
                    <button
                      key={n}
                      type="button"
                      className="lkdv-postcard"
                      aria-label={`Ouvrir le jour ${n}`}
                      onClick={() => onDayPick?.(n)}
                    >
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <CarnetArt className="lkdv-postcard-art" />
                      )}
                      <span className="lkdv-postcard-stamp">
                        <b>J{n}</b>
                        {date ? <span>{date}</span> : null}
                      </span>
                      <span className="lkdv-postcard-ov">
                        <span className="lkdv-postcard-route">
                          {[etape?.from, etape?.to].filter(Boolean).join(' → ') || `Jour ${n}`}
                        </span>
                        {etape?.note ? <q>{etape.note}</q> : null}
                        <span className="lkdv-postcard-row">
                          <span>{stat?.distanceKm != null ? `${stat.distanceKm.toLocaleString('fr-FR')} km` : '—'}</span>
                          <span>{stat?.elevationM != null ? `+${Math.round(stat.elevationM).toLocaleString('fr-FR')} m` : '—'}</span>
                          <span>{day.moments.length} moment{day.moments.length > 1 ? 's' : ''}</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              {canEdit ? <AddCaption label="Ajouter un moment" onClick={() => onCreate?.()} /> : null}
            </div>
          );
        }
        if (lens.id === 'moments') {
          return (
            <div style={stackWrap}>
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
              {canEdit && dayData.moments.length > 0 ? (
                <AddCaption label="Ajouter un moment" onClick={() => onCreate?.()} />
              ) : null}
              <div className="lkdv-tl">
                {dayData.moments.map((m, idx) => (
                  <MomentCard
                    key={m.id}
                    moment={m}
                    showDay={activeDay === 0}
                    kitItems={detail.kit.items}
                    playing={voice.playingId === m.id}
                    canEdit={canEdit}
                    index={idx}
                    onOpen={(moment) => onSelectMoment?.(moment, idx)}
                    onPlay={(moment) => voice.toggle(moment.id, moment.meta?.audioUrl)}
                    onEdit={(moment) => onEdit?.({ kind: 'moment', moment })}
                    onOpenItem={(itemId) => pushStack({ type: 'item', itemId })}
                  />
                ))}
              </div>
            </div>
          );
        }
        if (lens.id === 'medias') {
          return (
            <div style={{ padding: '6px 14px' }}>
              {dayPhotoMoments.length > 0 ? (
                <h3 className="lkdv-h5" style={{ margin: '0 0 8px' }}>
                  {dayPhotoMoments.length} média{dayPhotoMoments.length > 1 ? 's' : ''} · photos et vidéos
                </h3>
              ) : null}
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
            <div style={stackWrap}>
              {encounters.length === 0 ? (
                <LensState title="Aucune rencontre." hint="Pas de rencontre notée ce jour." />
              ) : (
                encounters.map((m, idx) => (
                  <MomentCard
                    key={m.id}
                    moment={m}
                    showDay={activeDay === 0}
                    kitItems={detail.kit.items}
                    playing={false}
                    canEdit={canEdit}
                    index={idx}
                    onOpen={(moment) => onSelectMoment?.(moment, idx)}
                    onPlay={() => undefined}
                    onEdit={(moment) => onEdit?.({ kind: 'moment', moment })}
                    onOpenItem={() => undefined}
                  />
                ))
              )}
              {canEdit ? <AddCaption label="Ajouter une rencontre" onClick={() => onCreate?.('meet')} /> : null}
            </div>
          );
        }
        if (lens.id === 'nature') {
          const species = dayData.moments.filter((m) => m.type === 'species');
          const Glyph = MOMENT_TYPE_ICONS.species;
          return (
            <div style={stackWrap}>
              <h3 className="lkdv-h5">Planche d’espèces · {species.length}</h3>
              {species.length === 0 ? (
                <LensState title="Aucune espèce." hint="Aucune espèce notée ce jour." />
              ) : (
                <div className="lkdv-twocol">
                  {species.map((m, idx) => (
                    <div key={m.id} className="lkdv-mtile" data-carnet-row="" style={rowStyle(idx)}>
                      <span className="sp-gl" aria-hidden="true">
                        <Glyph size={26} strokeWidth={1.5} />
                      </span>
                      <b style={{ fontSize: 13 }}>{m.caption || m.title || m.place}</b>
                      {m.meta?.latin ? (
                        <i style={{ font: 'italic 400 12.5px var(--font-sans, sans-serif)', color: 'var(--label2)' }}>
                          {m.meta.latin}
                        </i>
                      ) : null}
                      <span className="lkdv-mute">
                        J{m.dayNumber} · {m.time ?? ''}
                      </span>
                      {canEdit ? <EditPill label="Modifier l’espèce" onClick={() => onEdit?.({ kind: 'moment', moment: m })} /> : null}
                    </div>
                  ))}
                </div>
              )}
              {canEdit ? <AddCaption label="Ajouter une espèce" onClick={() => onCreate?.('species')} /> : null}
            </div>
          );
        }
        break;

      case 'route':
        if (lens.id === 'etapes') {
          /* Une étape peut n'avoir que son nom ; les stats du jour (issues des
             sorties datées) complètent distance et D+ au lieu d'afficher
             « Chiffres non renseignés » alors que le carnet les connaît. */
          const etapesWithStats = dayData.etapes.map((etape) => {
            if (etape.distanceKm != null && etape.elevationM != null) return etape;
            const day = detail.days.find(
              (entry) => (entry.dayNumber ?? entry.index) === etape.dayNumber
            );
            if (!day) return etape;
            return {
              ...etape,
              distanceKm: etape.distanceKm ?? day.distanceKm,
              elevationM: etape.elevationM ?? day.elevationM,
            };
          });
          return (
            <div style={stackWrap}>
              {etapesWithStats.length === 0 ? (
                <LensState title="Aucune étape." hint="Les étapes du parcours apparaissent ici dès qu’elles sont renseignées." />
              ) : (
                <EtapeRows
                  etapes={etapesWithStats}
                  activeDay={activeDay}
                  onOpen={(e) => pushStack({ type: 'etape', etapeId: e.id })}
                />
              )}
              {canEdit ? (
                <AddCaption label="Ajouter une étape" onClick={() => onEdit?.({ kind: 'etape', etape: null, day: nextDay })} />
              ) : null}
            </div>
          );
        }
        if (lens.id === 'nuits') {
          return (
            <div style={stackWrap}>
              {dayData.nights.length === 0 ? (
                <LensState title="Aucune nuit enregistrée." hint="Les nuits apparaissent ici dès qu’elles sont renseignées." />
              ) : (
                <NightCards
                  nights={dayData.nights}
                  activeDay={activeDay}
                  dateOf={dateOfDay}
                  onOpen={(n) => {
                    pushStack({ type: 'night', nightId: n.id });
                    if (n.lat != null && n.lng != null) onFocusMap?.(n.lat, n.lng, 13);
                  }}
                />
              )}
              {canEdit ? (
                <AddCaption label="Ajouter une nuit" onClick={() => onEdit?.({ kind: 'nuit', night: null, day: nextDay })} />
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
                <CarnetAltitude points={profile} height={80} interactive label="Profil d’altitude du tracé" />
              ) : (
                <p className="lkdv-altitude-empty" role="status">
                  Aucune mesure d’altitude enregistrée pour ce carnet.
                </p>
              )}
            </div>
          );
        }
        if (lens.id === 'meteo') {
          const withWeather = dayData.etapes.filter((e) => e.weather);
          return (
            <div style={stackWrap}>
              {withWeather.length === 0 ? (
                <LensState title="Météo non renseignée." hint="Aucune condition n’a été notée pour cette période." />
              ) : (
                withWeather.map((e) => (
                  <div key={e.id} className="lkdv-card2">
                    <div className="lkdv-row2">
                      <b className="lkdv-mono" style={{ color: 'var(--tint)' }}>
                        J{e.dayNumber}
                      </b>
                      <span>{e.weather}</span>
                    </div>
                    <span className="lkdv-mute">{[e.from, e.to].filter(Boolean).join(' → ')}</span>
                  </div>
                ))
              )}
            </div>
          );
        }
        break;

      case 'sac':
        if (lens.id === 'kit') {
          return (
            <div style={{ position: 'relative', minHeight: '100%', paddingBottom: '48px' }}>
              <div style={stackWrap}>
                {dayData.kitItems.length === 0 ? (
                  <LensState title="Aucun matériel." hint="Aucun objet cité ce jour." />
                ) : (
                  <KitTiles items={dayData.kitItems} onOpen={(item) => pushStack({ type: 'item', itemId: item.id })} />
                )}
                {canEdit ? <AddCaption label="Ajouter un objet" onClick={() => onCreate?.('kit')} /> : null}
              </div>
            </div>
          );
        }
        if (lens.id === 'verdicts') {
          const withVerdict = dayData.kitItems.filter((i) => i.verdict);
          return (
            <div style={stackWrap}>
              {dayData.kitItems.length === 0 ? (
                <LensState title="Aucun matériel." hint="Aucun objet cité ce jour." />
              ) : (
                <VerdictList
                  items={withVerdict}
                  filter={verdictFilter}
                  onFilter={setVerdictFilter}
                  onOpen={(item) => pushStack({ type: 'item', itemId: item.id })}
                />
              )}
              {dayData.kitItems.length > 0 && withVerdict.length === 0 ? (
                <LensState title="Aucun verdict pour ce carnet." hint="Les verdicts se remplissent après les sorties." />
              ) : null}
              {canEdit ? (
                <AddCaption label="Ajouter un verdict" onClick={() => onEdit?.({ kind: 'verdict', itemId: null })} />
              ) : null}
            </div>
          );
        }
        if (lens.id === 'poids') {
          const known = dayData.kitItems.some((i) => i.weightG);
          return (
            <div style={stackWrap}>
              {dayData.kitItems.length === 0 ? (
                <LensState title="Aucun matériel." hint="Aucun objet cité ce jour." />
              ) : known ? (
                <WeightDonut items={dayData.kitItems} />
              ) : (
                <LensState title="Poids non renseigné." hint="Aucun objet de ce kit n’a de poids." />
              )}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px 14px' }}>
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
            <div style={stackWrap}>
              {detail.participants.map((p, idx) => (
                <CrewCard
                  key={p.userId}
                  participant={p}
                  index={idx}
                  momentCount={momentsOfParticipant(detail, p)}
                  isAuthor={p.role === 'author'}
                  onOpen={() => pushStack({ type: 'participant', userId: p.userId })}
                />
              ))}
              {canEdit ? (
                <AddCaption label="Inviter un voyageur" onClick={() => onEdit?.({ kind: 'voyageur', participant: null })} />
              ) : null}
            </div>
          );
        }
        if (lens.id === 'reactions') {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '6px 14px' }}>
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
                        background: on ? 'var(--tint)' : 'var(--fill2)',
                        color: on ? 'var(--tint-ink)' : 'var(--tint)',
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
                    background: reactions.liked ? 'var(--like)' : 'var(--fill2)',
                    color: reactions.liked ? 'var(--white)' : 'var(--tint)',
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
                    border: '0.5px solid var(--sep)',
                    background: 'var(--fill3)',
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
                    background: 'var(--tint)',
                    color: 'var(--tint-ink)',
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
          const signal = detail.livePosition?.recordedAt ?? detail.publicZone?.recordedAt ?? null;
          return (
            <div style={stackWrap}>
              {/* Lot 2 du suivi (maquette « suivre pendant le voyage ») : la
                  progression et les battements sont le suivi à froid, le
                  résumé du soir le rattrapage de la journée terminée. */}
              <CarnetProgression detail={detail} />
              {/* Proposition n° 20 : suivre le carnet, pas seulement son auteur. */}
              {!isParticipantRole(detail.viewerRole) ? (
                <div className="lkdv-sig" data-testid="carnet-follow">
                  <Radio size={18} aria-hidden />
                  <span style={{ flex: 1 }}>
                    <b>{carnetFollow.following ? 'Tu suis ce carnet' : 'Suivre ce carnet'}</b>
                    <br />
                    <span className="lkdv-mute">
                      {carnetFollow.following
                        ? 'Ses signaux arrivent selon ta fréquence de notification.'
                        : 'Reçois ses signaux pendant le voyage, pas seulement à la publication.'}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="lkdv-lens-cta"
                    aria-pressed={carnetFollow.following}
                    aria-label={carnetFollow.following ? 'Ne plus suivre le carnet' : 'Suivre le carnet'}
                    disabled={carnetFollow.busy}
                    onClick={() => {
                      if (!userId) {
                        onRequireAuth?.();
                        return;
                      }
                      void carnetFollow.toggle();
                    }}
                    style={
                      carnetFollow.following
                        ? { background: 'var(--fill2)', color: 'var(--tint)' }
                        : undefined
                    }
                  >
                    {carnetFollow.following ? 'Ne plus suivre' : 'Suivre'}
                  </button>
                </div>
              ) : null}
              <div className="lkdv-sig">
                <Radio size={18} aria-hidden />
                <span>
                  <b>Dernier signal</b>
                  {signal
                    ? ` : ${detail.place.locality ?? 'position reçue'}, ${relativeTime(signal)}.`
                    : ' : aucun signal reçu pour l’instant.'}
                  <br />
                  <span className="lkdv-mute">
                    {isParticipantRole(detail.viewerRole)
                      ? 'Tu vois la position exacte sur la carte.'
                      : 'Position affichée au niveau du massif, différée.'}
                  </span>
                </span>
              </div>
              <CarnetBeats
                detail={detail}
                activeDay={activeDay}
                onSelectDay={(day) => onDayPick?.(day)}
              />
              <CarnetEveningSummary
                detail={detail}
                onOpenDay={(day) => onDayPick?.(day)}
              />
              <h3 className="lkdv-h5">Me prévenir</h3>
              <div role="radiogroup" aria-label="Notifications" style={{ display: 'grid', gap: 6 }}>
                {NOTIF_PREFS.map(([label, hint], i) => {
                  const mode = CARNET_NOTIFY_MODES[i];
                  const active = serverNotif
                    ? carnetFollow.notifyMode === mode
                    : notifPref === i;
                  return (
                    <button
                      key={label}
                      type="button"
                      className="lkdv-opt"
                      role="radio"
                      aria-checked={active}
                      aria-label={label}
                      onClick={() => {
                        /* Connecté et table appliquée : la fréquence vit sur le
                           compte ; sinon la préférence reste sur l'appareil. */
                        if (serverNotif) {
                          void carnetFollow.setNotifyMode(mode);
                          return;
                        }
                        setNotifPref(i);
                        if (!userId) onRequireAuth?.();
                      }}
                    >
                      <span className="rad" />
                      {label}
                      <small>{hint}</small>
                    </button>
                  );
                })}
              </div>
              <p className="lkdv-mute">
                {serverNotif
                  ? 'Préférence enregistrée sur ton compte.'
                  : 'Préférence gardée sur cet appareil.'}
              </p>
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
      {kitPillNode}
    </div>
  );
}
