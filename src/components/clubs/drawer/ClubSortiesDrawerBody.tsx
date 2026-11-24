'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CalendarCheck,
  CalendarPlus,
  Car,
  Check,
  CheckCircle2,
  ChevronLeft,
  CloudSun,
  Compass,
  Download,
  ExternalLink,
  Layers,
  MapPin,
  Mountain,
  Package,
  Plus,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Users,
  Wind,
  X,
} from 'lucide-react';
import { CarnetHorizontalTimeline } from '@/components/carnet/v2/CarnetHorizontalTimeline';
import { generatedProductImage } from '@/components/compte/drawer/cards/productImage';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ClubG02Workspace } from '@/components/clubs/g02';
import '@/styles/communaute-v2.css';
import '@/features/community/v2/explore/explore-v2.css';
import { EventTicket } from '@/features/community/v2/shared/EventTicket';
import type { EventCardVM } from '@/features/community/v2/shared/types';
import {
  AnimatedNumber,
  ClubStaggerCard,
  ClubStaggerList,
  LensTransition,
  StackSlideView,
} from './ClubDrawerMotion';
import { ClubEmptyCard } from './ClubSharedUi';
import type { ClubOutingData, ClubSortiesDrawerBodyProps } from './ClubDrawerTypes';

export type OutingFilterId = 'all' | 'weekend' | 'carpool' | 'joined' | 'available';
type OutingDetailLensId = 'overview' | 'carpool' | 'gear' | 'participants';
export type WeatherWindowId = 'morning' | 'afternoon' | 'weekend';

interface CarpoolVehicle {
  id: string;
  driverName: string;
  driverHandle: string;
  departureCity: string;
  departureTime: string;
  totalSeats: number;
  takenSeats: number;
  bookedByMe?: boolean;
  gearRack: string;
}

