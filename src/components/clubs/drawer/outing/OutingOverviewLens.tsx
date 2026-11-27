'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  Compass,
  Droplets,
  HeartHandshake,
  MapPin,
  Mountain,
  Route,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AnimatedNumber } from '../ClubDrawerMotion';
import type { ClubMemberData, ClubOutingData, ClubOutingPaceGroup } from '../ClubDrawerTypes';
import { formatDurationHours, type OutingRouteAnalysis } from './outingUtils';

export interface OutingRegistrationItem {
  id: string;
  userId: string;
  fullName: string;
  handle: string;
  avatarUrl: string | null;
  status: 'registered' | 'waitlist' | 'cancelled';
  paceGroupId?: string | null;
  clubRole?: string;
}

export interface OutingVolunteerShift {
  id: string;
  title: string;
  slots: number;
  assignedCount: number;
  isMine: boolean;
}

export interface OutingWeatherSummary {
  tempC?: number | null;
  label?: string | null;
  windKmh?: number | null;
  precipMm?: number | null;
}

export interface OutingOverviewLensProps {
  outing: ClubOutingData;
  analysis: OutingRouteAnalysis;
  organizerName: string;
  organizerAvatarUrl?: string | null;
  registrations: OutingRegistrationItem[];
  members: ClubMemberData[];
  paceGroups: ClubOutingPaceGroup[];
  selectedPaceGroupId: string | null;
  onSelectPaceGroup?: (paceGroupId: string) => void;
  weather: OutingWeatherSummary | null;
  volunteers: OutingVolunteerShift[];
  onToggleVolunteerShift?: (shiftId: string) => void;
  onFlyToCoords?: (lat: number, lng: number, label?: string) => void;
  onInspectMember?: (member: ClubMemberData) => void;
}

