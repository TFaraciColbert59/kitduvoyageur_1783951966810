'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
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
} from '@/features/carnet/detail/types';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useCarnetDayReactions } from '@/features/carnet/detail/useCarnetDayReactions';
import { useKitFork } from '@/features/carnet/detail/useKitFork';
import { useCarnetDialog } from './useCarnetDialog';
import { CarnetAltitude } from './CarnetAltitude';

export type CarnetSlotId = 'fil' | 'route' | 'sac' | 'chiffres' | 'equipage';

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
  const [verdictFilter, setVerdictFilter] = useState<'all' | 'top' | 'flop' | 'neutre'>('all');
  const [newCommentText, setNewCommentText] = useState('');

  // Reactions for the current active day
  const effectiveDay = activeDay > 0 ? activeDay : 1;
  const reactions = useCarnetDayReactions({
    carnetId: detail.id,
    dayNumber: effectiveDay,
    initialLikes: detail.dayReactions?.[effectiveDay]?.likesCount ?? 0,
    initialLiked: detail.dayReactions?.[effectiveDay]?.userLiked ?? false,
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
    const isVisitor = detail.viewerRole === 'visitor';
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
        { id: 'nuits', label: 'Nuits', icon: <Moon size={15} /> },
        { id: 'meteo', label: 'Météo', icon: <CloudSun size={15} /> },
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
                      {currentStackItem.participant.role}
                    </p>
                  ) : null}
                </div>
              </div>

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
              {detail.moments.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  style={{
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
            </div>
          );
        }
        if (lens.id === 'medias') {
          return (
            <div className="lkdv-ig-grid" style={{ padding: '6px' }}>
              {detail.photoMoments.map((m, idx) => (
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
          );
        }
        if (lens.id === 'rencontres') {
          const encounters = detail.moments.filter(
            (m) =>
              m.type === 'rencontre' || (m.caption && m.caption.toLowerCase().includes('rencontre'))
          );
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px' }}>
              {encounters.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--label2)', fontSize: '13px' }}>
                  Aucune rencontre répertoriée.
                </p>
              ) : (
                encounters.map((m) => (
                  <div
                    key={m.id}
                    style={{
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
          const natureMoments = detail.moments.filter(
            (m) =>
              m.type === 'faune_flore' ||
              (m.caption &&
                (m.caption.toLowerCase().includes('faune') ||
                  m.caption.toLowerCase().includes('flore')))
          );
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px' }}>
              {natureMoments.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--label2)', fontSize: '13px' }}>
                  Aucune observation nature consignée.
                </p>
              ) : (
                natureMoments.map((m) => (
                  <div
                    key={m.id}
                    style={{
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
              {detail.etapes.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  style={{
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
              {(detail.nights ?? []).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  style={{
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
            </div>
          );
        }
        if (lens.id === 'altitude') {
          const profile = detail.elevationProfile ?? [];
          return (
            <div className="lkdv-altitude-card">
              <b>Profil d’altitude du tracé</b>
              <p>
                {detail.elevationM
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
              {detail.etapes.map((e) => (
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
                  <b style={{ fontSize: '13px' }}>Poids total du sac</b>
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>
                    {detail.kit.totalWeightG
                      ? `${(detail.kit.totalWeightG / 1000).toFixed(1)} kg`
                      : '—'}
                  </span>
                </div>

                {detail.kit.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    style={{
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
              </div>

              {/* Floating pill "Reprendre" on Sac slot bottom-left */}
              <button
                type="button"
                className="lkdv-pill-reprendre"
                onClick={() => {
                  const ids = detail.kit.items.map((i) => i.id);
                  void forkAllItems(ids);
                }}
              >
                <Package size={14} />
                <span>Reprendre le kit</span>
              </button>
            </div>
          );
        }
        if (lens.id === 'verdicts') {
          const verdictsList = detail.kit.items.filter((i) => i.verdict);
          const filtered = verdictsList.filter((v) => {
            if (verdictFilter === 'all') return true;
            return v.verdict === verdictFilter;
          });

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['all', 'top', 'flop', 'neutre'] as const).map((f) => (
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
                      color: verdictFilter === f ? '#fff' : 'var(--tint)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                    onClick={() => setVerdictFilter(f)}
                  >
                    {f === 'all' ? 'Tous' : `${f}s`}
                  </button>
                ))}
              </div>

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
                        background:
                          item.verdict === 'top'
                            ? 'var(--mint, #E1EBDE)'
                            : item.verdict === 'flop'
                              ? 'var(--bad-bg, #FDE8E6)'
                              : 'rgba(23, 64, 44, 0.08)',
                        color:
                          item.verdict === 'top'
                            ? 'var(--good, #3D7A52)'
                            : item.verdict === 'flop'
                              ? 'var(--bad, #A8443A)'
                              : 'inherit',
                      }}
                    >
                      {item.verdict}
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
        if (lens.id === 'distance') {
          return (
            <div
              style={{ padding: '12px', borderRadius: '16px', background: 'var(--drawer-card-bg)' }}
            >
              <b>Distance totale</b>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: '20px',
                  fontWeight: 700,
                  color: 'var(--tint)',
                }}
              >
                {detail.distanceKm ? `${Math.round(detail.distanceKm)} km` : '—'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--label2)' }}>
                Moyenne journalière :{' '}
                {detail.distanceKm && detail.days.length
                  ? `${(detail.distanceKm / detail.days.length).toFixed(1)} km/j`
                  : '—'}
              </p>
            </div>
          );
        }
        if (lens.id === 'denivele') {
          return (
            <div
              style={{ padding: '12px', borderRadius: '16px', background: 'var(--drawer-card-bg)' }}
            >
              <b>Dénivelé positif</b>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: '20px',
                  fontWeight: 700,
                  color: 'var(--tint)',
                }}
              >
                {detail.elevationM ? `+${Math.round(detail.elevationM)} m` : '—'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--label2)' }}>
                Moyenne journalière :{' '}
                {detail.elevationM && detail.days.length
                  ? `+${Math.round(detail.elevationM / detail.days.length)} m/j`
                  : '—'}
              </p>
            </div>
          );
        }
        if (lens.id === 'duree') {
          return (
            <div
              style={{ padding: '12px', borderRadius: '16px', background: 'var(--drawer-card-bg)' }}
            >
              <b>Durée d’expédition</b>
              <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 700 }}>
                {detail.days.length} journées de marche
              </p>
            </div>
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
              {detail.budget.items.map((item) => (
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
              {detail.participants.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  style={{
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
                          {p.role}
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
                  <b style={{ fontSize: '14px' }}>Jour {effectiveDay}</b>
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
        renderLens={(lens) => renderCurrentSlotContent(lens)}
      />
    </div>
  );
}
