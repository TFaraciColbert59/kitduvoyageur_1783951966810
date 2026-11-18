'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bike,
  CloudSun,
  Footprints,
  Loader2,
  MapPin,
  Mountain,
  Snowflake,
  Upload,
  Users,
} from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import type { User } from '@supabase/supabase-js';
import { EventTicket } from '../../shared/EventTicket';
import {
  elevationGain,
  lengthKm,
  sampleAlong,
} from '@/features/community/create/carnet/traceEngine';
import { parseGpxTrace } from '../carnet/gpx';
import {
  TrailSearchFieldV2,
  type TrailDetail,
  type TrailSummary,
} from '../carnet/TrailSearchFieldV2';
import type { EventCardVM } from '../../shared/types';
import { CreateFormEngineV2, type CreateFormEngineApiV2 } from '../engine/CreateFormEngineV2';
import {
  createDefaultsV2,
  type SortieFormValuesV2,
  sortieSchemaV2,
} from '../engine/createSchemasV2';
import { useCreateSheet } from '../CreateSheetContext';
import { createEventWithPostV2, toStartsAt } from '../createRpc';
import { ChipsFieldV2, SegmentedFieldV2 } from '../fields/ChipsV2';
import { SelectDropdownV2 } from '../fields/SelectDropdownV2';
import { VisibilityPickerV2 } from '../fields/VisibilityPickerV2';
import { useMyClubsV2 } from '../club/useMyClubsV2';
import { DateFieldV2, TimeFieldV2 } from '../fields/DateFieldV2';
import { NumberFieldV2, NumberStepperV2 } from '../fields/NumberStepperV2';
import { TextAreaFieldV2, TextFieldV2 } from '../fields/FieldV2';
import { PlaceFieldV2 } from '../fields/PlaceFieldV2';
import { PrefillApplierV2 } from '../fields/PrefillApplierV2';
import { deleteMediaObjectsV2, uploadedObjectsOf } from '../fields/media';
import { MeetingMapV2 } from '../sortie/MeetingMapV2';
import {
  formatFiguresFr,
  importedFiguresV2,
  loadItinerarySourcesV2,
  type ItinerarySourceKindV2,
  type ItinerarySourceV2,
} from '../sortie/itinerarySourcesV2';
import { createClient } from '@/lib/supabase/client';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { SheetPreview } from '../../shared/SheetPreview';
import { CollapsibleHeroPreview, useScrollCollapsePreview } from '../photo/CollapsibleHeroPreview';
import type { CreateFormV2Props } from './types';

/** Icônes **linéaires** de la maquette (FID-052) : plus d'emoji. */
const ACTIVITY_ICONS = {
  rando: <Mountain size={14} aria-hidden="true" />,
  trail: <Footprints size={14} aria-hidden="true" />,
  ski: <Snowflake size={14} aria-hidden="true" />,
  velo: <Bike size={14} aria-hidden="true" />,
  escalade: <Mountain size={14} aria-hidden="true" />,
  autre: <Mountain size={14} aria-hidden="true" />,
} as const;

const ACTIVITY_OPTIONS = [
  { value: 'rando', label: 'Rando' },
  { value: 'trail', label: 'Trail' },
  { value: 'ski', label: 'Ski de rando' },
  { value: 'velo', label: 'Vélo' },
  { value: 'escalade', label: 'Escalade' },
  { value: 'autre', label: 'Autre' },
] as const;

/** Échelle à 5 niveaux et définitions de la maquette (HTML L3095). */
const LEVELS = [
  {
    value: 'tres_facile',
    label: 'Très facile',
    hint: 'Sentier large, peu de dénivelé, accessible à tous.',
  },
  { value: 'facile', label: 'Facile', hint: 'Sentier balisé, jusqu’à 500 m de dénivelé.' },
  {
    value: 'moyen',
    label: 'Moyen',
    hint: 'Dénivelé soutenu, terrain varié, bonne condition requise.',
  },
  {
    value: 'difficile',
    label: 'Difficile',
    hint: 'Longue journée, passages exposés ou techniques.',
  },
  {
    value: 'expert',
    label: 'Expert',
    hint: 'Terrain alpin, matériel spécifique, grande expérience.',
  },
] as const;

