'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Controller } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { CommunityFormDrawer } from './CommunityFormDrawer';
import { Field, Select, SubmitFooter, TextArea, TextInput } from './form-fields';
import { CreateFormEngine } from './engine/CreateFormEngine';
import { createDefaults, CREATE_FIELD_LABELS, type CarnetFormValues } from './engine/createSchemas';
import { CREATE_STEPS, StepPager } from './shared/StepPager';
import { MediaPicker } from './shared/MediaPicker';
import { DateRangeField } from './shared/DateRangeField';
import { FormErrorSummary } from './shared/FormErrorSummary';
import { InlineError } from './shared/InlineError';
import { resolveCoverUrl } from './shared/mediaSubmit';
import { insertCommunityPost, createPostMediaUploader } from './upload';

export interface CarnetCreateFormProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: 'carnet', id: string) => void;
  step?: number;
  onStepChange?: (step: number) => void;
}

const DEFAULTS = createDefaults('carnet');
const STEPS = CREATE_STEPS.carnet;
const LAST_STEP = STEPS.length - 1;
const STEP_FIELDS = [
  ['title', 'destination', 'description', 'cover'],
  ['startDate', 'endDate'],
  ['visibility'],
] as const;

const VISIBILITY_LABELS: Record<CarnetFormValues['visibility'], string> = {
  public: 'Public — visible dans le fil et sur ton profil.',
  private: 'Privé — seul toi peux ouvrir le carnet.',
};

