'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Controller } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { CommunityFormDrawer } from './CommunityFormDrawer';
import { Field, Select, SubmitFooter, TextArea, TextInput } from './form-fields';
import { CreateFormEngine } from './engine/CreateFormEngine';
import { createDefaults, CREATE_FIELD_LABELS, type KitFormValues } from './engine/createSchemas';
import { CREATE_STEPS, StepPager } from './shared/StepPager';
import { MediaPicker } from './shared/MediaPicker';
import { NumberStepper } from './shared/NumberStepper';
import { FormErrorSummary } from './shared/FormErrorSummary';
import { FormPreview } from './shared/FormPreview';
import { InlineError } from './shared/InlineError';
import { resolveCoverUrl } from './shared/mediaSubmit';
import { insertCommunityPost, createPostMediaUploader } from './upload';

export interface KitCreateFormProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: 'kit', id: string) => void;
  step?: number;
  onStepChange?: (step: number) => void;
}

const DEFAULTS = createDefaults('kit');
const STEPS = CREATE_STEPS.kit;
const LAST_STEP = STEPS.length - 1;
const STEP_FIELDS = [
  ['name', 'season', 'description', 'cover'],
  ['weightG', 'isPublic'],
] as const;

export function KitCreateForm({
  open,
  onClose,
  user,
  onCreated,
  step,
  onStepChange,
}: KitCreateFormProps) {
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

  const submit = async (values: KitFormValues) => {
    setSubmitError(null);
    if (!user?.id) throw new Error('Connecte-toi pour créer un kit.');
    const coverUrl = resolveCoverUrl(values.cover);

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from('materiel_kits')
      .insert({
        user_id: user.id,
        name: values.name.trim(),
        description: values.description.trim() || null,
        season: values.season,
        total_weight_g: values.weightG,
        is_public: values.isPublic,
        cover_image_url: coverUrl,
      })
      .select('id')
      .single();
    if (insertError || !data) {
      throw new Error(insertError?.message || 'Création du kit refusée.');
    }

    try {
      await insertCommunityPost({
        authorId: user.id,
        content: `**${values.name.trim()}**\n\n${
          values.description.trim() || 'Mon kit de matériel.'
        }\n\n/materiel`,
        postType: 'share',
        imageUrl: coverUrl,
        linkedKitId: data.id,
        audience: values.isPublic ? 'public' : 'abonnies',
        title: values.name.trim(),
      });
    } catch {
      // Le pont vers le fil est best-effort : le kit existe déjà.
    }

    onCreated('kit', data.id);
    setStep(0);
    onClose();
  };

  return (
    <CreateFormEngine<KitFormValues>
      kind="kit"
      defaultValues={DEFAULTS}
      onSubmit={submit}
      resetOnSuccess
      draftKey="kit"
      step={activeStep}
      onStepChange={setStep}
      stepFields={STEP_FIELDS}
      onError={(message) => setSubmitError(message)}
    >
      {(form, api) => {
        const errors = form.formState.errors;
        const previewValues = form.watch();
        const description = form.watch('description');
        const weightG = form.watch('weightG');
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
            ariaLabel="Créer un kit"
            error={submitError}
            footer={
              <SubmitFooter
                label={activeStep < LAST_STEP ? 'Continuer' : 'Créer le kit'}
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
            <FormPreview kind="kit" values={previewValues} />

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
                <Field label="Nom" htmlFor="kit-name">
                  <TextInput
                    id="kit-name"
                    {...form.register('name')}
                    maxLength={100}
                    placeholder="Kit bivouac 3 saisons"
                  />
                  <InlineError message={errors.name?.message} />
                </Field>
                <Field label="Saison" htmlFor="kit-season">
                  <Select id="kit-season" {...form.register('season')}>
                    <option value="toute_saison">Toute saison</option>
                    <option value="printemps">Printemps</option>
                    <option value="ete">Été</option>
                    <option value="automne">Automne</option>
                    <option value="hiver">Hiver</option>
                  </Select>
                  <InlineError message={errors.season?.message} />
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
                      hint="Une image pour la carte du kit."
                      upload={uploader}
                      fieldName="cover"
                    />
                  )}
                />
                <InlineError message={errors.cover?.message as string | undefined} />
                <Field
                  label="Description"
                  hint={`${description.length}/1000 caractères`}
                  htmlFor="kit-description"
                >
                  <TextArea
                    id="kit-description"
                    {...form.register('description')}
                    maxLength={1000}
                    placeholder="Usage, terrain, particularités…"
                  />
                  <InlineError message={errors.description?.message} />
                </Field>
              </div>

              <div>
                <Controller
                  control={form.control}
                  name="weightG"
                  render={({ field }) => (
                    <NumberStepper
                      label="Poids total"
                      value={field.value}
                      onChange={field.onChange}
                      min={1}
                      max={60_000}
                      step={100}
                      unit="g"
                    />
                  )}
                />
                <InlineError message={errors.weightG?.message} />
                <p className="lkdv-form-note">
                  {weightG > 0
                    ? `${(weightG / 1000).toFixed(2)} kg une fois les items ajoutés.`
                    : 'Renseigne le poids total du kit, en grammes.'}
                </p>
                <Field
                  label="Visibilité"
                  hint={
                    form.watch('isPublic')
                      ? 'Public — le kit apparaît sur ton profil.'
                      : 'Privé — seul toi peux ouvrir le kit.'
                  }
                  htmlFor="kit-visibility"
                >
                  <Select
                    id="kit-visibility"
                    value={form.watch('isPublic') ? 'public' : 'private'}
                    onChange={(event) =>
                      form.setValue('isPublic', event.target.value === 'public', {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  >
                    <option value="public">Public</option>
                    <option value="private">Privé</option>
                  </Select>
                  <InlineError message={errors.isPublic?.message} />
                </Field>
                <Link className="lkdv-form-link" href="/hub" onClick={api.flushDraft}>
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

export default KitCreateForm;
