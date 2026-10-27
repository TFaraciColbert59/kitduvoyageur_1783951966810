'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Camera, FileText, HelpCircle, CalendarDays } from 'lucide-react';
import { Controller, type FieldPath } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { CommunityFormDrawer } from './CommunityFormDrawer';
import { Field, Select, SubmitFooter, SwitchField, TextArea, TextInput } from './form-fields';
import { insertCommunityPost, createPostMediaUploader } from './upload';
import { CreateFormEngine } from './engine/CreateFormEngine';
import {
  createDefaults,
  CREATE_FIELD_LABELS,
  type PostFormValues,
  type PostKind,
} from './engine/createSchemas';
import { StepPager, CREATE_STEPS } from './shared/StepPager';
import { MediaPicker } from './shared/MediaPicker';
import { TagChips } from './shared/TagChips';
import { NumberStepper } from './shared/NumberStepper';
import { FormErrorSummary } from './shared/FormErrorSummary';
import { FormPreview } from './shared/FormPreview';
import { CreationInfoRail } from './shared/CreationInfoRail';
import { CreationSignature } from './shared/CreationSignature';
import { PlaceSearch } from './shared/PlaceSearch';
import { AudienceLens, CaptionRuler, PollBalance } from './shared/InfoCards';

export interface PostCreateFormProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: 'post', id: string) => void;
}

const POST_DEFAULTS = createDefaults('post');
const STEPS = [CREATE_STEPS.post[0]];
const LAST_STEP = STEPS.length - 1;
const STEP_FIELDS = [
  ['kind', 'media', 'title', 'content', 'eventDate', 'eventDuration', 'eventMax', 'location', 'tags', 'pollOptions', 'audience', 'clubId', 'allowComments', 'allowLikes', 'scheduledAt'],
] as const;

const TYPES: Array<{ id: PostKind; label: string; hint: string; icon: React.ReactNode }> = [
  { id: 'photo', label: 'Photo / vidéo', hint: 'Montrer un moment', icon: <Camera size={15} aria-hidden="true" /> },
  { id: 'billet', label: 'Billet', hint: 'Raconter une histoire', icon: <FileText size={15} aria-hidden="true" /> },
  { id: 'question', label: 'Question', hint: 'Demander à la communauté', icon: <HelpCircle size={15} aria-hidden="true" /> },
  { id: 'event', label: 'Événement', hint: 'Donner rendez-vous', icon: <CalendarDays size={15} aria-hidden="true" /> },
];

export interface PostSnapshotPayload {
  schema: 'lkdv.post.options.v1';
  options: { allow_comments: boolean; allow_likes: boolean };
  scheduled_at: string | null;
  poll: { options: string[] } | null;
  /** Compatible `Record<string, unknown>` pour l’écriture jsonb. */
  [key: string]: unknown;
}

/**
 * Métadonnées de publication écrites dans `community_posts.snapshot_payload`.
 *
 * Le snapshot n’est autorisé que sur une audience publique (trigger
 * `reject_public_media_on_restricted_post`). Il est donc construit ici, pur et
 * testable, puis omis à la soumission pour `abonnies` / `club`.
 */
