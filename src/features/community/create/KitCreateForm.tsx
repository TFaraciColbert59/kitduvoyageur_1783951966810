'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { CommunityFormDrawer } from './CommunityFormDrawer';
import { Field, Select, SubmitFooter, TextArea, TextInput } from './form-fields';
import { CreateFormEngine } from './engine/CreateFormEngine';
import { createDefaults, CREATE_FIELD_LABELS, type KitFormValues } from './engine/createSchemas';
import { CREATE_STEPS, StepPager } from './shared/StepPager';
import { MediaPicker } from './shared/MediaPicker';
import { FormErrorSummary } from './shared/FormErrorSummary';
import { FormPreview } from './shared/FormPreview';
import { CreationInfoRail } from './shared/CreationInfoRail';
import { CreationSignature } from './shared/CreationSignature';
import { KitPackingMatrix } from './shared/InfoCards';
import { InlineError } from './shared/InlineError';
import { resolveCoverUrl } from './shared/mediaSubmit';
import { insertCommunityPost, createPostMediaUploader } from './upload';
import { InventoryPicker } from './kit/InventoryPicker';
import {
  KIT_TEMPLATES,
  inventoryWeight,
  kitCompletionScore,
  suggestKitCompletion,
  type CustomKitItem,
  type InventoryItem,
  type KitTemplateId,
} from './kit/kitCompletion';

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
  ['inventoryIds'],
  ['customItems', 'template'],
  ['name', 'season', 'weightG', 'description', 'isPublic', 'cover'],
] as const;

