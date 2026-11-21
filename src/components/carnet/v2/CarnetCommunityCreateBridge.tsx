'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import {
  AlertTriangle,
  Camera,
  ChevronLeft,
  ChevronRight,
  CloudLightning,
  Compass,
  Droplets,
  HeartPulse,
  Leaf,
  MapPin,
  Mic,
  PenLine,
  Square,
  Trash2,
  Users,
  Wrench,
} from 'lucide-react';
import { getIncidentMeta, INCIDENT_TYPES, type IncidentTypeId } from '@/features/carnet/detail/momentTypes';
import { Toaster, toast } from 'sonner';
import '@/styles/communaute-v2.css';
import '@/styles/communaute-v2-shell.css';
import '@/features/community/v2/create/create-v2.css';
import { CommunitySheetShell } from '@/features/community/v2/shared/CommunitySheetShell';
import { SheetPreviewContext } from '@/features/community/v2/shared/SheetPreview';
import {
  CreateSheetContext,
  type CreateDetailRequest,
  type CreateSheetContextValue,
} from '@/features/community/v2/create/CreateSheetContext';
import type { CreateNavV2 } from '@/features/community/v2/create/engine/nav';
import { createKindConfig, stepAriaLabel } from '@/features/community/v2/create/engine/steps';
import type { CreateKindV2 } from '@/features/community/v2/create/engine/createSchemasV2';
import type { CreateMomentResult } from '@/features/carnet/detail/useCarnetEdits';
import { formatClock, useVoiceRecorder } from '@/features/carnet/detail/useVoiceRecorder';
import { CarnetSpeciesCreatePane, type DiscoveredSpeciesItem } from './CarnetSpeciesCreatePane';
import { CarnetPlaceSearchField } from './CarnetPlaceSearchField';
import type { PokedexApiSpecies } from '@/app/api/pokedex/species/route';
import { createClient } from '@/lib/supabase/client';

const PostFormV2 = dynamic(
  () => import('@/features/community/v2/create/forms/PostFormV2').then((m) => ({ default: m.PostFormV2 })),
  { ssr: false, loading: () => <div className="lkdv-cv2c-form-loading" aria-busy="true" /> },
);
const StoryFormV2 = dynamic(
  () => import('@/features/community/v2/create/forms/StoryFormV2').then((m) => ({ default: m.StoryFormV2 })),
  { ssr: false, loading: () => <div className="lkdv-cv2c-form-loading" aria-busy="true" /> },
);

export type CarnetCreateTabId = 'post' | 'story' | 'voice' | 'meet' | 'species' | 'inc';

const CARNET_CREATE_TABS: ReadonlyArray<{
  id: CarnetCreateTabId;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'post', label: 'Publication', icon: <PenLine size={20} aria-hidden="true" /> },
  { id: 'story', label: 'Story', icon: <Camera size={20} aria-hidden="true" /> },
  { id: 'meet', label: 'Rencontre', icon: <Users size={20} aria-hidden="true" /> },
  { id: 'species', label: 'Espèce', icon: <Leaf size={20} aria-hidden="true" /> },
  { id: 'inc', label: 'Incident', icon: <AlertTriangle size={20} aria-hidden="true" /> },
];

interface CarnetCommunityCreateBridgeProps {
  initialTab?: CarnetCreateTabId;
  initialPrefill?: Record<string, unknown> | null;
  initialSpeciesName?: string;
  initialSpeciesLatin?: string;
  discoveredSpecies?: DiscoveredSpeciesItem[];
  nearbyLat?: number | null;
  nearbyLng?: number | null;
  day: number;
  defaultPlace?: string;
  user: User | null;
  onSubmitMoment: (input: unknown, file: File | null) => Promise<CreateMomentResult>;
  onClose: () => void;
  onCreated: () => void;
}

