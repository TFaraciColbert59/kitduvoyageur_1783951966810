'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Controller } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { CommunityFormDrawer } from './CommunityFormDrawer';
import { Field, Select, SubmitFooter, TextArea, TextInput } from './form-fields';
import { insertCommunityPost, createPostMediaUploader } from './upload';
import { CreateFormEngine } from './engine/CreateFormEngine';
import {
  createDefaults,
  CREATE_FIELD_LABELS,
  type PostFormValues,
  type PostKind,
  type PostAudience,
} from './engine/createSchemas';
import { StepPager, CREATE_STEPS } from './shared/StepPager';
import { MediaPicker } from './shared/MediaPicker';
import { TagChips } from './shared/TagChips';
import { NumberStepper } from './shared/NumberStepper';
import { FormErrorSummary } from './shared/FormErrorSummary';
import { FormPreview } from './shared/FormPreview';

export interface PostCreateFormProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: 'post', id: string) => void;
}

const POST_DEFAULTS = createDefaults('post');
const STEP_FIELDS = [
  ['kind'],
  [
    'title',
    'content',
    'media',
    'eventDate',
    'eventDuration',
    'location',
    'tags',
  ],
  ['audience', 'clubId', 'eventMax'],
] as const;

const TYPES: Array<{ id: PostKind; label: string }> = [
  { id: 'photo', label: 'Photo / vidéo' },
  { id: 'billet', label: 'Billet' },
  { id: 'question', label: 'Question' },
  { id: 'event', label: 'Événement' },
];

function InlineError({ message }: { message?: string }) {
  return message ? (
    <span className="lkdv-form-error-inline" role="alert">
      {message}
    </span>
  ) : null;
}

