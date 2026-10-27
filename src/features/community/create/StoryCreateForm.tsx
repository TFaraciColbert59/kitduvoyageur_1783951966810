'use client';

import React, { useMemo, useState } from 'react';
import { Controller } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { stripImageMetadata } from '@/lib/media/stripImageMetadata';
import { CommunityFormDrawer } from './CommunityFormDrawer';
import { Field, Select, SubmitFooter, SwitchField, TextArea, TextInput } from './form-fields';
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
import { FormPreview } from './shared/FormPreview';
import { CreationInfoRail } from './shared/CreationInfoRail';
import { CreationSignature } from './shared/CreationSignature';
import { StoryLayerStack, CaptionRuler } from './shared/InfoCards';
import { InlineError } from './shared/InlineError';
import { createStoryMediaUploader } from './upload';

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
const STEP_FIELDS = [
  ['media'],
  ['caption', 'overlayText', 'overlayLink'],
  ['audience', 'replyPolicy', 'allowReshare'],
] as const;

/**
 * Composition v1 de `post_stories.composition` : tableau d’overlays.
 *
 * Le visionneur existant (`CommunityStoriesBar.parseTextOverlays`) filtre les
 * entrées `type: 'text'` et ignore les autres : l’overlay lien est donc
 * persisté sans casser la lecture actuelle.
 */
export type StoryCompositionEntry =
  | { type: 'text'; text: string }
  | { type: 'link'; url: string };

