'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { ClubPokedexDrawerBody } from '../ClubPokedexDrawerBody';
import type { ClubMapPokedexItem } from '../../map/clubMapTypes';
import type {
  ClubGearVaultItem,
  ClubItemData,
  ClubMemberData,
  ClubOutingData,
  ClubOutingPaceGroup,
  ClubOutingTransportItem,
  ClubPostData,
  ClubStandardKit,
  ClubToastPayload,
} from '../ClubDrawerTypes';
import {
  OutingOverviewLens,
  type OutingRegistrationItem,
  type OutingVolunteerShift,
  type OutingWeatherSummary,
} from './OutingOverviewLens';
import { OutingTransportLens } from './OutingTransportLens';
import { OutingGearLens } from './OutingGearLens';
import { OutingMemoriesLens, type OutingStoryItem } from './OutingMemoriesLens';
import {
  cleanOutingTitle,
  computeOutingRouteAnalysis,
} from './outingUtils';

export type OutingDetailLensId = 'overview' | 'transport' | 'gear' | 'pokedex' | 'memories';

export interface ClubOutingDetailSheetProps {
  activeClub: ClubItemData;
  outing: ClubOutingData;
  members: ClubMemberData[];
  outings: ClubOutingData[];
  vaultGear: ClubGearVaultItem[];
  standardKits: ClubStandardKit[];
  pokedexItems: ClubMapPokedexItem[];
  posts: ClubPostData[];
  currentUserId: string | null;
  activeLensIndex: number;
  onBack: () => void;
  onDownloadGpx?: (outing: ClubOutingData) => void;
  onFlyToCoords?: (lat: number, lng: number, label?: string) => void;
  onRequestGearLoan?: (payload: {
    gearId: string;
    quantity?: number;
    eventId?: string | null;
    neededFrom?: string | null;
    neededUntil?: string | null;
    note?: string;
  }) => Promise<boolean> | void;
  onToggleReserveGear?: (gearId: string) => void;
  onCloneStandardKit?: (kitId: string) => void;
  onOpenClubSalons?: () => void;
  onOpenVaultTab?: () => void;
  onCreatePost?: () => void;
  onObservationCreated?: (item: ClubMapPokedexItem) => void;
  onInspectMember?: (member: ClubMemberData) => void;
  onToast?: (payload: ClubToastPayload) => void;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ClubOutingDetailSheet({
  activeClub,
  outing,
  members,
  outings,
  vaultGear,
  standardKits,
  pokedexItems,
  posts,
  currentUserId,
  activeLensIndex,
  onBack,
  onDownloadGpx,
  onFlyToCoords,
  onRequestGearLoan,
  onToggleReserveGear,
  onCloneStandardKit,
  onOpenClubSalons,
  onOpenVaultTab,
  onCreatePost,
  onObservationCreated,
  onInspectMember,
  onToast,
}: ClubOutingDetailSheetProps) {
  const [liveOuting, setLiveOuting] = useState<ClubOutingData>(outing);
  const [organizerName, setOrganizerName] = useState<string>(outing.leaderName || 'Encadrant du club');
  const [organizerAvatar, setOrganizerAvatar] = useState<string | null>(outing.leaderAvatarUrl ?? null);
  const [registrations, setRegistrations] = useState<OutingRegistrationItem[]>([]);
  const [paceGroups, setPaceGroups] = useState<ClubOutingPaceGroup[]>(outing.paceGroups ?? []);
  const [selectedPaceGroupId, setSelectedPaceGroupId] = useState<string | null>(null);
  const [volunteers, setVolunteers] = useState<OutingVolunteerShift[]>([]);
  const [weather, setWeather] = useState<OutingWeatherSummary | null>(null);
  const [transports, setTransports] = useState<ClubOutingTransportItem[]>([]);
  const [transportsLoading, setTransportsLoading] = useState(false);
  const [stories, setStories] = useState<OutingStoryItem[]>([]);

  useEffect(() => {
    setLiveOuting(outing);
    setOrganizerName(outing.leaderName || 'Encadrant du club');
    setOrganizerAvatar(outing.leaderAvatarUrl ?? null);
    setPaceGroups(outing.paceGroups ?? []);
  }, [outing]);

  const analysis = useMemo(() => computeOutingRouteAnalysis(liveOuting), [liveOuting]);

  const loadTransports = useCallback(async () => {
    if (!UUID_RE.test(activeClub.id) || !UUID_RE.test(outing.id)) return;
    setTransportsLoading(true);
    try {
      const res = await fetch(
        `/api/clubs/${encodeURIComponent(activeClub.id)}/events/${encodeURIComponent(outing.id)}/transport`,
        { credentials: 'include' },
      );
      const payload = (await res.json().catch(() => null)) as {
        data?: { transports?: ClubOutingTransportItem[] };
      } | null;
      if (res.ok && Array.isArray(payload?.data?.transports)) {
        setTransports(payload.data.transports);
      }
    } catch {
      // ignore
    } finally {
      setTransportsLoading(false);
    }
  }, [activeClub.id, outing.id]);

  // Fetch all real DB details for this outing in parallel
  useEffect(() => {
    let cancelled = false;
    const clubValid = UUID_RE.test(activeClub.id);
    const eventValid = UUID_RE.test(outing.id);

    if (clubValid && eventValid) {
      // 1. Real event detail + registrations + organizerProfile + paceGroups
      fetch(
        `/api/clubs/${encodeURIComponent(activeClub.id)}/events/${encodeURIComponent(outing.id)}`,
        { credentials: 'include' },
      )
        .then((r) => (r.ok ? r.json() : null))
        .then(
          (
            payload: {
              data?: {
                event?: {
                  description?: string | null;
                  meetingPoint?: string | null;
                  level?: string | null;
                  durationLabel?: string | null;
                  safetyChecklist?: string[] | null;
                  safetyNotes?: string | null;
                  kitId?: string | null;
                  standardKitId?: string | null;
                  paceGroups?: ClubOutingPaceGroup[];
                };
                organizerProfile?: { fullName?: string; avatarUrl?: string | null } | null;
                registrations?: OutingRegistrationItem[];
              };
            } | null,
          ) => {
            if (cancelled || !payload?.data) return;
            const ev = payload.data.event;
            if (ev) {
              setLiveOuting((prev) => ({
                ...prev,
                description: ev.description ?? prev.description,
                meetingPoint: ev.meetingPoint ?? prev.meetingPoint,
                level: ev.level ?? prev.level,
                durationLabel: ev.durationLabel ?? prev.durationLabel,
                safetyChecklist: ev.safetyChecklist ?? prev.safetyChecklist,
                safetyNotes: ev.safetyNotes ?? prev.safetyNotes,
                kitId: ev.kitId ?? prev.kitId,
                standardKitId: ev.standardKitId ?? prev.standardKitId,
                paceGroups: ev.paceGroups ?? prev.paceGroups,
              }));
              if (Array.isArray(ev.paceGroups) && ev.paceGroups.length > 0) {
                setPaceGroups(ev.paceGroups);
              }
            }
            if (payload.data.organizerProfile?.fullName) {
              setOrganizerName(payload.data.organizerProfile.fullName);
              setOrganizerAvatar(payload.data.organizerProfile.avatarUrl ?? null);
            }
            if (Array.isArray(payload.data.registrations)) {
              setRegistrations(payload.data.registrations);
              const mine = payload.data.registrations.find(
                (r) => currentUserId && r.userId === currentUserId,
              );
              if (mine?.paceGroupId) setSelectedPaceGroupId(mine.paceGroupId);
            }
          },
        )
        .catch(() => {});

      // 2. Transports Aller & Retour
      void loadTransports();

      // 3. Volunteers shifts
      fetch(
        `/api/clubs/${encodeURIComponent(activeClub.id)}/volunteers?eventId=${encodeURIComponent(outing.id)}`,
        { credentials: 'include' },
      )
        .then((r) => (r.ok ? r.json() : null))
        .then(
          (
            payload: {
              data?: {
                shifts?: Array<{
                  id: string;
                  title: string;
                  slots?: number;
                  assignments?: Array<{ userId: string }>;
                }>;
              };
            } | null,
          ) => {
            if (cancelled || !Array.isArray(payload?.data?.shifts)) return;
            setVolunteers(
              payload.data.shifts.map((s) => ({
                id: s.id,
                title: s.title,
                slots: s.slots ?? 1,
                assignedCount: s.assignments?.length ?? 0,
                isMine: Boolean(
                  currentUserId && s.assignments?.some((a) => a.userId === currentUserId),
                ),
              })),
            );
          },
        )
        .catch(() => {});

      // 4. Club stories filtered to this outing
      fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/story-highlights`, {
        credentials: 'include',
      })
        .then((r) => (r.ok ? r.json() : null))
        .then(
          (
            payload: {
              data?: {
                archiveStories?: Array<{
                  id: string;
                  authorName?: string;
                  authorAvatarUrl?: string | null;
                  mediaUrl?: string;
                  caption?: string | null;
                  outingId?: string | null;
                  spot?: string | null;
                  lat?: number | null;
                  lng?: number | null;
                  createdAt?: string | null;
                }>;
              };
            } | null,
          ) => {
            if (cancelled || !Array.isArray(payload?.data?.archiveStories)) return;
            const filtered = payload.data.archiveStories
              .filter((st) => st.outingId === outing.id && st.mediaUrl)
              .map((st) => ({
                id: st.id,
                authorName: st.authorName || 'Membre du club',
                authorAvatarUrl: st.authorAvatarUrl ?? null,
                mediaUrl: st.mediaUrl!,
                caption: st.caption ?? null,
                spot: st.spot ?? null,
                lat: st.lat ?? null,
                lng: st.lng ?? null,
                createdAt: st.createdAt ?? null,
              }));
            setStories(filtered);
          },
        )
        .catch(() => {});
    }

    // 5. Weather for outing coords (strict allowlist: lat, lon, from, to)
    if (Number.isFinite(outing.lat) && Number.isFinite(outing.lng)) {
      const targetDay = (
        outing.startsAtIso && /^\d{4}-\d{2}-\d{2}/.test(outing.startsAtIso)
          ? outing.startsAtIso.slice(0, 10)
          : new Date().toISOString().slice(0, 10)
      );
      fetch(
        `/api/weather?lat=${outing.lat.toFixed(4)}&lon=${outing.lng.toFixed(4)}&from=${targetDay}&to=${targetDay}`,
      )
        .then((r) => (r.ok ? r.json() : null))
        .then(
          (
            w: {
              days?: Array<{
                tempMaxC?: number;
                tempMinC?: number;
                windMaxKmh?: number;
                summary?: string;
                label?: string;
              }>;
              current?: { temperature_2m?: number; wind_speed_10m?: number };
              temperature?: number;
              label?: string;
              windKmh?: number;
            } | null,
          ) => {
            if (cancelled || !w) return;
            const d0 = w.days?.[0];
            setWeather({
              tempC: d0?.tempMaxC ?? w.current?.temperature_2m ?? w.temperature ?? null,
              windKmh: d0?.windMaxKmh ?? w.current?.wind_speed_10m ?? w.windKmh ?? null,
              label: d0?.summary ?? d0?.label ?? w.label ?? 'Conditions alpines',
            });
          },
        )
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [activeClub.id, currentUserId, loadTransports, outing.id, outing.lat, outing.lng]);

  const cleanTitle = cleanOutingTitle(liveOuting.title);
  const safeLensIdx = Math.max(0, Math.min(4, activeLensIndex));

  const handleOfferTransport = async (body: {
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
  }) => {
    try {
      const res = await fetch(
        `/api/clubs/${encodeURIComponent(activeClub.id)}/events/${encodeURIComponent(outing.id)}/transport`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'offer_transport', ...body }),
        },
      );
      if (!res.ok) {
        onToast?.({ title: 'Publication trajet impossible', subtitle: 'Vérifie ta connexion au club.' });
        return false;
      }
      await loadTransports();
      onToast?.({ title: 'Trajet publié ✓', subtitle: body.outboundFromLabel });
      return true;
    } catch {
      onToast?.({ title: 'Erreur réseau' });
      return false;
    }
  };

  const handleBookSeat = async (transportId: string, leg: 'aller_retour' | 'aller' | 'retour') => {
    try {
      const res = await fetch(
        `/api/clubs/${encodeURIComponent(activeClub.id)}/events/${encodeURIComponent(outing.id)}/transport`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'book_seat', transportId, leg }),
        },
      );
      if (!res.ok) {
        onToast?.({ title: 'Plus de place sur ce sens' });
        return;
      }
      await loadTransports();
      onToast?.({ title: 'Place réservée ✓' });
    } catch {
      onToast?.({ title: 'Erreur réseau' });
    }
  };

  const handleCancelBooking = async (transportId: string) => {
    try {
      await fetch(
        `/api/clubs/${encodeURIComponent(activeClub.id)}/events/${encodeURIComponent(outing.id)}/transport`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cancel_booking', transportId }),
        },
      );
      await loadTransports();
      onToast?.({ title: 'Place libérée' });
    } catch {
      // ignore
    }
  };

  const handleDeleteTransport = async (transportId: string) => {
    try {
      await fetch(
        `/api/clubs/${encodeURIComponent(activeClub.id)}/events/${encodeURIComponent(outing.id)}/transport`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_transport', transportId }),
        },
      );
      await loadTransports();
      onToast?.({ title: 'Trajet supprimé' });
    } catch {
      // ignore
    }
  };

  return (
    <div
      data-testid="club-outing-detail-sheet"
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {/* 1. EN-TÊTE SANS FOND (FERMETURE PILULE CROIX + TITRE) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '2px 0 4px',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Fermer la fiche sortie"
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            border: '0.5px solid rgba(23, 64, 44, 0.16)',
            background: 'rgba(255, 255, 255, 0.85)',
            color: '#17402c',
            display: 'inline-grid',
            placeItems: 'center',
            cursor: 'pointer',
            flex: 'none',
          }}
        >
          <X size={15} aria-hidden="true" />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: '#172b24',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {cleanTitle}
          </div>
          <div style={{ fontSize: 11, color: '#56665d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {liveOuting.dateLabel || liveOuting.date} · {liveOuting.massif}
            {liveOuting.level ? ` · ${liveOuting.level}` : ''}
          </div>
        </div>
      </div>

      {/* 2. CORPS DU VOLET ACTIF */}
      {safeLensIdx === 0 ? (
        <OutingOverviewLens
          outing={liveOuting}
          analysis={analysis}
          organizerName={organizerName}
          organizerAvatarUrl={organizerAvatar}
          registrations={registrations}
          members={members}
          paceGroups={paceGroups}
          selectedPaceGroupId={selectedPaceGroupId}
          onSelectPaceGroup={(pgId) => {
            setSelectedPaceGroupId(pgId);
            onToast?.({ title: 'Groupe d’allure sélectionné ✓' });
          }}
          weather={weather}
          volunteers={volunteers}
          onFlyToCoords={onFlyToCoords}
          onInspectMember={onInspectMember}
        />
      ) : null}

      {safeLensIdx === 1 ? (
        <OutingTransportLens
          outing={liveOuting}
          analysis={analysis}
          members={members}
          transports={transports}
          loading={transportsLoading}
          currentUserId={currentUserId}
          onOfferTransport={handleOfferTransport}
          onBookSeat={handleBookSeat}
          onCancelBooking={handleCancelBooking}
          onDeleteTransport={handleDeleteTransport}
        />
      ) : null}

      {safeLensIdx === 2 ? (
        <OutingGearLens
          outing={liveOuting}
          vaultGear={vaultGear}
          standardKits={standardKits}
          onRequestGearLoan={onRequestGearLoan}
          onToggleReserveGear={onToggleReserveGear}
          onCloneStandardKit={onCloneStandardKit}
          onOpenVaultTab={onOpenVaultTab}
          onToast={onToast}
        />
      ) : null}

      {safeLensIdx === 3 ? (
        <ClubPokedexDrawerBody
          activeClub={activeClub}
          lensId="pokedex"
          pokedexItems={pokedexItems}
          members={members}
          outings={outings}
          currentUserId={currentUserId}
          outingFilterId={outing.id}
          onFlyToCoords={
            onFlyToCoords
              ? (lat, lng) => onFlyToCoords(lat, lng, cleanTitle)
              : undefined
          }
          onObservationCreated={onObservationCreated}
          onToast={onToast}
        />
      ) : null}

      {safeLensIdx === 4 ? (
        <OutingMemoriesLens
          outing={liveOuting}
          stories={stories}
          posts={posts}
          onFlyToCoords={onFlyToCoords}
          onCreatePost={onCreatePost}
        />
      ) : null}
    </div>
  );
}
