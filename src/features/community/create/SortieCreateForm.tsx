'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Controller } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { CommunityFormDrawer } from './CommunityFormDrawer';
import { Field, Select, SubmitFooter, SwitchField, TextArea, TextInput } from './form-fields';
import { CreateFormEngine } from './engine/CreateFormEngine';
import {
  createDefaults,
  CREATE_FIELD_LABELS,
  type OutingType,
  type SortieFormValues,
} from './engine/createSchemas';
import { CREATE_STEPS, StepPager } from './shared/StepPager';
import { MediaPicker } from './shared/MediaPicker';
import { DateRangeField } from './shared/DateRangeField';
import { NumberStepper } from './shared/NumberStepper';
import { FormErrorSummary } from './shared/FormErrorSummary';
import { FormPreview } from './shared/FormPreview';
import { CreationSignature } from './shared/CreationSignature';
import { PlaceSearch } from './shared/PlaceSearch';
import { DifficultyLadder, CapacityGauge, SafetyManifest, MeetingPin } from './shared/InfoCards';
import { ActivitySearch } from './shared/ActivitySearch';
import { InlineError } from './shared/InlineError';
import { resolveCoverUrl } from './shared/mediaSubmit';
import { insertCommunityPost, createPostMediaUploader } from './upload';

export interface SortieCreateFormProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: 'sortie', id: string) => void;
  step?: number;
  onStepChange?: (step: number) => void;
}

const DEFAULTS = createDefaults('sortie');
const STEPS = CREATE_STEPS.sortie;
const LAST_STEP = STEPS.length - 1;
const STEP_FIELDS = [
  ['title', 'eventType', 'location', 'meetingPoint', 'cover'],
  ['startDate', 'endDate', 'duration', 'level', 'distanceKm', 'deniveleM'],
  ['maxParticipants', 'waitlist'],
  ['description', 'safetyNotes'],
] as const;

const LEVEL_LABELS: Record<SortieFormValues['level'], string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  difficile: 'Difficile',
};

export const OUTING_TYPE_LABELS: Record<OutingType, string> = {
  rando: 'Randonnée',
  trail: 'Trail',
  ski: 'Ski de rando',
  velo: 'Vélo',
  escalade: 'Escalade',
  autre: 'Autre',
};

const OUTING_TYPE_EMOJI: Record<OutingType, string> = {
  rando: '🥾',
  trail: '🏃',
  ski: '🎿',
  velo: '🚴',
  escalade: '🧗',
  autre: '🧭',
};

/**
 * `events.description` porte les métadonnées sans colonne dédiée :
 * niveau, rendez-vous, distance, dénivelé, liste d’attente, sécurité.
 */
