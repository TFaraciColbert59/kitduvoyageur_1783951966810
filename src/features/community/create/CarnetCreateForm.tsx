'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Controller } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { CommunityFormDrawer } from './CommunityFormDrawer';
import { Field, Select, SubmitFooter, SwitchField, TextArea, TextInput } from './form-fields';
import { CreateFormEngine } from './engine/CreateFormEngine';
import { createDefaults, CREATE_FIELD_LABELS, type CarnetFormValues } from './engine/createSchemas';
import { CREATE_STEPS, StepPager } from './shared/StepPager';
import { MediaPicker } from './shared/MediaPicker';
import { DateRangeField } from './shared/DateRangeField';
import { NumberStepper } from './shared/NumberStepper';
import { TagChips } from './shared/TagChips';
import { FormErrorSummary } from './shared/FormErrorSummary';
import { CreationSignature } from './shared/CreationSignature';
import { FormPreview } from './shared/FormPreview';
import { PlaceSearch } from './shared/PlaceSearch';
import { WeatherByDay } from './shared/WeatherByDay';
import { AiImproveButton } from './shared/AiImproveButton';
import { RouteMetrics, CarnetLogistics } from './shared/InfoCards';
import { CarnetCoverBoard, CarnetGpxBlock, CarnetDays } from './shared/CarnetExtras';
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
const STEPS = [CREATE_STEPS.carnet[0]];
const LAST_STEP = STEPS.length - 1;
const STEP_FIELDS = [
  ['title', 'destination', 'cover', 'lieuDepart', 'lieuArrivee', 'distanceKm', 'deniveleM', 'routeRating', 'startDate', 'endDate', 'nbNuits', 'nbVoyageurs', 'weather', 'tags', 'isCollaborative', 'description', 'visibility'],
] as const;

const VISIBILITY_LABELS: Record<CarnetFormValues['visibility'], string> = {
  public: 'Public — visible dans le fil et sur ton profil.',
  private: 'Privé — seul toi peux ouvrir le carnet.',
};

const RATING_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export interface CarnetInsertRow {
  title: string;
  destination: string;
  description: string;
  cover_image: string;
  cover_image_alt: string;
  start_date: string | null;
  end_date: string | null;
  visibility: CarnetFormValues['visibility'];
  author_id: string;
  lieu_depart: string | null;
  lieu_arrivee: string | null;
  distance_km: number;
  denivele_m: number;
  nb_nuits: number;
  nb_voyageurs: number;
  weather: string | null;
  route_rating: number;
  tags: string[];
  is_collaborative: boolean;
  [key: string]: unknown;
}

/**
 * Ligne `carnets` : uniquement des colonnes existantes, aucune migration.
 * `map_points` reste intact (le formulaire rapide n’a pas de coordonnées) ;
 * l’itinéraire vit dans `lieu_depart`, `lieu_arrivee`, `distance_km` et
 * `denivele_m`.
 */
