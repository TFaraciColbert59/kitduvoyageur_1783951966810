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
  Leaf,
  MapPin,
  Mic,
  PenLine,
  Square,
  Trash2,
  Users,
} from 'lucide-react';
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
import type { PokedexApiSpecies } from '@/app/api/pokedex/species/route';

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
  { id: 'voice', label: 'Vocal', icon: <Mic size={20} aria-hidden="true" /> },
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
    const idx = CARNET_CREATE_TABS.findIndex((t) => t.id === initialTab);
    return idx >= 0 ? idx : 0;
  });
  const activeTab = CARNET_CREATE_TABS[tabIndex]?.id ?? 'post';

  const [navs, setNavs] = useState<Map<CreateKindV2, CreateNavV2>>(() => new Map());
  const [detail, setDetail] = useState<CreateDetailRequest | null>(null);
  const [previewSlot, setPreviewSlot] = useState<HTMLDivElement | null>(null);
  const stepHostRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [stepHostsVersion, setStepHostsVersion] = useState(0);

  // Carnet-specific moment fields (voice, meet, species, inc)
  const [place, setPlace] = useState(defaultPlace);
  const [caption, setCaption] = useState(initialSpeciesName);
  const [who, setWho] = useState('');
  const [latin, setLatin] = useState(initialSpeciesLatin);
  const [speciesFile, setSpeciesFile] = useState<File | null>(null);
  const [speciesNote, setSpeciesNote] = useState('');
  const [speciesSuggestions, setSpeciesSuggestions] = useState<
    Array<{ taxonId: number | string; name: string; latin: string; imageUrl?: string | null }>
  >([]);
  const [ambiance, setAmbiance] = useState(false);
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

  const stepHostCallbacksRef = useRef<Map<string, (el: HTMLDivElement | null) => void>>(new Map());
  const registerStepHost = useCallback((kind: CreateKindV2, stepIndex: number) => {
    const key = `${kind}:${stepIndex}`;
    let cb = stepHostCallbacksRef.current.get(key);
    if (!cb) {
      cb = (el: HTMLDivElement | null) => {
        if (el) {
          if (stepHostRefs.current.get(key) !== el) {
            stepHostRefs.current.set(key, el);
            setStepHostsVersion((v) => v + 1);
          }
        } else if (stepHostRefs.current.delete(key)) {
          setStepHostsVersion((v) => v + 1);
        }
      };
      stepHostCallbacksRef.current.set(key, cb);
    }
    return cb;
  }, []);

  const stepHostsFor = useCallback(
    (kind: CreateKindV2): Array<HTMLDivElement | null> => {
      void stepHostsVersion;
      const count = createKindConfig(kind).steps.length;
      return Array.from({ length: count }, (_, i) => stepHostRefs.current.get(`${kind}:${i}`) ?? null);
    },
    [stepHostsVersion],
  );

  const handleNavChange = useCallback((kind: CreateKindV2, nav: CreateNavV2 | null) => {
    setNavs((prev) => {
      const next = new Map(prev);
      if (nav) next.set(kind, nav);
      else next.delete(kind);
      return next;
    });
  }, []);

  const contextValue = useMemo<CreateSheetContextValue>(
    () => ({
      user,
      activeKind: activeTab === 'story' ? 'story' : 'post',
      openDetail: (req) => setDetail(req),
      closeDetail: () => setDetail(null),
      reportCreated: () => {
        toast.success('Publié avec succès');
        onCreated();
      },
      requestCreate: () => {},
      requireAuth: () => {},
      registerDirty: () => () => {},
      registerFlush: () => () => {},
      setPreviewCollapsed: () => {},
    }),
    [activeTab, onCreated, user],
  );

  const activeCommunityKind: CreateKindV2 | null =
    activeTab === 'post' ? 'post' : activeTab === 'story' ? 'story' : null;
  const activeNav = activeCommunityKind ? navs.get(activeCommunityKind) ?? null : null;

  const mini = useMemo(() => {
    if (!activeCommunityKind || !activeNav) return null;
    const cfg = createKindConfig(activeCommunityKind);
    const pages = cfg.steps.map((step, index) => [
      <div
        key={`${activeCommunityKind}-step-${index}`}
        className="lkdv-cv2c-step-host"
        ref={registerStepHost(activeCommunityKind, index)}
        data-step-title={step.label}
      />,
    ]);
    return {
      items: cfg.steps.map((step, index) => ({
        id: `cv2c-step-${index}`,
        label: stepAriaLabel(index, step.label),
        icon: <span className="lkdv-cv2c-step-num">{index + 1}</span>,
      })),
      active: activeNav.stepIndex,
      onChange: (index: number) => activeNav.goToStep(index),
      label: `Étapes de la création : ${activeTab === 'story' ? 'Story' : 'Publication'}`,
      pages,
    };
  }, [activeCommunityKind, activeNav, activeTab, registerStepHost]);

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

  const submitCarnetMoment = async () => {
    if (momentBusy) return;
    if (activeTab === 'post' || activeTab === 'story') return;
    if (activeTab === 'species') {
      const c = caption.trim().toLowerCase();
      const l = latin.trim().toLowerCase();
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
      type: activeTab,
      day,
      place,
      caption,
    };
    if (activeTab === 'voice') {
      input.durationLabel = voice.recording?.durationLabel;
      if (ambiance) input.ambiance = true;
    }
    if (activeTab === 'meet') input.who = who;
    if (activeTab === 'species') {
      input.latin = latin;
      if (speciesNote.trim()) {
        input.caption = `${caption.trim() || 'Espèce'} — ${speciesNote.trim()}`;
      }
    }

    const attachedFile =
      activeTab === 'voice'
        ? (voice.recording?.file ?? null)
        : activeTab === 'species'
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

  const footer = activeCommunityKind ? (
    activeNav ? (
      <div className="lkdv-cv2c-footbar">
        {activeNav.serverError ? (
          <p className="lkdv-cv2c-server" role="alert">
            {activeNav.serverError}
          </p>
        ) : null}
        <LayoutGroup id="carnet-cv2c-foot">
          <motion.div
            layout
            className="lkdv-cv2c-footbar-row lkdv-cv2c-foot-actions lkdv-cv2c-foot-actions--compact"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {activeNav.canBack ? (
                <motion.button
                  key="back"
                  type="button"
                  className="lkdv-cv2-pill lkdv-cv2-pill--secondary lkdv-cv2c-back lkdv-cv2c-back--icon"
                  aria-label="Retour"
                  onClick={activeNav.goBack}
                  disabled={activeNav.busy}
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </motion.button>
              ) : null}
            </AnimatePresence>
            <motion.button
              key="next"
              type="button"
              className="lkdv-cv2-pill lkdv-cv2-pill--primary lkdv-cv2c-next"
              onClick={activeNav.goNext}
              disabled={activeNav.busy || !user}
            >
              {activeNav.busy
                ? 'Envoi…'
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
      <div className="lkdv-cv2c-foot-actions lkdv-cv2c-foot-actions--compact">
        <button
          type="button"
          className="lkdv-cv2-pill lkdv-cv2-pill--primary lkdv-cv2c-next"
          disabled={momentBusy}
          onClick={() => void submitCarnetMoment()}
        >
          {momentBusy ? 'Envoi…' : `Ajouter à J${day}`}
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  const renderMomentForm = (kind: 'voice' | 'meet' | 'species' | 'inc') => (
    <div className="lkdv-cv2c-pane">
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">
          <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
          Lieu (Jour {day})
        </span>
        <input
          type="text"
          className="lkdv-cv2-input"
          value={place}
          maxLength={80}
          placeholder="Col, refuge, sommet…"
          onChange={(e) => setPlace(e.target.value)}
        />
      </div>

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
        <div className="lkdv-cv2-field">
          <span className="lkdv-cv2-field-label">Personne rencontrée</span>
          <input
            type="text"
            className="lkdv-cv2-input"
            value={who}
            maxLength={60}
            placeholder="Prénom ou surnom…"
            onChange={(e) => setWho(e.target.value)}
          />
        </div>
      ) : null}

      {kind === 'species' ? (
        <>
          <div className="lkdv-cv2-field">
            <span className="lkdv-cv2-field-label">Nom scientifique (optionnel)</span>
            <input
              type="text"
              className="lkdv-cv2-input"
              value={latin}
              maxLength={80}
              placeholder="Capra ibex…"
              onChange={(e) => setLatin(e.target.value)}
            />
          </div>
          {speciesSuggestions.length > 0 ? (
            <div className="lkdv-carnet-filter-rail" style={{ paddingBottom: 2 }}>
              {speciesSuggestions.map((sp) => (
                <button
                  key={sp.taxonId}
                  type="button"
                  className="lkdv-carnet-filter-pill"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingLeft: 4 }}
                  onClick={() => {
                    setCaption(sp.name);
                    setLatin(sp.latin);
                    setSpeciesSuggestions([]);
                  }}
                >
                  {sp.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sp.imageUrl}
                      alt=""
                      style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : null}
                  <span>{sp.name}</span>
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">
          {kind === 'meet'
            ? 'Ce qu’on s’est dit'
            : kind === 'species'
              ? 'Espèce observée'
              : kind === 'inc'
                ? 'Ce qui s’est passé'
                : 'Note ou légende'}
        </span>
        <textarea
          className="lkdv-cv2-input"
          rows={3}
          value={caption}
          maxLength={240}
          placeholder={
            kind === 'meet'
              ? 'Un échange sur le sentier…'
              : kind === 'species'
                ? 'Bouquetin des Alpes…'
                : kind === 'inc'
                  ? 'Ampoule, météo, détour…'
                  : 'Un mot sur cette note…'
          }
          onChange={(e) => setCaption(e.target.value)}
        />
      </div>
    </div>
  );

  const panes = CARNET_CREATE_TABS.map((t) => {
    if (t.id === 'post' || t.id === 'story') {
      return <div key={t.id} className="lkdv-cv2c-pane" />;
    }
    if (t.id === 'species') {
      return (
        <CarnetSpeciesCreatePane
          key="species"
          day={day}
          place={place}
          onPlaceChange={setPlace}
          caption={caption}
          onCaptionChange={setCaption}
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
        />
      );
    }
    return <React.Fragment key={t.id}>{renderMomentForm(t.id)}</React.Fragment>;
  });

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
          capsule={{
            items: CARNET_CREATE_TABS.map((t) => ({
              id: t.id,
              label: t.label,
              icon: t.icon,
            })),
            active: tabIndex,
            onChange: (idx) => {
              setDetail(null);
              setMomentError(null);
              setTabIndex(idx);
            },
            ariaLabel: 'Type de moment du carnet',
          }}
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
                prefill={initialPrefill}
                prefillNonce={1}
                onNavChange={(nav) => handleNavChange('post', nav)}
                stepHosts={stepHostsFor('post')}
              />
            </div>
          ) : null}
          {activeTab === 'story' ? (
            <div className="lkdv-cv2c-form-mount" data-kind="story">
              <StoryFormV2
                active
                prefill={initialPrefill}
                prefillNonce={1}
                onNavChange={(nav) => handleNavChange('story', nav)}
                stepHosts={stepHostsFor('story')}
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