interface TerrainReport {
  id: string;
  author: string;
  time: string;
  category: 'sentier' | 'neve' | 'vent' | 'eau';
  text: string;
  severity: 'ok' | 'warn';
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function buildElevationPoints(outing: ClubOutingData): Array<{ km: number; alt: number; label: string }> {
  const totalKm = Math.max(4, outing.km || 14);
  const maxAlt = Math.max(450, outing.maxAlt || 1850);
  const baseAlt = Math.max(150, maxAlt - Math.max(300, outing.dplus || 850));
  return [
    { km: 0, alt: baseAlt, label: `Départ · ${outing.carpoolCity || outing.massif}` },
    { km: +(totalKm * 0.22).toFixed(1), alt: Math.round(baseAlt + (maxAlt - baseAlt) * 0.35), label: 'Forêt & Balise 1' },
    { km: +(totalKm * 0.48).toFixed(1), alt: Math.round(baseAlt + (maxAlt - baseAlt) * 0.78), label: 'Col intermédiaire' },
    { km: +(totalKm * 0.65).toFixed(1), alt: maxAlt, label: `Sommet · ${maxAlt} m` },
    { km: +(totalKm * 0.84).toFixed(1), alt: Math.round(baseAlt + (maxAlt - baseAlt) * 0.42), label: 'Refuge & Crête retour' },
    { km: totalKm, alt: baseAlt + 40, label: 'Arrivée parking' },
  ];
}

export function ClubSortiesDrawerBody({
  activeSubTab,
  active = true,
  activeClub,
  outings,
  members,
  vaultGear,
  inspectedOuting,
  onInspectOuting,
  onToggleRsvpOuting,
  onCreateGroupFromOuting,
  onDownloadGpx,
  onFlyToCoords,
  onSwitchTab,
  onToast,
  weatherWindow: controlledWeatherWindow,
  outingFilter: controlledOutingFilter,
}: ClubSortiesDrawerBodyProps & {
  weatherWindow?: WeatherWindowId;
  outingFilter?: OutingFilterId;
}) {
  // D09 — Upcoming outings filter & search state (controlled from bottom-right SortMenuButton)
  const outingFilter = controlledOutingFilter ?? 'all';
  const [searchQuery, setSearchQuery] = useState('');

  // D13 — Inspected Outing sub-lens state
  const [detailLens, setDetailLens] = useState<OutingDetailLensId>('overview');
  const [hoverPointIdx, setHoverPointIdx] = useState<number>(3);
  const [checkedGearMap, setCheckedGearMap] = useState<Record<string, boolean>>({});
  const [bookedVehicles, setBookedVehicles] = useState<Record<string, boolean>>({});
  const [customVehicles, setCustomVehicles] = useState<Record<string, CarpoolVehicle[]>>({});
  const [newCarCity, setNewCarCity] = useState('');
  const [newCarSeats, setNewCarSeats] = useState('3');
  const [showAddCarForm, setShowAddCarForm] = useState(false);

  // D10 — Weather & terrain reports state (controlled from bottom-right SortMenuButton)
  const weatherWindow = controlledWeatherWindow ?? 'morning';
  const [reportDraft, setReportDraft] = useState('');
  const [reportCategory, setReportCategory] = useState<TerrainReport['category']>('sentier');
  const [terrainReports, setTerrainReports] = useState<TerrainReport[]>([
    {
      id: 'rep-1',
      author: 'Marc (@marc_alpi)',
      time: 'Il y a 2h',
      category: 'sentier',
      text: 'Sentier sec jusqu’à 2 100 m, balisage bien visible et source active au refuge.',
      severity: 'ok',
    },
    {
      id: 'rep-2',
      author: 'Léa (@lea.fontaine)',
      time: 'Hier · 18h30',
      category: 'vent',
      text: 'Rafales modérées sur la crête sommitale après 13h, coupe-vent indispensable.',
      severity: 'warn',
    },
  ]);

  const upcomingOutings = useMemo(
    () => outings.filter((o) => o.status !== 'completed' && o.status !== 'cancelled'),
    [outings],
  );

  const filteredUpcoming = useMemo(() => {
    const q = normalizeText(searchQuery.trim());
    return upcomingOutings.filter((o) => {
      if (outingFilter === 'carpool' && (o.carpoolSeatsLeft ?? 0) <= 0) return false;
      if (outingFilter === 'joined' && !o.rsvpJoined) return false;
      if (outingFilter === 'available' && o.participantsCount >= o.maxParticipants) return false;
      if (outingFilter === 'weekend') {
        const d = normalizeText(o.date || '');
        const isWe = d.includes('sam') || d.includes('dim') || d.includes('nov') || d.includes('we');
        if (!isWe && upcomingOutings.length > 1) return false;
      }
      if (!q) return true;
      const haystack = normalizeText(
        `${o.title} ${o.massif} ${o.leaderName} ${o.carpoolCity} ${(o.requiredGear ?? []).join(' ')}`,
      );
      return haystack.includes(q);
    });
  }, [upcomingOutings, outingFilter, searchQuery]);

  const upcomingKpis = useMemo(() => {
    const totalSeats = upcomingOutings.reduce((acc, o) => acc + Math.max(0, o.carpoolSeatsLeft || 0), 0);
    const totalDplus = upcomingOutings.reduce((acc, o) => acc + Math.max(0, o.dplus || 0), 0);
    const joinedCount = upcomingOutings.filter((o) => o.rsvpJoined).length;
    return {
      count: upcomingOutings.length,
      totalSeats,
      totalDplus,
      joinedCount,
    };
  }, [upcomingOutings]);

  // ============================================================================
  // D13 — FICHE SORTIE & COVOITURAGE (Multi-lens Carnet-grade detail view)
  // ============================================================================
  if (inspectedOuting) {
    const elevationPoints = buildElevationPoints(inspectedOuting);
    const activePoint = elevationPoints[Math.min(hoverPointIdx, elevationPoints.length - 1)] || elevationPoints[0];
    const requiredGearList =
      inspectedOuting.requiredGear && inspectedOuting.requiredGear.length > 0
        ? inspectedOuting.requiredGear
        : ['Chaussures crantées', 'Coupe-vent imperméable', 'Eau 2L & Réserve énergétique', 'Fond de sac sécurité'];

    const readyGearCount = requiredGearList.filter(
      (g) => checkedGearMap[`${inspectedOuting.id}:${g}`],
    ).length;
    const gearReadyPct = Math.round((readyGearCount / Math.max(1, requiredGearList.length)) * 100);

    const baseVehicles: CarpoolVehicle[] = [
      {
        id: `${inspectedOuting.id}-v1`,
        driverName: inspectedOuting.leaderName || 'Encadrant Club',
        driverHandle: inspectedOuting.leaderHandle || 'guide_club',
        departureCity: inspectedOuting.carpoolCity || activeClub.massif,
        departureTime: '06h30 · Parking Relais',
        totalSeats: 4,
        takenSeats: Math.max(1, 4 - Math.max(1, inspectedOuting.carpoolSeatsLeft || 2)),
        gearRack: 'Coffre + Porte-skis / Sacs 50L',
      },
      {
        id: `${inspectedOuting.id}-v2`,
        driverName: members[1]?.name || 'Léa Fontaine',
        driverHandle: members[1]?.handle || 'lea.fontaine',
        departureCity: `${inspectedOuting.carpoolCity || 'Gare SNCF'} · Centre`,
        departureTime: '06h45 · Devant la gare',
        totalSeats: 3,
        takenSeats: 2,
        gearRack: 'Break compact · 3 sacs rando',
      },
    ];
    const vehicles = [...baseVehicles, ...(customVehicles[inspectedOuting.id] ?? [])];
    const fillPct = Math.min(
      100,
      Math.round(
        ((inspectedOuting.participantsCount + (inspectedOuting.rsvpJoined ? 0 : 0)) /
          Math.max(1, inspectedOuting.maxParticipants || 12)) *
          100,
      ),
    );
    const estHours = Math.max(
      2.5,
      +(((inspectedOuting.km || 12) / 4) + ((inspectedOuting.dplus || 600) / 400)).toFixed(1),
    );

    const detailLenses: Array<{ id: OutingDetailLensId; label: string }> = [
      { id: 'overview', label: 'Aperçu & Trace' },
      { id: 'carpool', label: `Covoiturage (${vehicles.length})` },
      { id: 'gear', label: `Matériel (${readyGearCount}/${requiredGearList.length})` },
      { id: 'participants', label: `Cordée (${inspectedOuting.participantsCount}/${inspectedOuting.maxParticipants})` },
    ];

    return (
      <div className="club-drawer-pane-content" data-testid="club-inspected-outing">
        <div
          className="club-stack-header"
          style={{
            background: 'rgba(251, 250, 246, 0.94)',
            backdropFilter: 'blur(16px)',
            borderRadius: 16,
            padding: '6px 8px',
            marginBottom: 8,
            position: 'sticky',
            top: 0,
            zIndex: 12,
          }}
        >
          <button
            type="button"
            className="lkdv-carnet-btn-soft"
            style={{ height: 30, padding: '0 10px', fontSize: 12 }}
            onClick={() => onInspectOuting(null)}
            aria-label="Toutes les sorties"
          >
            <ChevronLeft size={15} aria-hidden="true" />
            <span>Retour</span>
          </button>
          <b className="club-stack-title">Fiche Sortie</b>
        </div>

        <StackSlideView stackKey={`outing-${inspectedOuting.id}`}>
          <div
            className="club-glass-card"
            style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <b style={{ fontSize: 15, lineHeight: 1.25, color: 'var(--label)' }}>
                  {inspectedOuting.title}
                </b>
                <div style={{ fontSize: 12, color: 'var(--label2)', marginTop: 3 }}>
                  {inspectedOuting.date} · {inspectedOuting.massif}
                </div>
              </div>
              <span className={inspectedOuting.rsvpJoined ? 'club-badge-sage' : 'club-badge-soft'} style={{ flex: 'none' }}>
                {inspectedOuting.rsvpJoined ? 'Inscrit ✓' : inspectedOuting.status === 'live' ? 'En direct' : 'Ouvert'}
              </span>
            </div>

            <div className="lkdv-carnet-kpi-grid-3">
              <div className="lkdv-carnet-kpi-mini">
                <small>Distance</small>
                <b>{inspectedOuting.km} km</b>
              </div>
              <div className="lkdv-carnet-kpi-mini">
                <small>Dénivelé +</small>
                <b>+{inspectedOuting.dplus} m</b>
              </div>
              <div className="lkdv-carnet-kpi-mini">
                <small>Alt. max</small>
                <b>{inspectedOuting.maxAlt} m</b>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--label2)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span>Encadrant : <b style={{ color: 'var(--label)' }}>{inspectedOuting.leaderName}</b></span>
              <span>· {inspectedOuting.participantsCount}/{inspectedOuting.maxParticipants} inscrits</span>
              <span>· ~{estHours} h</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button
                type="button"
                className={inspectedOuting.rsvpJoined ? 'lkdv-carnet-btn-soft' : 'lkdv-carnet-btn-primary'}
                style={{ height: 32, padding: '0 12px', fontSize: 12 }}
                onClick={() => {
                  onToggleRsvpOuting(inspectedOuting.id);
                  onToast?.({
                    title: inspectedOuting.rsvpJoined ? 'Inscription annulée' : 'Inscription confirmée ✓',
                    subtitle: inspectedOuting.title,
                    undo: () => onToggleRsvpOuting(inspectedOuting.id),
                  });
                }}
                aria-label={inspectedOuting.rsvpJoined ? 'Inscrit à la sortie' : 'Participer'}
              >
                {inspectedOuting.rsvpJoined ? <CalendarCheck size={14} aria-hidden="true" /> : <CalendarPlus size={14} aria-hidden="true" />}
                <span>{inspectedOuting.rsvpJoined ? 'Inscrit ✓' : 'Participer'}</span>
              </button>
              <button
                type="button"
                className="lkdv-carnet-btn-soft"
                style={{ height: 32, padding: '0 10px', fontSize: 12 }}
                onClick={() => onFlyToCoords(inspectedOuting.lat, inspectedOuting.lng, inspectedOuting.title)}
                aria-label="Trace 3D"
              >
                <MapPin size={14} aria-hidden="true" />
                <span>Carte</span>
              </button>
              <button
                type="button"
                className="lkdv-carnet-btn-soft"
                style={{ height: 32, padding: '0 10px', fontSize: 12 }}
                onClick={() => {
                  onDownloadGpx(inspectedOuting);
                  onToast?.({ title: 'Trace GPX téléchargée', subtitle: `${inspectedOuting.title} (${inspectedOuting.km} km)` });
                }}
                aria-label="Télécharger le GPX"
              >
                <Download size={14} aria-hidden="true" />
                <span>GPX</span>
              </button>
              <button
                type="button"
                className="lkdv-carnet-btn-soft"
                style={{ height: 32, padding: '0 10px', fontSize: 12 }}
                onClick={() => {
                  onCreateGroupFromOuting(inspectedOuting);
                  onToast?.({ title: 'Groupe de cordée initialisé', subtitle: inspectedOuting.title });
                }}
                aria-label="Créer un groupe de voyage"
              >
                <Users size={14} aria-hidden="true" />
                <span>Cordée</span>
              </button>
            </div>
          </div>

          <div className="club-filter-rail" role="tablist" aria-label="Sections de la fiche sortie" style={{ marginTop: 8 }}>
            {detailLenses.map((l) => {
              const isCur = detailLens === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  role="tab"
                  aria-selected={isCur}
                  className={`club-filter-pill ${isCur ? 'is-active' : ''}`}
                  onClick={() => setDetailLens(l.id)}
                >
                  {isCur ? <span className="club-filter-pill-bg" /> : null}
                  <span className="club-filter-pill-label">{l.label}</span>
                </button>
              );
            })}
          </div>

          <LensTransition transitionKey={`outing-detail-${detailLens}`}>
            {detailLens === 'overview' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                <div className="club-glass-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b style={{ fontSize: 13, color: 'var(--label)' }}>Profil altimétrique</b>
                    <span className="club-badge-sage">
                      Km {activePoint.km} · {activePoint.alt} m
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--label2)' }}>{activePoint.label}</div>
                  {typeof window !== 'undefined' && typeof window.ResizeObserver !== 'undefined' && !/jsdom/i.test(window.navigator?.userAgent || '') ? (
                    <div style={{ width: '100%', height: 110 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={elevationPoints} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
                          <defs>
                            <linearGradient id="clubOutingElevGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#17402c" stopOpacity={0.32} />
                              <stop offset="95%" stopColor="#17402c" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="km" tickFormatter={(v) => `${v}km`} tick={{ fontSize: 10, fill: '#56665d' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#56665d' }} axisLine={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{ borderRadius: 12, border: '1px solid rgba(23,64,44,0.14)', background: 'rgba(255,255,255,0.96)', fontSize: 11.5 }}
                            formatter={(val: number | string) => [`${val} m`, 'Altitude']}
                          />
                          <Area type="monotone" dataKey="alt" stroke="#17402c" strokeWidth={2.2} fill="url(#clubOutingElevGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--label2)' }}>
                      {elevationPoints.map((pt) => `Km ${pt.km} (${pt.alt} m)`).join(' → ')}
                    </div>
                  )}
                </div>

                <div className="club-glass-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b style={{ fontSize: 13, color: 'var(--label)' }}>Matériel recommandé</b>
                    <button
                      type="button"
                      className="lkdv-carnet-btn-soft"
                      style={{ height: 26, padding: '0 10px', fontSize: 11 }}
                      onClick={() => setDetailLens('gear')}
                    >
                      Checklist ({readyGearCount}/{requiredGearList.length})
                    </button>
                  </div>
                  <div className="lkdv-carnet-kit-plus-row">
                    {requiredGearList.map((g) => (
                      <button
                        key={g}
                        type="button"
                        className="lkdv-carnet-kit-mini-tile"
                        onClick={() => setDetailLens('gear')}
                      >
                        <div className="lkdv-carnet-kit-mini-tile-top">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={generatedProductImage(g, 96)}
                            alt=""
                            loading="lazy"
                            style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }}
                          />
                        </div>
                        <b title={g}>{g}</b>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {detailLens === 'carpool' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="s2">
                    Départ groupé : <b>{inspectedOuting.carpoolCity}</b>
                  </span>
                  <button
                    type="button"
                    className="reseau-btn active"
                    style={{ fontSize: 11.5 }}
                    onClick={() => setShowAddCarForm((v) => !v)}
                  >
                    <Car size={13} aria-hidden="true" />{' '}
                    <span>{showAddCarForm ? 'Fermer' : '+ Proposer un véhicule'}</span>
                  </button>
                </div>

                {showAddCarForm ? (
                  <div
                    className="li nt club-glass-card"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}
                  >
                    <b style={{ fontSize: 12.5 }}>Ajouter ma voiture au convoi</b>
                    <div className="club-form-grid-2">
                      <input
                        type="text"
                        className="club-glass-input"
                        placeholder="Ville / Point de RDV"
                        aria-label="Ville de départ du véhicule"
                        value={newCarCity}
                        onChange={(e) => setNewCarCity(e.target.value)}
                      />
                      <input
                        type="number"
                        className="club-glass-input"
                        placeholder="Places dispo"
                        aria-label="Nombre de places disponibles"
                        min={1}
                        max={8}
                        value={newCarSeats}
                        onChange={(e) => setNewCarSeats(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="reseau-btn primary"
                      onClick={() => {
                        const seats = Math.max(1, Number(newCarSeats) || 3);
                        const v: CarpoolVehicle = {
                          id: `${inspectedOuting.id}-v-${Date.now()}`,
                          driverName: 'Mon Véhicule (Cordée)',
                          driverHandle: 'moi',
                          departureCity: newCarCity.trim() || inspectedOuting.carpoolCity,
                          departureTime: '06h30 · RDV Covoiturage',
                          totalSeats: seats + 1,
                          takenSeats: 1,
                          bookedByMe: true,
                          gearRack: 'Coffre rando partagé',
                        };
                        setCustomVehicles((prev) => ({
                          ...prev,
                          [inspectedOuting.id]: [...(prev[inspectedOuting.id] ?? []), v],
                        }));
                        setNewCarCity('');
                        setShowAddCarForm(false);
                        onToast?.({
                          title: 'Véhicule ajouté au covoiturage',
                          subtitle: `${v.departureCity} (+${seats} places)`,
                        });
                      }}
                    >
                      Publier mon véhicule
                    </button>
                  </div>
                ) : null}

                {vehicles.map((v) => {
                  const isBooked = Boolean(bookedVehicles[v.id] || v.bookedByMe);
                  const taken = Math.min(v.totalSeats, v.takenSeats + (bookedVehicles[v.id] ? 1 : 0));
                  const seatsLeft = Math.max(0, v.totalSeats - taken);
                  return (
                    <div
                      key={v.id}
                      className="li nt club-glass-card"
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="ttl">
                          <b>{v.driverName}</b> <span className="s2">(@{v.driverHandle})</span>
                        </div>
                        <span className={seatsLeft > 0 ? 'club-badge-sage' : 'club-badge-soft'}>
                          {seatsLeft > 0 ? `${seatsLeft} pl. dispo` : 'Complet'}
                        </span>
                      </div>
                      <div className="s2">
                        📍 {v.departureCity} · 🕕 {v.departureTime}
                      </div>
                      <div className="s2">🎒 {v.gearRack}</div>
                      <button
                        type="button"
                        className={`reseau-btn ${isBooked ? 'active' : 'primary'}`}
                        style={{ marginTop: 4 }}
                        onClick={() => {
                          setBookedVehicles((prev) => ({ ...prev, [v.id]: !prev[v.id] }));
                          onToast?.({
                            title: isBooked ? 'Place covoiturage libérée' : 'Place covoiturage réservée ✓',
                            subtitle: `${v.driverName} · ${v.departureCity}`,
                          });
                        }}
                      >
                        {isBooked ? 'Place réservée ✓ (Libérer)' : 'Réserver une place'}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {detailLens === 'gear' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                <div
                  className="li nt club-glass-card"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b style={{ fontSize: 12.5 }}>Préparation du sac pour la sortie</b>
                    <span className="club-badge-sage">{gearReadyPct}% prêt</span>
                  </div>
                  <div className="club-progress-track" aria-label={`${gearReadyPct}% du matériel prêt`}>
                    <div className="club-progress-fill" style={{ width: `${gearReadyPct}%` }} />
                  </div>
                </div>

                {vaultGear.filter((vg) => vg.eventId === inspectedOuting.id).length > 0 ? (
                  <div className="club-glass-card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <b style={{ fontSize: 12 }}>Matériel réservé pour cette sortie</b>
                    {vaultGear
                      .filter((vg) => vg.eventId === inspectedOuting.id)
                      .map((vg) => (
                        <div key={vg.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span>{vg.name}</span>
                          <span className="club-badge-sage">{vg.loanStatus || 'Réservé'}</span>
                        </div>
                      ))}
                  </div>
                ) : null}

                {requiredGearList.map((gearName) => {
                  const key = `${inspectedOuting.id}:${gearName}`;
                  const checked = Boolean(checkedGearMap[key]);
                  const matchingVault = vaultGear.find((vg) =>
                    normalizeText(vg.name).includes(normalizeText(gearName).slice(0, 5)),
                  );
                  return (
                    <div
                      key={gearName}
                      className="li nt club-glass-card"
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}
                    >
                      <div>
                        <div className="ttl">
                          <b>{gearName}</b>
                        </div>
                        <div className="s2">
                          {checked
                            ? 'Validé dans votre sac ✓'
                            : matchingVault
                              ? `Dispo au coffre : ${matchingVault.name} (${matchingVault.ownerName})`
                              : 'Obligatoire pour le départ'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {!checked && onSwitchTab ? (
                          <button
                            type="button"
                            className="reseau-btn active"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            onClick={() => onSwitchTab(3, 0)}
                            title="Emprunter au coffre du club"
                          >
                            <Package size={13} aria-hidden="true" />
                            <span>Emprunter au club</span>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={`reseau-btn ${checked ? 'active' : 'primary'} club-icon-pill`}
                          onClick={() =>
                            setCheckedGearMap((prev) => ({
                              ...prev,
                              [key]: !prev[key],
                            }))
                          }
                          aria-label={checked ? `${gearName} prêt` : `Cocher ${gearName}`}
                        >
                          <Check size={15} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {detailLens === 'participants' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                <div
                  className="li nt club-glass-card"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b style={{ fontSize: 12.5 }}>Remplissage de la cordée</b>
                    <span className="club-badge-sage">
                      {inspectedOuting.participantsCount}/{inspectedOuting.maxParticipants} places
                    </span>
                  </div>
                  <div className="club-progress-track">
                    <div className="club-progress-fill" style={{ width: `${fillPct}%` }} />
                  </div>
                </div>

                {members.slice(0, Math.max(3, Math.min(members.length, 6))).map((m, idx) => (
                  <div
                    key={m.id}
                    className="li nt club-glass-card"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}
                  >
                    <div>
                      <div className="ttl">
                        <b>{m.name}</b> <span className="s2">(@{m.handle})</span>
                      </div>
                      <div className="s2">
                        {idx === 0 ? '🧭 Encadrant de la sortie' : `${m.role} · ${m.massif}`}
                      </div>
                    </div>
                    <span className="club-badge-sage">{idx === 0 ? 'Guide' : 'Inscrit ✓'}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </LensTransition>
        </StackSlideView>
      </div>
    );
  }

  // ============================================================================
  // D10 — 2.1 OUTINGS-TICKETS ("Aperçu tickets des sorties à venir — Communauté")
  // ============================================================================
  if (activeSubTab === 1) {
    return (
      <div className="club-drawer-pane-content" data-testid="club-outings-tickets-pane">
        {upcomingOutings.length === 0 ? (
          <ClubEmptyCard
            icon={<Mountain size={22} />}
            title="Aucune sortie à venir"
            description="Les prochains départs du club apparaîtront ici en format ticket."
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              paddingBottom: 12,
            }}
          >
            {upcomingOutings.map((o) => {
              const level: EventCardVM['level'] =
                (o.dplus || 0) >= 1600
                  ? 'expert'
                  : (o.dplus || 0) >= 1100
                    ? 'difficile'
                    : (o.dplus || 0) >= 600
                      ? 'moyen'
                      : 'facile';
              const cleanTitle = o.title.replace(/\s*\([^)]*km[^)]*\)\s*$/i, '').trim() || o.title;
              const organizerName = o.leaderName || activeClub.name;
              const initials = organizerName
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase() || '')
                .join('') || 'C';
              const maxP = Math.max(1, o.maxParticipants || 12);
              const curP = Math.max(0, o.participantsCount || 0);
              const eventVM: EventCardVM = {
                id: o.id,
                title: cleanTitle,
                activity: activeClub.category || 'Alpinisme',
                startsAt: o.startsAtIso || null,
                endsAt: null,
                eventDate: o.startsAtIso || o.date || new Date().toISOString(),
                location: o.massif || activeClub.massif || 'Alpes',
                meetingPoint: o.carpoolCity || null,
                level,
                distanceKm: o.km || null,
                elevationGainM: o.dplus || null,
                duration: null,
                coverImage: o.coverUrl ?? null,
                coverAlt: cleanTitle,
                maxParticipants: maxP,
                currentParticipants: curP,
                spotsLeft: Math.max(0, maxP - curP),
                waitlistEnabled: true,
                myStatus: o.rsvpJoined ? 'registered' : 'none',
                organizer: {
                  id: o.leaderHandle || activeClub.id,
                  name: organizerName,
                  handle: o.leaderHandle || null,
                  avatarUrl: null,
                  initials,
                },
                participants: [],
                participantsTotal: curP,
                clubId: activeClub.id,
                clubName: activeClub.name,
                kitId: null,
                description: null,
                safetyNotes: null,
                safetyChecklist: [],
                recurrence: null,
                past: false,
                routeTrace:
                  o.routeTrace && o.routeTrace.length >= 2
                    ? o.routeTrace
                    : (() => {
                        const baseLat = Number.isFinite(o.lat) ? o.lat : 45.8;
                        const baseLng = Number.isFinite(o.lng) ? o.lng : 6.8;
                        const kmFactor = Math.min(24, Math.max(6, o.km || 12));
                        const dpFactor = Math.min(26, Math.max(8, (o.dplus || 800) / 80));
                        const pts: Array<[number, number]> = [];
                        for (let i = 0; i < 6; i += 1) {
                          const t = i / 5;
                          const phase = (baseLat * 17.3 + baseLng * 11.7 + i * 1.15);
                          const x = 6 + t * 88;
                          const ridge = Math.sin(phase) * (dpFactor * 0.65) + Math.cos(t * Math.PI * (kmFactor / 8)) * 12;
                          const y = Math.max(10, Math.min(90, 52 - ridge - t * 14));
                          pts.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
                        }
                        return pts;
                      })(),
                distanceKmFromMe: null,
                lat: o.lat ?? null,
                lng: o.lng ?? null,
              };
              return (
                <div
                  key={o.id}
                  className="lkdv-cv2x-event"
                  data-level={eventVM.level ?? undefined}
                >
                  <EventTicket
                    event={eventVM}
                    variant="tile"
                    showCapacity
                    onOpen={() => {
                      setDetailLens('overview');
                      onInspectOuting(o);
                    }}
                    href={`/sorties/${encodeURIComponent(o.id)}`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // D09 — 2.0 OUTINGS-UPCOMING ("Prochains départs & covoiturage" — Sorties Carnet)
  // ============================================================================
  return (
    <div className="club-drawer-pane-content" data-testid="club-outings-upcoming-pane">
      {/* Filter & Quick Search Ribbon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingInline: 10 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, opacity: 0.55 }} aria-hidden="true" />
          <input
            type="text"
            className="club-glass-input"
            style={{ paddingLeft: 30, paddingRight: searchQuery ? 28 : 10, width: '100%' }}
            placeholder="Rechercher une sortie, sommet, encadrant, ville covoit…"
            aria-label="Rechercher une sortie du club"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Effacer la recherche de sortie"
              style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="reseau-list">
        {filteredUpcoming.length === 0 ? (
          <ClubEmptyCard
            icon={<Mountain size={22} />}
            title="Aucune sortie programmée pour ce filtre."
            description="Proposez une sortie ou réinitialisez les filtres pour voir tous les départs."
          />
        ) : (
          <div data-hscroll="true">
            <CarnetHorizontalTimeline
              ariaLabel="Frise des sorties du club"
              groups={[
                {
                  day: 1,
                  groupLabel: 'À venir',
                  events: filteredUpcoming.map((o) => {
                    const cleanTitle = o.title.replace(/\s*\([^)]*km[^)]*\)\s*$/i, '').trim();
                    return {
                      id: o.id,
                      day: 1,
                      kind: 'perf',
                      badge:
                        o.status === 'live'
                          ? 'En direct 🔴'
                          : o.rsvpJoined
                            ? 'Inscrit ✓'
                            : o.carpoolSeatsLeft > 0
                              ? `Sortie · ${o.carpoolSeatsLeft} pl. covoit`
                              : 'Sortie',
                      timeLabel: o.date || 'À venir',
                      title: cleanTitle || o.title,
                      subtitle: [
                        o.massif,
                        o.km ? `${o.km} km` : null,
                        o.dplus ? `+${o.dplus} m` : null,
                      ]
                        .filter(Boolean)
                        .join(' · '),
                      onClick: () => {
                        setDetailLens('overview');
                        onInspectOuting(o);
                      },
                    };
                  }),
                },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default ClubSortiesDrawerBody;
