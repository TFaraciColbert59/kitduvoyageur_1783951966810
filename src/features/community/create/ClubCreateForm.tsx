'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Controller } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { CommunityFormDrawer } from './CommunityFormDrawer';
import { Field, Select, SubmitFooter, TextArea, TextInput } from './form-fields';
import { CreateFormEngine } from './engine/CreateFormEngine';
import { createDefaults, CREATE_FIELD_LABELS, type ClubFormValues } from './engine/createSchemas';
import { CREATE_STEPS, StepPager } from './shared/StepPager';
import { MediaPicker } from './shared/MediaPicker';
import { FormErrorSummary } from './shared/FormErrorSummary';
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
const STEPS = CREATE_STEPS.club;
const LAST_STEP = STEPS.length - 1;
const STEP_FIELDS = [
  ['name', 'category', 'location'],
  ['description', 'cover'],
  ['privacy', 'membershipRules'],
] as const;

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
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
        rules: values.membershipRules.trim() || null,
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

    onCreated('club', data.id);
    onClose();
  };

  return (
    <CreateFormEngine<ClubFormValues>
      kind="club"
      defaultValues={DEFAULTS}
      onSubmit={submit}
      resetOnSuccess
    >
      {(form) => {
        const errors = form.formState.errors;
        const description = form.watch('description');
        const privacy = form.watch('privacy');
        const name = form.watch('name');
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
            <p className="lkdv-form-intro">
              L’identité du club. Les zones, événements et membres se complètent ensuite.
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
                  <Field label="Lieu" htmlFor="club-location">
                    <TextInput
                      id="club-location"
                      {...form.register('location')}
                      maxLength={80}
                      placeholder="Vercors"
                    />
                    <InlineError message={errors.location?.message} />
                  </Field>
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
                    />
                  )}
                />
                <InlineError message={errors.cover?.message as string | undefined} />
              </div>

              <div>
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

export default ClubCreateForm;