export function CarnetCreateForm({
  open,
  onClose,
  user,
  onCreated,
  step,
  onStepChange,
}: CarnetCreateFormProps) {
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

  const submit = async (values: CarnetFormValues) => {
    setSubmitError(null);
    if (!user?.id) throw new Error('Connecte-toi pour créer un carnet.');
    const coverUrl = resolveCoverUrl(values.cover);

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from('carnets')
      .insert({
        title: values.title.trim(),
        destination: values.destination.trim(),
        description: values.description.trim(),
        cover_image: coverUrl ?? '',
        start_date: values.startDate || null,
        end_date: values.endDate || null,
        visibility: values.visibility,
        author_id: user.id,
      })
      .select('id')
      .single();
    if (insertError || !data) {
      throw new Error(insertError?.message || 'Création du carnet refusée.');
    }

    try {
      await insertCommunityPost({
        authorId: user.id,
        content: `**${values.title.trim()}**\n\n${
          values.description.trim() || values.destination.trim()
        }`,
        postType: 'share',
        imageUrl: coverUrl,
        audience: values.visibility === 'public' ? 'public' : 'abonnies',
        linkedCarnetId: data.id,
        title: values.title.trim(),
      });
    } catch {
      // Le pont vers le fil est best-effort : le carnet existe déjà.
    }

    onCreated('carnet', data.id);
    onClose();
  };

  return (
    <CreateFormEngine<CarnetFormValues>
      kind="carnet"
      defaultValues={DEFAULTS}
      onSubmit={submit}
      resetOnSuccess
    >
      {(form) => {
        const errors = form.formState.errors;
        const description = form.watch('description');
        const startDate = form.watch('startDate');
        const endDate = form.watch('endDate');
        const visibility = form.watch('visibility');
        const cover = form.watch('cover');
        const goNext = async () => {
          const fields = STEP_FIELDS[activeStep] ?? [];
          const valid = await form.trigger([...fields]);
          if (valid) setStep(activeStep + 1);
        };
        const onInvalid = (invalid: typeof errors) => {
          const first = Object.keys(invalid)[0];
          const target = STEP_FIELDS.findIndex(
            (fields) => first && (fields as readonly string[]).includes(first),
          );
          setStep(target >= 0 ? target : 0);
        };
        const onPrimary = () => {
          if (activeStep < LAST_STEP) {
            void goNext();
            return;
          }
          void form.handleSubmit(async (values) => {
            try {
              await submit(values);
              form.reset(DEFAULTS);
              setStep(0);
            } catch (error) {
              setSubmitError(
                error instanceof Error && error.message ? error.message : 'Création impossible.',
              );
            }
          }, onInvalid)();
        };

        return (
          <CommunityFormDrawer
            open={open}
            onClose={onClose}
            ariaLabel="Créer un carnet"
            error={submitError}
            footer={
              <SubmitFooter
                label={activeStep < LAST_STEP ? 'Continuer' : 'Créer le carnet'}
                busy={form.formState.isSubmitting}
                onClick={onPrimary}
              />
            }
          >
            <p className="lkdv-form-intro">
              Les bases du carnet. Les étapes, moments et le kit se complètent ensuite.
            </p>
            <FormErrorSummary
              errors={errors}
              labels={CREATE_FIELD_LABELS}
              onFocusField={(name) => {
                form.setFocus(name as Parameters<typeof form.setFocus>[0]);
              }}
            />

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
                <Field label="Titre" htmlFor="carnet-title">
                  <TextInput
                    id="carnet-title"
                    {...form.register('title')}
                    maxLength={120}
                    placeholder="Traversée du Vercors"
                  />
                  <InlineError message={errors.title?.message} />
                </Field>
                <Field label="Destination" htmlFor="carnet-destination">
                  <TextInput
                    id="carnet-destination"
                    {...form.register('destination')}
                    maxLength={120}
                    placeholder="Vercors, France"
                  />
                  <InlineError message={errors.destination?.message} />
                </Field>
                <Controller
                  control={form.control}
                  name="cover"
                  render={({ field }) => (
                    <MediaPicker
                      value={field.value}
                      onChange={field.onChange}
                      max={1}
                      label="Couverture"
                      hint="Une image pour la carte et le fil du carnet."
                      upload={uploader}
                    />
                  )}
                />
                <InlineError message={errors.cover?.message as string | undefined} />
                <Field
                  label="Description"
                  hint={`${description.length}/1000 caractères`}
                  htmlFor="carnet-description"
                >
                  <TextArea
                    id="carnet-description"
                    {...form.register('description')}
                    maxLength={1000}
                    placeholder="Le récit, l’idée, les points forts…"
                  />
                  <InlineError message={errors.description?.message} />
                </Field>
              </div>

              <div>
                <DateRangeField
                  label="Dates du voyage"
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
                  startLabel="Début"
                  endLabel="Fin"
                  idPrefix="carnet-date"
                  error={errors.endDate?.message ?? errors.startDate?.message ?? null}
                />
                <InlineError message={errors.startDate?.message} />
                {startDate && endDate ? (
                  <p className="lkdv-form-note">
                    {Math.max(
                      1,
                      Math.round(
                        (new Date(`${endDate}T12:00:00`).getTime() -
                          new Date(`${startDate}T12:00:00`).getTime()) /
                          86_400_000,
                      ),
                    )}{' '}
                    nuit(s) sur place.
                  </p>
                ) : null}
              </div>

              <div>
                <Field label="Visibilité" hint={VISIBILITY_LABELS[visibility]} htmlFor="carnet-visibility">
                  <Select id="carnet-visibility" {...form.register('visibility')}>
                    <option value="public">Public</option>
                    <option value="private">Privé</option>
                  </Select>
                  <InlineError message={errors.visibility?.message} />
                </Field>

                <div className="lkdv-create-form-preview" aria-label="Aperçu du carnet">
                  {cover[0]?.previewUrl || cover[0]?.url ? (
                    <img
                      className="lkdv-create-form-preview-cover"
                      src={cover[0].previewUrl || cover[0].url || ''}
                      alt={cover[0].alt || ''}
                    />
                  ) : (
                    <span className="lkdv-create-form-preview-cover is-empty" aria-hidden="true">
                      🥾
                    </span>
                  )}
                  <div className="lkdv-create-form-preview-txt">
                    <b>{form.watch('title').trim() || 'Titre du carnet'}</b>
                    <small>{form.watch('destination').trim() || 'Destination'}</small>
                    <small>
                      {startDate || 'Début'} → {endDate || 'Fin'} ·{' '}
                      {visibility === 'public' ? 'Public' : 'Privé'}
                    </small>
                  </div>
                </div>

                <Link className="lkdv-form-link" href="/communaute" onClick={onClose}>
                  Ouvrir l’éditeur complet
                </Link>
              </div>
            </StepPager>
          </CommunityFormDrawer>
        );
      }}
    </CreateFormEngine>
  );
}

export default CarnetCreateForm;