function totalWeight(selected: InventoryItem[], custom: CustomKitItem[]) {
  return inventoryWeight(selected, custom);
}

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
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [inventoryRetry, setInventoryRetry] = useState(0);
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

  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    setInventoryLoading(true);
    setInventoryError(null);
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      setInventoryError('Inventaire indisponible pour le moment.');
      setInventoryLoading(false);
      return;
    }
    void supabase
      .from('product_ownership')
      .select('id, name, photo_url, condition, category, weight_g')
      .eq('user_id', user.id)
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setInventoryError(error.message);
        else {
          setInventory(
            (data ?? []).map((row: any) => ({
              id: row.id,
              name: row.name || 'Objet',
              photoUrl: row.photo_url,
              condition: row.condition,
              category: row.category,
              weightG: row.weight_g,
            })),
          );
        }
        setInventoryLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, user?.id, inventoryRetry]);

  const submit = async (values: KitFormValues) => {
    setSubmitError(null);
    if (!user?.id) throw new Error('Connecte-toi pour créer un kit.');
    const selected = inventory.filter((item) => values.inventoryIds.includes(item.id));
    const total = totalWeight(selected, values.customItems);
    if (total <= 0) throw new Error('Ajoute au moins un objet avec un poids.');
    const coverUrl = resolveCoverUrl(values.cover);

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from('materiel_kits')
      .insert({
        user_id: user.id,
        name: values.name.trim(),
        description: values.description.trim() || null,
        season: values.season,
        total_weight_g: total,
        is_public: values.isPublic,
        cover_image_url: coverUrl,
      })
      .select('id')
      .single();
    if (insertError || !data) throw new Error(insertError?.message || 'Création du kit refusée.');

    const rows = [
      ...selected.map((item) => ({
        kit_id: data.id,
        user_id: user.id,
        product_ownership_id: item.id,
        name: item.name,
        category: item.category || 'Divers',
        weight_g: item.weightG ?? 0,
        quantity: 1,
        condition: item.condition || null,
        is_checked: true,
      })),
      ...values.customItems.map((item) => ({
        kit_id: data.id,
        user_id: user.id,
        name: item.name,
        category: item.category,
        weight_g: item.weightG,
        quantity: item.quantity,
        is_checked: true,
      })),
    ];
    if (rows.length > 0) {
      const { error: itemsError } = await supabase.from('materiel_kit_items').insert(rows);
      if (itemsError) throw new Error(itemsError.message || 'Les objets du kit n’ont pas pu être enregistrés.');
    }

    try {
      await insertCommunityPost({
        authorId: user.id,
        content: `**${values.name.trim()}**\n\n${values.description.trim() || 'Mon kit de matériel.'}\n\n/materiel`,
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
        const selectedIds = form.watch('inventoryIds');
        const customItems = form.watch('customItems');
        const template = form.watch('template');
        const selected = inventory.filter((item) => selectedIds.includes(item.id));
        const total = totalWeight(selected, customItems);
        const score = kitCompletionScore(selected, customItems, template as KitTemplateId);
        const suggestions = suggestKitCompletion(selected, customItems, template as KitTemplateId);
        const updateWeight = (nextIds: string[], nextCustom: CustomKitItem[]) => {
          const nextSelected = inventory.filter((item) => nextIds.includes(item.id));
          form.setValue('weightG', totalWeight(nextSelected, nextCustom), { shouldValidate: true });
        };
        const goNext = async () => {
          const fields = STEP_FIELDS[activeStep] ?? [];
          const valid = await form.trigger([...fields]);
          if (valid) setStep(activeStep + 1);
        };
        const onPrimary = () => {
          if (activeStep < LAST_STEP) { void goNext(); return; }
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
            <FormErrorSummary errors={errors} labels={CREATE_FIELD_LABELS} onFocusField={api.focusField} />

            <CreationInfoRail kind="kit" step={activeStep} steps={CREATE_STEPS.kit} values={previewValues} />
            <CreationSignature kind="kit" values={previewValues} />

            <StepPager
              steps={STEPS}
              index={activeStep}
              onIndexChange={setStep}
              actions={activeStep > 0 ? (
                <button type="button" className="lkdv-create-step-back" onClick={() => setStep(activeStep - 1)}>Retour</button>
              ) : null}
            >
              <div>
                <InventoryPicker
                  items={inventory}
                  selectedIds={selectedIds}
                  onChange={(ids) => {
                    form.setValue('inventoryIds', ids, { shouldValidate: true, shouldDirty: true });
                    updateWeight(ids, customItems);
                  }}
                  loading={inventoryLoading}
                  error={inventoryError}
                  onRetry={() => setInventoryRetry((value) => value + 1)}
                />
                <p className="lkdv-form-note">{total > 0 ? `${(total / 1000).toFixed(2)} kg sélectionnés` : 'Sélectionne les produits que tu emportes.'}</p>
              </div>

              <div>
                <KitPackingMatrix selected={selectedIds.length} custom={customItems.length} score={score} />
                <div className="lkdv-kit-completion">
                  <div className="lkdv-kit-score" aria-label={`Complétude ${score} %`}><b>{score}%</b><span aria-hidden="true"><i style={{ width: `${score}%` }} /></span></div>
                  <Select
                    aria-label="Modèle de kit"
                    value={template}
                    onChange={(event) => form.setValue('template', event.target.value as KitTemplateId, { shouldDirty: true })}
                  >
                    {KIT_TEMPLATES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </Select>
                </div>

                {suggestions.length > 0 ? (
                  <div className="lkdv-kit-suggestions">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion.category}
                        type="button"
                        className="lkdv-kit-suggestion"
                        onClick={() => {
                          const next: CustomKitItem = {
                            id: crypto.randomUUID(),
                            name: suggestion.suggestedName,
                            category: suggestion.category,
                            weightG: 0,
                            quantity: 1,
                          };
                          const nextItems = [...customItems, next];
                          form.setValue('customItems', nextItems, { shouldDirty: true, shouldValidate: true });
                          updateWeight(selectedIds, nextItems);
                        }}
                      >
                        + {suggestion.category}
                      </button>
                    ))}
                  </div>
                ) : null}

                <CustomItemEditor
                  onAdd={(item) => {
                    const next = [...customItems, item];
                    form.setValue('customItems', next, { shouldDirty: true, shouldValidate: true });
                    updateWeight(selectedIds, next);
                  }}
                />

                {customItems.length > 0 ? (
                  <ul className="lkdv-kit-custom-list">
                    {customItems.map((item) => (
                      <li key={item.id}>
                        <span><b>{item.name}</b><small>{item.category} · {item.weightG} g</small></span>
                        <button
                          type="button"
                          aria-label={`Retirer ${item.name}`}
                          onClick={() => {
                            const next = customItems.filter((value) => value.id !== item.id);
                            form.setValue('customItems', next, { shouldDirty: true, shouldValidate: true });
                            updateWeight(selectedIds, next);
                          }}
                        >×</button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <InlineError message={errors.customItems?.message as string | undefined} />
              </div>

              <div>
                <FormPreview kind="kit" values={previewValues} />
                <Field label="Nom" htmlFor="kit-name">
                  <TextInput id="kit-name" {...form.register('name')} maxLength={100} placeholder="Kit bivouac 3 saisons" />
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
                    <MediaPicker value={field.value} onChange={field.onChange} max={1} label="Photo de couverture" hint="Une image pour la carte du kit." upload={uploader} fieldName="cover" />
                  )}
                />
                <Field label="Description" htmlFor="kit-description">
                  <TextArea id="kit-description" {...form.register('description')} maxLength={1000} placeholder="Usage, terrain, particularités…" />
                  <InlineError message={errors.description?.message} />
                </Field>
                <Field label="Visibilité" htmlFor="kit-visibility">
                  <Select id="kit-visibility" value={form.watch('isPublic') ? 'public' : 'private'} onChange={(event) => form.setValue('isPublic', event.target.value === 'public', { shouldValidate: true, shouldDirty: true })}>
                    <option value="public">Public</option>
                    <option value="private">Privé</option>
                  </Select>
                  <InlineError message={errors.isPublic?.message} />
                </Field>
                <p className="lkdv-form-note">{total > 0 ? `${(total / 1000).toFixed(2)} kg · ${selected.length + customItems.length} objets` : 'Ajoute des objets à ton kit.'}</p>
                <Link className="lkdv-form-link" href="/hub" onClick={api.flushDraft}>Ouvrir l’éditeur complet</Link>
              </div>
            </StepPager>
          </CommunityFormDrawer>
        );
      }}
    </CreateFormEngine>
  );
}

function CustomItemEditor({ onAdd }: { onAdd: (item: CustomKitItem) => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Divers');
  const [weight, setWeight] = useState('0');
  return (
    <div className="lkdv-kit-custom-editor">
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Objet à ajouter" aria-label="Nom de l’objet" />
      <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Catégorie" aria-label="Catégorie de l’objet" />
      <input value={weight} onChange={(event) => setWeight(event.target.value)} inputMode="numeric" placeholder="g" aria-label="Poids de l’objet en grammes" />
      <button
        type="button"
        aria-label="Ajouter l’objet"
        disabled={!name.trim()}
        onClick={() => {
          onAdd({ id: crypto.randomUUID(), name: name.trim(), category: category.trim() || 'Divers', weightG: Math.max(0, Number(weight) || 0), quantity: 1 });
          setName('');
          setWeight('0');
        }}
      >+</button>
    </div>
  );
}

export default KitCreateForm;