export function buildPostSnapshot(values: PostFormValues): PostSnapshotPayload {
  const pollOptions = values.pollOptions
    .map((option) => option.trim())
    .filter(Boolean);
  return {
    schema: 'lkdv.post.options.v1',
    options: {
      allow_comments: values.allowComments,
      allow_likes: values.allowLikes,
    },
    scheduled_at: values.scheduledAt || null,
    poll: pollOptions.length >= 2 ? { options: pollOptions } : null,
  };
}

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
  const activeStep = Math.max(0, Math.min(LAST_STEP, step ?? internalStep));

  const setStep = (next: number) => {
    const safe = Math.max(0, Math.min(LAST_STEP, next));
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

    // La base refuse un snapshot sur une audience restreinte : on ne l’envoie
    // que pour une publication publique.
    const snapshotPayload =
      values.audience === 'public' ? buildPostSnapshot(values) : null;

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
        snapshotPayload,
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
        snapshotPayload,
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
        const pollOptions = form.watch('pollOptions');
        const pollEnabled = pollOptions.length > 0;
        const pollAllowed = kind === 'question' || kind === 'billet';
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
        const setPollOptions = (next: string[]) =>
          form.setValue('pollOptions', next, {
            shouldValidate: true,
            shouldDirty: true,
          });
        const selectKind = (type: PostKind) => {
          form.setValue('kind', type, {
            shouldValidate: true,
            shouldDirty: true,
            shouldTouch: true,
          });
          // Le sondage n’est proposé que pour les billets et les questions :
          // changer de format ne doit pas publier d’options devenues invisibles.
          if (type !== 'question' && type !== 'billet') setPollOptions([]);
        };

        return (
          <CommunityFormDrawer
            open={open}
            onClose={onClose}
            ariaLabel="Créer une publication"
            error={submitError}
            footer={
              <SubmitFooter
                label={activeStep < LAST_STEP ? 'Continuer' : 'Publier'}
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
            <FormPreview kind="post" values={previewValues} />
            <CreationInfoRail kind="post" step={activeStep} steps={STEPS} values={previewValues} />
            <CreationSignature kind="post" values={previewValues} />

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
                      <span className="lkdv-format-icon">{type.icon}</span>
                      <span className="lkdv-format-copy">
                        <b>{type.label}</b>
                        <small>{type.hint}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <InlineError message={errors.kind?.message} />
              </div>

              <div>
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
                      fieldName="media"
                    />
                  )}
                />
                <InlineError message={errors.media?.message as string | undefined} />
                <p className="lkdv-form-note">
                  Les médias ne sont pas autorisés pour une audience restreinte.
                </p>
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
                  <CaptionRuler value={form.watch('content')} max={4000} />
                </Field>

                <div className="lkdv-form-row">
                  <Controller
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <PlaceSearch label="Lieu" value={field.value} onChange={field.onChange} placeholder="Lac Blanc, Chamonix…" />
                    )}
                  />
                  <InlineError message={errors.location?.message} />
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

                {pollAllowed ? (
                  <div>
                    <SwitchField
                      label="Sondage"
                      checked={pollEnabled}
                      onChange={(enabled) => setPollOptions(enabled ? ['', ''] : [])}
                    />
                    {pollEnabled ? (
                      <>
                        {pollOptions.map((option, index) => (
                          <div key={index} className="lkdv-form-row lkdv-poll-option">
                            <Field
                              label={`Option ${index + 1}`}
                              htmlFor={`post-poll-${index}`}
                            >
                              <Controller
                                control={form.control}
                                name={`pollOptions.${index}` as FieldPath<PostFormValues>}
                                render={({ field }) => (
                                  <TextInput
                                    {...field}
                                    id={`post-poll-${index}`}
                                    placeholder={`Option ${index + 1}`}
                                    maxLength={80}
                                  />
                                )}
                              />
                              <InlineError
                                message={
                                  errors.pollOptions?.[index]?.message as string | undefined
                                }
                              />
                            </Field>
                            <button
                              type="button"
                              className="lkdv-create-step-back"
                              aria-label={`Retirer l’option ${index + 1}`}
                              onClick={() =>
                                setPollOptions(
                                  pollOptions.filter((_, entry) => entry !== index),
                                )
                              }
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {pollOptions.length < 4 ? (
                          <button
                            type="button"
                            className="lkdv-create-step-back"
                            aria-label="Ajouter une option"
                            onClick={() => setPollOptions([...pollOptions, ''])}
                          >
                            +
                          </button>
                        ) : null}
                        <PollBalance options={pollOptions} />
                        <InlineError
                          message={errors.pollOptions?.message as string | undefined}
                        />
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div>
                <AudienceLens value={form.watch('audience')} />
                <details className="lkdv-advanced">
                  <summary>Plus d’options</summary>
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

                <Field
                  label="Publication programmée"
                  hint="Vide = publication immédiate."
                  htmlFor="post-scheduled-at"
                >
                  <TextInput
                    id="post-scheduled-at"
                    type="datetime-local"
                    {...form.register('scheduledAt')}
                  />
                  <InlineError message={errors.scheduledAt?.message} />
                </Field>
                </details>
              </div>
            </StepPager>
          </CommunityFormDrawer>
        );
      }}
    </CreateFormEngine>
  );
}

export default PostCreateForm;