export function buildCarnetRow(
  values: CarnetFormValues,
  userId: string,
  coverUrl: string | null,
): CarnetInsertRow {
  return {
    title: values.title.trim(),
    destination: values.destination.trim(),
    description: values.description.trim(),
    cover_image: coverUrl ?? '',
    cover_image_alt: values.cover[0]?.alt?.trim() || values.title.trim(),
    start_date: values.startDate || null,
    end_date: values.endDate || null,
    visibility: values.visibility,
    author_id: userId,
    lieu_depart: values.lieuDepart.trim() || null,
    lieu_arrivee: values.lieuArrivee.trim() || null,
    distance_km: values.distanceKm,
    denivele_m: values.deniveleM,
    nb_nuits: values.nbNuits,
    nb_voyageurs: values.nbVoyageurs,
    weather: values.weather.trim() || null,
    route_rating: values.routeRating,
    tags: values.tags,
    is_collaborative: values.isCollaborative,
  };
}

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
    const row = buildCarnetRow(values, user.id, coverUrl);

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from('carnets')
      .insert(row)
      .select('id')
      .single();
    if (insertError || !data) {
      throw new Error(insertError?.message || 'Création du carnet refusée.');
    }

    try {
      const routeLine = [
        values.distanceKm > 0 ? `${values.distanceKm} km` : '',
        values.deniveleM > 0 ? `+${values.deniveleM} m` : '',
        values.nbNuits > 0 ? `${values.nbNuits} nuit(s)` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      await insertCommunityPost({
        authorId: user.id,
        content: `**${values.title.trim()}**\n\n${
          values.description.trim() || values.destination.trim()
        }${routeLine ? `\n\n${routeLine}` : ''}`,
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
    setStep(0);
    onClose();
  };

  return (
    <CreateFormEngine<CarnetFormValues>
      kind="carnet"
      defaultValues={DEFAULTS}
      onSubmit={submit}
      resetOnSuccess
      draftKey="carnet"
      step={activeStep}
      onStepChange={setStep}
      stepFields={STEP_FIELDS}
      onError={(message) => setSubmitError(message)}
    >
      {(form, api) => {
        const errors = form.formState.errors;
        const previewValues = form.watch();
        const description = form.watch('description');
        const startDate = form.watch('startDate');
        const endDate = form.watch('endDate');
        const visibility = form.watch('visibility');
        const routeRating = form.watch('routeRating');
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
            <FormErrorSummary
              errors={errors}
              labels={CREATE_FIELD_LABELS}
              onFocusField={api.focusField}
            />
            <CreationSignature kind="carnet" values={previewValues} />

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
                <Field label="Titre" htmlFor="carnet-title" required>
                  <TextInput
                    id="carnet-title"
                    {...form.register('title')}
                    maxLength={120}
                    placeholder="Traversée du Vercors"
                  />
                  <InlineError message={errors.title?.message} />
                </Field>
                <div className="lkdv-carnet-dest-date">
                <Controller
                  control={form.control}
                  name="destination"
                  render={({ field }) => (
                    <PlaceSearch label="Destination" value={field.value} onChange={field.onChange} placeholder="Vercors, France" />
                  )}
                />
                <InlineError message={errors.destination?.message} />
                <DateRangeField
                  label="Dates du voyage"
                  start={startDate}
                  end={endDate}
                  onStartChange={(value) => {
                    form.setValue('startDate', value, { shouldValidate: true, shouldDirty: true });
                    const end = form.getValues('endDate');
                    const nights = value && end ? Math.max(0, Math.round((new Date(end).getTime() - new Date(value).getTime()) / 86_400_000)) : 0;
                    form.setValue('nbNuits', nights, { shouldDirty: true });
                  }}
                  onEndChange={(value) => {
                    form.setValue('endDate', value, { shouldValidate: true, shouldDirty: true });
                    const start = form.getValues('startDate');
                    const nights = start && value ? Math.max(0, Math.round((new Date(value).getTime() - new Date(start).getTime()) / 86_400_000)) : 0;
                    form.setValue('nbNuits', nights, { shouldDirty: true });
                  }}
                  startLabel="Début"
                  endLabel="Fin"
                  idPrefix="carnet-date"
                  error={errors.endDate?.message ?? errors.startDate?.message ?? null}
                />
                <InlineError message={errors.startDate?.message} />
                </div>
                <div hidden aria-hidden="true"><FormPreview kind="carnet" values={previewValues} /></div>
                <div className="lkdv-carnet-cover-source" aria-hidden="true">
                  <Controller
                    control={form.control}
                    name="cover"
                    render={({ field }) => (
                      <MediaPicker value={field.value} onChange={field.onChange} max={1} label="Couverture" hint="Une image pour la carte et le fil du carnet." upload={uploader} fieldName="cover" />
                    )}
                  />
                </div>
                <InlineError message={errors.cover?.message as string | undefined} />
                <CarnetCoverBoard
                  cover={form.watch('cover')}
                  onAddCover={() => document.querySelector<HTMLInputElement>('.lkdv-carnet-cover-source input[type=file]')?.click()}
                />
                <CarnetDays startDate={startDate} endDate={endDate} />
              </div>

              <div>
                <div className="lkdv-form-row lkdv-route-gpx">
                  <RouteMetrics values={previewValues} />
                  <CarnetGpxBlock />
                </div>
                <div className="lkdv-form-row">
                  <Controller
                    control={form.control}
                    name="lieuDepart"
                    render={({ field }) => (
                      <PlaceSearch label="Départ" value={field.value} onChange={field.onChange} placeholder="Chamonix" />
                    )}
                  />
                  <InlineError message={errors.lieuDepart?.message} />
                  <Controller
                    control={form.control}
                    name="lieuArrivee"
                    render={({ field }) => (
                      <PlaceSearch label="Arrivée" value={field.value} onChange={field.onChange} placeholder="Les Houches" />
                    )}
                  />
                  <InlineError message={errors.lieuArrivee?.message} />
                </div>

                <div className="lkdv-form-row">
                  <Field label="Distance (km)" htmlFor="carnet-distance">
                    <TextInput
                      id="carnet-distance"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={10_000}
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
                        max={30_000}
                        step={50}
                        unit="m"
                      />
                    )}
                  />
                </div>
                <InlineError message={errors.deniveleM?.message} />
                <Field
                  label="Note de l’itinéraire"
                  hint="0 à 5, par pas de 0,5."
                  htmlFor="carnet-rating"
                >
                  <Select
                    id="carnet-rating"
                    value={String(routeRating)}
                    onChange={(event) =>
                      form.setValue('routeRating', Number(event.target.value), {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  >
                    {RATING_OPTIONS.map((rating) => (
                      <option key={rating} value={String(rating)}>
                        {rating === 0 ? 'Non noté' : `${String(rating).replace('.', ',')} / 5`}
                      </option>
                    ))}
                  </Select>
                  <InlineError message={errors.routeRating?.message} />
                </Field>
              </div>

              <div>
                <CarnetLogistics
                  nights={form.watch('nbNuits')}
                  travelers={form.watch('nbVoyageurs')}
                  weather={form.watch('weather')}
                  rating={routeRating}
                />


                <div className="lkdv-form-row">
                  <Controller
                    control={form.control}
                    name="nbVoyageurs"
                    render={({ field }) => (
                      <NumberStepper
                        label="Voyageurs"
                        value={field.value}
                        onChange={field.onChange}
                        min={1}
                        max={50}
                        unit="pers."
                      />
                    )}
                  />
                </div>
                <InlineError message={errors.nbVoyageurs?.message} />
                <p className="lkdv-form-note">Nuits calculées automatiquement depuis les dates.</p>

                <div className="lkdv-form-row lkdv-weather-tags">
                  <Controller
                    control={form.control}
                    name="weather"
                    render={({ field }) => (
                      <WeatherByDay startDate={startDate} endDate={endDate} value={field.value} onChange={field.onChange} />
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="tags"
                    render={({ field }) => (
                      <TagChips value={field.value} onChange={field.onChange} label="Tags" />
                    )}
                  />
                </div>
                <InlineError message={errors.weather?.message} />

                <details className="lkdv-advanced">
                  <summary>Collaboratif</summary>
                  <Controller
                    control={form.control}
                    name="isCollaborative"
                    render={({ field }) => (
                      <SwitchField label="Collaboratif" checked={field.value} onChange={field.onChange} />
                    )}
                  />
                  <InlineError message={errors.isCollaborative?.message} />
                </details>
              </div>

              <div>
                <Field
                  label="Récit"
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
                  <AiImproveButton value={description} onChange={(next) => form.setValue('description', next, { shouldDirty: true, shouldValidate: true })} />
                </Field>
              </div>

              <div>
                <details className="lkdv-advanced">
                  <summary>Visibilité</summary>
                  <Field label="Visibilité" hint={VISIBILITY_LABELS[visibility]} htmlFor="carnet-visibility">
                    <Select id="carnet-visibility" {...form.register('visibility')}>
                      <option value="public">Public</option>
                      <option value="private">Privé</option>
                    </Select>
                    <InlineError message={errors.visibility?.message} />
                  </Field>
                </details>

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

export default CarnetCreateForm;