const RECURRENCES = [
  { value: '', label: 'Aucune' },
  { value: 'weekly', label: 'Chaque semaine' },
  { value: 'monthly', label: 'Chaque mois' },
] as const;

/** Check-list de sécurité de la maquette (HTML L3097) : 6 objets. */
const SAFETY_CHIPS = ['DVA', 'Pelle', 'Sonde', 'Frontale', 'Eau', 'Couverture de survie'];

interface ClubOption {
  id: string;
  name: string;
  slug: string;
}

interface KitOption {
  id: string;
  name: string;
}

function weatherLabelFor(label: string, tMax: number | null): string {
  return tMax != null ? `${Math.round(tMax)}° · ${label || 'prévision'}` : label || 'prévision';
}

type SortieLevel = (typeof LEVELS)[number]['value'];

function mapHikeDifficultyToSortieLevel(raw: string | null | undefined): SortieLevel | null {
  if (!raw) return null;
  const s = raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
  if (!s) return null;
  if (s.includes('tres facile') || s === 'tres_facile' || s === 't1' || s === '1') return 'tres_facile';
  if (s.includes('tres difficile') || s.includes('expert') || s.includes('alpin') || s === 't5' || s === 't6' || s === '5') return 'expert';
  if (s.includes('difficile') || s.includes('soutenu') || s === 't4' || s === '4') return 'difficile';
  if (s.includes('moyen') || s.includes('modere') || s.includes('intermediaire') || s === 't3' || s === '3') return 'moyen';
  if (s.includes('facile') || s === 't2' || s === '2' || s === 'f') return 'facile';
  return null;
}