export function buildStoryComposition(
  values: Pick<StoryFormValues, 'overlayText' | 'overlayLink'>,
): StoryCompositionEntry[] | null {
  const entries: StoryCompositionEntry[] = [];
  const text = values.overlayText.trim().slice(0, 120);
  if (text) entries.push({ type: 'text', text });
  const url = values.overlayLink.trim();
  if (url) entries.push({ type: 'link', url });
  return entries.length > 0 ? entries : null;
}

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

  const storyUploader = useMemo(
    () => (user?.id ? createStoryMediaUploader(user.id) : undefined),
    [user?.id],
  );

  const setStep = (next: number) => {
    const safe = Math.max(0, Math.min(LAST_STEP, next));
    setInternalStep(safe);
    onStepChange?.(safe);
  };

  const submit = async (values: StoryFormValues) => {
    setSubmitError(null);
    if (!user?.id) throw new Error('Connecte-toi pour publier une story.');
    const media = values.media[0];
    if (!media) throw new Error('Choisis une photo ou une vidéo.');
    if (media.status === 'uploading') {
      throw new Error('Attends la fin de l’envoi du média.');
    }
    if (media.status === 'error') {
      throw new Error('Le média n’a pas pu être envoyé. Réessaie ou retire-le.');
    }

    const composition = buildStoryComposition(values);
    const supabase = createClient();
    const storyId = crypto.randomUUID();
    const isVideo = (media.type || '').startsWith('video/');
    let contentType = media.type || (isVideo ? 'video/mp4' : 'image/jpeg');
    let storagePath = media.storagePath?.trim() ?? '';
    const storageBucket = media.storageBucket?.trim() || 'stories-private';

    if (!storagePath) {
      // Média jamais envoyé (ou brouillon d’une version antérieure) : envoi
      // de secours au moment de publier, sans progression MediaPicker.
      const file = media.file;
      if (!file) throw new Error('Choisis une photo ou une vidéo.');
      if (file.size > MEDIA_MAX_BYTES) {
        throw new Error('Média trop volumineux (50 Mo max).');
      }
      const cleaned = isVideo ? file : await stripImageMetadata(file);
      contentType = cleaned.type || (isVideo ? 'video/mp4' : 'image/jpeg');
      const ext = (file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg'))
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      storagePath = `${user.id}/${storyId}/${Date.now()}.${ext || 'bin'}`;
      const { error: uploadError } = await supabase.storage
        .from('stories-private')
        .upload(storagePath, cleaned, { cacheControl: '3600', upsert: false, contentType });
      if (uploadError) throw new Error(uploadError.message);
    }

    const { error: insertError } = await supabase.from('post_stories').insert({
      id: storyId,
      author_id: user.id,
      image_url: null,
      storage_bucket: storageBucket,
      storage_path: storagePath,
      media_type: isVideo ? 'video' : 'image',
      mime_type: contentType,
      composition,
      composition_version: composition ? 1 : null,
      status: 'ready',
      client_request_id: crypto.randomUUID(),
      caption: values.caption.trim() ? values.caption.trim().slice(0, 280) : null,
      visibility: VISIBILITY[values.audience],
      reply_policy: values.replyPolicy,
      allow_reshare: values.allowReshare,
    });
    if (insertError) {
      await supabase.storage.from('stories-private').remove([storagePath]).catch(() => {});
      throw new Error(insertError.message);
    }

    onCreated('story', storyId);
    setStep(0);
    onClose();
  };

  return (
    <CreateFormEngine<StoryFormValues>
      kind="story"
      defaultValues={DEFAULTS}
      onSubmit={submit}
      resetOnSuccess
      draftKey="story"
      step={activeStep}
      onStepChange={setStep}
      stepFields={STEP_FIELDS}
      onError={(message) => setSubmitError(message)}
    >
      {(form, api) => {
        const errors = form.formState.errors;
        const previewValues = form.watch();
        const media = form.watch('media');
        const caption = form.watch('caption');
        const overlayText = form.watch('overlayText');
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
            <FormErrorSummary
              errors={errors}
              labels={CREATE_FIELD_LABELS}
              onFocusField={api.focusField}
            />
            <FormPreview kind="story" values={previewValues} />
            <CreationInfoRail kind="story" step={activeStep} steps={CREATE_STEPS.story} values={previewValues} />
            <CreationSignature kind="story" values={previewValues} />

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
                      upload={storyUploader}
                      fieldName="media"
                    />
                  )}
                />
                <InlineError message={errors.media?.message as string | undefined} />
                <p className="lkdv-form-note">
                  L’envoi démarre dès la sélection. En cas d’échec, réessaie sans
                  reprendre la story.
                </p>
              </div>

              <div>
                <StoryLayerStack values={previewValues} />
                {media[0]?.previewUrl || media[0]?.url ? (
                  <figure className="lkdv-create-story-frame" aria-label="Aperçu de la story">
                    {media[0].type.startsWith('video/') ? (
                      <video src={media[0].previewUrl || media[0].url || ''} muted playsInline />
                    ) : (
                      <img
                        src={media[0].previewUrl || media[0].url || ''}
                        alt={media[0].alt || 'Aperçu de la story'}
                      />
                    )}
                    <figcaption>
                      {overlayText.trim() || caption.trim() || 'Ta légende s’affichera ici.'}
                    </figcaption>
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
                  <CaptionRuler value={caption} max={280} />
                </Field>

                <Field label="Texte de la story" hint="120 caractères max." htmlFor="story-overlay">
                  <TextInput
                    id="story-overlay"
                    {...form.register('overlayText')}
                    maxLength={120}
                    placeholder="Texte à poser sur la story"
                  />
                  <InlineError message={errors.overlayText?.message} />
                </Field>

                <Field label="Lien de la story" htmlFor="story-link">
                  <TextInput
                    id="story-link"
                    type="url"
                    {...form.register('overlayLink')}
                    placeholder="https://…"
                  />
                  <InlineError message={errors.overlayLink?.message} />
                </Field>
              </div>

              <div>
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

                <Controller
                  control={form.control}
                  name="allowReshare"
                  render={({ field }) => (
                    <SwitchField
                      label="Partage"
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                <InlineError message={errors.allowReshare?.message} />
              </div>
            </StepPager>
          </CommunityFormDrawer>
        );
      }}
    </CreateFormEngine>
  );
}

export default StoryCreateForm;
