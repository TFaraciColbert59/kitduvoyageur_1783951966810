'use client';

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  Bike,
  Bus,
  Car,
  Check,
  ChevronDown,
  Clock,
  Footprints,
  Hand,
  MapPin,
  Minus,
  Plus,
  Train,
  Trash2,
  X,
} from 'lucide-react';
import type { ClubMemberData, ClubOutingData, ClubOutingTransportItem } from '../ClubDrawerTypes';
import { formatClockLabel, type OutingRouteAnalysis } from './outingUtils';

export interface OutingTransportLensProps {
  outing: ClubOutingData;
  analysis: OutingRouteAnalysis;
  members?: ClubMemberData[];
  transports: ClubOutingTransportItem[];
  loading: boolean;
  currentUserId: string | null;
  onOfferTransport: (payload: {
    direction: 'aller_retour' | 'aller' | 'retour';
    mode: 'carpool' | 'minibus_club' | 'train' | 'bus' | 'bike' | 'foot';
    outboundFromLabel: string;
    outboundDepartureAt?: string | null;
    returnFromLabel?: string | null;
    returnDepartureAt?: string | null;
    returnToLabel?: string | null;
    seatsTotal: number;
    gearNotes?: string | null;
    costShareCents: number;
    notes?: string | null;
  }) => Promise<boolean>;
  onBookSeat: (transportId: string, leg: 'aller_retour' | 'aller' | 'retour') => Promise<void>;
  onCancelBooking: (transportId: string) => Promise<void>;
  onDeleteTransport: (transportId: string) => Promise<void>;
}

function modeIcon(mode: ClubOutingTransportItem['mode'], size = 14) {
  if (mode === 'train') return <Train size={size} aria-hidden="true" />;
  if (mode === 'bus' || mode === 'minibus_club') return <Bus size={size} aria-hidden="true" />;
  if (mode === 'bike') return <Bike size={size} aria-hidden="true" />;
  if (mode === 'foot') return <Footprints size={size} aria-hidden="true" />;
  return <Car size={size} aria-hidden="true" />;
}

function modeLabel(mode: ClubOutingTransportItem['mode']): string {
  switch (mode) {
    case 'minibus_club':
      return 'Minibus club';
    case 'train':
      return 'TER / Train';
    case 'bus':
      return 'Navette';
    case 'bike':
      return 'Vélo';
    case 'foot':
      return 'À pied';
    default:
      return 'Covoiturage';
  }
}

function isPassengerRequest(t: ClubOutingTransportItem): boolean {
  return t.seatsTotal === 0 || Boolean(t.notes?.startsWith('[RECHERCHE]'));
}

