'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Controller, type FieldPath } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { CommunityFormDrawer } from './CommunityFormDrawer';
import { Field, Select, SubmitFooter, SwitchField, TextArea, TextInput } from './form-fields';
import { CreateFormEngine } from './engine/CreateFormEngine';
import { createDefaults, CREATE_FIELD_LABELS, type ClubFormValues } from './engine/createSchemas';
import { CREATE_STEPS, StepPager } from './shared/StepPager';
import { MediaPicker } from './shared/MediaPicker';
import { FormErrorSummary } from './shared/FormErrorSummary';
import { FormPreview } from './shared/FormPreview';
import { CreationInfoRail } from './shared/CreationInfoRail';
import { CreationSignature } from './shared/CreationSignature';
import { PlaceSearch } from './shared/PlaceSearch';
import { ClubRulesLedger, ClubModeCards, JoinStepper, ClubInvitePass } from './shared/InfoCards';
import { InlineError } from './shared/InlineError';
import { resolveCoverUrl } from './shared/mediaSubmit';
import { insertCommunityPost, createPostMediaUploader } from './upload';

export interface ClubCreateFormProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: 'club', id: string) => void;
  step?: number;
  onStepChange?: (step: number) => void;
}

const DEFAULTS = createDefaults('club');
const STEPS = [CREATE_STEPS.club[0]];
const LAST_STEP = STEPS.length - 1;
const STEP_FIELDS = [
  ['name', 'category', 'location', 'description', 'cover', 'privacy', 'membershipRules', 'joinQuestions', 'welcomePost'],
] as const;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * `clubs.rules` est la seule colonne texte d’adhésion : les règles libres et
 * les questions structurées y sont concaténées, sans nouvelle colonne.
 */
export function buildClubRules(values: ClubFormValues): string | null {
  const questions = values.joinQuestions
    .map((question) => question.trim())
    .filter(Boolean);
  const parts = [values.membershipRules.trim()];
  if (questions.length > 0) {
    parts.push(
      `Questions d’adhésion :\n${questions
        .map((question, index) => `${index + 1}. ${question}`)
        .join('\n')}`,
    );
  }
  const rules = parts.filter(Boolean).join('\n\n');
  return rules || null;
}