export function CarnetCommunityCreateBridge({
  initialTab = 'post',
  initialPrefill = null,
  initialSpeciesName = '',
  initialSpeciesLatin = '',
  discoveredSpecies = [],
  nearbyLat = null,
  nearbyLng = null,
  day,
  defaultPlace = '',
  user,
  onSubmitMoment,
  onClose,
  onCreated,
}: CarnetCommunityCreateBridgeProps) {
  const [tabIndex, setTabIndex] = useState(() => {
    const resolved = initialTab === 'voice' ? 'post' : initialTab;
    const idx = CARNET_CREATE_TABS.findIndex((t) => t.id === resolved);
    return idx >= 0 ? idx : 0;
  });
  const [postVoiceMode, setPostVoiceMode] = useState(initialTab === 'voice');
  const [momentStepIndex, setMomentStepIndex] = useState(0);
  const activeTab = CARNET_CREATE_TABS[tabIndex]?.id ?? 'post';

  const [navs, setNavs] = useState<Map<CreateKindV2, CreateNavV2>>(() => new Map());
  const [detail, setDetail] = useState<CreateDetailRequest | null>(null);
  const [previewSlot, setPreviewSlot] = useState<HTMLDivElement | null>(null);
  const stepHostsRef = useRef<Array<HTMLDivElement | null>>([]);
  const [, bumpHostsVersion] = useState(0);

  // Carnet-specific moment fields (voice, meet, species, inc)
  const [place, setPlace] = useState(defaultPlace);
  const [speciesCaption, setSpeciesCaption] = useState(initialSpeciesName);
  const [momentCaptions, setMomentCaptions] = useState<Record<'voice' | 'meet' | 'inc', string>>({
    voice: '',
    meet: '',
    inc: '',
  });
  const [who, setWho] = useState('');
  const [whoMatches, setWhoMatches] = useState<
    Array<{ id: string; name: string; avatarUrl: string | null; location: string | null }>
  >([]);
  const [whoDropdownOpen, setWhoDropdownOpen] = useState(false);
  const [selectedWhoUser, setSelectedWhoUser] = useState<{
    id: string;
    name: string;
    avatarUrl: string | null;
    location: string | null;
  } | null>(null);
  const [whoStats, setWhoStats] = useState<{
    posts: number;
    followers: number;
    following: number;
  } | null>(null);
  const [latin, setLatin] = useState(initialSpeciesLatin);
  const [speciesFile, setSpeciesFile] = useState<File | null>(null);
  const [speciesNote, setSpeciesNote] = useState('');
  const [speciesSuggestions, setSpeciesSuggestions] = useState<
    Array<{ taxonId: number | string; name: string; latin: string; imageUrl?: string | null }>
  >([]);
  const [ambiance, setAmbiance] = useState(false);
  const [incidentType, setIncidentType] = useState<IncidentTypeId>('meteo');
  const [momentBusy, setMomentBusy] = useState(false);
  const [momentError, setMomentError] = useState<string | null>(null);
  const voice = useVoiceRecorder();

  const recordedUrl = useMemo(
    () => (voice.recording ? URL.createObjectURL(voice.recording.file) : null),
    [voice.recording],
  );
  useEffect(
    () => () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    },
    [recordedUrl],
  );

  const attachStepHost = useCallback((stepIndex: number, element: HTMLDivElement | null) => {
    if (stepHostsRef.current[stepIndex] === element) return;
    stepHostsRef.current[stepIndex] = element;
    if (element) {
      queueMicrotask(() => bumpHostsVersion((v) => v + 1));
    }
  }, []);

  const handleNavChange = useCallback((kind: CreateKindV2, nav: CreateNavV2 | null) => {
    setNavs((prev) => {
      const cur = prev.get(kind) ?? null;
      if (cur === nav) return prev;
      if (
        cur &&
        nav &&
        cur.stepIndex === nav.stepIndex &&
        cur.stepCount === nav.stepCount &&
        cur.busy === nav.busy &&
        cur.busyLabel === nav.busyLabel &&
        cur.canBack === nav.canBack &&
        cur.finalLabel === nav.finalLabel &&
        cur.serverError === nav.serverError &&
        cur.hasContent === nav.hasContent
      ) {
        return prev;
      }
      const next = new Map(prev);
      if (nav) next.set(kind, nav);
      else next.delete(kind);
      return next;
    });
  }, []);

  const onPostNavChange = useCallback(
    (nav: CreateNavV2 | null) => handleNavChange('post', nav),
    [handleNavChange],
  );
  const onStoryNavChange = useCallback(
    (nav: CreateNavV2 | null) => handleNavChange('story', nav),
    [handleNavChange],
  );
  const handleVoiceModeChange = useCallback((next: boolean) => {
    setMomentError(null);
    setPostVoiceMode(next);
  }, []);

  const openDetail = useCallback((req: CreateDetailRequest) => setDetail(req), []);
  const closeDetail = useCallback(() => setDetail(null), []);
  const reportCreated = useCallback(() => {
    toast.success('Publié avec succès');
    onCreated();
  }, [onCreated]);
  const noop = useCallback(() => {}, []);

  const contextValue = useMemo<CreateSheetContextValue>(
    () => ({
      user,
      requireAuth: noop,
      reportCreated,
      openDetail,
      closeDetail,
      requestCreate: noop,
    }),
    [closeDetail, noop, openDetail, reportCreated, user],
  );

  const activeCommunityKind: CreateKindV2 | null =
    activeTab === 'post' ? 'post' : activeTab === 'story' ? 'story' : null;
  const activeNav = activeCommunityKind ? navs.get(activeCommunityKind) ?? null : null;

  const momentStepLabels = useMemo(() => {
    if (activeTab === 'voice') return ['Enregistrement', 'Lieu & Note'];
    if (activeTab === 'meet') return ['Voyageur', 'Lieu & Échange'];
    if (activeTab === 'species') return ['Espèce'];
    if (activeTab === 'inc') return ['Incident'];
    return [];
  }, [activeTab]);

  const validatedNowRef = useRef<Set<string>>(new Set());

  const handleValidateSpeciesDiscovery = useCallback(
    async (species: PokedexApiSpecies, file: File) => {
      const res = await onSubmitMoment(
        {
          type: 'species',
          day,
          place,
          caption: species.name,
          latin: species.latin,
        },
        file,
      );
      if (!res.ok) return { ok: false, error: res.error };
      validatedNowRef.current.add(species.latin.toLowerCase());
      validatedNowRef.current.add(species.name.toLowerCase());
      toast.success(`${species.name} validée dans ton Pokédex !`);
      return { ok: true };
    },
    [day, onSubmitMoment, place],
  );

  const communityStepPages = useMemo(() => {
    if (!activeCommunityKind) return null;
    const cfg = createKindConfig(activeCommunityKind);
    const stepHosts = cfg.steps.map((step, index) => (
      <div
        key={`${activeCommunityKind}-${step.id}`}
        className="lkdv-cv2c-step-host"
        ref={(el) => attachStepHost(index, el)}
        data-step-host={index}
      />
    ));
    return CARNET_CREATE_TABS.map((t) => (t.id === activeCommunityKind ? stepHosts : []));
  }, [activeCommunityKind, attachStepHost]);

  const mini = useMemo(() => {
    if (activeCommunityKind && activeNav && communityStepPages) {
      const cfg = createKindConfig(activeCommunityKind);
      return {
        items: cfg.steps.map((step, index) => ({
          id: `cv2c-step-${index}`,
          label: stepAriaLabel(index, step.label),
          icon: <span className="lkdv-cv2c-step-num">{index + 1}</span>,
        })),
        active: activeNav.stepIndex,
        onChange: (index: number) => activeNav.goToStep(index),
        label: `Étapes de la création : ${activeTab === 'story' ? 'Story' : 'Publication'}`,
        pages: communityStepPages,
      };
    }
    if (activeCommunityKind) return null;

    const voicePreview = (
      <div
        className="lkdv-carnet-species-preview"
        style={{ marginBottom: 4 }}
        aria-label="Aperçu du mémo vocal"
      >
        <div
          className="lkdv-carnet-species-preview-media"
          style={{
            background: ambiance
              ? 'linear-gradient(135deg, rgba(27, 67, 50, 0.16), rgba(16, 185, 129, 0.14))'
              : 'rgba(27, 67, 50, 0.08)',
          }}
        >
          <div className="lkdv-carnet-species-preview-empty" style={{ color: '#1b4332' }}>
            <Mic size={24} aria-hidden="true" />
            <span>{voice.recording?.durationLabel || (voice.state === 'recording' ? formatClock(voice.seconds) : '0:00')}</span>
          </div>
          <span className="lkdv-carnet-species-preview-day">Jour {day}</span>
          {ambiance ? (
            <span className="lkdv-carnet-species-preview-rarity">Ambiance</span>
          ) : null}
        </div>
        <div className="lkdv-carnet-species-preview-body">
          <div className="lkdv-carnet-species-preview-title">
            <b>{momentCaptions.voice.trim() || (ambiance ? 'Son d’ambiance' : 'Mémo vocal')}</b>
            <i>{place.trim() || `Lieu non défini · J${day}`}</i>
          </div>
        </div>
      </div>
    );

    const activeIncMeta = getIncidentMeta(incidentType);
    const incIconNode = (id: IncidentTypeId, size = 24) => {
      switch (id) {
        case 'meteo':
          return <CloudLightning size={size} aria-hidden="true" />;
        case 'blessure':
          return <HeartPulse size={size} aria-hidden="true" />;
        case 'materiel':
          return <Wrench size={size} aria-hidden="true" />;
        case 'itineraire':
          return <Compass size={size} aria-hidden="true" />;
        case 'eau':
          return <Droplets size={size} aria-hidden="true" />;
        default:
          return <AlertTriangle size={size} aria-hidden="true" />;
      }
    };

    const incPreview = (
      <div
        className="lkdv-carnet-species-preview"
        style={{
          marginBottom: 4,
          borderColor: `${activeIncMeta.color}3d`,
          background: activeIncMeta.bg,
        }}
        aria-label="Aperçu de l’incident"
      >
        <div
          className="lkdv-carnet-species-preview-media"
          style={{ background: activeIncMeta.bg }}
        >
          <div className="lkdv-carnet-species-preview-empty" style={{ color: activeIncMeta.color }}>
            {incIconNode(activeIncMeta.id, 24)}
            <span>{activeIncMeta.label}</span>
          </div>
          <span className="lkdv-carnet-species-preview-day">Jour {day}</span>
        </div>
        <div className="lkdv-carnet-species-preview-body">
          <div className="lkdv-carnet-species-preview-title">
            <b>{momentCaptions.inc.trim() || `Incident · ${activeIncMeta.label}`}</b>
            <i>{place.trim() || `Lieu non défini · J${day}`}</i>
          </div>
        </div>
      </div>
    );

    const heroName = selectedWhoUser?.name || who.trim() || 'Voyageur rencontré…';
    const heroAvatar = selectedWhoUser?.avatarUrl ?? null;
    const heroSubtitle =
      selectedWhoUser?.location ||
      (place.trim() ? `Rencontré à ${place.trim()}` : 'Rencontre sur le sentier');
    const meetHero = (
      <div
        className={`lkdv-carnet-card lkdv-cv2c-carnet-ig-editor lkdv-cv2x-carnet-ig-tile lkdv-cv2x-member-ig-tile${
          heroAvatar ? ' has-cover-bg' : ''
        }`}
        style={{ minHeight: 'auto', marginBottom: 4 }}
      >
        {heroAvatar ? (
          <span className="lkdv-cv2x-carnet-bg" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroAvatar} alt="" className="lkdv-cv2x-carnet-bg-img" />
            <span className="lkdv-cv2x-carnet-bg-scrim" />
          </span>
        ) : null}
        <span className="lkdv-carnet-card-scroll lkdv-cv2x-tile-link">
          <span className="lkdv-ig-header">
            <span className="lkdv-ig-avi-wrap">
              <span className="lkdv-ig-avi">
                {heroAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={heroAvatar} alt="" className="lkdv-cv2x-cover-img" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span className="lkdv-cv2c-ig-avi-initials">
                    {heroName.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
            </span>
            <span className="lkdv-ig-stats" role="group" aria-label="Statistiques du profil">
              <span className="lkdv-ig-stat">
                <b>{whoStats ? whoStats.posts : '—'}</b>
                <span>publications</span>
              </span>
              <span className="lkdv-ig-stat">
                <b>{whoStats ? whoStats.followers : '—'}</b>
                <span>followers</span>
              </span>
              <span className="lkdv-ig-stat">
                <b>{whoStats ? whoStats.following : '—'}</b>
                <span>suivi(e)s</span>
              </span>
            </span>
          </span>
          <span className="lkdv-ig-bio">
            <span className="lkdv-ig-name lkdv-cv2x-carnet-title">{heroName}</span>
            <span className="lkdv-ig-handle-sub lkdv-cv2-meta">{heroSubtitle}</span>
          </span>
        </span>
      </div>
    );

    const pagesByTab = CARNET_CREATE_TABS.map((t) => {
      if (t.id === 'post' || t.id === 'story') return [];
      if (t.id === 'voice') {
        return [
          <div key="voice-s0" className="lkdv-cv2c-pane">
            {voicePreview}
            <div className="lkdv-cv2-card" style={{ padding: 14, borderRadius: 22 }}>
              <span className="lkdv-cv2-field-label">Enregistrement audio</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                {voice.state === 'recording' ? (
                  <button
                    type="button"
                    className="lkdv-cv2-pill lkdv-cv2-pill--primary"
                    style={{ background: '#a8443a' }}
                    onClick={voice.stop}
                  >
                    <Square size={13} /> Arrêter · {formatClock(voice.seconds)}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="lkdv-cv2-pill lkdv-cv2-pill--primary"
                    disabled={!voice.supported}
                    onClick={() => void voice.start()}
                  >
                    <Mic size={14} /> {voice.state === 'ready' ? 'Réenregistrer' : 'Enregistrer'}
                  </button>
                )}
                {voice.state === 'ready' ? (
                  <button
                    type="button"
                    className="lkdv-cv2-pill lkdv-cv2-pill--secondary"
                    onClick={voice.reset}
                  >
                    <Trash2 size={13} /> Effacer
                  </button>
                ) : null}
              </div>
              {voice.state === 'ready' && voice.recording ? (
                <audio controls src={recordedUrl ?? undefined} style={{ width: '100%', marginTop: 10 }} />
              ) : null}
              <p className="lkdv-cv2-field-hint" style={{ marginTop: 8 }}>
                {voice.message ??
                  (voice.supported
                    ? '3 minutes maximum. Le micro ne s’ouvre qu’à l’appui.'
                    : 'Enregistrement audio non supporté par ce navigateur.')}
              </p>
            </div>
            <span className="lkdv-cv2c-inert-row">
              <span>
                <b>Son d’ambiance</b>
                <small>Marquer comme ambiance sonore du lieu</small>
              </span>
              <button
                type="button"
                className="lkdv-cv2c-switch"
                role="switch"
                aria-checked={ambiance}
                onClick={() => setAmbiance((v) => !v)}
              >
                <span className="lkdv-cv2c-switch-track" aria-hidden="true">
                  <span className="lkdv-cv2c-switch-dot" />
                </span>
              </button>
            </span>
          </div>,
          <div key="voice-s1" className="lkdv-cv2c-pane">
            {voicePreview}
            <CarnetPlaceSearchField label={`Lieu (Jour ${day})`} value={place} onChange={setPlace} />
            <div className="lkdv-cv2-field">
              <span className="lkdv-cv2-field-label">Note ou légende</span>
              <textarea
                className="lkdv-cv2-input"
                rows={3}
                value={momentCaptions.voice}
                maxLength={240}
                placeholder="Un mot sur cette note…"
                onChange={(e) => setMomentCaptions((prev) => ({ ...prev, voice: e.target.value }))}
              />
            </div>
          </div>,
        ];
      }
      if (t.id === 'meet') {
        return [
          <div key="meet-s0" className="lkdv-cv2c-pane">
            {meetHero}
            <div className="lkdv-cv2-field" style={{ position: 'relative' }}>
              <span className="lkdv-cv2-field-label">Personne rencontrée</span>
              <input
                type="text"
                className="lkdv-cv2-input"
                value={who}
                maxLength={60}
                autoComplete="off"
                placeholder="Rechercher parmi mes abonnés…"
                onFocus={() => setWhoDropdownOpen(true)}
                onChange={(e) => {
                  setWho(e.target.value);
                  setSelectedWhoUser(null);
                  setWhoDropdownOpen(true);
                }}
              />
              {whoDropdownOpen && whoMatches.length > 0 ? (
                <div
                  role="listbox"
                  aria-label="Voyageurs correspondants"
                  style={{
                    marginTop: 6,
                    borderRadius: 16,
                    border: '1px solid rgba(27, 67, 50, 0.14)',
                    background: 'rgba(255, 255, 255, 0.96)',
                    boxShadow: '0 10px 26px rgba(15, 23, 42, 0.1)',
                    overflow: 'hidden',
                    maxHeight: 160,
                    overflowY: 'auto',
                  }}
                >
                  {whoMatches.map((u, idx) => (
                    <button
                      key={`${u.id}-${idx}`}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => {
                        setWho(u.name);
                        setSelectedWhoUser(u);
                        setWhoMatches([]);
                        setWhoDropdownOpen(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        border: 0,
                        borderBottom: '1px solid rgba(27, 67, 50, 0.08)',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      {u.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.avatarUrl}
                          alt=""
                          style={{ width: 22, height: 22, borderRadius: 999, objectFit: 'cover' }}
                        />
                      ) : (
                        <span
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 999,
                            background: '#ddebd8',
                            color: '#17402C',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {u.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#111827' }}>{u.name}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>,
          <div key="meet-s1" className="lkdv-cv2c-pane">
            {meetHero}
            <CarnetPlaceSearchField label={`Lieu (Jour ${day})`} value={place} onChange={setPlace} />
            <div className="lkdv-cv2-field">
              <span className="lkdv-cv2-field-label">Ce qu’on s’est dit</span>
              <textarea
                className="lkdv-cv2-input"
                rows={3}
                value={momentCaptions.meet}
                maxLength={240}
                placeholder="Un échange sur le sentier…"
                onChange={(e) => setMomentCaptions((prev) => ({ ...prev, meet: e.target.value }))}
              />
            </div>
          </div>,
        ];
      }
      if (t.id === 'species') {
        return [
          <CarnetSpeciesCreatePane
            key="species-s0"
            day={day}
            place={place}
            onPlaceChange={setPlace}
            caption={speciesCaption}
            onCaptionChange={setSpeciesCaption}
            latin={latin}
            onLatinChange={setLatin}
            speciesFile={speciesFile}
            onSpeciesFileChange={setSpeciesFile}
            note={speciesNote}
            onNoteChange={setSpeciesNote}
            discoveredSpecies={discoveredSpecies}
            nearbyLat={nearbyLat}
            nearbyLng={nearbyLng}
            onValidateDiscovery={handleValidateSpeciesDiscovery}
            user={user}
          />,
        ];
      }
      return [
        <div key="inc-s0" className="lkdv-cv2c-pane">
          {incPreview}
          <div className="lkdv-cv2-field">
            <span className="lkdv-cv2-field-label">Type d’incident</span>
            <div
              role="radiogroup"
              aria-label="Type d’incident"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 8,
              }}
            >
              {INCIDENT_TYPES.map((item) => {
                const selected = incidentType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setIncidentType(item.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      padding: '10px 6px',
                      borderRadius: 16,
                      border: selected
                        ? `1.5px solid ${item.color}`
                        : '1px solid rgba(27, 67, 50, 0.14)',
                      background: selected ? item.bg : 'rgba(255, 255, 255, 0.84)',
                      color: selected ? item.color : '#1b4332',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {incIconNode(item.id, 18)}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <CarnetPlaceSearchField label={`Lieu (Jour ${day})`} value={place} onChange={setPlace} />
          <div className="lkdv-cv2-field">
            <span className="lkdv-cv2-field-label">Ce qui s’est passé</span>
            <textarea
              className="lkdv-cv2-input"
              rows={3}
              value={momentCaptions.inc}
              maxLength={240}
              placeholder="Ampoule, météo, détour…"
              onChange={(e) => setMomentCaptions((prev) => ({ ...prev, inc: e.target.value }))}
            />
          </div>
        </div>,
      ];
    });

    return {
      items: momentStepLabels.map((lbl, index) => ({
        id: `cv2c-mstep-${index}`,
        label: stepAriaLabel(index, lbl),
        icon: <span className="lkdv-cv2c-step-num">{index + 1}</span>,
      })),
      active: momentStepIndex,
      onChange: (index: number) => setMomentStepIndex(index),
      label: `Étapes de la création : ${activeTab}`,
      pages: pagesByTab,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeCommunityKind,
    activeNav,
    activeTab,
    communityStepPages,
    momentStepLabels,
    momentStepIndex,
    ambiance,
    voice.state,
    voice.seconds,
    voice.recording,
    voice.supported,
    voice.message,
    recordedUrl,
    day,
    place,
    momentCaptions,
    who,
    whoDropdownOpen,
    whoMatches,
    selectedWhoUser,
    whoStats,
    speciesCaption,
    latin,
    speciesFile,
    speciesNote,
    discoveredSpecies,
    nearbyLat,
    nearbyLng,
    incidentType,
  ]);

  useEffect(() => {
    if (!whoDropdownOpen || activeTab !== 'meet') return;
    const q = who.trim();
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const url =
        q.length >= 2
          ? `/api/users/search?scope=followers&q=${encodeURIComponent(q)}&limit=12`
          : `/api/users/search?scope=followers&limit=25`;
      fetch(url)
        .then((res) => (res.ok ? res.json() : { users: [] }))
        .then((data: {
          users?: Array<{
            id: string;
            name?: string | null;
            full_name?: string | null;
            avatarUrl?: string | null;
            avatar_url?: string | null;
            location?: string | null;
          }>;
        }) => {
          if (cancelled) return;
          const mapped = Array.isArray(data.users)
            ? data.users
                .map((u) => ({
                  id: u.id,
                  name: (u.name || u.full_name || '').trim(),
                  avatarUrl: u.avatarUrl ?? u.avatar_url ?? null,
                  location: u.location ?? null,
                }))
                .filter((u) => u.name.length > 0)
            : [];
          const filtered =
            q.length === 1
              ? mapped.filter(
                  (u) =>
                    u.name.toLowerCase().includes(q.toLowerCase()) ||
                    (u.location ?? '').toLowerCase().includes(q.toLowerCase()),
                )
              : mapped;
          setWhoMatches(filtered);
        })
        .catch(() => {
          if (!cancelled) setWhoMatches([]);
        });
    }, q.length === 0 ? 0 : 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [who, whoDropdownOpen, activeTab]);

  useEffect(() => {
    const uid = selectedWhoUser?.id;
    if (!uid) {
      setWhoStats(null);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    void Promise.all([
      supabase.from('community_posts').select('id', { count: 'exact', head: true }).eq('author_id', uid),
      supabase.from('user_follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', uid),
      supabase.from('user_follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', uid),
    ])
      .then(([p, f1, f2]) => {
        if (!cancelled) {
          setWhoStats({
            posts: p.count ?? 0,
            followers: f1.count ?? 0,
            following: f2.count ?? 0,
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedWhoUser?.id]);

  const submitCarnetMoment = async (overrideKind?: 'voice' | 'meet' | 'species' | 'inc') => {
    const targetKind = overrideKind ?? activeTab;
    if (momentBusy) return;
    if (targetKind === 'post' || targetKind === 'story') return;
    const tabCaption =
      targetKind === 'species'
        ? speciesCaption
        : momentCaptions[targetKind];

    if (targetKind === 'voice' && !voice.recording?.file) {
      setMomentError('Enregistre un mémo vocal avant de l’ajouter.');
      return;
    }
    if (targetKind === 'meet' && !selectedWhoUser) {
      setMomentError('Sélectionne un voyageur parmi tes abonnés.');
      return;
    }
    if (targetKind === 'inc' && !tabCaption.trim()) {
      setMomentError('Décris brièvement ce qui s’est passé.');
      return;
    }
    if (targetKind === 'species') {
      const c = speciesCaption.trim().toLowerCase();
      const l = latin.trim().toLowerCase();
      if (!c) {
        setMomentError('Sélectionne ou valide une espèce d’abord.');
        return;
      }
      const alreadyDiscovered =
        (c && validatedNowRef.current.has(c)) ||
        (l && validatedNowRef.current.has(l)) ||
        discoveredSpecies.some(
          (d) => (l && d.latin.toLowerCase() === l) || (c && d.name.toLowerCase() === c),
        );
      if (!alreadyDiscovered && !speciesFile) {
        setMomentError('Preuve photo obligatoire pour valider une nouvelle espèce.');
        return;
      }
    }
    setMomentBusy(true);
    setMomentError(null);
    const input: Record<string, unknown> = {
      type: targetKind,
      day,
      place,
      caption: tabCaption,
    };
    if (targetKind === 'voice') {
      input.durationLabel = voice.recording?.durationLabel;
      if (ambiance) input.ambiance = true;
    }
    if (targetKind === 'meet' && selectedWhoUser) {
      input.who = selectedWhoUser.name;
      input.whoUserId = selectedWhoUser.id;
      if (selectedWhoUser.avatarUrl) input.whoAvatarUrl = selectedWhoUser.avatarUrl;
    }
    if (targetKind === 'species') {
      input.latin = latin;
      if (speciesNote.trim()) {
        input.caption = `${speciesCaption.trim() || 'Espèce'} — ${speciesNote.trim()}`;
      }
    }
    if (targetKind === 'inc') {
      input.incidentType = incidentType;
    }

    const attachedFile =
      targetKind === 'voice'
        ? (voice.recording?.file ?? null)
        : targetKind === 'species'
          ? speciesFile
          : null;

    const result = await onSubmitMoment(input, attachedFile);
    setMomentBusy(false);
    if (!result.ok) {
      setMomentError(result.error);
      return;
    }
    toast.success('Moment ajouté au carnet');
    onCreated();
  };

  const isLastMomentStep = momentStepIndex >= momentStepLabels.length - 1;

  const voiceStepContent = (
    <div className="lkdv-cv2c-pane">
      <div
        className="lkdv-carnet-species-preview"
        style={{ marginBottom: 4 }}
        aria-label="Aperçu du mémo vocal"
      >
        <div
          className="lkdv-carnet-species-preview-media"
          style={{
            background: ambiance
              ? 'linear-gradient(135deg, rgba(27, 67, 50, 0.16), rgba(16, 185, 129, 0.14))'
              : 'rgba(27, 67, 50, 0.08)',
          }}
        >
          <div className="lkdv-carnet-species-preview-empty" style={{ color: '#1b4332' }}>
            <Mic size={24} aria-hidden="true" />
            <span>{voice.recording?.durationLabel || (voice.state === 'recording' ? formatClock(voice.seconds) : '0:00')}</span>
          </div>
          <span className="lkdv-carnet-species-preview-day">Jour {day}</span>
          {ambiance ? (
            <span className="lkdv-carnet-species-preview-rarity">Ambiance</span>
          ) : null}
        </div>
        <div className="lkdv-carnet-species-preview-body">
          <div className="lkdv-carnet-species-preview-title">
            <b>{momentCaptions.voice.trim() || (ambiance ? 'Son d’ambiance' : 'Mémo vocal')}</b>
            <i>{place.trim() || `Lieu non défini · J${day}`}</i>
          </div>
        </div>
      </div>

      <div className="lkdv-cv2-card" style={{ padding: 14, borderRadius: 22 }}>
        <span className="lkdv-cv2-field-label">Enregistrement audio</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          {voice.state === 'recording' ? (
            <button
              type="button"
              className="lkdv-cv2-pill lkdv-cv2-pill--primary"
              style={{ background: '#a8443a' }}
              onClick={voice.stop}
            >
              <Square size={13} /> Arrêter · {formatClock(voice.seconds)}
            </button>
          ) : (
            <button
              type="button"
              className="lkdv-cv2-pill lkdv-cv2-pill--primary"
              disabled={!voice.supported}
              onClick={() => void voice.start()}
            >
              <Mic size={14} /> {voice.state === 'ready' ? 'Réenregistrer' : 'Enregistrer'}
            </button>
          )}
          {voice.state === 'ready' ? (
            <button
              type="button"
              className="lkdv-cv2-pill lkdv-cv2-pill--secondary"
              onClick={voice.reset}
            >
              <Trash2 size={13} /> Effacer
            </button>
          ) : null}
        </div>
        {voice.state === 'ready' && voice.recording ? (
          <audio controls src={recordedUrl ?? undefined} style={{ width: '100%', marginTop: 10 }} />
        ) : null}
        <p className="lkdv-cv2-field-hint" style={{ marginTop: 8 }}>
          {voice.message ??
            (voice.supported
              ? '3 minutes maximum. Le micro ne s’ouvre qu’à l’appui.'
              : 'Enregistrement audio non supporté par ce navigateur.')}
        </p>
      </div>

      <span className="lkdv-cv2c-inert-row">
        <span>
          <b>Son d’ambiance</b>
          <small>Marquer comme ambiance sonore du lieu</small>
        </span>
        <button
          type="button"
          className="lkdv-cv2c-switch"
          role="switch"
          aria-checked={ambiance}
          onClick={() => setAmbiance((v) => !v)}
        >
          <span className="lkdv-cv2c-switch-track" aria-hidden="true">
            <span className="lkdv-cv2c-switch-dot" />
          </span>
        </button>
      </span>

      <CarnetPlaceSearchField label={`Lieu (Jour ${day})`} value={place} onChange={setPlace} />

      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">Note ou légende</span>
        <textarea
          className="lkdv-cv2-input"
          rows={2}
          value={momentCaptions.voice}
          maxLength={240}
          placeholder="Un mot sur cette note…"
          onChange={(e) => setMomentCaptions((prev) => ({ ...prev, voice: e.target.value }))}
        />
      </div>
    </div>
  );

  const footer = activeCommunityKind ? (
    activeNav ? (
      <div className="lkdv-cv2c-footbar">
        {postVoiceMode && momentError ? (
          <p className="lkdv-cv2c-server" role="alert">
            {momentError}
          </p>
        ) : activeNav.serverError ? (
          <p className="lkdv-cv2c-server" role="alert">
            {activeNav.serverError}
          </p>
        ) : null}
        <LayoutGroup id="carnet-cv2c-foot">
          <motion.div
            layout
            className="lkdv-cv2c-footbar-row lkdv-cv2c-foot-actions lkdv-cv2c-foot-actions--compact"
            transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {activeNav.canBack ? (
                <motion.button
                  key="back"
                  layout
                  type="button"
                  className="lkdv-cv2-pill lkdv-cv2-pill--secondary lkdv-cv2c-back lkdv-cv2c-back--icon"
                  aria-label="Retour"
                  onClick={activeNav.goBack}
                  disabled={activeNav.busy || momentBusy}
                  initial={{ opacity: 0, x: 34, scale: 0.6 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 34, scale: 0.6 }}
                  transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
                  style={{ position: 'relative', zIndex: 1 }}
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </motion.button>
              ) : null}
            </AnimatePresence>
            <motion.button
              key="next"
              layout="position"
              type="button"
              className="lkdv-cv2-pill lkdv-cv2-pill--primary lkdv-cv2c-next"
              onClick={() => {
                if (postVoiceMode && activeNav.stepIndex >= activeNav.stepCount - 1) {
                  void submitCarnetMoment('voice');
                  return;
                }
                activeNav.goNext();
              }}
              disabled={activeNav.busy || momentBusy || !user}
              transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: 'relative', zIndex: 2 }}
            >
              {momentBusy || activeNav.busy
                ? 'Envoi…'
                : postVoiceMode && activeNav.stepIndex >= activeNav.stepCount - 1
                  ? `Ajouter à J${day}`
                  : activeNav.stepIndex >= activeNav.stepCount - 1
                    ? activeNav.finalLabel
                    : 'Suivant'}
              <ChevronRight size={15} aria-hidden="true" />
            </motion.button>
          </motion.div>
        </LayoutGroup>
      </div>
    ) : null
  ) : (
    <div className="lkdv-cv2c-footbar">
      {momentError ? (
        <p className="lkdv-cv2c-server" role="alert">
          {momentError}
        </p>
      ) : null}
      <LayoutGroup id="carnet-moment-foot">
        <motion.div
          layout
          className="lkdv-cv2c-footbar-row lkdv-cv2c-foot-actions lkdv-cv2c-foot-actions--compact"
        >
          <AnimatePresence initial={false} mode="popLayout">
            {momentStepIndex > 0 ? (
              <motion.button
                key="back"
                type="button"
                className="lkdv-cv2-pill lkdv-cv2-pill--secondary lkdv-cv2c-back lkdv-cv2c-back--icon"
                aria-label="Retour"
                onClick={() => setMomentStepIndex((s) => Math.max(0, s - 1))}
                disabled={momentBusy}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </motion.button>
            ) : null}
          </AnimatePresence>
          <motion.button
            key="next"
            type="button"
            className="lkdv-cv2-pill lkdv-cv2-pill--primary lkdv-cv2c-next"
            disabled={momentBusy}
            onClick={() => {
              if (!isLastMomentStep) {
                setMomentError(null);
                setMomentStepIndex((s) => s + 1);
                return;
              }
              void submitCarnetMoment();
            }}
          >
            {momentBusy ? 'Envoi…' : isLastMomentStep ? `Ajouter à J${day}` : 'Suivant'}
            <ChevronRight size={15} aria-hidden="true" />
          </motion.button>
        </motion.div>
      </LayoutGroup>
    </div>
  );

  const renderMomentForm = (kind: 'voice' | 'meet' | 'inc') => {
    const heroName = selectedWhoUser?.name || who.trim() || 'Voyageur rencontré…';
    const heroAvatar = selectedWhoUser?.avatarUrl ?? null;
    const heroSubtitle =
      selectedWhoUser?.location ||
      (place.trim() ? `Rencontré à ${place.trim()}` : 'Rencontre sur le sentier');

    return (
      <div className="lkdv-cv2c-pane">
        {kind === 'voice' ? (
          <div
            className="lkdv-carnet-species-preview"
            style={{ marginBottom: 4 }}
            aria-label="Aperçu du mémo vocal"
          >
            <div
              className="lkdv-carnet-species-preview-media"
              style={{
                background: ambiance
                  ? 'linear-gradient(135deg, rgba(27, 67, 50, 0.16), rgba(16, 185, 129, 0.14))'
                  : 'rgba(27, 67, 50, 0.08)',
              }}
            >
              <div className="lkdv-carnet-species-preview-empty" style={{ color: '#1b4332' }}>
                <Mic size={24} aria-hidden="true" />
                <span>{voice.recording?.durationLabel || (voice.state === 'recording' ? formatClock(voice.seconds) : '0:00')}</span>
              </div>
              <span className="lkdv-carnet-species-preview-day">Jour {day}</span>
              {ambiance ? (
                <span className="lkdv-carnet-species-preview-rarity">Ambiance</span>
              ) : null}
            </div>
            <div className="lkdv-carnet-species-preview-body">
              <div className="lkdv-carnet-species-preview-title">
                <b>{momentCaptions.voice.trim() || (ambiance ? 'Son d’ambiance' : 'Mémo vocal')}</b>
                <i>{place.trim() || `Lieu non défini · J${day}`}</i>
              </div>
            </div>
          </div>
        ) : null}

        {kind === 'inc' ? (
          <div
            className="lkdv-carnet-species-preview"
            style={{
              marginBottom: 4,
              borderColor: 'rgba(180, 83, 9, 0.24)',
              background: 'rgba(254, 243, 199, 0.38)',
            }}
            aria-label="Aperçu de l’incident"
          >
            <div
              className="lkdv-carnet-species-preview-media"
              style={{ background: 'rgba(217, 119, 6, 0.14)' }}
            >
              <div className="lkdv-carnet-species-preview-empty" style={{ color: '#b45309' }}>
                <AlertTriangle size={24} aria-hidden="true" />
                <span>Incident</span>
              </div>
              <span className="lkdv-carnet-species-preview-day">Jour {day}</span>
            </div>
            <div className="lkdv-carnet-species-preview-body">
              <div className="lkdv-carnet-species-preview-title">
                <b>{momentCaptions.inc.trim() || 'Signalement terrain…'}</b>
                <i>{place.trim() || `Lieu non défini · J${day}`}</i>
              </div>
            </div>
          </div>
        ) : null}

        {kind === 'meet' ? (
          <div
            className={`lkdv-carnet-card lkdv-cv2c-carnet-ig-editor lkdv-cv2x-carnet-ig-tile lkdv-cv2x-member-ig-tile${
              heroAvatar ? ' has-cover-bg' : ''
            }`}
            style={{ minHeight: 'auto', marginBottom: 4 }}
          >
            {heroAvatar ? (
              <span className="lkdv-cv2x-carnet-bg" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={heroAvatar} alt="" className="lkdv-cv2x-carnet-bg-img" />
                <span className="lkdv-cv2x-carnet-bg-scrim" />
              </span>
            ) : null}
            <span className="lkdv-carnet-card-scroll lkdv-cv2x-tile-link">
              <span className="lkdv-ig-header">
                <span className="lkdv-ig-avi-wrap">
                  <span className="lkdv-ig-avi">
                    {heroAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={heroAvatar} alt="" className="lkdv-cv2x-cover-img" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span className="lkdv-cv2c-ig-avi-initials">
                        {heroName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                </span>
                <span className="lkdv-ig-stats" role="group" aria-label="Statistiques du profil">
                  <span className="lkdv-ig-stat">
                    <b>{whoStats ? whoStats.posts : '—'}</b>
                    <span>publications</span>
                  </span>
                  <span className="lkdv-ig-stat">
                    <b>{whoStats ? whoStats.followers : '—'}</b>
                    <span>followers</span>
                  </span>
                  <span className="lkdv-ig-stat">
                    <b>{whoStats ? whoStats.following : '—'}</b>
                    <span>suivi(e)s</span>
                  </span>
                </span>
              </span>
              <span className="lkdv-ig-bio">
                <span className="lkdv-ig-name lkdv-cv2x-carnet-title">{heroName}</span>
                <span className="lkdv-ig-handle-sub lkdv-cv2-meta">{heroSubtitle}</span>
              </span>
            </span>
          </div>
        ) : null}

        <CarnetPlaceSearchField
          label={`Lieu (Jour ${day})`}
          value={place}
          onChange={setPlace}
        />

      {kind === 'voice' ? (
        <>
          <div className="lkdv-cv2-card" style={{ padding: 14, borderRadius: 22 }}>
            <span className="lkdv-cv2-field-label">Enregistrement audio</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              {voice.state === 'recording' ? (
                <button
                  type="button"
                  className="lkdv-cv2-pill lkdv-cv2-pill--primary"
                  style={{ background: '#a8443a' }}
                  onClick={voice.stop}
                >
                  <Square size={13} /> Arrêter · {formatClock(voice.seconds)}
                </button>
              ) : (
                <button
                  type="button"
                  className="lkdv-cv2-pill lkdv-cv2-pill--primary"
                  disabled={!voice.supported}
                  onClick={() => void voice.start()}
                >
                  <Mic size={14} /> {voice.state === 'ready' ? 'Réenregistrer' : 'Enregistrer'}
                </button>
              )}
              {voice.state === 'ready' ? (
                <button
                  type="button"
                  className="lkdv-cv2-pill lkdv-cv2-pill--secondary"
                  onClick={voice.reset}
                >
                  <Trash2 size={13} /> Effacer
                </button>
              ) : null}
            </div>
            {voice.state === 'ready' && voice.recording ? (
              <audio
                controls
                src={recordedUrl ?? undefined}
                style={{ width: '100%', marginTop: 10 }}
              />
            ) : null}
            <p className="lkdv-cv2-field-hint" style={{ marginTop: 8 }}>
              {voice.message ??
                (voice.supported
                  ? '3 minutes maximum. Le micro ne s’ouvre qu’à l’appui.'
                  : 'Enregistrement audio non supporté par ce navigateur.')}
            </p>
          </div>

          <span className="lkdv-cv2c-inert-row">
            <span>
              <b>Son d’ambiance</b>
              <small>Marquer comme ambiance sonore du lieu</small>
            </span>
            <button
              type="button"
              className="lkdv-cv2c-switch"
              role="switch"
              aria-checked={ambiance}
              onClick={() => setAmbiance((v) => !v)}
            >
              <span className="lkdv-cv2c-switch-track" aria-hidden="true">
                <span className="lkdv-cv2c-switch-dot" />
              </span>
            </button>
          </span>
        </>
      ) : null}

      {kind === 'meet' ? (
        <div className="lkdv-cv2-field" style={{ position: 'relative' }}>
          <span className="lkdv-cv2-field-label">Personne rencontrée</span>
          <input
            type="text"
            className="lkdv-cv2-input"
            value={who}
            maxLength={60}
            autoComplete="off"
            placeholder="Rechercher parmi mes abonnés…"
            onFocus={() => setWhoDropdownOpen(true)}
            onChange={(e) => {
              setWho(e.target.value);
              setSelectedWhoUser(null);
              setWhoDropdownOpen(true);
            }}
          />
          {whoDropdownOpen && whoMatches.length > 0 ? (
            <div
              role="listbox"
              aria-label="Voyageurs correspondants"
              style={{
                marginTop: 6,
                borderRadius: 16,
                border: '1px solid rgba(27, 67, 50, 0.14)',
                background: 'rgba(255, 255, 255, 0.96)',
                boxShadow: '0 10px 26px rgba(15, 23, 42, 0.1)',
                overflow: 'hidden',
                maxHeight: 160,
                overflowY: 'auto',
              }}
            >
              {whoMatches.map((u, idx) => (
                <button
                  key={`${u.id}-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    setWho(u.name);
                    setSelectedWhoUser(u);
                    setWhoMatches([]);
                    setWhoDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    border: 0,
                    borderBottom: '1px solid rgba(27, 67, 50, 0.08)',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  {u.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.avatarUrl}
                      alt=""
                      style={{ width: 22, height: 22, borderRadius: 999, objectFit: 'cover' }}
                    />
                  ) : (
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        background: '#ddebd8',
                        color: '#17402C',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {u.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#111827' }}>{u.name}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">
          {kind === 'meet'
            ? 'Ce qu’on s’est dit'
            : kind === 'inc'
              ? 'Ce qui s’est passé'
              : 'Note ou légende'}
        </span>
        <textarea
          className="lkdv-cv2-input"
          rows={3}
          value={momentCaptions[kind]}
          maxLength={240}
          placeholder={
            kind === 'meet'
              ? 'Un échange sur le sentier…'
              : kind === 'inc'
                ? 'Ampoule, météo, détour…'
                : 'Un mot sur cette note…'
          }
          onChange={(e) =>
            setMomentCaptions((prev) => ({
              ...prev,
              [kind]: e.target.value,
            }))
          }
        />
      </div>
    </div>
    );
  };

  // La coque utilise mini.pages (filterMode) pour tous les volets ; panes reste neutre et stable comme CreateSheetV2.
  const panes = useMemo(
    () => CARNET_CREATE_TABS.map((t) => <div key={t.id} data-kind={t.id} />),
    [],
  );

  const capsule = useMemo(
    () => ({
      items: CARNET_CREATE_TABS.map((t) => ({
        id: t.id,
        label: t.label,
        icon: t.icon,
      })),
      active: tabIndex,
      onChange: (idx: number) => {
        setDetail(null);
        setMomentError(null);
        setMomentStepIndex(0);
        setTabIndex(idx);
      },
      ariaLabel: 'Type de moment du carnet',
    }),
    [tabIndex],
  );

  const sheetDetail = detail
    ? {
        pages: [detail.node],
        index: 0,
        title: detail.title,
        meta: detail.meta,
        onBack: () => setDetail(null),
      }
    : null;

  const usesPreviewSlot = activeTab === 'post' || activeTab === 'story';

  return (
    <CreateSheetContext.Provider value={contextValue}>
      <SheetPreviewContext.Provider value={usesPreviewSlot ? previewSlot : null}>
        <CommunitySheetShell
          open
          onClose={onClose}
          kind="create"
          guestNotice={!user?.id || user.is_anonymous === true}
          label="Créer dans le carnet"
          capsule={capsule}
          mini={detail ? null : mini}
          footer={detail ? null : footer}
          panes={panes}
          detail={sheetDetail}
          resetKey={activeTab}
          previewSlotRef={usesPreviewSlot ? setPreviewSlot : undefined}
        >
          {activeTab === 'post' ? (
            <div className="lkdv-cv2c-form-mount" data-kind="post">
              <PostFormV2
                active
                prefill={null}
                prefillNonce={0}
                onNavChange={onPostNavChange}
                stepHosts={stepHostsRef.current}
                voiceMode={postVoiceMode}
                onVoiceModeChange={handleVoiceModeChange}
                voiceStepContent={postVoiceMode ? voiceStepContent : undefined}
              />
            </div>
          ) : null}
          {activeTab === 'story' ? (
            <div className="lkdv-cv2c-form-mount" data-kind="story">
              <StoryFormV2
                active
                prefill={null}
                prefillNonce={0}
                onNavChange={onStoryNavChange}
                stepHosts={stepHostsRef.current}
                inCarnet
              />
            </div>
          ) : null}
          <Toaster
            position="top-center"
            richColors
            offset="max(11px, calc(env(safe-area-inset-top, 0px) - 48px))"
            toastOptions={{ className: 'lkdv-island-toast' }}
          />
        </CommunitySheetShell>
      </SheetPreviewContext.Provider>
    </CreateSheetContext.Provider>
  );
}