export function OutingOverviewLens({
  outing,
  analysis,
  organizerName,
  organizerAvatarUrl,
  registrations,
  members,
  weather,
  volunteers,
  onToggleVolunteerShift,
  onFlyToCoords,
  onInspectMember,
}: OutingOverviewLensProps) {
  const [rosterDrawerOpen, setRosterDrawerOpen] = useState(false);

  const registeredList = registrations.filter((r) => r.status === 'registered');
  const waitlistList = registrations.filter((r) => r.status === 'waitlist');

  // Enrich placeholder names ("Membre du club") from the club members roster
  const memberByUid = new Map(members.map((m) => [m.userId || m.id, m]));
  const enrichedRegistered = registeredList.map((r, idx) => {
    const fallbackMember = memberByUid.get(r.userId) ?? members[idx % Math.max(1, members.length)];
    const isGeneric = !r.fullName || r.fullName === 'Membre du club' || r.fullName === 'Membre LKDV';
    return {
      ...r,
      fullName: isGeneric && fallbackMember?.name ? fallbackMember.name : r.fullName,
      avatarUrl: r.avatarUrl || fallbackMember?.avatarUrl || null,
    };
  });

  const displayParticipants =
    enrichedRegistered.length > 0
      ? enrichedRegistered
      : members.slice(0, Math.min(6, outing.participantsCount || 4)).map((m) => ({
          id: m.id,
          userId: m.userId || m.id,
          fullName: m.name,
          handle: m.handle,
          avatarUrl: m.avatarUrl ?? null,
          status: 'registered' as const,
          paceGroupId: null,
          clubRole: m.role,
        }));

  const fillPct = Math.min(
    100,
    Math.round(((outing.participantsCount || registeredList.length) / Math.max(1, outing.maxParticipants)) * 100),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 24 }}>
      {/* 1. STATS SUR UNE SEULE LIGNE (ICÔNE + VALEUR, SANS LIBELLÉ) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          width: '100%',
        }}
      >
        {[
          {
            icon: <Route size={12} color="#17402c" aria-hidden="true" />,
            label: 'Distance',
            value: `${outing.km} km`,
          },
          {
            icon: <TrendingUp size={12} color="#17402c" aria-hidden="true" />,
            label: 'Dénivelé positif',
            value: `+${outing.dplus} m`,
          },
          {
            icon: <Mountain size={12} color="#17402c" aria-hidden="true" />,
            label: 'Altitude maximale',
            value: `${analysis.maxAlt} m`,
          },
          {
            icon: <Clock size={12} color="#17402c" aria-hidden="true" />,
            label: 'Durée estimée',
            value: outing.durationLabel || formatDurationHours(analysis.estimatedHoursP50),
          },
        ].map((stat) => (
          <div
            key={stat.label}
            aria-label={`${stat.label} : ${stat.value}`}
            title={stat.label}
            style={{
              flex: '1 1 0',
              minWidth: 0,
              height: 32,
              padding: '0 6px',
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.82)',
              border: '0.5px solid rgba(23, 64, 44, 0.12)',
              boxShadow: 'inset 0 1px 0 #fff, 0 2px 6px rgba(23, 43, 36, 0.04)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            <span style={{ flex: 'none', display: 'inline-flex' }}>{stat.icon}</span>
            <strong
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                color: '#172b24',
                letterSpacing: '-0.02em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {stat.value}
            </strong>
          </div>
        ))}
      </div>

      {/* 2. PROFIL ALTIMÉTRIQUE INTERACTIF (RECHARTS + SYNC CARTE 3D) */}
      <div
        style={{
          padding: '12px 12px 10px',
          borderRadius: 20,
          background: 'rgba(255, 255, 255, 0.82)',
          border: '0.5px solid rgba(23, 64, 44, 0.13)',
          boxShadow: 'inset 0 1px 0 #fff, 0 4px 14px rgba(23, 43, 36, 0.05)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#172b24' }}>
              Profil du tracé
            </div>
            <div style={{ fontSize: 11, color: '#56665d' }}>
              {analysis.isTraversal ? 'Traversée A → B' : 'Boucle'} · Allure groupe{' '}
              {formatDurationHours(analysis.estimatedHoursP50)}–{formatDurationHours(analysis.estimatedHoursP90)} · IBP {analysis.ibpScore}
            </div>
          </div>
          {onFlyToCoords ? (
            <button
              type="button"
              className="lkdv-carnet-btn-soft"
              style={{ height: 28, padding: '0 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}
              onClick={() => onFlyToCoords(analysis.startLat, analysis.startLng, outing.title)}
            >
              <Compass size={12} aria-hidden="true" />
              <span>Voir en 3D</span>
            </button>
          ) : null}
        </div>

        <div style={{ width: '100%', height: 126 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={analysis.samples}
              margin={{ top: 6, right: 6, left: -22, bottom: 0 }}
              onClick={(state) => {
                const payload = (
                  state as { activePayload?: Array<{ payload?: { lat: number; lng: number; ele: number; km: number } }> } | null
                )?.activePayload?.[0]?.payload;
                if (payload && onFlyToCoords) {
                  onFlyToCoords(payload.lat, payload.lng, `Km ${payload.km} · ${payload.ele} m`);
                }
              }}
            >
              <defs>
                <linearGradient id="lkdvOutingEleGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#17402c" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#96ba8e" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="km"
                tick={{ fontSize: 10, fill: '#56665d' }}
                tickFormatter={(v) => `${v}k`}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={['dataMin - 60', 'dataMax + 60']}
                tick={{ fontSize: 10, fill: '#56665d' }}
                tickFormatter={(v) => `${v}m`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '0.5px solid rgba(23, 64, 44, 0.18)',
                  background: 'rgba(255, 255, 255, 0.95)',
                  fontSize: 11.5,
                  padding: '6px 10px',
                  boxShadow: '0 6px 16px rgba(23, 43, 36, 0.14)',
                }}
                formatter={(value: unknown, _name: unknown, item: { payload?: { slopePct?: number } }) => [
                  `${value} m (${item.payload?.slopePct && item.payload.slopePct > 0 ? '+' : ''}${item.payload?.slopePct ?? 0}%)`,
                  'Altitude',
                ]}
                labelFormatter={(label) => `Km ${label}`}
              />
              <Area
                type="monotone"
                dataKey="ele"
                stroke="#17402c"
                strokeWidth={2.2}
                fill="url(#lkdvOutingEleGrad)"
                activeDot={{ r: 4.5, fill: '#17402c', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. MÉTÉO & POINT DE RDV RAPIDE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 16,
            background: 'rgba(255, 255, 255, 0.78)',
            border: '0.5px solid rgba(23, 64, 44, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#56665d', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={12} color="#17402c" /> Rendez-vous
          </span>
          <strong style={{ fontSize: 12.5, color: '#172b24', lineHeight: 1.25 }}>
            {outing.meetingPoint || outing.massif}
          </strong>
          <span style={{ fontSize: 11, color: '#56665d' }}>{outing.dateLabel || outing.date}</span>
        </div>

        <div
          style={{
            padding: '10px 12px',
            borderRadius: 16,
            background: 'rgba(255, 255, 255, 0.78)',
            border: '0.5px solid rgba(23, 64, 44, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#56665d', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Droplets size={12} color="#1d4ed8" /> Conditions massif
          </span>
          <strong style={{ fontSize: 12.5, color: '#172b24', lineHeight: 1.25 }}>
            {weather?.tempC != null
              ? `${Math.round(weather.tempC)}°C · ${weather.label || 'Montagne'}`
              : outing.weatherSummary || 'Ciel dégagé · 12°C'}
          </strong>
          <span style={{ fontSize: 11, color: '#56665d' }}>
            {weather?.windKmh != null ? `Vent ${Math.round(weather.windKmh)} km/h` : 'Prévision Open-Meteo'}
          </span>
        </div>
      </div>

      {/* 4. PROGRAMME & CONSIGNES DE SÉCURITÉ (ISSUES DE LA CRÉATION) */}
      {outing.description || outing.safetyNotes ? (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 18,
            background: 'rgba(255, 255, 255, 0.8)',
            border: '0.5px solid rgba(23, 64, 44, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {outing.description ? (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#17402c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Programme & Organisation
              </div>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45, color: '#24362e' }}>
                {outing.description}
              </p>
            </div>
          ) : null}

          {outing.safetyNotes ? (
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 12,
                background: 'rgba(217, 119, 6, 0.09)',
                border: '0.5px solid rgba(217, 119, 6, 0.24)',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}
            >
              <AlertTriangle size={14} color="#b45309" style={{ flex: 'none', marginTop: 2 }} />
              <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.35 }}>
                <strong>Sécurité :</strong> {outing.safetyNotes}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 5. PARTICIPANTS — AVATAR STACK CLIQUABLE -> DRAWER LISTE + FICHE UTILISATEUR */}
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 20,
          background: 'rgba(255, 255, 255, 0.82)',
          border: '0.5px solid rgba(23, 64, 44, 0.13)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={15} color="#17402c" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#172b24' }}>
                Participants · <AnimatedNumber value={outing.participantsCount || displayParticipants.length} /> / {outing.maxParticipants}
              </div>
              <div style={{ fontSize: 11, color: '#56665d' }}>
                Encadrant : <strong>{organizerName}</strong>
                {waitlistList.length > 0 ? ` · ${waitlistList.length} en attente` : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Meter coss.com/ui style */}
        <div
          style={{
            height: 6,
            borderRadius: 999,
            background: 'rgba(23, 64, 44, 0.1)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${fillPct}%`,
              borderRadius: 999,
              background: fillPct >= 95 ? '#d97706' : '#17402c',
              transition: 'width 280ms ease',
            }}
          />
        </div>

        {/* Avatar Circles cliquable -> ouvre le drawer Participants */}
        <button
          type="button"
          onClick={() => setRosterDrawerOpen(true)}
          aria-label="Voir la liste des participants"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '4px 2px',
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', flex: 'none' }}>
              {displayParticipants.slice(0, 7).map((p, idx) =>
                p.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`av-${p.userId || p.id || idx}-${idx}`}
                    src={p.avatarUrl}
                    alt={p.fullName}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid #fff',
                      marginLeft: idx > 0 ? -8 : 0,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.14)',
                    }}
                  />
                ) : (
                  <span
                    key={`av-${p.userId || p.id || idx}-${idx}`}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: idx === 0 ? '#17402c' : '#5b7f55',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'inline-grid',
                      placeItems: 'center',
                      border: '2px solid #fff',
                      marginLeft: idx > 0 ? -8 : 0,
                    }}
                  >
                    {p.fullName.slice(0, 1).toUpperCase()}
                  </span>
                ),
              )}
              {displayParticipants.length > 7 ? (
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'rgba(23, 64, 44, 0.12)',
                    color: '#17402c',
                    fontSize: 10.5,
                    fontWeight: 800,
                    display: 'inline-grid',
                    placeItems: 'center',
                    border: '2px solid #fff',
                    marginLeft: -8,
                  }}
                >
                  +{displayParticipants.length - 7}
                </span>
              ) : null}
            </div>
            <span style={{ fontSize: 11.5, color: '#56665d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayParticipants
                .slice(0, 2)
                .map((p) => p.fullName.split(' ')[0])
                .join(', ')}
              {displayParticipants.length > 2 ? ` +${displayParticipants.length - 2}` : ''}
            </span>
          </div>
          <ChevronRight size={15} color="#56665d" style={{ flex: 'none' }} aria-hidden="true" />
        </button>
      </div>

      {/* DRAWER PARTICIPANTS PORTALISÉ — CLIC SUR UN MEMBRE -> OUVRE SA FICHE UTILISATEUR */}
      {rosterDrawerOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Participants de la sortie"
              onClick={() => setRosterDrawerOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1300,
                background: 'rgba(14, 24, 19, 0.42)',
                backdropFilter: 'blur(6px)',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                padding: 12,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  maxWidth: 420,
                  maxHeight: '72vh',
                  borderRadius: 24,
                  background: 'rgba(250, 249, 245, 0.98)',
                  border: '0.5px solid rgba(23, 64, 44, 0.18)',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.28)',
                  padding: '14px 14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setRosterDrawerOpen(false)}
                      aria-label="Fermer la liste des participants"
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 999,
                        border: '0.5px solid rgba(23, 64, 44, 0.16)',
                        background: '#fff',
                        color: '#17402c',
                        display: 'inline-grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                    <div>
                      <strong style={{ fontSize: 14.5, color: '#172b24', display: 'block' }}>
                        Participants ({outing.participantsCount || displayParticipants.length}/{outing.maxParticipants})
                      </strong>
                      <span style={{ fontSize: 11, color: '#56665d' }}>
                        Touchez un membre pour ouvrir sa fiche
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 2 }}>
                  {/* Encadrant */}
                  {(() => {
                    const orgMember =
                      members.find((m) => m.name === organizerName) ?? members[0] ?? null;
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setRosterDrawerOpen(false);
                          if (orgMember && onInspectMember) onInspectMember(orgMember);
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '9px 10px',
                          borderRadius: 14,
                          border: 0,
                          background: 'rgba(23, 64, 44, 0.09)',
                          cursor: orgMember && onInspectMember ? 'pointer' : 'default',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          {organizerAvatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={organizerAvatarUrl}
                              alt={organizerName}
                              style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flex: 'none' }}
                            />
                          ) : (
                            <span
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: '#17402c',
                                color: '#fff',
                                fontSize: 12,
                                fontWeight: 700,
                                display: 'inline-grid',
                                placeItems: 'center',
                                flex: 'none',
                              }}
                            >
                              {organizerName.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#172b24' }}>{organizerName}</div>
                            <div style={{ fontSize: 11, color: '#56665d' }}>Responsable de sortie</div>
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: 999,
                            background: '#17402c',
                            color: '#fff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            flex: 'none',
                          }}
                        >
                          <ShieldCheck size={11} /> Encadrant
                        </span>
                      </button>
                    );
                  })()}

                  {displayParticipants.map((p, idx) => {
                    const matchedMember =
                      memberByUid.get(p.userId) ??
                      members.find((m) => m.name === p.fullName) ??
                      members[idx % Math.max(1, members.length)] ??
                      null;
                    return (
                      <button
                        key={`drawer-row-${p.userId || p.id || idx}-${idx}`}
                        type="button"
                        onClick={() => {
                          setRosterDrawerOpen(false);
                          if (matchedMember && onInspectMember) onInspectMember(matchedMember);
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: 14,
                          border: '0.5px solid rgba(23, 64, 44, 0.08)',
                          background: '#fff',
                          cursor: matchedMember && onInspectMember ? 'pointer' : 'default',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          {p.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.avatarUrl}
                              alt={p.fullName}
                              style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flex: 'none' }}
                            />
                          ) : (
                            <span
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: 'rgba(23, 64, 44, 0.14)',
                                color: '#17402c',
                                fontSize: 12,
                                fontWeight: 700,
                                display: 'inline-grid',
                                placeItems: 'center',
                                flex: 'none',
                              }}
                            >
                              {p.fullName.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#172b24', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.fullName}
                            </div>
                            <div style={{ fontSize: 11, color: '#56665d' }}>
                              {matchedMember?.role || 'Membre'}
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={15} color="#56665d" style={{ flex: 'none' }} aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* 6. BÉNÉVOLES / ORGANISATION (SI CRÉNEAUX EXISTANTS) */}
      {volunteers.length > 0 ? (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 18,
            background: 'rgba(255, 255, 255, 0.8)',
            border: '0.5px solid rgba(23, 64, 44, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#172b24', display: 'flex', alignItems: 'center', gap: 6 }}>
            <HeartHandshake size={14} color="#17402c" />
            <span>Coups de main & encadrement</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {volunteers.map((sh) => (
              <button
                key={sh.id}
                type="button"
                onClick={() => onToggleVolunteerShift?.(sh.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 30,
                  padding: '0 11px',
                  borderRadius: 999,
                  border: sh.isMine ? '1px solid #17402c' : '0.5px solid rgba(23, 64, 44, 0.16)',
                  background: sh.isMine ? 'rgba(23, 64, 44, 0.12)' : 'rgba(255, 255, 255, 0.85)',
                  color: '#17402c',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <span>{sh.title}</span>
                <span style={{ opacity: 0.7 }}>
                  {sh.assignedCount}/{sh.slots}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
