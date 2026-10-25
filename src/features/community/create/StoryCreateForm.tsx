'use client';

import React, { useState } from 'react';
import { Controller } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { stripImageMetadata } from '@/lib/media/stripImageMetadata';
import { CommunityFormDrawer } from './CommunityFormDrawer';
import { Field, Select, SubmitFooter, TextArea } from './form-fields';
import { CreateFormEngine } from './engine/CreateFormEngine';
import {
  createDefaults,
  CREATE_FIELD_LABELS,
  MEDIA_MAX_BYTES,
  type StoryFormValues,
} from './engine/createSchemas';
import { CREATE_STEPS, StepPager } from './shared/StepPager';
import { MediaPicker } from './shared/MediaPicker';
import { FormErrorSummary } from './shared/FormErrorSummary';
import { InlineError } from './shared/InlineError';

export interface StoryCreateFormProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: 'story', id: string) => void;
  step?: number;
  onStepChange?: (step: number) => void;
}

const DEFAULTS = createDefaults('story');
const STEPS = CREATE_STEPS.story;
const LAST_STEP = STEPS.length - 1;
const STEP_FIELDS = [['media'], ['caption', 'audience', 'replyPolicy']] as const;

/** `post_stories.visibility` n’utilise pas le libellé d’interface « abonnies ». */
const VISIBILITY: Record<StoryFormValues['audience'], string> = {
  public: 'public',
  abonnies: 'followers',
  only_me: 'only_me',
};

export function StoryCreateForm({
  open,
  onClose,
  user,
  onCreated,
  step,
  onStepChange,
}: StoryCreateFormProps) {
  const [internalStep, setInternalStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const activeStep = Math.max(0, Math.min(LAST_STEP, step ?? internalStep));

  const setStep = (next: number) => {
    const safe = Math.max(0, Math.min(LAST_STEP, next));
    setInternalStep(safe);
    onStepChange?.(safe);
  };

  const submit = async (values: StoryFormValues) => {
    setSubmitError(null);
    if (!user?.id) throw new Error('Connecte-toi pour publier une story.');
    const media = values.media[0];
    const file = media?.file;
    if (!file) throw new Error('Choisis une photo ou une vidéo.');
    if (file.size > MEDIA_MAX_BYTES) throw new Error('Média trop volumineux (50 Mo max).');

    const supabase = createClient();
    const isVideo = file.type.startsWith('video/');
    const cleaned = isVideo ? file : await stripImageMetadata(file);
    const contentType = cleaned.type || (isVideo ? 'video/mp4' : 'image/jpeg');
    const ext = (file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg'))
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const storyId = crypto.randomUUID();
    const path = `${user.id}/${storyId}/${Date.now()}.${ext || 'bin'}`;
    const { error: uploadError } = await supabase.storage
      .from('stories-private')
      .upload(path, cleaned, { cacheControl: '3600', upsert: false, contentType });
    if (uploadError) throw new Error(uploadError.message);

    const { error: insertError } = await supabase.from('post_stories').insert({
      id: storyId,
      author_id: user.id,
      image_url: null,
      storage_bucket: 'stories-private',
      storage_path: path,
      media_type: isVideo ? 'video' : 'image',
      mime_type: contentType,
      composition: null,
      composition_version: null,
      status: 'ready',
      client_request_id: crypto.randomUUID(),
      caption: values.caption.trim() ? values.caption.trim().slice(0, 280) : null,
      visibility: VISIBILITY[values.audience],
      reply_policy: values.replyPolicy,
    });
    if (insertError) {
      await supabase.storage.from('stories-private').remove([path]).catch(() => {});
      throw new Error(insertError.message);
    }

    onCreated('story', storyId);
    onClose();
  };

  return (
    <CreateFormEngine<StoryFormValues>
      kind="story"
      defaultValues={DEFAULTS}
      onSubmit={submit}
      resetOnSuccess
    >
      {(form) => {
        const errors = form.formState.errors;
        const media = form.watch('media');
        const caption = form.watch('caption');
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
                error instanceof Error && error.message
                  ? error.message
                  : 'Publication impossible.',
              );
            }
          }, onInvalid)();
        };

        return (
          <CommunityFormDrawer
            open={open}
            onClose={onClose}
            ariaLabel="Créer une story"
            error={submitError}
            footer={
              <SubmitFooter
                label={activeStep < LAST_STEP ? 'Continuer' : 'Publier la story'}
                busy={form.formState.isSubmitting}
                onClick={onPrimary}
              />
            }
          >
            <p className="lkdv-form-intro">
              Une photo ou une vidéo verticale, une légende, une audience. La story dure 24 h.
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
                <Controller
                  control={form.control}
                  name="media"
                  render={({ field }) => (
                    <MediaPicker
                      value={field.value}
                      onChange={field.onChange}
                      max={1}
                      label="Photo ou vidéo"
                      hint="Un seul média, format vertical 9:16."
                    />
                  )}
                />
                <InlineError message={errors.media?.message as string | undefined} />
                <p className="lkdv-form-note">
                  L’aperçu reste sur ton appareil : l’envoi se fait à la publication.
                </p>
              </div>

              <div>
                {media[0]?.previewUrl ? (
                  <figure className="lkdv-create-story-frame" aria-label="Aperçu de la story">
                    {media[0].type.startsWith('video/') ? (
                      <video src={media[0].previewUrl} muted playsInline />
                    ) : (
                      <img src={media[0].previewUrl} alt={media[0].alt || 'Aperçu de la story'} />
                    )}
                    <figcaption>{caption.trim() || 'Ta légende s’affichera ici.'}</figcaption>
                  </figure>
                ) : null}

                <Field label="Légende" hint="280 caractères max." htmlFor="story-caption">
                  <TextArea
                    id="story-caption"
                    {...form.register('caption')}
                    maxLength={280}
                    placeholder="Un mot sur ce moment…"
                  />
                  <InlineError message={errors.caption?.message} />
                </Field>

                <div className="lkdv-form-row">
                  <Field label="Audience" htmlFor="story-audience">
                    <Select id="story-audience" {...form.register('audience')}>
                      <option value="public">Tout le monde</option>
                      <option value="abonnies">Mes abonnés</option>
                      <option value="only_me">Moi uniquement</option>
                    </Select>
                    <InlineError message={errors.audience?.message} />
                  </Field>
                  <Field label="Réponses" htmlFor="story-replies">
                    <Select id="story-replies" {...form.register('replyPolicy')}>
                      <option value="everyone">Tout le monde</option>
                      <option value="followers">Mes abonnés</option>
                      <option value="off">Désactivées</option>
                    </Select>
                    <InlineError message={errors.replyPolicy?.message} />
                  </Field>
                </div>
              </div>
            </StepPager>
          </CommunityFormDrawer>
        );
      }}
    </CreateFormEngine>
  );
}

export default StoryCreateForm;
