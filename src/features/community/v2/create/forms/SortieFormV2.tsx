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
  return (
    <>
      <ChipsFieldV2
        name="activity"
        label="Activité"
        options={ACTIVITY_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
          icon: ACTIVITY_ICONS[option.value],
        }))}
      />
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
        required
        hint="Le lieu affiché sur le billet de la sortie."
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
        <TextFieldV2
          name="meetingPoint"
          label="Point de rendez-vous"
          placeholder="Parking de la Flégère, 8 h"
          maxLength={120}
        />
        <MeetingMapV2
          lat={values.meetingLat}
          lng={values.meetingLng}
          onChange={(lat, lng) => {
            form.setValue('meetingLat', lat, { shouldDirty: true, shouldValidate: true });
            form.setValue('meetingLng', lng, { shouldDirty: true, shouldValidate: true });
          }}
        />
        {/* FID-064 — fieldset « Rendez-vous » de la maquette (L3120-3124) :
          date, heure de départ, heure de fin et récurrence sont sur l'étape 1.
          FID-063 — la photo de couverture (ajout V2 sans équivalent maquette)
          est retirée du flux. */}
        <div className="lkdv-cv2c-date-range">
          <DateFieldV2
            name="date"
            label="Date"
            required
            min={new Date().toISOString().slice(0, 10)}
          />
          <TimeFieldV2 name="startTime" label="Départ" required />
        </div>
        <TimeFieldV2
          name="endTime"
          label="Fin (optionnel)"
          hint="Laisse vide si la durée est libre."
        />
      </fieldset>
      <SegmentedFieldV2
        label="Récurrence"
        options={RECURRENCES.map((entry) => ({ ...entry }))}
        value={values.recurrence}
        onChange={(value) =>
          form.setValue('recurrence', value as SortieFormValuesV2['recurrence'], {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
      />
      <p className="lkdv-cv2-field-hint">
        La règle de récurrence est enregistrée, les occurrences ne sont pas générées.
      </p>
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
        <p className="lkdv-cv2c-difficulty-def">
          <b>{LEVELS.find((level) => level.value === values.level)?.label}.</b>{' '}
          {LEVELS.find((level) => level.value === values.level)?.hint}
        </p>
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
  const [clubs, setClubs] = useState<ClubOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useCreateSheet();

  const loadOptions = async () => {
    if (!user || loading || clubs) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('club_members')
        .select('club_id, clubs(id, name, slug)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(20);
      const clubRows = Array.isArray(data) ? data : [];
      setClubs(
        clubRows
          .map((row) => {
            const raw = (row as { clubs?: unknown }).clubs;
            const club = Array.isArray(raw) ? raw[0] : raw;
            if (!club || typeof club !== 'object') return null;
            const record = club as Record<string, unknown>;
            if (typeof record.id !== 'string') return null;
            return {
              id: record.id,
              name: String(record.name ?? ''),
              slug: String(record.slug ?? ''),
            };
          })
          .filter((entry): entry is ClubOption => entry !== null)
      );
    } catch {
      setClubs([]);
    } finally {
      setLoading(false);
    }
  };

  const percentage =
    values.maxParticipants > 0 ? Math.min(100, Math.round((1 / values.maxParticipants) * 100)) : 0;

  return (
    <>
      <NumberStepperV2 name="maxParticipants" label="Participants maximum" min={2} max={50} />
      {/* FID-052 : carte « Aperçu de la jauge » de la maquette (L3133), encadrée
          comme les autres cartes du formulaire. */}
      <div className="lkdv-cv2-card">
        <span className="lkdv-cv2-eyebrow">Aperçu de la jauge</span>
        <div className="lkdv-cv2c-capacity-row">
          <span className="lkdv-cv2-gauge">
            <span className="lkdv-cv2-gauge-track">
              <span className="lkdv-cv2-gauge-fill" style={{ width: `${percentage}%` }} />
            </span>
            <span className="lkdv-cv2-field-hint">
              <Users size={11} aria-hidden="true" /> {values.maxParticipants - 1} places restantes ·{' '}
              {values.waitlist ? 'liste d’attente activée' : 'pas de liste d’attente'}
            </span>
          </span>
        </div>
      </div>
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
      <div className="lkdv-cv2c-inline-add">
        <button
          type="button"
          className="lkdv-cv2-chip lkdv-cv2-chip--lg"
          onClick={() => void loadOptions()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 size={13} className="lkdv-cv2c-spin" aria-hidden="true" />
          ) : (
            <MapPin size={13} aria-hidden="true" />
          )}
          Choisir un club et un kit
        </button>
      </div>
      {clubs && clubs.length > 0 ? (
        <div className="lkdv-cv2-field">
          <span className="lkdv-cv2-field-label">Club organisateur (optionnel)</span>
          <div className="lkdv-cv2-chips">
            {clubs.map((club) => (
              <button
                key={club.id}
                type="button"
                className="lkdv-cv2-chip lkdv-cv2-chip--lg"
                aria-pressed={values.clubId === club.id}
                onClick={() =>
                  form.setValue('clubId', values.clubId === club.id ? '' : club.id, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                {club.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function SecuriteStep() {
  const form = useFormContext<SortieFormValuesV2>();
  const values = form.watch();
  const ski = values.activity === 'ski';
  const { user } = useCreateSheet();
  const [kits, setKits] = useState<KitOption[] | null>(null);
  const [loading, setLoading] = useState(false);

  const loadKits = async () => {
    if (!user || loading || kits) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('materiel_kits')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('is_trashed', false)
        .order('updated_at', { ascending: false })
        .limit(20);
      setKits(Array.isArray(data) ? (data as KitOption[]) : []);
    } catch {
      setKits([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ChipsFieldV2
        name="safetyChecklist"
        label={ski ? 'Check-list de sécurité *' : 'Check-list de sécurité'}
        multiple
        options={SAFETY_CHIPS.map((entry) => ({ value: entry, label: entry }))}
        hint={
          ski
            ? 'Ski de rando : le DVA est obligatoire dans la check-list.'
            : 'Choisis ce que chacun doit emporter.'
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
        <span className="lkdv-cv2-field-label">Matériel requis</span>
        <div className="lkdv-cv2-chips" role="radiogroup" aria-label="Depuis un kit">
          <button
            type="button"
            role="radio"
            aria-checked={!values.kitId}
            className="lkdv-cv2-chip lkdv-cv2-chip--lg"
            onClick={() => form.setValue('kitId', '', { shouldDirty: true, shouldValidate: true })}
          >
            Aucun kit
          </button>
          {kits?.map((kit) => (
            <button
              key={kit.id}
              type="button"
              role="radio"
              aria-checked={values.kitId === kit.id}
              className="lkdv-cv2-chip lkdv-cv2-chip--lg"
              onClick={() =>
                form.setValue('kitId', values.kitId === kit.id ? '' : kit.id, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            >
              <Mountain size={12} aria-hidden="true" />
              {kit.name}
            </button>
          ))}
        </div>
        {kits === null ? (
          <button
            type="button"
            className="lkdv-cv2-chip lkdv-cv2-chip--lg"
            onClick={() => void loadKits()}
          >
            {loading ? (
              <Loader2 size={13} className="lkdv-cv2c-spin" aria-hidden="true" />
            ) : (
              <Mountain size={13} aria-hidden="true" />
            )}
            Choisir un kit
          </button>
        ) : null}
      </div>
      {/* FID-063 : le switch « Publier une annonce dans le fil » est conservé
          (la maquette publie bien une annonce avec la sortie, L3140) ; le
          programme reste sur l'étape Sécurité. */}
      <TextAreaFieldV2
        name="description"
        label="Programme"
        placeholder="Le programme, le matériel, le rythme…"
        maxLength={1500}
      />
      {/* FID-063 / J-14 : le switch « Publier une annonce dans le fil » (ajout
          V2 sans équivalent maquette) est **retiré du flux** ; la maquette
          publie l'annonce avec la sortie (`commit`), et la RPC l'écrit dans la
          même transaction. */}
      <p className="lkdv-cv2-field-hint">
        Une annonce part dans le fil avec la sortie, dans la même transaction : si elle échoue, rien
        n’est créé.
      </p>
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
    // Pont Publication → Sortie : le titre (ou la légende) est repris (maquette L2864).
    if (typeof prefill.title === 'string' && prefill.title) mapped.title = prefill.title;
    return Object.keys(mapped).length > 0 ? mapped : null;
  }, [prefill]);

  return (
    <>
      <PrefillApplierV2 values={prefillValues} nonce={prefillNonce} />
      {api.active ? (
        <SheetPreview>
          <div className="lkdv-cv2c-ticket-preview" inert aria-hidden="true">
            <EventTicket event={ticket} variant="preview" />
            {weatherState === 'loading' ? (
              <p className="lkdv-cv2c-ticket-weather">
                <Loader2 size={13} className="lkdv-cv2c-spin" aria-hidden="true" /> Météo prévue…
              </p>
            ) : weather ? (
              <p className="lkdv-cv2c-ticket-weather">
                <CloudSun size={13} aria-hidden="true" /> Météo prévue : {weather}
              </p>
            ) : weatherState === 'off' ? (
              <p className="lkdv-cv2c-ticket-weather">
                Météo pas encore disponible pour cette date (prévisions à 14 jours).
              </p>
            ) : null}
          </div>
        </SheetPreview>
      ) : null}
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
          reportCreated('sortie', { id: result.id, name: values.title.trim() });
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
