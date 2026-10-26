'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Controller } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { CommunityFormDrawer } from './CommunityFormDrawer';
import { Field, Select, SubmitFooter, TextArea, TextInput } from './form-fields';
import { CreateFormEngine } from './engine/CreateFormEngine';
import {
  createDefaults,
  CREATE_FIELD_LABELS,
  type SortieFormValues,
} from './engine/createSchemas';
import { CREATE_STEPS, StepPager } from './shared/StepPager';
import { MediaPicker } from './shared/MediaPicker';
import { DateRangeField } from './shared/DateRangeField';
import { NumberStepper } from './shared/NumberStepper';
import { FormErrorSummary } from './shared/FormErrorSummary';
import { FormPreview } from './shared/FormPreview';
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
  ['title', 'startDate', 'endDate', 'duration'],
  ['location', 'level', 'description', 'cover'],
  ['maxParticipants'],
] as const;

const LEVEL_LABELS: Record<SortieFormValues['level'], string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  difficile: 'Difficile',
};

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
    const level = LEVEL_LABELS[values.level];
    const description = [values.description.trim(), `Niveau : ${level}`]
      .filter(Boolean)
      .join('\n\n');
    const duration =
      values.duration.trim() ||
      (values.endDate ? `Du ${values.startDate} au ${values.endDate}` : '');

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from('events')
      .insert({
        title: values.title.trim(),
        type: 'rando',
        emoji: '🥾',
        organizer_id: user.id,
        event_date: values.startDate,
        duration,
        location: values.location.trim(),
        country: 'France',
        max_participants: values.maxParticipants,
        current_participants: 0,
        description,
        cover_image: coverUrl ?? '',
        cover_alt: values.title.trim(),
        shared_kitty: 0,
        kitty_goal: 0,
        status: 'upcoming',
      })
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
        }\n\nNiveau : ${level}\n\n${values.description.trim()}\n\n/evenements`,
        postType: 'share',
        imageUrl: coverUrl,
        title: values.title.trim(),
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

            <StepPager
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
                <Field label="Titre" htmlFor="sortie-title">
                  <TextInput
                    id="sortie-title"
                    {...form.register('title')}
                    maxLength={120}
                    placeholder="Lac Blanc au lever du jour"
                  />
                  <InlineError message={errors.title?.message} />
                </Field>
                <DateRangeField
                  label="Dates de la sortie"
                  start={startDate}
                  end={endDate}
                  onStartChange={(value) =>
                    form.setValue('startDate', value, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  onEndChange={(value) =>
                    form.setValue('endDate', value, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  min={undefined}
                  startLabel="Date"
                  endLabel="Fin (optionnel)"
                  idPrefix="sortie-date"
                  error={errors.startDate?.message ?? errors.endDate?.message ?? null}
                />
                <InlineError message={errors.startDate?.message} />
                <Field label="Durée" hint="Laisser vide pour une journée." htmlFor="sortie-duration">
                  <TextInput
                    id="sortie-duration"
                    {...form.register('duration')}
                    maxLength={60}
                    placeholder="1 journée"
                  />
                  <InlineError message={errors.duration?.message} />
                </Field>
              </div>

              <div>
                <Field label="Lieu" htmlFor="sortie-location">
                  <TextInput
                    id="sortie-location"
                    {...form.register('location')}
                    maxLength={120}
                    placeholder="Chamonix"
                  />
                  <InlineError message={errors.location?.message} />
                </Field>
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
                <Field label="Description" htmlFor="sortie-description">
                  <TextArea
                    id="sortie-description"
                    {...form.register('description')}
                    maxLength={1500}
                    placeholder="Le programme, le niveau, le matériel…"
                  />
                  <InlineError message={errors.description?.message} />
                </Field>
              </div>

              <div>
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
                <Link className="lkdv-form-link" href="/evenements" onClick={api.flushDraft}>
                  Voir les sorties
                </Link>
              </div>
            </StepPager>
          </CommunityFormDrawer>
        );
      }}
    </CreateFormEngine>
  );
}

export default SortieCreateForm;