export function ClubCreateForm({
  open,
  onClose,
  user,
  onCreated,
  step,
  onStepChange,
}: ClubCreateFormProps) {
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

  const submit = async (values: ClubFormValues) => {
    setSubmitError(null);
    if (!user?.id) throw new Error('Connecte-toi pour créer un club.');
    const coverUrl = resolveCoverUrl(values.cover);
    const description = [
      values.description.trim(),
      values.location.trim() ? `📍 ${values.location.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    const slugBase = slugify(values.name);
    const slug = `${slugBase || 'club'}-${Math.random().toString(36).slice(2, 6)}`;

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from('clubs')
      .insert({
        slug,
        name: values.name.trim(),
        description,
        cover_image: coverUrl ?? '',
        category: values.category.trim(),
        privacy: values.privacy,
        rules: buildClubRules(values),
        created_by: user.id,
        members_count: 1,
      })
      .select('id, slug')
      .single();
    if (insertError || !data) {
      throw new Error(insertError?.message || 'Création du club refusée.');
    }

    const { error: memberError } = await supabase.from('club_members').insert({
      club_id: data.id,
      user_id: user.id,
      role: 'admin',
      status: 'active',
    });
    if (memberError) throw new Error(memberError.message);

    if (values.welcomePost) {
      try {
        await insertCommunityPost({
          authorId: user.id,
          content: `**Bienvenue dans ${values.name.trim()}**\n\n${
            values.description.trim() || 'La cordée est ouverte.'
          }\n\n/clubs/${data.slug || data.id}`,
          postType: 'share',
          imageUrl: coverUrl,
          audience: 'club',
          clubId: data.id,
          title: values.name.trim(),
        });
      } catch {
        // Le pont vers le fil est best-effort : le club existe déjà.
      }
    }

    onCreated('club', data.id);
    setStep(0);
    onClose();
  };

  return (
    <CreateFormEngine<ClubFormValues>
      kind="club"
      defaultValues={DEFAULTS}
      onSubmit={submit}
      resetOnSuccess
      draftKey="club"
      step={activeStep}
      onStepChange={setStep}
      stepFields={STEP_FIELDS}
      onError={(message) => setSubmitError(message)}
    >
      {(form, api) => {
        const errors = form.formState.errors;
        const previewValues = form.watch();
        const description = form.watch('description');
        const privacy = form.watch('privacy');
        const name = form.watch('name');
        const joinQuestions = form.watch('joinQuestions');
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
        const setJoinQuestions = (next: string[]) =>
          form.setValue('joinQuestions', next, {
            shouldValidate: true,
            shouldDirty: true,
          });

        return (
          <CommunityFormDrawer
            open={open}
            onClose={onClose}
            ariaLabel="Créer un club"
            error={submitError}
            footer={
              <SubmitFooter
                label={activeStep < LAST_STEP ? 'Continuer' : 'Créer le club'}
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
            <FormPreview kind="club" values={previewValues} />
            <CreationInfoRail kind="club" step={activeStep} steps={STEPS} values={previewValues} />
            <CreationSignature kind="club" values={previewValues} />

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
                <Field label="Nom" htmlFor="club-name">
                  <TextInput
                    id="club-name"
                    {...form.register('name')}
                    maxLength={80}
                    placeholder="La Cordée du Vercors"
                  />
                  <InlineError message={errors.name?.message} />
                </Field>
                <div className="lkdv-form-row">
                  <Field label="Catégorie" htmlFor="club-category">
                    <TextInput
                      id="club-category"
                      {...form.register('category')}
                      maxLength={60}
                      placeholder="Randonnée"
                    />
                    <InlineError message={errors.category?.message} />
                  </Field>
                  <Controller
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <PlaceSearch label="Lieu" value={field.value} onChange={field.onChange} placeholder="Vercors" />
                    )}
                  />
                  <InlineError message={errors.location?.message} />
                </div>
                <p className="lkdv-form-note">
                  {name.trim()
                    ? `Le club sera visible sous « ${name.trim()} ».`
                    : 'Le nom du club apparaîtra sur sa carte et dans le fil.'}
                </p>
              </div>

              <div>
                <Field
                  label="Description"
                  hint={`${description.length}/1500 caractères`}
                  htmlFor="club-description"
                >
                  <TextArea
                    id="club-description"
                    {...form.register('description')}
                    maxLength={1500}
                    placeholder="L’esprit du club, le niveau, le rythme…"
                  />
                  <InlineError message={errors.description?.message} />
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
                      hint="Le visuel de la carte du club."
                      upload={uploader}
                      fieldName="cover"
                    />
                  )}
                />
                <InlineError message={errors.cover?.message as string | undefined} />
              </div>

              <div>
                <JoinStepper questions={joinQuestions.filter(Boolean).length} privacy={privacy} />
                <ClubRulesLedger values={previewValues} />
                <ClubModeCards value={privacy} />
                <Field
                  label="Adhésion"
                  hint={
                    privacy === 'open'
                      ? 'Ouvert — on rejoint le club en un geste.'
                      : 'Sur validation — chaque demande est approuvée.'
                  }
                  htmlFor="club-privacy"
                >
                  <Select id="club-privacy" {...form.register('privacy')}>
                    <option value="open">Ouvert</option>
                    <option value="closed">Sur validation</option>
                  </Select>
                  <InlineError message={errors.privacy?.message} />
                </Field>
                <Field
                  label="Règles d’adhésion"
                  hint="1000 caractères max. Facultatif."
                  htmlFor="club-rules"
                >
                  <TextArea
                    id="club-rules"
                    {...form.register('membershipRules')}
                    maxLength={1000}
                    placeholder="Niveau requis, matériel, charte du club…"
                  />
                  <InlineError message={errors.membershipRules?.message} />
                </Field>
                {joinQuestions.map((question, index) => (
                  <div key={index} className="lkdv-form-row">
                    <Field
                      label={`Question ${index + 1}`}
                      htmlFor={`club-question-${index}`}
                    >
                      <Controller
                        control={form.control}
                        name={`joinQuestions.${index}` as FieldPath<ClubFormValues>}
                        render={({ field }) => (
                          <TextInput
                            {...field}
                            id={`club-question-${index}`}
                            placeholder={`Question ${index + 1}`}
                            maxLength={120}
                          />
                        )}
                      />
                      <InlineError
                        message={errors.joinQuestions?.[index]?.message as string | undefined}
                      />
                    </Field>
                    <button
                      type="button"
                      className="lkdv-create-step-back"
                      aria-label={`Retirer la question ${index + 1}`}
                      onClick={() =>
                        setJoinQuestions(
                          joinQuestions.filter((_, entry) => entry !== index),
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                {joinQuestions.length < 3 ? (
                  <button
                    type="button"
                    className="lkdv-create-step-back"
                    aria-label="Ajouter une question"
                    onClick={() => setJoinQuestions([...joinQuestions, ''])}
                  >
                    +
                  </button>
                ) : null}
                <InlineError message={errors.joinQuestions?.message as string | undefined} />
              </div>

              <div>
                <ClubInvitePass />
                <Controller
                  control={form.control}
                  name="welcomePost"
                  render={({ field }) => (
                    <SwitchField
                      label="Post d’accueil"
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                <InlineError message={errors.welcomePost?.message} />
                <p className="lkdv-form-note">
                  Le post d’accueil est publié dans le fil du club après validation.
                </p>
                <Link className="lkdv-form-link" href="/communaute" onClick={api.flushDraft}>
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

export default ClubCreateForm;
