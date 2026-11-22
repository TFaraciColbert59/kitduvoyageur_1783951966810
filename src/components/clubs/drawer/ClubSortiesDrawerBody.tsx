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
import { ClubG02Workspace } from '@/components/clubs/g02';
import {
  AnimatedNumber,
  ClubStaggerCard,
  ClubStaggerList,
  LensTransition,
  StackSlideView,
} from './ClubDrawerMotion';
import { ClubEmptyCard } from './ClubSharedUi';
import type { ClubOutingData, ClubSortiesDrawerBodyProps } from './ClubDrawerTypes';

type OutingFilterId = 'all' | 'weekend' | 'carpool' | 'joined' | 'available';
type OutingDetailLensId = 'overview' | 'carpool' | 'gear' | 'participants';
type WeatherWindowId = 'morning' | 'afternoon' | 'weekend';
type GpxFilterId = 'all' | 'high_dplus' | 'long_km';

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
  currentUserId,
  initialSection = 'events',
}: ClubSortiesDrawerBodyProps) {
  // D09 — Upcoming outings filter & search state
  const [outingFilter, setOutingFilter] = useState<OutingFilterId>('all');
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

  // D10 — Weather & terrain reports state
  const [weatherWindow, setWeatherWindow] = useState<WeatherWindowId>('morning');
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

  // D11 — GPX Archives filter state
  const [gpxFilter, setGpxFilter] = useState<GpxFilterId>('all');
  const [gpxSearch, setGpxSearch] = useState('');

  const upcomingOutings = useMemo(
    () => outings.filter((o) => o.status !== 'completed' && o.status !== 'cancelled'),
    [outings],
  );

  const completedOutings = useMemo(() => {
    const completed = outings.filter((o) => o.status === 'completed');
    if (completed.length > 0) return completed;
    // Provide synthetic archive entries derived from club outings when none are marked completed yet
    return outings.slice(0, 3).map((o, idx) => ({
      ...o,
      id: `${o.id}-archive-${idx}`,
      status: 'completed' as const,
      date: idx === 0 ? 'Dim. dernier · Trace vérifiée' : 'Mois dernier · Archive GPX',
      km: o.km || 16 + idx * 4,
      dplus: o.dplus || 920 + idx * 240,
      maxAlt: o.maxAlt || 2150 + idx * 180,
    }));
  }, [outings]);

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

  const filteredArchives = useMemo(() => {
    const q = normalizeText(gpxSearch.trim());
    return completedOutings.filter((o) => {
      if (gpxFilter === 'high_dplus' && (o.dplus || 0) < 1000) return false;
      if (gpxFilter === 'long_km' && (o.km || 0) < 15) return false;
      if (!q) return true;
      return normalizeText(`${o.title} ${o.massif} ${o.leaderName}`).includes(q);
    });
  }, [completedOutings, gpxFilter, gpxSearch]);

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
        <div className="club-stack-header">
          <button
            type="button"
            className="club-stack-back"
            onClick={() => onInspectOuting(null)}
            aria-label="Toutes les sorties"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            <span>Retour</span>
          </button>
          <b className="club-stack-title">Fiche Sortie & Covoiturage</b>
        </div>

        <StackSlideView stackKey={`outing-${inspectedOuting.id}`}>
          {/* Top Hero Card — strict flex column to prevent .li.nt CSS grid overlap */}
          <div
            className="li nt club-glass-card"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: 8 }}>
              <div className="ttl">
                <b>{inspectedOuting.title}</b>
              </div>
              <span className={inspectedOuting.rsvpJoined ? 'club-badge-sage' : 'club-badge-soft'}>
                {inspectedOuting.rsvpJoined ? 'Inscrit ✓' : inspectedOuting.status === 'live' ? 'En direct 🔴' : 'Ouvert'}
              </span>
            </div>
            <div className="s2">
              📅 {inspectedOuting.date} · 📍 {inspectedOuting.massif} · {inspectedOuting.km} km · +{inspectedOuting.dplus} m D+ · Alt max {inspectedOuting.maxAlt} m
            </div>
            <div className="s2">
              🧭 Encadrant : <b>{inspectedOuting.leaderName}</b> (@{inspectedOuting.leaderHandle}) · {inspectedOuting.participantsCount}/{inspectedOuting.maxParticipants} inscrits · ⏱ ~{estHours} h
            </div>
            <div className="s2">
              🚐 Covoiturage départ <b>{inspectedOuting.carpoolCity}</b> : <b>{inspectedOuting.carpoolSeatsLeft} places restantes</b>
            </div>

            {/* Sub-lens selector pills inside Fiche Sortie */}
            <div
              className="club-form-pills"
              role="tablist"
              aria-label="Sections de la fiche sortie"
              style={{ width: '100%', marginTop: 4 }}
            >
              {detailLenses.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="tab"
                  aria-selected={detailLens === l.id}
                  className={`reseau-btn ${detailLens === l.id ? 'primary' : 'active'}`}
                  onClick={() => setDetailLens(l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {/* Primary Action Bar (always accessible) */}
            <div className="club-form-pills" style={{ width: '100%', marginTop: 4 }}>
              <button
                type="button"
                className={`reseau-btn ${inspectedOuting.rsvpJoined ? 'active' : 'primary'} club-icon-pill`}
                onClick={() => {
                  onToggleRsvpOuting(inspectedOuting.id);
                  onToast?.({
                    title: inspectedOuting.rsvpJoined ? 'Inscription annulée' : 'Inscription confirmée ✓',
                    subtitle: inspectedOuting.title,
                    undo: () => onToggleRsvpOuting(inspectedOuting.id),
                  });
                }}
                aria-label={inspectedOuting.rsvpJoined ? 'Inscrit à la sortie' : 'Participer'}
                title={inspectedOuting.rsvpJoined ? 'Inscrit à la sortie' : 'Participer'}
              >
                {inspectedOuting.rsvpJoined ? (
                  <CalendarCheck size={16} aria-hidden="true" />
                ) : (
                  <CalendarPlus size={16} aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                className="reseau-btn active club-icon-pill"
                onClick={() => onFlyToCoords(inspectedOuting.lat, inspectedOuting.lng, inspectedOuting.title)}
                aria-label="Trace 3D"
                title="Trace 3D"
              >
                <MapPin size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="reseau-btn active club-icon-pill"
                onClick={() => {
                  onDownloadGpx(inspectedOuting);
                  onToast?.({
                    title: 'Trace GPX téléchargée',
                    subtitle: `${inspectedOuting.title} (${inspectedOuting.km} km)`,
                  });
                }}
                aria-label="Télécharger le GPX"
                title="Télécharger le GPX"
              >
                <Download size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="reseau-btn active club-icon-pill"
                onClick={() => {
                  onCreateGroupFromOuting(inspectedOuting);
                  onToast?.({
                    title: 'Groupe de cordée initialisé',
                    subtitle: inspectedOuting.title,
                  });
                }}
                aria-label="Créer un groupe de voyage"
                title="Créer un groupe de voyage"
              >
                <Users size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <LensTransition transitionKey={`outing-detail-${detailLens}`}>
            {detailLens === 'overview' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                {/* Interactive Elevation Sparkline Card */}
                <div
                  className="li nt club-glass-card"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b style={{ fontSize: 12.5, color: '#172b24' }}>Profil Altimétrique & Waypoints</b>
                    <span className="club-badge-sage">
                      Km {activePoint.km} · {activePoint.alt} m
                    </span>
                  </div>
                  <div className="s2">{activePoint.label}</div>
                  <svg
                    viewBox="0 0 260 64"
                    style={{ width: '100%', height: 64, overflow: 'visible' }}
                    aria-label="Profil altimétrique de la sortie"
                  >
                    <defs>
                      <linearGradient id="clubOutingElevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#17402C" stopOpacity="0.32" />
                        <stop offset="100%" stopColor="#17402C" stopOpacity="0.03" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 8 54 L 60 38 L 122 20 L 168 10 L 214 32 L 252 50 L 252 60 L 8 60 Z"
                      fill="url(#clubOutingElevGrad)"
                    />
                    <path
                      d="M 8 54 L 60 38 L 122 20 L 168 10 L 214 32 L 252 50"
                      fill="none"
                      stroke="#17402C"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {[
                      { x: 8, y: 54 },
                      { x: 60, y: 38 },
                      { x: 122, y: 20 },
                      { x: 168, y: 10 },
                      { x: 214, y: 32 },
                      { x: 252, y: 50 },
                    ].map((pt, idx) => (
                      <circle
                        key={idx}
                        cx={pt.x}
                        cy={pt.y}
                        r={hoverPointIdx === idx ? 5 : 3.5}
                        fill={hoverPointIdx === idx ? '#17402C' : '#FBFAF6'}
                        stroke="#17402C"
                        strokeWidth="2"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setHoverPointIdx(idx)}
                      />
                    ))}
                  </svg>
                  <div className="club-form-pills">
                    {elevationPoints.map((pt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`reseau-btn ${hoverPointIdx === idx ? 'primary' : 'active'}`}
                        onClick={() => setHoverPointIdx(idx)}
                        style={{ fontSize: 11, padding: '3px 8px' }}
                      >
                        Km {pt.km} ({pt.alt}m)
                      </button>
                    ))}
                  </div>
                </div>

                {/* Required gear tags summary */}
                <div
                  className="li nt club-glass-card"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <b style={{ fontSize: 12.5, color: '#172b24' }}>Équipement obligatoire & Sécurité</b>
                    <button
                      type="button"
                      className="reseau-btn active"
                      style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={() => setDetailLens('gear')}
                    >
                      Checklist ({readyGearCount}/{requiredGearList.length})
                    </button>
                  </div>
                  <div className="club-skill-tags">
                    {requiredGearList.map((g) => (
                      <span key={g} className="club-skill-tag">
                        Kit requis : {g}
                      </span>
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
                            title="Chercher dans le coffre d'entraide"
                          >
                            <Package size={13} aria-hidden="true" />
                            <span>Coffre</span>
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
  // D10 — 2.1 OUTINGS-WEATHER ("Météo et conditions massif")
  // ============================================================================
  if (activeSubTab === 1) {
    const windowStats: Record<
      WeatherWindowId,
      { iso: string; wind: string; visibility: string; riskLabel: string; temp1500: string; temp2500: string; temp3500: string }
    > = {
      morning: {
        iso: activeClub.weatherIso || '3 100 m',
        wind: activeClub.weatherWind || '15 km/h NO',
        visibility: 'Excellente · Plafond > 3 500 m',
        riskLabel: 'Créneau Optimal ✓',
        temp1500: '11°C',
        temp2500: '4°C',
        temp3500: '-3°C',
      },
      afternoon: {
        iso: '2 950 m (évolution cumulus)',
        wind: '30 km/h NO sur crêtes',
        visibility: 'Bonne · Bourgeonnements 15h',
        riskLabel: 'Vigilance Crêtes',
        temp1500: '14°C',
        temp2500: '6°C',
        temp3500: '-2°C',
      },
      weekend: {
        iso: '3 050 m stable',
        wind: '20 km/h · Anticyclonique',
        visibility: 'Samedi clair · Dimanche voilé 16h',
        riskLabel: 'Fenêtre Favorable ✓',
        temp1500: '12°C',
        temp2500: '5°C',
        temp3500: '-2°C',
      },
    };
    const currentW = windowStats[weatherWindow];

    return (
      <div className="club-drawer-pane-content" data-testid="club-weather-pane">
        <div className="club-sec-head">
          <div className="club-sec-head-titles">
            <span className="club-sec-eyebrow">Conditions · {activeClub.massif}</span>
            <b className="club-sec-title">Bulletin Massif · {activeClub.massif}</b>
          </div>
          <span className="club-badge-sage">{currentW.riskLabel}</span>
        </div>

        {/* Time window pills */}
        <div className="club-form-pills" role="tablist" aria-label="Créneau météo">
          {(
            [
              { id: 'morning', label: 'Matin (06h–12h)' },
              { id: 'afternoon', label: 'Après-midi (12h–18h)' },
              { id: 'weekend', label: 'Tendance Week-end' },
            ] as const
          ).map((w) => (
            <button
              key={w.id}
              type="button"
              role="tab"
              aria-selected={weatherWindow === w.id}
              className={`reseau-btn ${weatherWindow === w.id ? 'primary' : 'active'}`}
              onClick={() => setWeatherWindow(w.id)}
            >
              {w.label}
            </button>
          ))}
        </div>

        {/* Altitude Thermal Etagement Card */}
        <div
          className="li nt club-glass-card"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="ttl">
              <Thermometer size={14} aria-hidden="true" style={{ display: 'inline', marginRight: 6 }} />
              <b>Étagement thermique & Isotherme 0°C</b>
            </div>
            <span className="club-badge-sage">Vérifié</span>
          </div>
          <div className="s2">{currentW.iso} · {currentW.visibility}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 2 }}>
            <div className="club-kpi-box" style={{ padding: '6px 8px', borderRadius: 12, background: 'rgba(23,64,44,0.05)' }}>
              <div className="s2">1 500 m (Forêt)</div>
              <b style={{ fontSize: 13.5 }}>{currentW.temp1500}</b>
            </div>
            <div className="club-kpi-box" style={{ padding: '6px 8px', borderRadius: 12, background: 'rgba(23,64,44,0.05)' }}>
              <div className="s2">2 500 m (Cols)</div>
              <b style={{ fontSize: 13.5 }}>{currentW.temp2500}</b>
            </div>
            <div className="club-kpi-box" style={{ padding: '6px 8px', borderRadius: 12, background: 'rgba(23,64,44,0.05)' }}>
              <div className="s2">3 500 m (Crêtes)</div>
              <b style={{ fontSize: 13.5 }}>{currentW.temp3500}</b>
            </div>
          </div>
        </div>

        <div className="li nt club-glass-card">
          <div>
            <div className="ttl">
              <Wind size={14} aria-hidden="true" style={{ display: 'inline', marginRight: 6 }} />
              <span>Vent en altitude & Crêtes</span>
            </div>
            <div className="s2">{currentW.wind} · Vigilance passages exposés</div>
          </div>
          <span className="club-badge-soft">Info</span>
        </div>

        <div className="li nt club-glass-card">
          <div>
            <div className="ttl">
              <span>État des sentiers & Refuges (Tribu)</span>
            </div>
            <div className="s2">{activeClub.weatherTrail}</div>
          </div>
          <button
            type="button"
            className="reseau-btn active club-icon-pill"
            onClick={() => onFlyToCoords(activeClub.lat, activeClub.lng, `Météo ${activeClub.massif}`)}
            aria-label="Carte 3D"
            title="Carte 3D"
          >
            <Mountain size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Community Terrain Reports & Crowd-sourced observation form */}
        <div
          className="li nt club-glass-card"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: 12.5, color: '#172b24' }}>Observations Terrain de la Cordée ({terrainReports.length})</b>
            <span className="club-badge-soft">Direct Tribu</span>
          </div>

          {terrainReports.map((rep) => (
            <div
              key={rep.id}
              style={{
                padding: '8px 10px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.62)',
                border: '1px solid rgba(23,43,36,0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b style={{ fontSize: 12 }}>{rep.author}</b>
                <span className={rep.severity === 'ok' ? 'club-badge-sage' : 'club-badge-soft'}>
                  {rep.category.toUpperCase()} · {rep.time}
                </span>
              </div>
              <div className="s2">{rep.text}</div>
            </div>
          ))}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!reportDraft.trim()) return;
              const created: TerrainReport = {
                id: `rep-${Date.now()}`,
                author: 'Observation Membre',
                time: 'À l’instant',
                category: reportCategory,
                text: reportDraft.trim(),
                severity: reportCategory === 'vent' || reportCategory === 'neve' ? 'warn' : 'ok',
              };
              setTerrainReports((prev) => [created, ...prev]);
              setReportDraft('');
              onToast?.({
                title: 'Observation terrain publiée',
                subtitle: `${activeClub.massif} · ${created.category}`,
                undo: () => setTerrainReports((prev) => prev.filter((r) => r.id !== created.id)),
              });
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}
          >
            <div className="club-form-pills">
              {(
                [
                  { id: 'sentier', label: 'Sentier' },
                  { id: 'neve', label: 'Névé / Glace' },
                  { id: 'vent', label: 'Vent Crête' },
                  { id: 'eau', label: 'Source / Refuge' },
                ] as const
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`reseau-btn ${reportCategory === c.id ? 'primary' : 'active'}`}
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  onClick={() => setReportCategory(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                className="club-glass-input"
                placeholder={`Signaler une condition sur ${activeClub.massif}…`}
                aria-label="Signaler une condition terrain"
                value={reportDraft}
                onChange={(e) => setReportDraft(e.target.value)}
              />
              <button
                type="submit"
                className="reseau-btn primary"
                disabled={!reportDraft.trim()}
              >
                Publier
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ============================================================================
  // D12 — 2.3 OUTINGS-G02 ("Pont Sorties club, courses et groupes")
  // ============================================================================
  if (activeSubTab === 3) {
    return (
      <div className="club-drawer-pane-content" data-testid="club-outings-g02-bridge">
        <div className="club-sec-head" style={{ marginBottom: 6 }}>
          <div className="club-sec-head-titles">
            <span className="club-sec-eyebrow">Espace Sorties & Groupes · {activeClub.name}</span>
            <b className="club-sec-title">Planification, Groupes d’allure & Émargement</b>
          </div>
          <span className="club-badge-sage">{outings.length} sorties</span>
        </div>
        {active ? <ClubG02Workspace clubId={activeClub.id} initialSection={initialSection} /> : null}
      </div>
    );
  }

  // ============================================================================
  // D11 — 2.2 OUTINGS-GPX ("Archives et traces GPX")
  // ============================================================================
  if (activeSubTab === 2) {
    return (
      <div className="club-drawer-pane-content" data-testid="club-outings-gpx-pane">
        <div className="club-sec-head">
          <div className="club-sec-head-titles">
            <span className="club-sec-eyebrow">Archives · {activeClub.massif}</span>
            <b className="club-sec-title">Archives & Traces GPX ({filteredArchives.length})</b>
          </div>
          <span className="club-badge-sage">Traces Vérifiées</span>
        </div>

        {/* Search & Filter strip */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, opacity: 0.55 }} aria-hidden="true" />
            <input
              type="text"
              className="club-glass-input"
              style={{ paddingLeft: 30, width: '100%' }}
              placeholder="Filtrer les traces GPX par sommet, massif, guide…"
              aria-label="Rechercher une trace GPX"
              value={gpxSearch}
              onChange={(e) => setGpxSearch(e.target.value)}
            />
          </div>
          <div className="club-form-pills" role="tablist" aria-label="Filtres archives GPX">
            {(
              [
                { id: 'all', label: `Toutes (${completedOutings.length})` },
                { id: 'high_dplus', label: '+1 000 m D+' },
                { id: 'long_km', label: '+15 km' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                className={`reseau-btn ${gpxFilter === f.id ? 'primary' : 'active'}`}
                onClick={() => setGpxFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="reseau-list">
          {filteredArchives.length === 0 ? (
            <ClubEmptyCard
              icon={<Route size={22} />}
              title="Aucune archive GPX ne correspond à ce filtre."
              description="Réinitialisez le filtre pour afficher toutes les traces certifiées du club."
            />
          ) : (
            <>
              <div data-hscroll="true">
                <CarnetHorizontalTimeline
                  ariaLabel="Frise des archives GPX"
                  groups={[
                    {
                      day: 1,
                      groupLabel: 'Archives',
                      events: filteredArchives.map((o) => ({
                        id: o.id,
                        day: 1,
                        kind: 'perf',
                        badge: 'Archive GPX',
                        timeLabel: o.date || 'Archive',
                        title: o.title,
                        subtitle: [
                          o.massif,
                          o.km ? `${o.km} km` : null,
                          o.dplus ? `+${o.dplus} m` : null,
                        ]
                          .filter(Boolean)
                          .join(' · '),
                        onClick: () => onInspectOuting(o),
                      })),
                    },
                  ]}
                />
              </div>

              <ClubStaggerList style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {filteredArchives.map((o) => (
                  <ClubStaggerCard
                    key={o.id}
                    className="li nt club-glass-card"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}
                  >
                    <div
                      style={{ cursor: 'pointer', flex: 1 }}
                      onClick={() => onInspectOuting(o)}
                    >
                      <div className="ttl">
                        <b>{o.title}</b>
                      </div>
                      <div className="s2">
                        📍 {o.massif} · {o.km} km · +{o.dplus} m D+ · Alt max {o.maxAlt} m
                      </div>
                      <div className="s2">
                        Trace certifiée par <b>{o.leaderName}</b>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="reseau-btn active club-icon-pill"
                        onClick={() => onFlyToCoords(o.lat, o.lng, o.title)}
                        aria-label={`Centrer la carte sur ${o.title}`}
                        title="Voir sur la carte 3D"
                      >
                        <MapPin size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="reseau-btn primary club-icon-pill"
                        onClick={() => {
                          onDownloadGpx(o);
                          onToast?.({
                            title: 'Trace GPX téléchargée',
                            subtitle: `${o.title} (${o.km} km)`,
                          });
                        }}
                        aria-label={`Télécharger GPX ${o.title}`}
                        title="Télécharger le GPX"
                      >
                        <Download size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </ClubStaggerCard>
                ))}
              </ClubStaggerList>
            </>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // D09 — 2.0 OUTINGS-UPCOMING ("Prochains départs & covoiturage" — Sorties Carnet)
  // ============================================================================
  return (
    <div className="club-drawer-pane-content" data-testid="club-outings-upcoming-pane">
      <div className="club-sec-head">
        <div className="club-sec-head-titles">
          <span className="club-sec-eyebrow">Sorties · {activeClub.massif}</span>
          <b className="club-sec-title">Prochains Départs & Covoiturage</b>
        </div>
        <span className="club-badge-sage">
          <AnimatedNumber value={upcomingKpis.count} /> départs · <AnimatedNumber value={upcomingKpis.totalSeats} /> pl. covoit
        </span>
      </div>

      {/* Filter & Quick Search Ribbon */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, opacity: 0.55 }} aria-hidden="true" />
          <input
            type="text"
            className="club-glass-input"
            style={{ paddingLeft: 30, width: '100%' }}
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

        <div className="club-form-pills" role="tablist" aria-label="Filtres des sorties">
          {(
            [
              { id: 'all', label: `Toutes (${upcomingOutings.length})` },
              { id: 'weekend', label: 'Ce week-end' },
              { id: 'carpool', label: `Covoiturage (${upcomingKpis.totalSeats} pl.)` },
              { id: 'joined', label: `Mes inscriptions (${upcomingKpis.joinedCount})` },
              { id: 'available', label: 'Places dispo' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={outingFilter === f.id}
              className={`reseau-btn ${outingFilter === f.id ? 'primary' : 'active'}`}
              onClick={() => setOutingFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
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
                  events: filteredUpcoming.map((o) => ({
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
                    title: o.title,
                    subtitle: [
                      o.massif,
                      o.km ? `${o.km} km` : null,
                      o.dplus ? `+${o.dplus} m` : null,
                      o.carpoolCity ? `🚐 ${o.carpoolCity}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · '),
                    onClick: () => {
                      setDetailLens('overview');
                      onInspectOuting(o);
                    },
                  })),
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