function formatHikeDurationFr(hours: number | null | undefined, km: number, gainM: number): string {
  const effectiveHours =
    hours != null && Number.isFinite(hours) && hours > 0
      ? hours
      : km > 0 || gainM > 0
        ? km / 4 + gainM / 350
        : 0;
  if (effectiveHours <= 0) return '';
  const totalMin = Math.max(30, Math.round((effectiveHours * 60) / 15) * 15);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

function buildTicket(values: SortieFormValuesV2, user: User | null): EventCardVM {
  const startsAt = toStartsAt(values.date, values.startTime);
  return {
    id: 'cv2c-preview',
    title: values.title.trim() || 'Titre de la sortie',
    activity: values.activity,
    startsAt,
    endsAt: values.endTime ? toStartsAt(values.date, values.endTime) : null,
    eventDate: values.date,
    location: values.location.trim(),
    meetingPoint: values.meetingPoint.trim() || null,
    level: values.level,
    // FID-052 : le billet d'aperçu montre « 0 km · +0 m » avant saisie, comme
    // la maquette (le billet Explorer garde `null` quand la donnée manque).
    distanceKm: values.distanceKm,
    elevationGainM: values.elevationGainM,
    duration: values.duration || null,
    coverImage: values.cover[0]?.previewUrl || values.cover[0]?.url || null,
    coverAlt: values.cover[0]?.alt ?? null,
    maxParticipants: values.maxParticipants,
    currentParticipants: 1,
    spotsLeft: Math.max(0, values.maxParticipants - 1),
    waitlistEnabled: values.waitlist,
    myStatus: 'registered',
    organizer: {
      id: user?.id ?? 'preview',
      name: (user?.user_metadata?.full_name as string | undefined) ?? 'Toi',
      initials: 'T',
      avatarUrl: (user?.user_metadata?.avatar_url as string | undefined) ?? null,
    },
    participants: [],
    participantsTotal: 1,
    clubId: values.clubId || null,
    clubName: null,
    kitId: values.kitId || null,
    description: values.description || null,
    safetyNotes: values.safetyNotes || null,
    safetyChecklist: values.safetyChecklist,
    recurrence: values.recurrence === '' ? null : values.recurrence,
    past: false,
    distanceKmFromMe: null,
  };
}

function ActivityPlaceStep({ prefill }: { prefill?: Record<string, unknown> | null }) {
  const form = useFormContext<SortieFormValuesV2>();
  const values = form.watch();
  const clubName = typeof prefill?.clubName === 'string' ? prefill.clubName : '';
  const returnToPostEvent = Boolean(prefill?.returnToPostEvent);
  const prefilledDate = typeof prefill?.date === 'string' ? prefill.date : '';
  return (
    <>
      {returnToPostEvent ? (
        <div className="lkdv-cv2-card lkdv-cv2c-event-sortie-banner" data-testid="cv2c-sortie-return-banner">
          <b>Sortie pour ton post Événement{prefilledDate ? ` · ${prefilledDate}` : ''}</b>
          <small>
            Une fois créée, cette sortie sera automatiquement rattachée à ta publication.
          </small>
        </div>
      ) : null}
      <div className="lkdv-cv2c-row-2">
        <SelectDropdownV2
          name="activity"
          label="Activité"
          options={ACTIVITY_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
        <SelectDropdownV2
          name="recurrence"
          label="Récurrence"
          options={RECURRENCES.map((entry) => ({
            value: entry.value,
            label: entry.label,
          }))}
        />
      </div>
      <TextFieldV2
        name="title"
        label="Titre"
        placeholder="Lac Blanc au lever du jour"
        required
        maxLength={120}
      />
      <PlaceFieldV2
        name="location"
        label="Lieu"
        placeholder="Chamonix…"
        latName="meetingLat"
        lngName="meetingLng"
        required
      />
      {clubName ? (
        <p className="lkdv-cv2c-recap lkdv-cv2-card">
          <span className="lkdv-cv2-eyebrow">Club</span>
          <b>{clubName}</b>
          <small>La sortie sera rattachée au club.</small>
        </p>
      ) : null}
      <fieldset className="lkdv-cv2c-fset" data-testid="cv2-sortie-rdv">
        <legend className="lkdv-cv2-field-label">Rendez-vous</legend>
        <MeetingMapV2
          lat={values.meetingLat}
          lng={values.meetingLng}
          onChange={(lat, lng) => {
            form.setValue('meetingLat', lat, { shouldDirty: true, shouldValidate: true });
            form.setValue('meetingLng', lng, { shouldDirty: true, shouldValidate: true });
          }}
          onResolveAddress={(labelText) => {
            form.setValue('meetingPoint', labelText, { shouldDirty: true, shouldValidate: true });
            if (!form.getValues('location')?.trim()) {
              form.setValue('location', labelText, { shouldDirty: true, shouldValidate: true });
            }
          }}
        />
        {/* FID-064 — fieldset « Rendez-vous » de la maquette (L3120-3124) :
          date, heure de départ, heure de fin et récurrence sont sur l'étape 1.
          FID-063 — la photo de couverture (ajout V2 sans équivalent maquette)
          est retirée du flux. */}
        <DateFieldV2
          name="date"
          label="Date"
          required
          min={new Date().toISOString().slice(0, 10)}
        />
        <div className="lkdv-cv2c-row-2">
          <TimeFieldV2 name="startTime" label="Départ" required />
          <TimeFieldV2 name="endTime" label="Fin (optionnel)" />
        </div>
      </fieldset>
    </>
  );
}

function ItineraireStep() {
  const form = useFormContext<SortieFormValuesV2>();
  const values = form.watch();
  const { haptic } = useHapticFeedback();
  const [traceState, setTraceState] = useState<'idle' | 'loading' | 'error'>('idle');
  const traceInputRef = useRef<HTMLInputElement | null>(null);
  // Sortie#5 — import depuis un carnet ou une sortie enregistrée.
  const { user } = useCreateSheet();
  const [sourceKind, setSourceKind] = useState<ItinerarySourceKindV2 | null>(null);
  const [sources, setSources] = useState<ItinerarySourceV2[] | null>(null);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [imported, setImported] = useState<string | null>(null);

  const openSources = async (kind: ItinerarySourceKindV2) => {
    haptic('selection');
    if (sourceKind === kind) {
      setSourceKind(null);
      return;
    }
    setSourceKind(kind);
    setSources(null);
    setSourcesError(null);
    const result = await loadItinerarySourcesV2(kind, user?.id ?? '');
    setSources(result.data);
    setSourcesError(result.error);
  };

  const pickSource = (source: ItinerarySourceV2) => {
    const figures = importedFiguresV2(source);
    form.setValue('distanceKm', figures.distanceKm, { shouldDirty: true, shouldValidate: true });
    form.setValue('elevationGainM', figures.elevationGainM, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setImported(source.name);
    setSourceKind(null);
    setTraceState('idle');
    haptic('success');
  };

  const pickTrail = (trail: TrailSummary, points: [number, number][], detail: TrailDetail) => {
    const rawKm =
      trail.distance_km ??
      detail.distance_km ??
      (points.length >= 2 ? Math.round(lengthKm(points) * 10) / 10 : 0);
    const km = Math.min(500, Math.max(0, Math.round(rawKm * 10) / 10));
    const gain = Math.min(
      20_000,
      Math.max(0, Math.round(trail.elevation_gain ?? detail.elevation_gain ?? 0)),
    );
    const mappedLevel = mapHikeDifficultyToSortieLevel(trail.difficulty ?? detail.difficulty);
    const durationStr = formatHikeDurationFr(trail.duration_hours ?? detail.duration_hours, km, gain);
    const trailTitle = (trail.name ?? detail.name ?? '').trim();

    if (km > 0) form.setValue('distanceKm', km, { shouldDirty: true, shouldValidate: true });
    if (gain > 0) form.setValue('elevationGainM', gain, { shouldDirty: true, shouldValidate: true });
    if (mappedLevel) form.setValue('level', mappedLevel, { shouldDirty: true, shouldValidate: true });
    if (durationStr) form.setValue('duration', durationStr, { shouldDirty: true, shouldValidate: true });
    if (trailTitle && !form.getValues('title')?.trim()) {
      form.setValue('title', trailTitle.slice(0, 120), { shouldDirty: true, shouldValidate: true });
    }
    if (trailTitle && !form.getValues('location')?.trim()) {
      form.setValue('location', trailTitle.slice(0, 120), { shouldDirty: true });
    }
    const startLat = points[0]?.[1] ?? detail.lat ?? trail.lat;
    const startLng = points[0]?.[0] ?? detail.lng ?? trail.lng;
    if (typeof startLat === 'number' && typeof startLng === 'number') {
      form.setValue('meetingLat', startLat, { shouldDirty: true });
      form.setValue('meetingLng', startLng, { shouldDirty: true });
    }
    const extraDesc = (detail.ai_description ?? trail.ai_description ?? '').trim();
    if (extraDesc && !form.getValues('description')?.trim()) {
      form.setValue('description', extraDesc.slice(0, 1500), { shouldDirty: true });
    }
    setImported(trailTitle || 'Randonnée');
    setTraceState('idle');
    haptic('success');
  };

  const importTrace = async (file: File | undefined) => {
    if (!file) return;
    setTraceState('loading');
    try {
      const points = parseGpxTrace(await file.text());
      if (points.length < 2) throw new Error('trace');
      const km = Math.min(500, Math.round(lengthKm(points) * 10) / 10);
      form.setValue('distanceKm', km, { shouldDirty: true, shouldValidate: true });
      const samples = sampleAlong(points, Math.max(2, Math.min(100, Math.round(km * 8) + 2)));
      const query = samples.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(';');
      const response = await fetch(`/api/elevation?points=${query}`);
      if (response.ok) {
        const payload = (await response.json()) as { elevations?: Array<number | null> };
        const gain = elevationGain(
          Array.isArray(payload.elevations) ? payload.elevations : []
        ).gain;
        form.setValue('elevationGainM', Math.min(20_000, gain), {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      setTraceState('idle');
      setImported(file.name);
      haptic('success');
    } catch {
      setTraceState('error');
    }
  };

  return (
    <>
      <TrailSearchFieldV2
        label="Rechercher une randonnée (pré-remplissage auto)"
        placeholder="Lac Blanc, Chamonix, GR20…"
        selectedHint={
          imported
            ? `« ${imported} » appliqué : difficulté, distance, dénivelé et durée mis à jour.`
            : undefined
        }
        onPickTrail={pickTrail}
      />
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label" id="cv2c-level-label">
          Niveau de difficulté
        </span>
        <div className="lkdv-cv2c-difficulty" role="radiogroup" aria-labelledby="cv2c-level-label">
          {LEVELS.map((level, index) => (
            <button
              key={level.value}
              type="button"
              role="radio"
              aria-checked={values.level === level.value}
              aria-label={`${index + 1}. ${level.label}`}
              onClick={() => {
                form.setValue('level', level.value, { shouldDirty: true, shouldValidate: true });
                haptic('selection');
              }}
            >
              <b aria-hidden="true">{index + 1}</b>
              <small aria-hidden="true">{level.label}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="lkdv-cv2c-metric-row">
        <NumberFieldV2 name="distanceKm" label="Distance" unit="km" max={500} step={0.1} />
        {/* Maquette L3129 : dénivelé en **stepper** (pas de champ libre). */}
        <NumberStepperV2
          name="elevationGainM"
          label="Dénivelé positif"
          unit="m"
          min={0}
          max={20_000}
          step={50}
        />
      </div>
      <fieldset className="lkdv-cv2c-fset" data-testid="cv2-sortie-import">
        <legend className="lkdv-cv2-field-label">Importer un itinéraire</legend>
        <input
          ref={traceInputRef}
          type="file"
          accept=".gpx,application/gpx+xml"
          className="lkdv-cv2c-sr-only"
          aria-label="Importer une trace GPX"
          onChange={(event) => {
            void importTrace(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <div className="lkdv-cv2-chips" role="group" aria-label="Source de l’itinéraire">
          <button
            type="button"
            className="lkdv-cv2-chip lkdv-cv2-chip--lg"
            onClick={() => traceInputRef.current?.click()}
            disabled={traceState === 'loading'}
          >
            {traceState === 'loading' ? (
              <Loader2 size={13} className="lkdv-cv2c-spin" aria-hidden="true" />
            ) : (
              <Upload size={13} aria-hidden="true" />
            )}
            Une trace
          </button>
          <button
            type="button"
            className="lkdv-cv2-chip lkdv-cv2-chip--lg"
            aria-expanded={sourceKind === 'carnet'}
            aria-controls="cv2c-import-list"
            onClick={() => void openSources('carnet')}
          >
            Un carnet
          </button>
          <button
            type="button"
            className="lkdv-cv2-chip lkdv-cv2-chip--lg"
            aria-expanded={sourceKind === 'sortie'}
            aria-controls="cv2c-import-list"
            onClick={() => void openSources('sortie')}
          >
            Une sortie enregistrée
          </button>
        </div>
        {sourceKind ? (
          <div
            id="cv2c-import-list"
            className="lkdv-cv2c-kit-sources"
            data-testid="cv2-import-list"
          >
            {sources == null ? (
              <p className="lkdv-cv2-field-hint" role="status">
                <Loader2 size={12} className="lkdv-cv2c-spin" aria-hidden="true" /> Chargement…
              </p>
            ) : null}
            {sourcesError ? (
              <p className="lkdv-cv2-field-hint lkdv-cv2c-notice" role="status">
                {sourcesError}
              </p>
            ) : null}
            {sources && !sourcesError && sources.length === 0 ? (
              <p className="lkdv-cv2-field-hint">
                {sourceKind === 'carnet'
                  ? 'Aucun de tes carnets n’a de distance renseignée.'
                  : 'Aucune sortie enregistrée avec une distance.'}
              </p>
            ) : null}
            {sources?.map((source) => (
              <button
                key={source.id}
                type="button"
                className="lkdv-cv2c-kit-source"
                onClick={() => pickSource(source)}
              >
                <b>{source.name}</b>
                <small>
                  {formatFiguresFr(source)} · {source.meta}
                </small>
              </button>
            ))}
          </div>
        ) : null}
        {imported && traceState !== 'error' ? (
          <p
            className="lkdv-cv2-field-hint lkdv-cv2c-notice"
            role="status"
            data-testid="cv2-import-done"
          >
            Importé : {imported}. Distance et D+ calculés.
          </p>
        ) : null}
        {traceState === 'error' ? (
          <p className="lkdv-cv2-field-hint lkdv-cv2c-notice" role="status">
            Trace illisible ou vide : distance et dénivelé peuvent être saisis à la main.
          </p>
        ) : null}
      </fieldset>
      <TextFieldV2 name="duration" label="Durée estimée" placeholder="5 h" maxLength={60} />
    </>
  );
}

function ParticipantsStep() {
  const form = useFormContext<SortieFormValuesV2>();
  const values = form.watch();
  const { user, requestCreate } = useCreateSheet();
  const myClubs = useMyClubsV2(user?.id ?? null);
  const [visMode, setVisMode] = useState<'public' | 'private' | 'club'>(() =>
    values.clubId ? 'club' : 'public',
  );

  useEffect(() => {
    if (visMode === 'club') void myClubs.load();
  }, [myClubs, visMode]);

  const percentage =
    values.maxParticipants > 0 ? Math.min(100, Math.round((1 / values.maxParticipants) * 100)) : 0;

  return (
    <>
      <NumberStepperV2 name="maxParticipants" label="Participants maximum" min={2} max={50} />
      <button
        type="button"
        className="lkdv-cv2c-switch"
        role="switch"
        aria-checked={values.waitlist}
        onClick={() => form.setValue('waitlist', !values.waitlist, { shouldDirty: true })}
      >
        <span className="lkdv-cv2c-switch-track" aria-hidden="true">
          <span className="lkdv-cv2c-switch-dot" />
        </span>
        Activer la liste d’attente quand c’est complet
      </button>
      <VisibilityPickerV2
        name="clubId"
        label="Visibilité"
        value={visMode}
        onSelectValue={(next) => {
          const mode = next as 'public' | 'private' | 'club';
          setVisMode(mode);
          if (mode !== 'club') {
            form.setValue('clubId', '', { shouldDirty: true, shouldValidate: true });
          }
        }}
        clubs={myClubs.clubs ?? []}
        clubsLoading={myClubs.loading}
        clubsError={myClubs.error}
        onCreateClub={() => requestCreate('club')}
      />
    </>
  );
}

interface SortieKitCardOption {
  id: string;
  name: string;
  description?: string | null;
  total_weight_g?: number | null;
  field_proven_count?: number | null;
}

function formatKitWeight(grams?: number | null): string {
  if (!grams || grams <= 0) return 'Poids n.c.';
  return grams >= 1000 ? `${(grams / 1000).toFixed(1).replace('.', ',')} kg` : `${grams} g`;
}

function SecuriteStep() {
  const form = useFormContext<SortieFormValuesV2>();
  const values = form.watch();
  const ski = values.activity === 'ski';
  const { user } = useCreateSheet();
  const [kits, setKits] = useState<SortieKitCardOption[] | null>(null);
  const [kitsOpen, setKitsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const openKitRail = async () => {
    const nextOpen = !kitsOpen;
    setKitsOpen(nextOpen);
    if (!nextOpen || !user || loading || kits) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('materiel_kits')
        .select('id, name, description, total_weight_g, field_proven_count')
        .eq('user_id', user.id)
        .eq('is_trashed', false)
        .order('updated_at', { ascending: false })
        .limit(20);
      setKits(Array.isArray(data) ? (data as SortieKitCardOption[]) : []);
    } catch {
      setKits([]);
    } finally {
      setLoading(false);
    }
  };

  const applySafetyPreset = (preset: 'rando' | 'ski' | 'bivouac') => {
    const items =
      preset === 'ski'
        ? ['DVA', 'Pelle', 'Sonde', 'Couverture de survie']
        : preset === 'bivouac'
          ? ['Lampe frontale', 'Couverture de survie', 'Trousse de secours', 'Eau 1,5 L']
          : ['Eau 1,5 L', 'Coupe-vent', 'Trousse de secours'];
    const available = items.filter((item) => (SAFETY_CHIPS as readonly string[]).includes(item));
    form.setValue('safetyChecklist', available.length > 0 ? available : items, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <>
      <SelectDropdownV2
        name="safetyChecklist"
        label={ski ? 'Check-list de sécurité *' : 'Check-list de sécurité'}
        multiple
        placeholder="Choisir le matériel de sécurité…"
        options={SAFETY_CHIPS.map((entry) => ({ value: entry, label: entry }))}
        hint={
          ski
            ? 'Ski de rando : le DVA est obligatoire.'
            : undefined
        }
      />
      <TextAreaFieldV2
        name="safetyNotes"
        label="Consignes de sécurité"
        placeholder="DVA, pelle, sonde obligatoires…"
        maxLength={500}
      />
      {/* FID-064 : « Matériel requis » sur l'étape Sécurité (maquette L3138),
          en chips de kits existants. */}
      <div className="lkdv-cv2-field">
        <div className="lkdv-cv2c-field-head">
          <span className="lkdv-cv2-field-label">Matériel requis</span>
          <button
            type="button"
            className="lkdv-cv2-chip lkdv-cv2-chip--sm"
            onClick={() => void openKitRail()}
            aria-expanded={kitsOpen}
          >
            {loading ? (
              <Loader2 size={12} className="lkdv-cv2c-spin" aria-hidden="true" />
            ) : (
              <Mountain size={12} aria-hidden="true" />
            )}
            {kitsOpen ? 'Fermer les kits' : 'Ajouter un kit'}
          </button>
        </div>
        {kitsOpen ? (
          <div className="lkdv-cv2c-hrail lkdv-cv2c-kitcard-rail" role="radiogroup" aria-label="Mes kits">
            <button
              type="button"
              role="radio"
              aria-checked={!values.kitId}
              className="lkdv-cv2c-kitcard is-none"
              data-active={!values.kitId}
              onClick={() => form.setValue('kitId', '', { shouldDirty: true, shouldValidate: true })}
            >
              <b>Aucun kit</b>
              <small>Sans liste liée</small>
            </button>
            {(kits ?? []).map((kit) => {
              const active = values.kitId === kit.id;
              return (
                <button
                  key={kit.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className="lkdv-cv2c-kitcard"
                  data-active={active}
                  onClick={() =>
                    form.setValue('kitId', active ? '' : kit.id, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <div className="lkdv-cv2c-kitcard-top">
                    <span className="lkdv-cv2c-kitcard-ico" aria-hidden="true">
                      <Mountain size={14} />
                    </span>
                    <span className="lkdv-cv2c-kitcard-weight">{formatKitWeight(kit.total_weight_g)}</span>
                  </div>
                  <b className="lkdv-cv2c-kitcard-name">{kit.name}</b>
                  <small className="lkdv-cv2c-kitcard-meta">
                    {kit.field_proven_count && kit.field_proven_count > 0
                      ? `${kit.field_proven_count} sortie${kit.field_proven_count > 1 ? 's' : ''} éprouvée${kit.field_proven_count > 1 ? 's' : ''}`
                      : kit.description?.slice(0, 36) || 'Kit personnel'}
                  </small>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <TextAreaFieldV2
        name="description"
        label="Programme"
        placeholder="Le programme, le matériel, le rythme…"
        maxLength={1500}
      />
    </>
  );
}

function SortieBody({
  api,
  user,
  prefill,
  prefillNonce,
}: {
  api: CreateFormEngineApiV2<SortieFormValuesV2>;
  user: User | null;
  prefill?: Record<string, unknown> | null;
  prefillNonce: number;
}) {
  const values = api.form.watch();
  const ticket = useMemo(() => buildTicket(values, user), [user, values]);
  const [weather, setWeather] = useState<string | null>(null);
  const [weatherState, setWeatherState] = useState<'idle' | 'loading' | 'off'>('idle');

  // Météo du billet (FID-052) : mêmes conditions que le formulaire, appel à la
  // route `/api/weather` existante, aucun nouvel accès réseau.
  useEffect(() => {
    const hasPoint = values.meetingLat != null && values.meetingLng != null;
    if (!values.date || !hasPoint) {
      setWeather(null);
      setWeatherState('idle');
      return;
    }
    const start = new Date(`${values.date}T12:00:00`).getTime();
    const diffDays = (start - Date.now()) / 86_400_000;
    if (!Number.isFinite(diffDays) || diffDays < 0 || diffDays > 14) {
      setWeather(null);
      setWeatherState('off');
      return;
    }
    const controller = new AbortController();
    setWeatherState('loading');
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/weather?lat=${values.meetingLat}&lon=${values.meetingLng}&from=${values.date}&to=${values.date}`,
          { signal: controller.signal }
        );
        const payload = (await response.json()) as {
          status?: string;
          days?: Array<{ label?: string; tMaxC?: number | null }>;
        };
        if (!response.ok || payload.status !== 'ok' || !payload.days?.[0]) {
          setWeatherState('off');
          setWeather(null);
          return;
        }
        setWeather(weatherLabelFor(payload.days[0].label ?? '', payload.days[0].tMaxC ?? null));
        setWeatherState('idle');
      } catch {
        if (!controller.signal.aborted) setWeatherState('off');
      }
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [values.date, values.meetingLat, values.meetingLng]);
  const prefillValues = useMemo(() => {
    if (!prefill) return null;
    const mapped: Record<string, unknown> = {};
    if (typeof prefill.clubId === 'string' && prefill.clubId) mapped.clubId = prefill.clubId;
    if (typeof prefill.kitId === 'string' && prefill.kitId) mapped.kitId = prefill.kitId;
    if (typeof prefill.place === 'string' && prefill.place) mapped.location = prefill.place;
    if (typeof prefill.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(prefill.date)) {
      mapped.date = prefill.date;
    }
    // Pont Publication → Sortie : le titre (ou la légende) est repris (maquette L2864).
    if (typeof prefill.title === 'string' && prefill.title) mapped.title = prefill.title;
    return Object.keys(mapped).length > 0 ? mapped : null;
  }, [prefill]);

  const [previewCollapsed, setPreviewCollapsed] = useScrollCollapsePreview(api.active);
  const lastReturnNonceRef = useRef(-1);
  useEffect(() => {
    if (!prefill?.returnToPostEvent || lastReturnNonceRef.current === prefillNonce) return;
    lastReturnNonceRef.current = prefillNonce;
    api.setStep(0);
  }, [api, prefill?.returnToPostEvent, prefillNonce]);

  return (
    <>
      {api.active ? (
        <SheetPreview compact={false}>
          <CollapsibleHeroPreview
            collapsed={previewCollapsed}
            onExpand={() => setPreviewCollapsed(false)}
            title={ticket.title}
            subtitle={ticket.location || ticket.eventDate || 'Sortie'}
            badge={ACTIVITY_ICONS[values.activity]}
          >
            <EventTicket event={ticket} variant="preview" />
          </CollapsibleHeroPreview>
        </SheetPreview>
      ) : null}
      <PrefillApplierV2 values={prefillValues} nonce={prefillNonce} />
      {api.step === 0 ? <ActivityPlaceStep prefill={prefill} /> : null}
      {api.step === 1 ? <ItineraireStep /> : null}
      {api.step === 2 ? <ParticipantsStep /> : null}
      {api.step === 3 ? <SecuriteStep /> : null}
    </>
  );
}

/**
 * Sortie V2 (`Sortie#1-20`) : Activité et lieu → Itinéraire → Participants →
 * Sécurité. Activité unique, RDV sur mini-carte avec coordonnées enregistrées,
 * `starts_at` daté et minuté, difficulté tactile, capacité et liste d'attente,
 * check-list sécurité, kit requis, récurrence stockée, aperçu billet vivant,
 * et **une seule RPC atomique** (`create_event_with_post`).
 */
export function SortieFormV2({
  active,
  prefill,
  prefillNonce,
  onNavChange,
  stepHosts,
}: CreateFormV2Props) {
  const { user, reportCreated } = useCreateSheet();
  const defaults = React.useRef(createDefaultsV2('sortie')).current;

  return (
    <CreateFormEngineV2<SortieFormValuesV2>
      kind="sortie"
      schema={sortieSchemaV2}
      defaultValues={defaults}
      active={active}
      disabled={!user}
      onNavChange={onNavChange}
      stepHosts={stepHosts}
      onSubmit={async (values) => {
        try {
          const result = await createEventWithPostV2(values);
          reportCreated('sortie', {
            id: result.id,
            name: values.title.trim(),
            extra: {
              eventDate: values.date,
              eventLocation: values.location.trim(),
            },
          });
        } catch (error) {
          // Un échec de RPC ne laisse pas de couverture orpheline.
          await deleteMediaObjectsV2(uploadedObjectsOf(values.cover));
          throw error;
        }
      }}
    >
      {(api) => <SortieBody api={api} user={user} prefill={prefill} prefillNonce={prefillNonce} />}
    </CreateFormEngineV2>
  );
}

export default SortieFormV2;
