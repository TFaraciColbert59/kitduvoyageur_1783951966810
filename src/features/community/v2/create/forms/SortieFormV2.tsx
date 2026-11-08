'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CloudSun, Loader2, MapPin, Mountain, Users } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import type { User } from '@supabase/supabase-js';
import { EventTicket } from '../../shared/EventTicket';
import type { EventCardVM } from '../../shared/types';
import { CreateFormEngineV2, type CreateFormEngineApiV2 } from '../engine/CreateFormEngineV2';
import {
  createDefaultsV2,
  type SortieFormValuesV2,
  sortieSchemaV2,
} from '../engine/createSchemasV2';
import { useCreateSheet } from '../CreateSheetContext';
import { createEventWithPostV2, SORTIE_ACTIVITY_EMOJI, toStartsAt } from '../createRpc';
import { ChipsFieldV2 } from '../fields/ChipsV2';
import { DateFieldV2, TimeFieldV2 } from '../fields/DateFieldV2';
import { NumberFieldV2, NumberStepperV2 } from '../fields/NumberStepperV2';
import { TextAreaFieldV2, TextFieldV2 } from '../fields/FieldV2';
import { MediaFieldV2 } from '../fields/MediaFieldV2';
import { PlaceFieldV2 } from '../fields/PlaceFieldV2';
import { PrefillApplierV2 } from '../fields/PrefillApplierV2';
import { IMAGE_LIMITS, deleteMediaObjectsV2, uploadedObjectsOf } from '../fields/media';
import { MeetingMapV2 } from '../sortie/MeetingMapV2';
import { createClient } from '@/lib/supabase/client';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { CreateFormV2Props } from './types';

const ACTIVITY_OPTIONS = [
  { value: 'rando', label: 'Rando' },
  { value: 'trail', label: 'Trail' },
  { value: 'ski', label: 'Ski de rando' },
  { value: 'velo', label: 'Vélo' },
  { value: 'escalade', label: 'Escalade' },
  { value: 'autre', label: 'Autre' },
] as const;

const LEVELS = [
  { value: 'facile', label: 'Facile', hint: 'Moins de 4 h, faible dénivelé' },
  { value: 'moyen', label: 'Moyen', hint: '4 à 6 h, dénivelé modéré' },
  { value: 'difficile', label: 'Difficile', hint: 'Journée longue, fort dénivelé' },
] as const;

const RECURRENCES = [
  { value: '', label: 'Aucune' },
  { value: 'weekly', label: 'Chaque semaine' },
  { value: 'monthly', label: 'Chaque mois' },
] as const;

const SAFETY_CHIPS = ['DVA', 'Pelle', 'Sonde', 'Frontale', 'Eau', 'Carte', 'Trousse', 'Couverture de survie'];

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
    distanceKm: values.distanceKm > 0 ? values.distanceKm : null,
    elevationGainM: values.elevationGainM > 0 ? values.elevationGainM : null,
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

function ActivityPlaceStep({
  user,
  prefill,
}: {
  user: User | null;
  prefill?: Record<string, unknown> | null;
}) {
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
          icon: <span aria-hidden="true">{SORTIE_ACTIVITY_EMOJI[option.value]}</span>,
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
      <MediaFieldV2
        name="cover"
        label="Photo de couverture (optionnel)"
        userId={user?.id ?? ''}
        limits={IMAGE_LIMITS}
        max={1}
        showAlt={false}
        addLabel="Ajouter une photo"
      />
    </>
  );
}