export function PostCreateForm({
  open,
  onClose,
  user,
  onCreated,
  step,
  onStepChange,
}: PostCreateFormProps & { step?: number; onStepChange?: (step: number) => void }) {
  const [internalStep, setInternalStep] = useState(0);
  const [clubs, setClubs] = useState<Array<{ id: string; name: string }>>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const activeStep = Math.max(0, Math.min(2, step ?? internalStep));

  const setStep = (next: number) => {
    const safe = Math.max(0, Math.min(2, next));
    setInternalStep(safe);
    onStepChange?.(safe);
  };

  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    const supabase = createClient();
    void (async () => {
      const { data: memberships } = await supabase
        .from('club_members')
        .select('club_id')
        .eq('user_id', user.id)
        .eq('status', 'active');
      const ids = (memberships ?? []).map((row: { club_id: string }) => row.club_id);
      if (!ids.length) return;
      const { data } = await supabase.from('clubs').select('id,name').in('id', ids);
      if (!cancelled) setClubs((data ?? []) as Array<{ id: string; name: string }>);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user?.id]);

  const uploader = useMemo(
    () => (user?.id ? createPostMediaUploader(user.id) : undefined),
    [user?.id],
  );

  const submit = async (values: PostFormValues) => {
    if (!user?.id) throw new Error('Connecte-toi pour publier.');
    if (values.audience !== 'public' && values.media.length > 0) {
      throw new Error('Les médias ne sont autorisés que pour une publication publique.');
    }
    if (values.media.some((item) => item.status === 'uploading')) {
      throw new Error('Attends la fin de l’envoi des médias.');
    }
    if (values.media.some((item) => item.status === 'error')) {
      throw new Error('Un média n’a pas pu être envoyé. Réessaie ou supprime-le.');
    }
    const mediaUrls = values.media
      .map((item) => item.url)
      .filter((url): url is string => Boolean(url));
    if (values.kind === 'photo' && mediaUrls.length === 0) {
      throw new Error('Choisis au moins une photo ou une vidéo.');
    }

    let postId: string;
    if (values.kind === 'event') {
      const supabase = createClient();
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          title: values.title.trim(),
          type: 'rando',
          emoji: '🥾',
          organizer_id: user.id,
          event_date: values.eventDate,
          duration: values.eventDuration.trim(),
          location: values.location.trim(),
          country: 'France',
          max_participants: values.eventMax,
          current_participants: 0,
          description: values.content.trim(),
          cover_image: mediaUrls[0] || '',
          cover_alt: values.title.trim(),
          shared_kitty: 0,
          kitty_goal: 0,
          status: 'upcoming',
        })
        .select('id')
        .single();
      if (eventError || !event) {
        throw new Error(eventError?.message || 'Création de l’événement refusée.');
      }
      postId = await insertCommunityPost({
        authorId: user.id,
        content: `**${values.title.trim()}**\n\n📅 ${values.eventDate}${
          values.location.trim() ? ` · 📍 ${values.location.trim()}` : ''
        }\n\n${values.content.trim()}\n\n/evenements`,
        postType: 'share',
        mediaUrls,
        audience: values.audience,
        clubId: values.clubId,
        title: values.title.trim(),
      });
    } else {
      const fullContent =
        values.kind !== 'photo' && values.title.trim()
          ? `**${values.title.trim()}**\n\n${values.content.trim()}`
          : values.content.trim();
      const locationLine = values.location.trim() ? `\n\n📍 ${values.location.trim()}` : '';
      postId = await insertCommunityPost({
        authorId: user.id,
        content: `${fullContent}${locationLine}`,
        postType: values.kind === 'question' ? 'question' : 'post',
        mediaUrls,
        audience: values.audience,
        clubId: values.clubId,
        title: values.title.trim() || null,
      });
    }

    onCreated('post', postId);
    setStep(0);
    onClose();
  };

  return (
    <CreateFormEngine<PostFormValues>
      kind="post"
      defaultValues={POST_DEFAULTS}
      onSubmit={submit}
      resetOnSuccess
      draftKey="post"
      step={activeStep}
      onStepChange={setStep}
      stepFields={STEP_FIELDS}
      onError={(message) => setSubmitError(message)}
    >
      {(form, api) => {
        const kind = form.watch('kind');
        const errors = form.formState.errors;
        const previewValues = form.watch();
        const goNext = async () => {
          const fields = STEP_FIELDS[activeStep] ?? [];
          const valid = await form.trigger([...fields]);
          if (valid) setStep(activeStep + 1);
        };
        const onPrimary = () => {
          if (activeStep < 2) {
            void goNext();
            return;
          }
          api.submit();
        };

        return (
          <CommunityFormDrawer
            open={open}
            onClose={onClose}
            ariaLabel="Créer une publication"
            error={submitError}
            footer={
              <SubmitFooter
                label={activeStep < 2 ? 'Continuer' : 'Publier'}
                busy={form.formState.isSubmitting}
                onClick={onPrimary}
              />
            }
          >
            <p className="lkdv-form-intro">
              Choisis le format, ajoute ton texte ou ton média, puis publie.
            </p>
            <FormErrorSummary
              errors={errors}
              labels={CREATE_FIELD_LABELS}
              onFocusField={api.focusField}
            />
            <FormPreview kind="post" values={previewValues} />

            <StepPager
              steps={CREATE_STEPS.post}
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
                <div className="lkdv-form-tabs" role="group" aria-label="Type de publication">
                  {TYPES.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      aria-pressed={kind === type.id}
                      onClick={() =>
                        form.setValue('kind', type.id, {
                          shouldValidate: true,
                          shouldDirty: true,
                          shouldTouch: true,
                        })
                      }
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
                <InlineError message={errors.kind?.message} />
              </div>

              <div>
                {kind !== 'photo' ? (
                  <Field
                    label={
                      kind === 'question'
                        ? 'Question'
                        : kind === 'event'
                          ? 'Titre de la sortie'
                          : 'Titre'
                    }
                  >
                    <TextInput
                      {...form.register('title')}
                      placeholder="Un titre clair"
                      maxLength={120}
                    />
                    <InlineError message={errors.title?.message} />
                  </Field>
                ) : null}

                <Field label={kind === 'event' ? 'Description' : 'Texte'}>
                  <TextArea
                    {...form.register('content')}
                    placeholder={
                      kind === 'question'
                        ? 'Pose ta question à la communauté…'
                        : 'Raconte, partage, demande…'
                    }
                    maxLength={4000}
                  />
                  <InlineError message={errors.content?.message} />
                </Field>

                {kind === 'photo' || kind === 'event' ? (
                  <Controller
                    control={form.control}
                    name="media"
                    render={({ field }) => (
                      <MediaPicker
                        value={field.value}
                        onChange={field.onChange}
                        max={10}
                        label={
                          kind === 'event'
                            ? 'Photo de couverture (optionnel)'
                            : 'Photos / vidéos'
                        }
                        upload={uploader}
                      />
                    )}
                  />
                ) : null}
                <InlineError message={errors.media?.message as string | undefined} />

                <div className="lkdv-form-row">
                  <Field label="Lieu">
                    <TextInput
                      {...form.register('location')}
                      placeholder="Lac Blanc, Chamonix…"
                    />
                    <InlineError message={errors.location?.message} />
                  </Field>
                  <Controller
                    control={form.control}
                    name="tags"
                    render={({ field }) => (
                      <TagChips
                        value={field.value}
                        onChange={field.onChange}
                        label="Tags"
                        suggestions={['rando', 'bivouac', 'ski', 'vélo']}
                      />
                    )}
                  />
                </div>
              </div>

              <div>
                <Field label="Audience">
                  <Select {...form.register('audience')}>
                    <option value="public">Fil public</option>
                    <option value="abonnies">Mes abonnés</option>
                    <option value="club">Un club</option>
                  </Select>
                  <InlineError message={errors.audience?.message} />
                </Field>
                {form.watch('audience') === 'club' ? (
                  <Field
                    label="Club"
                    hint={
                      clubs.length === 0 ? 'Aucun club actif : rejoins un club d’abord.' : undefined
                    }
                  >
                    <Select {...form.register('clubId')}>
                      <option value="">Choisir un club</option>
                      {clubs.map((club) => (
                        <option key={club.id} value={club.id}>
                          {club.name}
                        </option>
                      ))}
                    </Select>
                    <InlineError message={errors.clubId?.message} />
                  </Field>
                ) : null}

                {kind === 'event' ? (
                  <>
                    <div className="lkdv-form-row">
                      <Field label="Date">
                        <TextInput type="date" {...form.register('eventDate')} />
                        <InlineError message={errors.eventDate?.message} />
                      </Field>
                      <Field label="Durée">
                        <TextInput
                          {...form.register('eventDuration')}
                          placeholder="2 jours"
                        />
                        <InlineError message={errors.eventDuration?.message} />
                      </Field>
                    </div>
                    <Controller
                      control={form.control}
                      name="eventMax"
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
                    <InlineError message={errors.eventMax?.message} />
                  </>
                ) : null}
              </div>
            </StepPager>
          </CommunityFormDrawer>
        );
      }}
    </CreateFormEngine>
  );
}

export default PostCreateForm;