export function OutingTransportLens({
  outing,
  analysis,
  members = [],
  transports,
  loading,
  currentUserId,
  onOfferTransport,
  onBookSeat,
  onCancelBooking,
  onDeleteTransport,
}: OutingTransportLensProps) {
  const [legFilter, setLegFilter] = useState<'all' | 'aller' | 'retour'>('all');
  const [pickingLegForId, setPickingLegForId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [entryKind, setEntryKind] = useState<'offer' | 'request'>('offer');
  const [mode, setMode] = useState<ClubOutingTransportItem['mode']>('carpool');
  const [direction, setDirection] = useState<'aller_retour' | 'aller' | 'retour'>('aller_retour');
  const [fromLabel, setFromLabel] = useState(outing.carpoolCity || 'Annecy · Gare');
  const [depTime, setDepTime] = useState('06:30');
  const [retTime, setRetTime] = useState('17:30');
  const [seatsTotal, setSeatsTotal] = useState(3);
  const [gearNotes, setGearNotes] = useState('');
  const [costEuros, setCostEuros] = useState('0');
  const [showExtras, setShowExtras] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const memberByUid = useMemo(
    () => new Map(members.map((m) => [m.userId || m.id, m])),
    [members],
  );

  const resolvePerson = (uid: string, rawName: string, rawAvatar: string | null, idx: number) => {
    const m = memberByUid.get(uid) ?? members[idx % Math.max(1, members.length)];
    const isGeneric = !rawName || rawName === 'Membre du club' || rawName === 'Membre' || rawName === 'Membre LKDV';
    return {
      name: isGeneric && m?.name ? m.name : rawName || 'Membre',
      avatarUrl: rawAvatar || m?.avatarUrl || null,
    };
  };

  const visibleTransports = transports.filter((t) => {
    if (legFilter === 'all') return true;
    return legFilter === 'aller'
      ? t.direction === 'aller_retour' || t.direction === 'aller'
      : t.direction === 'aller_retour' || t.direction === 'retour';
  });

  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromLabel.trim() || submitting) return;
    setSubmitting(true);
    const baseDate = outing.startsAtIso
      ? outing.startsAtIso.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const isReq = entryKind === 'request';
    const ok = await onOfferTransport({
      direction,
      mode: isReq ? 'carpool' : mode,
      outboundFromLabel: fromLabel.trim(),
      outboundDepartureAt:
        direction !== 'retour' ? `${baseDate}T${depTime || '07:00'}:00` : null,
      returnFromLabel:
        direction !== 'aller'
          ? analysis.isTraversal
            ? 'Arrivée du tracé'
            : outing.meetingPoint || outing.massif
          : null,
      returnDepartureAt:
        direction !== 'aller' ? `${baseDate}T${retTime || '17:30'}:00` : null,
      returnToLabel: direction !== 'aller' ? fromLabel.trim() : null,
      seatsTotal: isReq ? 0 : seatsTotal,
      gearNotes: gearNotes.trim() || null,
      costShareCents: isReq ? 0 : Math.max(0, Math.round((parseFloat(costEuros) || 0) * 100)),
      notes: isReq ? `[RECHERCHE] ${gearNotes.trim() || 'Cherche une place'}` : null,
    });
    setSubmitting(false);
    if (ok) setSheetOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 48 }}>
      {/* BARRE SUPÉRIEURE SOBRE : FILTRE SENS + AJOUTER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div
          role="tablist"
          aria-label="Filtrer par sens"
          style={{
            display: 'inline-flex',
            padding: 3,
            borderRadius: 999,
            background: 'rgba(23, 64, 44, 0.08)',
            gap: 2,
          }}
        >
          {(
            [
              ['all', 'Tout'],
              ['aller', 'Aller'],
              ['retour', 'Retour'],
            ] as const
          ).map(([val, lbl]) => {
            const active = legFilter === val;
            return (
              <button
                key={val}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setLegFilter(val)}
                style={{
                  height: 28,
                  padding: '0 12px',
                  borderRadius: 999,
                  border: 0,
                  background: active ? '#17402c' : 'transparent',
                  color: active ? '#fff' : '#17402c',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {lbl}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="lkdv-carnet-btn-soft"
          style={{
            height: 30,
            padding: '0 12px',
            borderRadius: 999,
            fontSize: 11.5,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
          onClick={() => setSheetOpen(true)}
        >
          <Plus size={13} aria-hidden="true" />
          <span>Ajouter</span>
        </button>
      </div>

      {/* LISTE ÉPURÉE (3 LIGNES CLAIRES PAR CARTE, ZÉRO ENCOMBREMENT) */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 18, fontSize: 12, color: '#56665d' }}>
          Chargement des trajets…
        </div>
      ) : visibleTransports.length === 0 ? (
        <div
          className="club-glass-card"
          style={{
            padding: '20px 14px',
            borderRadius: 18,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Car size={20} color="#56665d" />
          <div style={{ fontSize: 13, fontWeight: 700, color: '#172b24' }}>
            Aucun trajet publié
          </div>
          <p style={{ margin: 0, fontSize: 11.5, color: '#56665d', maxWidth: 250 }}>
            Propose des places ou indique que tu cherches un trajet.
          </p>
        </div>
      ) : (
        visibleTransports.map((t, tIdx) => {
          const isReq = isPassengerRequest(t);
          const isOrganizer = Boolean(currentUserId && t.organizerId === currentUserId);
          const isBooked = Boolean(t.myBookingLeg);
          const driver = resolvePerson(t.organizerId, t.organizerName, t.organizerAvatarUrl, tIdx);
          const seatsLeft = legFilter === 'retour' ? t.seatsLeftRetour : t.seatsLeftAller;
          const outTime = formatClockLabel(t.outboundDepartureAt);
          const retTimeStr = formatClockLabel(t.returnDepartureAt);
          const isPicking = pickingLegForId === t.id;

          return (
            <div
              key={t.id}
              className="club-glass-card"
              style={{
                padding: '12px 14px',
                borderRadius: 18,
                border: isBooked ? '1px solid rgba(23, 64, 44, 0.34)' : undefined,
                display: 'flex',
                flexDirection: 'column',
                gap: 9,
              }}
            >
              {/* Ligne 1 : Qui + Mode + Badge places */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  {driver.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={driver.avatarUrl}
                      alt={driver.name}
                      style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flex: 'none' }}
                    />
                  ) : (
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: isReq ? 'rgba(217, 119, 6, 0.14)' : 'rgba(23, 64, 44, 0.12)',
                        color: isReq ? '#b45309' : '#17402c',
                        fontSize: 12,
                        fontWeight: 800,
                        display: 'inline-grid',
                        placeItems: 'center',
                        flex: 'none',
                      }}
                    >
                      {isReq ? <Hand size={14} /> : driver.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#172b24', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {driver.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#56665d', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {modeIcon(t.mode, 11)}
                      <span>
                        {isReq ? 'Cherche une place' : modeLabel(t.mode)}
                        {!isReq && t.costShareCents > 0 ? ` · ${(t.costShareCents / 100).toFixed(0)} €` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none' }}>
                  <span
                    className={isReq ? 'club-badge-soft' : seatsLeft > 0 ? 'club-badge-sage' : 'club-badge-soft'}
                    style={{
                      fontSize: 11,
                      color: isReq ? '#b45309' : undefined,
                      background: isReq ? 'rgba(217, 119, 6, 0.12)' : undefined,
                    }}
                  >
                    {isReq ? 'Demande' : seatsLeft > 0 ? `${seatsLeft} place${seatsLeft > 1 ? 's' : ''}` : 'Complet'}
                  </span>
                  {isOrganizer ? (
                    <button
                      type="button"
                      aria-label="Supprimer"
                      onClick={() => void onDeleteTransport(t.id)}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        border: 0,
                        background: 'rgba(185, 28, 28, 0.08)',
                        color: '#b91c1c',
                        display: 'inline-grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Ligne 2 : Lieu + Horaires clairs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#172b24', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MapPin size={13} color="#17402c" style={{ flex: 'none' }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.direction === 'retour'
                      ? `${t.returnFromLabel || 'Arrivée'} → ${t.returnToLabel || t.outboundFromLabel}`
                      : t.outboundFromLabel}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: '#56665d', display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 18 }}>
                  <Clock size={11} style={{ flex: 'none' }} />
                  <span>
                    {[
                      outTime && t.direction !== 'retour' ? `Aller ${outTime}` : null,
                      retTimeStr && t.direction !== 'aller' ? `Retour ${retTimeStr}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || (t.direction === 'aller_retour' ? 'Aller & Retour' : t.direction)}
                  </span>
                </div>
              </div>

              {/* Ligne 3 : Avatars passagers + 1 SEUL bouton d'action */}
              {!isReq ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {t.bookings.length > 0 ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {t.bookings.slice(0, 4).map((b, bIdx) => {
                            const pax = resolvePerson(b.userId, b.userName, b.userAvatarUrl, tIdx + bIdx + 2);
                            return pax.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={b.id}
                                src={pax.avatarUrl}
                                alt={pax.name}
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: '2px solid #fff',
                                  marginLeft: bIdx > 0 ? -7 : 0,
                                }}
                              />
                            ) : (
                              <span
                                key={b.id}
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: '50%',
                                  background: '#5b7f55',
                                  color: '#fff',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  display: 'inline-grid',
                                  placeItems: 'center',
                                  border: '2px solid #fff',
                                  marginLeft: bIdx > 0 ? -7 : 0,
                                }}
                              >
                                {pax.name.slice(0, 1).toUpperCase()}
                              </span>
                            );
                          })}
                        </div>
                        <span style={{ fontSize: 11, color: '#56665d' }}>
                          {t.bookings.length} passager{t.bookings.length > 1 ? 's' : ''}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: 11, color: '#56665d' }}>
                        {t.gearNotes || 'Aucune réservation'}
                      </span>
                    )}
                  </div>

                  {!isOrganizer ? (
                    isBooked ? (
                      <button
                        type="button"
                        className="lkdv-carnet-btn-soft"
                        style={{ height: 30, padding: '0 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 700 }}
                        onClick={() => void onCancelBooking(t.id)}
                      >
                        <Check size={12} />
                        <span>Inscrit · Annuler</span>
                      </button>
                    ) : seatsLeft > 0 ? (
                      <button
                        type="button"
                        className="lkdv-carnet-btn-soft"
                        style={{ height: 30, padding: '0 14px', borderRadius: 999, fontSize: 11.5, fontWeight: 700 }}
                        onClick={() => {
                          if (t.direction === 'aller_retour') {
                            setPickingLegForId(isPicking ? null : t.id);
                          } else {
                            void onBookSeat(t.id, t.direction);
                          }
                        }}
                      >
                        Réserver
                      </button>
                    ) : null
                  ) : null}
                </div>
              ) : null}

              {/* Choix rapide Aller/Retour uniquement au clic sur Réserver */}
              {isPicking ? (
                <div style={{ display: 'flex', gap: 6, paddingTop: 4, borderTop: '0.5px solid rgba(23, 64, 44, 0.08)' }}>
                  {t.seatsLeftAller > 0 && t.seatsLeftRetour > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPickingLegForId(null);
                        void onBookSeat(t.id, 'aller_retour');
                      }}
                      style={{
                        flex: 1,
                        height: 30,
                        borderRadius: 999,
                        border: 0,
                        background: '#17402c',
                        color: '#fff',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Aller & Retour
                    </button>
                  ) : null}
                  {t.seatsLeftAller > 0 ? (
                    <button
                      type="button"
                      className="lkdv-carnet-btn-soft"
                      style={{ flex: 1, height: 30, borderRadius: 999, justifyContent: 'center', fontSize: 11.5, fontWeight: 600 }}
                      onClick={() => {
                        setPickingLegForId(null);
                        void onBookSeat(t.id, 'aller');
                      }}
                    >
                      Aller seul
                    </button>
                  ) : null}
                  {t.seatsLeftRetour > 0 ? (
                    <button
                      type="button"
                      className="lkdv-carnet-btn-soft"
                      style={{ flex: 1, height: 30, borderRadius: 999, justifyContent: 'center', fontSize: 11.5, fontWeight: 600 }}
                      onClick={() => {
                        setPickingLegForId(null);
                        void onBookSeat(t.id, 'retour');
                      }}
                    >
                      Retour seul
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })
      )}

      {/* FEUILLE MODALE PORTALISÉE LIQUID GLASS — MODERNE & ÉPURÉE */}
      {sheetOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Ajouter mon trajet"
              onClick={() => setSheetOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1300,
                background: 'rgba(14, 24, 19, 0.44)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                padding: 10,
              }}
            >
              <form
                onSubmit={handleSubmitEntry}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  maxWidth: 420,
                  maxHeight: '86vh',
                  overflowY: 'auto',
                  borderRadius: 28,
                  background: 'rgba(248, 247, 242, 0.96)',
                  backdropFilter: 'blur(24px)',
                  border: '0.5px solid rgba(23, 64, 44, 0.14)',
                  boxShadow: '0 24px 60px rgba(11, 31, 23, 0.30)',
                  padding: '10px 16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                {/* Poignée iOS */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 36,
                      height: 4,
                      borderRadius: 999,
                      background: 'rgba(23, 64, 44, 0.18)',
                    }}
                  />
                </div>

                {/* En-tête sobre */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 16, fontWeight: 700, color: '#172b24', letterSpacing: '-0.01em' }}>
                    Ajouter un trajet
                  </strong>
                  <button
                    type="button"
                    onClick={() => setSheetOpen(false)}
                    aria-label="Fermer"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      border: 0,
                      background: 'rgba(23, 64, 44, 0.08)',
                      color: '#172b24',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Contrôle segmenté iOS animé : Je propose / Je cherche */}
                <div
                  role="tablist"
                  aria-label="Type d'annonce"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    padding: 3,
                    borderRadius: 999,
                    background: 'rgba(23, 64, 44, 0.08)',
                    position: 'relative',
                  }}
                >
                  {(
                    [
                      ['offer', 'Je propose'],
                      ['request', 'Je cherche'],
                    ] as const
                  ).map(([k, lbl]) => {
                    const active = entryKind === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setEntryKind(k)}
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          height: 34,
                          borderRadius: 999,
                          border: 0,
                          background: 'transparent',
                          color: active ? '#172b24' : '#56665d',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {active ? (
                          <motion.span
                            layoutId="lkdv-transport-kind-thumb"
                            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                            style={{
                              position: 'absolute',
                              inset: 0,
                              borderRadius: 999,
                              background: '#fff',
                              boxShadow: '0 2px 8px rgba(23, 43, 36, 0.10)',
                              zIndex: -1,
                            }}
                          />
                        ) : null}
                        {lbl}
                      </button>
                    );
                  })}
                </div>

                {/* Grille 4 tuiles sur 1 seule ligne (jamais d'orphelin) */}
                {entryKind === 'offer' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {(
                      [
                        ['carpool', 'Covoit.'],
                        ['minibus_club', 'Minibus'],
                        ['train', 'Train'],
                        ['bus', 'Navette'],
                      ] as const
                    ).map(([m, shortLbl]) => {
                      const active = mode === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMode(m)}
                          style={{
                            height: 56,
                            borderRadius: 16,
                            border: active
                              ? '1.5px solid #17402c'
                              : '0.5px solid rgba(23, 64, 44, 0.12)',
                            background: active ? 'rgba(23, 64, 44, 0.09)' : '#fff',
                            color: active ? '#17402c' : '#56665d',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            fontSize: 11,
                            fontWeight: active ? 700 : 600,
                            cursor: 'pointer',
                          }}
                        >
                          {modeIcon(m, 16)}
                          <span>{shortLbl}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {/* Carte groupée iOS : Sens + Point de départ + Horaires */}
                <div
                  style={{
                    borderRadius: 20,
                    background: '#fff',
                    border: '0.5px solid rgba(23, 64, 44, 0.10)',
                    boxShadow: '0 2px 10px rgba(23, 43, 36, 0.04)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Sens intégré sur 1 ligne */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      padding: 6,
                      gap: 4,
                      borderBottom: '0.5px solid rgba(23, 64, 44, 0.08)',
                    }}
                  >
                    {(
                      [
                        ['aller_retour', 'Aller & Retour'],
                        ['aller', 'Aller'],
                        ['retour', 'Retour'],
                      ] as const
                    ).map(([d, lbl]) => {
                      const active = direction === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDirection(d)}
                          style={{
                            height: 30,
                            borderRadius: 12,
                            border: 0,
                            background: active ? 'rgba(23, 64, 44, 0.10)' : 'transparent',
                            color: active ? '#17402c' : '#56665d',
                            fontSize: 11.5,
                            fontWeight: active ? 700 : 600,
                            cursor: 'pointer',
                          }}
                        >
                          {lbl}
                        </button>
                      );
                    })}
                  </div>

                  {/* Lieu de départ sans bordure */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '12px 14px',
                      borderBottom: '0.5px solid rgba(23, 64, 44, 0.08)',
                    }}
                  >
                    <MapPin size={16} color="#17402c" style={{ flex: 'none' }} />
                    <input
                      type="text"
                      required
                      aria-label="Point de départ"
                      value={fromLabel}
                      onChange={(e) => setFromLabel(e.target.value)}
                      placeholder={
                        entryKind === 'request'
                          ? 'Ville ou quartier de départ…'
                          : 'Point de RDV (gare, parking, ville)…'
                      }
                      style={{
                        flex: 1,
                        minWidth: 0,
                        border: 0,
                        outline: 'none',
                        background: 'transparent',
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#172b24',
                      }}
                    />
                  </div>

                  {/* Horaires côte à côte dans la même carte */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        direction === 'aller_retour' ? '1fr 0.5px 1fr' : '1fr',
                      alignItems: 'center',
                    }}
                  >
                    {direction !== 'retour' ? (
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                          padding: '11px 14px',
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#56665d',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={14} color="#56665d" />
                          Aller
                        </span>
                        <input
                          type="time"
                          value={depTime}
                          onChange={(e) => setDepTime(e.target.value)}
                          style={{
                            border: 0,
                            outline: 'none',
                            background: 'transparent',
                            fontSize: 14,
                            fontWeight: 700,
                            color: '#172b24',
                            textAlign: 'right',
                            width: 78,
                          }}
                        />
                      </label>
                    ) : null}

                    {direction === 'aller_retour' ? (
                      <div
                        aria-hidden="true"
                        style={{ height: 24, background: 'rgba(23, 64, 44, 0.10)' }}
                      />
                    ) : null}

                    {direction !== 'aller' ? (
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                          padding: '11px 14px',
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#56665d',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={14} color="#56665d" />
                          Retour
                        </span>
                        <input
                          type="time"
                          value={retTime}
                          onChange={(e) => setRetTime(e.target.value)}
                          style={{
                            border: 0,
                            outline: 'none',
                            background: 'transparent',
                            fontSize: 14,
                            fontWeight: 700,
                            color: '#172b24',
                            textAlign: 'right',
                            width: 78,
                          }}
                        />
                      </label>
                    ) : null}
                  </div>
                </div>

                {/* Stepper moderne pour les places (uniquement si Je propose) */}
                {entryKind === 'offer' ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 18,
                      background: '#fff',
                      border: '0.5px solid rgba(23, 64, 44, 0.10)',
                      boxShadow: '0 2px 10px rgba(23, 43, 36, 0.04)',
                    }}
                  >
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#172b24' }}>
                      Places disponibles
                    </span>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                      <button
                        type="button"
                        aria-label="Diminuer le nombre de places"
                        disabled={seatsTotal <= 1}
                        onClick={() => setSeatsTotal((s) => Math.max(1, s - 1))}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          border: '0.5px solid rgba(23, 64, 44, 0.16)',
                          background: seatsTotal <= 1 ? 'rgba(23, 64, 44, 0.04)' : '#fff',
                          color: seatsTotal <= 1 ? '#9aa69f' : '#17402c',
                          display: 'grid',
                          placeItems: 'center',
                          cursor: seatsTotal <= 1 ? 'default' : 'pointer',
                        }}
                      >
                        <Minus size={14} />
                      </button>
                      <span
                        style={{
                          minWidth: 18,
                          textAlign: 'center',
                          fontSize: 15,
                          fontWeight: 700,
                          color: '#172b24',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {seatsTotal}
                      </span>
                      <button
                        type="button"
                        aria-label="Augmenter le nombre de places"
                        disabled={seatsTotal >= 20}
                        onClick={() => setSeatsTotal((s) => Math.min(20, s + 1))}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          border: 0,
                          background: '#17402c',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Options secondaires repliées par défaut (Frais + Coffre/Note) */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowExtras((v) => !v)}
                    style={{
                      border: 0,
                      background: 'transparent',
                      padding: '2px 4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#56665d',
                      cursor: 'pointer',
                    }}
                  >
                    <ChevronDown
                      size={14}
                      style={{
                        transform: showExtras ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.18s ease',
                      }}
                    />
                    <span>
                      {entryKind === 'offer'
                        ? 'Options (frais, coffre / matériel)'
                        : 'Ajouter une note (optionnel)'}
                    </span>
                  </button>

                  {showExtras ? (
                    <div
                      style={{
                        marginTop: 8,
                        borderRadius: 18,
                        background: '#fff',
                        border: '0.5px solid rgba(23, 64, 44, 0.10)',
                        overflow: 'hidden',
                      }}
                    >
                      {entryKind === 'offer' ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderBottom: '0.5px solid rgba(23, 64, 44, 0.08)',
                            gap: 8,
                          }}
                        >
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#56665d' }}>
                            Frais / pers.
                          </span>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            {(['0', '5', '10'] as const).map((preset) => {
                              const active = costEuros === preset;
                              return (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setCostEuros(preset)}
                                  style={{
                                    height: 26,
                                    padding: '0 9px',
                                    borderRadius: 999,
                                    border: 0,
                                    background: active ? '#17402c' : 'rgba(23, 64, 44, 0.07)',
                                    color: active ? '#fff' : '#17402c',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  {preset === '0' ? 'Gratuit' : `${preset} €`}
                                </button>
                              );
                            })}
                            <input
                              type="number"
                              min={0}
                              max={200}
                              aria-label="Frais personnalisés en euros"
                              value={costEuros}
                              onChange={(e) => setCostEuros(e.target.value)}
                              style={{
                                width: 46,
                                height: 26,
                                borderRadius: 8,
                                border: '0.5px solid rgba(23, 64, 44, 0.18)',
                                textAlign: 'center',
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#172b24',
                              }}
                            />
                          </div>
                        </div>
                      ) : null}

                      <input
                        type="text"
                        aria-label="Note ou matériel"
                        value={gearNotes}
                        onChange={(e) => setGearNotes(e.target.value)}
                        placeholder={
                          entryKind === 'offer'
                            ? 'Coffre, porte-skis, point précis…'
                            : 'Sac 45 L, bâtons, horaire flexible…'
                        }
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          border: 0,
                          outline: 'none',
                          padding: '11px 14px',
                          background: 'transparent',
                          fontSize: 13,
                          color: '#172b24',
                        }}
                      />
                    </div>
                  ) : null}
                </div>

                {/* CTA principal pilule */}
                <button
                  type="submit"
                  disabled={submitting || !fromLabel.trim()}
                  style={{
                    height: 46,
                    borderRadius: 999,
                    border: 0,
                    background: '#17402c',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: submitting || !fromLabel.trim() ? 'default' : 'pointer',
                    opacity: submitting || !fromLabel.trim() ? 0.55 : 1,
                    boxShadow: '0 8px 20px rgba(23, 64, 44, 0.22)',
                  }}
                >
                  {submitting
                    ? 'Publication…'
                    : entryKind === 'request'
                      ? 'Publier ma recherche'
                      : 'Publier le trajet'}
                </button>
              </form>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