export function buildSortieDescription(values: SortieFormValues): string {
  return [
    values.description.trim(),
    `Niveau : ${LEVEL_LABELS[values.level]}`,
    values.meetingPoint.trim() ? `Rendez-vous : ${values.meetingPoint.trim()}` : '',
    values.distanceKm > 0 ? `Distance : ${values.distanceKm} km` : '',
    values.deniveleM > 0 ? `Dénivelé : +${values.deniveleM} m` : '',
    values.waitlist ? 'Liste d’attente : oui' : '',
    values.safetyNotes.trim() ? `Sécurité : ${values.safetyNotes.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export interface SortieEventRow {
  title: string;
  type: OutingType;
  emoji: string;
  organizer_id: string;
  event_date: string;
  duration: string;
  location: string;
  country: string;
  max_participants: number;
  current_participants: number;
  description: string;
  cover_image: string;
  cover_alt: string;
  shared_kitty: number;
  kitty_goal: number;
  status: string;
  [key: string]: unknown;
}

export function buildSortieEventRow(
  values: SortieFormValues,
  userId: string,
  coverUrl: string | null,
): SortieEventRow {
  const duration =
    values.duration.trim() ||
    (values.endDate ? `Du ${values.startDate} au ${values.endDate}` : '');
  return {
    title: values.title.trim(),
    type: values.eventType,
    emoji: OUTING_TYPE_EMOJI[values.eventType],
    organizer_id: userId,
    event_date: values.startDate,
    duration,
    location: values.location.trim(),
    country: 'France',
    max_participants: values.maxParticipants,
    current_participants: 0,
    description: buildSortieDescription(values),
    cover_image: coverUrl ?? '',
    cover_alt: values.title.trim(),
    shared_kitty: 0,
    kitty_goal: 0,
    status: 'upcoming',
  };
}

export interface SortieSnapshot {
  schema: 'lkdv.sortie.options.v1';
  event_type: OutingType;
  meeting_point: string | null;
  waitlist: boolean;
  level: SortieFormValues['level'];
  distance_km: number;
  denivele_m: number;
  [key: string]: unknown;
}

/** Snapshot du post lié : métadonnées non persistables dans `events`. */
export function buildSortieSnapshot(values: SortieFormValues): SortieSnapshot {
  return {
    schema: 'lkdv.sortie.options.v1',
    event_type: values.eventType,
    meeting_point: values.meetingPoint.trim() || null,
    waitlist: values.waitlist,
    level: values.level,
    distance_km: values.distanceKm,
    denivele_m: values.deniveleM,
  };
}

export function SortieCreateForm({
  open,
  onClose,
  user,
  onCreated,
  step,
  onStepChange,
}: SortieCreateFormProps) {
  const [internalStep, setInternalStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const activeStep = Math.max(0, Math.min(LAST_STEP, step ?? internalStep));

  const uploader = useMemo(
    () => (user?.id ? createPostMediaUploader(user.id) : undefined),
    [user?.id],
  );

  const setStep = (next: number) => {
    const safe = Math.max(0, Math.min(LAST_STEP, next));
    setInternalStep(safe);
    onStepChange?.(safe);
  };

  const submit = async (values: SortieFormValues) => {
    setSubmitError(null);
    if (!user?.id) throw new Error('Connecte-toi pour créer une sortie.');
    const coverUrl = resolveCoverUrl(values.cover);
    const row = buildSortieEventRow(values, user.id, coverUrl);
    const snapshotPayload = buildSortieSnapshot(values);

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from('events')
      .insert(row)
      .select('id')
      .single();
    if (insertError || !data) {
      throw new Error(insertError?.message || 'Création de la sortie refusée.');
    }

    try {
      const dateLine = values.endDate
        ? `📅 ${values.startDate} → ${values.endDate}`
        : `📅 ${values.startDate}`;
      await insertCommunityPost({
        authorId: user.id,
        content: `**${values.title.trim()}**\n\n${dateLine}${
          values.location.trim() ? ` · 📍 ${values.location.trim()}` : ''
        }\n\nType : ${OUTING_TYPE_LABELS[values.eventType]}\nNiveau : ${
          LEVEL_LABELS[values.level]
        }${
          values.meetingPoint.trim() ? `\nRendez-vous : ${values.meetingPoint.trim()}` : ''
        }${
          values.waitlist ? '\nListe d’attente ouverte' : ''
        }\n\n${values.description.trim()}\n\n/evenements`,
        postType: 'share',
        imageUrl: coverUrl,
        title: values.title.trim(),
        snapshotPayload,
      });
    } catch {
      // Le pont vers le fil est best-effort : la sortie existe déjà.
    }

    onCreated('sortie', data.id);
    setStep(0);
    onClose();
  };

  return (
    <CreateFormEngine<SortieFormValues>
      kind="sortie"
      defaultValues={DEFAULTS}
      onSubmit={submit}
      resetOnSuccess
      draftKey="sortie"
      step={activeStep}
      onStepChange={setStep}
      stepFields={STEP_FIELDS}
      onError={(message) => setSubmitError(message)}
    >
      {(form, api) => {
        const errors = form.formState.errors;
        const previewValues = form.watch();
        const startDate = form.watch('startDate');
        const endDate = form.watch('endDate');
        const level = form.watch('level');
        const maxParticipants = form.watch('maxParticipants');
        const eventType = form.watch('eventType');
        const goNext = async () => {
          const fields = STEP_FIELDS[activeStep] ?? [];
          const valid = await form.trigger([...fields]);
          if (valid) setStep(activeStep + 1);
        };
        const onPrimary = () => {
          if (activeStep < LAST_STEP) {
            void goNext();
            return;
          }
          api.submit();
        };

        return (
          <CommunityFormDrawer
            open={open}
            onClose={onClose}
            ariaLabel="Créer une sortie"
            error={submitError}
            footer={
              <SubmitFooter
                label={activeStep < LAST_STEP ? 'Continuer' : 'Créer la sortie'}
                busy={form.formState.isSubmitting}
                onClick={onPrimary}
              />
            }
          >
            <FormErrorSummary
              errors={errors}
              labels={CREATE_FIELD_LABELS}
              onFocusField={api.focusField}
            />
            <FormPreview kind="sortie" values={previewValues} />
            <CreationSignature kind="sortie" values={previewValues} />

            <StepPager
              inline
              steps={STEPS}
              index={activeStep}
              onIndexChange={setStep}
              actions={
                activeStep > 0 ? (
                  <button
                    type="button"
                    className="lkdv-create-step-back"
                    onClick={() => setStep(activeStep - 1)}
                  >
                    Retour
                  </button>
                ) : null
              }
            >
              <div>
                <ActivitySearch
                  value={OUTING_TYPE_LABELS[eventType] ?? eventType}
                  onChange={(next) => {
                    const key = Object.entries(OUTING_TYPE_LABELS).find(([, label]) => label === next)?.[0];
                    if (key) form.setValue('eventType', key as typeof eventType, { shouldValidate: true, shouldDirty: true });
                  }}
                  placeholder="Randonnée, bivouac, resto…"
                />
                <Field label="Titre" htmlFor="sortie-title" required>
                  <TextInput
                    id="sortie-title"
                    {...form.register('title')}
                    maxLength={120}
                    placeholder="Lac Blanc au lever du jour"
                  />
                  <InlineError message={errors.title?.message} />
                </Field>

                <Field label="Type de sortie" htmlFor="sortie-type">
                  <Select id="sortie-type" {...form.register('eventType')}>
                    {Object.entries(OUTING_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <InlineError message={errors.eventType?.message} />
                </Field>

                <Controller
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <PlaceSearch label="Lieu" value={field.value} onChange={field.onChange} placeholder="Chamonix" />
                  )}
                />
                <InlineError message={errors.location?.message} />

                <Controller
                  control={form.control}
                  name="meetingPoint"
                  render={({ field }) => (
                    <PlaceSearch label="Rendez-vous" value={field.value} onChange={field.onChange} placeholder="Parking de la Flégère, 8 h" />
                  )}
                />
                <InlineError message={errors.meetingPoint?.message} />

                <Controller
                  control={form.control}
                  name="cover"
                  render={({ field }) => (
                    <MediaPicker
                      value={field.value}
                      onChange={field.onChange}
                      max={1}
                      label="Photo de couverture"
                      hint="Une image pour la carte de la sortie."
                      upload={uploader}
                      fieldName="cover"
                    />
                  )}
                />
                <InlineError message={errors.cover?.message as string | undefined} />
              </div>

              <div>
                <MeetingPin location={form.watch('location')} meeting={form.watch('meetingPoint')} />
                <DifficultyLadder value={level} />
                <DateRangeField
                  label="Dates de la sortie"
                  start={startDate}
                  end={endDate}
                  onStartChange={(value) => {
                    form.setValue('startDate', value, { shouldValidate: true, shouldDirty: true });
                    const end = form.getValues('endDate');
                    const days = value && end ? Math.max(1, Math.round((new Date(end).getTime() - new Date(value).getTime()) / 86_400_000) + 1) : 1;
                    form.setValue('duration', days > 1 ? `${days} jours` : '1 journée', { shouldDirty: true });
                  }}
                  onEndChange={(value) => {
                    form.setValue('endDate', value, { shouldValidate: true, shouldDirty: true });
                    const start = form.getValues('startDate');
                    const days = start && value ? Math.max(1, Math.round((new Date(value).getTime() - new Date(start).getTime()) / 86_400_000) + 1) : 1;
                    form.setValue('duration', days > 1 ? `${days} jours` : '1 journée', { shouldDirty: true });
                  }}
                  min={undefined}
                  startLabel="Date"
                  endLabel="Fin (optionnel)"
                  idPrefix="sortie-date"
                  error={errors.startDate?.message ?? errors.endDate?.message ?? null}
                />
                <InlineError message={errors.startDate?.message} />
                <p className="lkdv-form-note">Durée calculée automatiquement depuis les dates.</p>

                <Field
                  label="Niveau"
                  hint={`Niveau retenu : ${LEVEL_LABELS[level]}.`}
                  htmlFor="sortie-level"
                >
                  <Select id="sortie-level" {...form.register('level')}>
                    <option value="facile">Facile</option>
                    <option value="moyen">Moyen</option>
                    <option value="difficile">Difficile</option>
                  </Select>
                  <InlineError message={errors.level?.message} />
                </Field>

                <div className="lkdv-form-row">
                  <Field label="Distance (km)" htmlFor="sortie-distance">
                    <TextInput
                      id="sortie-distance"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={500}
                      step={0.1}
                      {...form.register('distanceKm', { valueAsNumber: true })}
                    />
                    <InlineError message={errors.distanceKm?.message} />
                  </Field>
                  <Controller
                    control={form.control}
                    name="deniveleM"
                    render={({ field }) => (
                      <NumberStepper
                        label="Dénivelé"
                        value={field.value}
                        onChange={field.onChange}
                        min={0}
                        max={20_000}
                        step={50}
                        unit="m"
                      />
                    )}
                  />
                </div>
                <InlineError message={errors.deniveleM?.message} />
              </div>

              <div>
                <CapacityGauge max={maxParticipants} waitlist={Boolean(form.watch('waitlist'))} />
                <details className="lkdv-advanced">
                  <summary>Capacité et liste d’attente</summary>
                <Controller
                  control={form.control}
                  name="maxParticipants"
                  render={({ field }) => (
                    <NumberStepper
                      label="Participants max"
                      value={field.value}
                      onChange={field.onChange}
                      min={2}
                      max={50}
                      unit="pers."
                    />
                  )}
                />
                <InlineError message={errors.maxParticipants?.message} />
                <p className="lkdv-form-note">
                  {maxParticipants} place(s) ouvertes. Les inscriptions se gèrent ensuite
                  depuis la sortie.
                </p>

                <Controller
                  control={form.control}
                  name="waitlist"
                  render={({ field }) => (
                    <SwitchField
                      label="Liste d’attente"
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                <InlineError message={errors.waitlist?.message} />

                </details>
                <Link className="lkdv-form-link" href="/evenements" onClick={api.flushDraft}>
                  Voir les sorties
                </Link>
              </div>

              <div>
                <SafetyManifest
                  notes={form.watch('safetyNotes')}
                  level={LEVEL_LABELS[level]}
                  places={maxParticipants}
                  waitlist={Boolean(form.watch('waitlist'))}
                />
                <Field label="Description" htmlFor="sortie-description">
                  <TextArea
                    id="sortie-description"
                    {...form.register('description')}
                    maxLength={1500}
                    placeholder="Le programme, le matériel, le rythme…"
                  />
                  <InlineError message={errors.description?.message} />
                </Field>

                <details className="lkdv-advanced">
                  <summary>Sécurité et consignes</summary>
                <Field
                  label="Consignes de sécurité"
                  hint="Matériel obligatoire, conditions, points de vigilance."
                  htmlFor="sortie-safety"
                >
                  <TextArea
                    id="sortie-safety"
                    {...form.register('safetyNotes')}
                    maxLength={500}
                    placeholder="DVA, pelle, sonde obligatoires…"
                  />
                  <InlineError message={errors.safetyNotes?.message} />
                </Field>

                <p className="lkdv-form-note">
                  Type retenu : {OUTING_TYPE_LABELS[eventType]} · {LEVEL_LABELS[level]}.
                </p>
                </details>
              </div>
            </StepPager>
          </CommunityFormDrawer>
        );
      }}
    </CreateFormEngine>
  );
}

export default SortieCreateForm;