function ItineraireStep() {
  const form = useFormContext<SortieFormValuesV2>();
  const values = form.watch();
  const [weather, setWeather] = useState<string | null>(null);
  const [weatherState, setWeatherState] = useState<'idle' | 'loading' | 'off'>('idle');
  const { haptic } = useHapticFeedback();

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
          { signal: controller.signal },
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
        const day = payload.days[0];
        setWeather(weatherLabelFor(day.label ?? '', day.tMaxC ?? null));
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

  return (
    <>
      <div className="lkdv-cv2c-date-range">
        <DateFieldV2 name="date" label="Date" required min={new Date().toISOString().slice(0, 10)} />
        <TimeFieldV2 name="startTime" label="Départ" />
      </div>
      <TimeFieldV2 name="endTime" label="Fin (optionnel)" hint="Laisse vide si la durée est libre." />
      {weatherState === 'loading' ? (
        <p className="lkdv-cv2-field-hint">
          <Loader2 size={12} className="lkdv-cv2c-spin" aria-hidden="true" /> Météo prévue…
        </p>
      ) : null}
      {weather ? (
        <p className="lkdv-cv2c-weather">
          <CloudSun size={13} aria-hidden="true" /> Météo prévue : {weather}
        </p>
      ) : null}
      {weatherState === 'off' ? (
        <p className="lkdv-cv2-field-hint">
          Météo pas encore disponible pour cette date (prévisions à 14 jours).
        </p>
      ) : null}
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">Niveau</span>
        <div className="lkdv-cv2c-difficulty" role="radiogroup" aria-label="Niveau de difficulté">
          {LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              role="radio"
              aria-checked={values.level === level.value}
              onClick={() => {
                form.setValue('level', level.value, { shouldDirty: true, shouldValidate: true });
                haptic('selection');
              }}
            >
              <b>{level.label}</b>
              <small>{level.hint}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="lkdv-cv2c-metric-row">
        <NumberFieldV2 name="distanceKm" label="Distance" unit="km" max={500} step={0.1} />
        <NumberFieldV2 name="elevationGainM" label="Dénivelé" unit="m" max={20_000} step={50} />
      </div>
      <TextFieldV2 name="duration" label="Durée estimée" placeholder="5 h" maxLength={60} />
      <ChipsFieldV2 name="recurrence" label="Récurrence" options={RECURRENCES.map((entry) => ({ ...entry }))} />
      <p className="lkdv-cv2-field-hint">
        La règle de récurrence est enregistrée, les occurrences ne sont pas générées.
      </p>
    </>
  );
}

function ParticipantsStep() {
  const form = useFormContext<SortieFormValuesV2>();
  const values = form.watch();
  const [clubs, setClubs] = useState<ClubOption[] | null>(null);
  const [kits, setKits] = useState<KitOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useCreateSheet();

  const loadOptions = async () => {
    if (!user || loading || clubs) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const [clubResponse, kitResponse] = await Promise.all([
        supabase
          .from('club_members')
          .select('club_id, clubs(id, name, slug)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(20),
        supabase
          .from('materiel_kits')
          .select('id, name')
          .eq('user_id', user.id)
          .eq('is_trashed', false)
          .order('updated_at', { ascending: false })
          .limit(20),
      ]);
      const clubRows = Array.isArray(clubResponse.data) ? clubResponse.data : [];
      setClubs(
        clubRows
          .map((row) => {
            const raw = (row as { clubs?: unknown }).clubs;
            const club = Array.isArray(raw) ? raw[0] : raw;
            if (!club || typeof club !== 'object') return null;
            const record = club as Record<string, unknown>;
            if (typeof record.id !== 'string') return null;
            return { id: record.id, name: String(record.name ?? ''), slug: String(record.slug ?? '') };
          })
          .filter((entry): entry is ClubOption => entry !== null),
      );
      setKits(Array.isArray(kitResponse.data) ? (kitResponse.data as KitOption[]) : []);
    } catch {
      setClubs([]);
      setKits([]);
    } finally {
      setLoading(false);
    }
  };

  const percentage =
    values.maxParticipants > 0
      ? Math.min(100, Math.round((1 / values.maxParticipants) * 100))
      : 0;

  return (
    <>
      <NumberStepperV2 name="maxParticipants" label="Participants maximum" min={2} max={50} />
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">Places prises à la création</span>
        <div className="lkdv-cv2c-capacity-row">
          <span className="lkdv-cv2-gauge">
            <span className="lkdv-cv2-gauge-track">
              <span className="lkdv-cv2-gauge-fill" style={{ width: `${percentage}%` }} />
            </span>
            <span className="lkdv-cv2-field-hint">
              <Users size={11} aria-hidden="true" /> 1 place prise par toi · {values.maxParticipants} au total
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
        <button type="button" className="lkdv-cv2-chip lkdv-cv2-chip--lg" onClick={() => void loadOptions()} disabled={loading}>
          {loading ? <Loader2 size={13} className="lkdv-cv2c-spin" aria-hidden="true" /> : <MapPin size={13} aria-hidden="true" />}
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
                onClick={() => form.setValue('clubId', values.clubId === club.id ? '' : club.id, { shouldDirty: true, shouldValidate: true })}
              >
                {club.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {kits && kits.length > 0 ? (
        <div className="lkdv-cv2-field">
          <span className="lkdv-cv2-field-label">Matériel requis (kit existant, optionnel)</span>
          <div className="lkdv-cv2-chips">
            {kits.map((kit) => (
              <button
                key={kit.id}
                type="button"
                className="lkdv-cv2-chip lkdv-cv2-chip--lg"
                aria-pressed={values.kitId === kit.id}
                onClick={() => form.setValue('kitId', values.kitId === kit.id ? '' : kit.id, { shouldDirty: true, shouldValidate: true })}
              >
                <Mountain size={12} aria-hidden="true" />
                {kit.name}
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
  return (
    <>
      <ChipsFieldV2
        name="safetyChecklist"
        label="Check-list sécurité"
        multiple
        options={SAFETY_CHIPS.map((entry) => ({ value: entry, label: entry }))}
        hint="Choisis ce que chacun doit emporter."
      />
      <TextAreaFieldV2
        name="safetyNotes"
        label="Consignes de sécurité"
        placeholder="DVA, pelle, sonde obligatoires…"
        maxLength={500}
      />
      <TextAreaFieldV2
        name="description"
        label="Programme"
        placeholder="Le programme, le matériel, le rythme…"
        maxLength={1500}
      />
      <button
        type="button"
        className="lkdv-cv2c-switch"
        role="switch"
        aria-checked={values.announce}
        onClick={() => form.setValue('announce', !values.announce, { shouldDirty: true })}
      >
        <span className="lkdv-cv2c-switch-track" aria-hidden="true">
          <span className="lkdv-cv2c-switch-dot" />
        </span>
        Publier une annonce dans le fil
      </button>
      <p className="lkdv-cv2-field-hint">
        L’annonce part dans la même transaction que la sortie : si elle échoue, rien n’est créé.
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
  const prefillValues = useMemo(() => {
    if (!prefill) return null;
    const mapped: Record<string, unknown> = {};
    if (typeof prefill.clubId === 'string' && prefill.clubId) mapped.clubId = prefill.clubId;
    if (typeof prefill.kitId === 'string' && prefill.kitId) mapped.kitId = prefill.kitId;
    if (typeof prefill.place === 'string' && prefill.place) mapped.location = prefill.place;
    return Object.keys(mapped).length > 0 ? mapped : null;
  }, [prefill]);

  return (
    <>
      <PrefillApplierV2 values={prefillValues} nonce={prefillNonce} />
      <div className="lkdv-cv2c-ticket-preview" inert aria-hidden="true">
        <EventTicket event={ticket} variant="preview" />
      </div>
      {api.step === 0 ? <ActivityPlaceStep user={user} prefill={prefill} /> : null}
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
export function SortieFormV2({ active, prefill, prefillNonce, onNavChange }: CreateFormV2Props) {
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
