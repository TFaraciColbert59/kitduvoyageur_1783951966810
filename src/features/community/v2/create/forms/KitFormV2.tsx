'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Backpack, GripVertical, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useFormContext, useFormState } from 'react-hook-form';
import type { User } from '@supabase/supabase-js';
import { CreateFormEngineV2, type CreateFormEngineApiV2 } from '../engine/CreateFormEngineV2';
import { createDefaultsV2, kitSchemaV2, type KitFormValuesV2, type KitItemV2 } from '../engine/createSchemasV2';
import { useCreateSheet } from '../CreateSheetContext';
import { createKitWithItemsV2 } from '../createRpc';
import { ChipsFieldV2 } from '../fields/ChipsV2';
import { TextAreaFieldV2, TextFieldV2 } from '../fields/FieldV2';
import { readError } from '../fields/FieldV2';
import { MediaFieldV2 } from '../fields/MediaFieldV2';
import { IMAGE_LIMITS, deleteMediaObjectsV2, uploadedObjectsOf } from '../fields/media';
import { ProductPickerSheetV2 } from '../kit/ProductPickerSheetV2';
import { mapInventoryItem } from '@/features/community/create/kit/catalog';
import {
  kitCompletionScore,
  suggestKitCompletion,
  type CustomKitItem,
  type InventoryItem,
  type KitTemplateId,
} from '@/features/community/create/kit/kitCompletion';
import type { PickerProduct } from '@/features/community/create/kit/types';
import { createClient } from '@/lib/supabase/client';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { formatWeightG } from '../../shared/format';
import type { CreateFormV2Props } from './types';

const CATEGORY_ORDER = [
  'Portage',
  'Abri',
  'Sommeil',
  'Cuisine',
  'Eau',
  'Nutrition',
  'Vêtements',
  'Électronique',
  'Sécurité',
  'Navigation',
  'Hygiène',
  'Réparation',
  'Divers',
];

const SEASON_OPTIONS = [
  { value: 'toute_saison', label: 'Toute saison' },
  { value: 'printemps', label: 'Printemps' },
  { value: 'ete', label: 'Été' },
  { value: 'automne', label: 'Automne' },
  { value: 'hiver', label: 'Hiver' },
] as const;

/** Objectifs de la maquette (`GOALS`, HTML L3172) : 4,5 kg / 7,5 kg / standard. */
const WEIGHT_TARGETS = [
  { id: 'ultra', label: 'Ultraléger', maxG: 4500 },
  { id: 'leger', label: 'Léger', maxG: 7500 },
  { id: 'standard', label: 'Standard', maxG: 20_000 },
] as const;

/**
 * Catégories toujours visibles, même vides, avec « Glisse un objet ici »
 * (maquette `CATS`, HTML L3166 et groupe vide L3191). Les autres catégories
 * n'apparaissent que si elles portent un objet.
 */
const BASE_CATEGORIES = ['Portage', 'Abri', 'Cuisine', 'Vêtements', 'Électronique', 'Sécurité'];

function totalWeightG(items: readonly KitItemV2[]): number {
  return items.reduce((total, item) => total + (item.weightG || 0) * (item.quantity || 1), 0);
}

function weightTarget(weightG: number): (typeof WEIGHT_TARGETS)[number] {
  return WEIGHT_TARGETS.find((target) => weightG <= target.maxG) ?? WEIGHT_TARGETS[WEIGHT_TARGETS.length - 1];
}

function displayKg(weightG: number): string {
  return `${(weightG / 1000).toFixed(1).replace('.', ',')} kg`;
}

function useInventory(user: User | null) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      setError('Inventaire indisponible pour le moment.');
      setLoading(false);
      return;
    }
    void supabase
      .from('product_ownership')
      .select('id, name, photo_url, condition, category, weight_g')
      .eq('user_id', user.id)
      .order('name', { ascending: true })
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError.message);
        } else {
          setInventory(
            (data ?? []).map((row) => {
              const record = row as Record<string, unknown>;
              return {
                id: String(record.id ?? ''),
                name: String(record.name ?? 'Objet'),
                photoUrl: typeof record.photo_url === 'string' ? record.photo_url : null,
                condition: typeof record.condition === 'string' ? record.condition : null,
                category: typeof record.category === 'string' ? record.category : null,
                weightG: typeof record.weight_g === 'number' ? record.weight_g : null,
              };
            }),
          );
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retry, user?.id]);

  return { inventory, loading, error, retry: () => setRetry((value) => value + 1) };
}

function WeightBar({ items }: { items: readonly KitItemV2[] }) {
  const weight = totalWeightG(items);
  const target = weightTarget(weight);
  const percent = Math.min(100, Math.round((weight / target.maxG) * 100));
  return (
    <div className="lkdv-cv2c-weight">
      <span className="lkdv-cv2c-weight-main">
        <b>{displayKg(weight)}</b>
        <small>Poids total</small>
      </span>
      <span className="lkdv-cv2-gauge" data-state={target.id === 'standard' ? 'full' : undefined}>
        <span className="lkdv-cv2-gauge-track" role="progressbar" aria-valuemin={0} aria-valuemax={target.maxG} aria-valuenow={weight} aria-label={`Objectif ${target.label}`}>
          <span className="lkdv-cv2-gauge-fill" style={{ width: `${percent}%` }} />
        </span>
        <span className="lkdv-cv2-field-hint">
          Objectif {target.label} · {displayKg(target.maxG)}
        </span>
      </span>
    </div>
  );
}

function InventoryStep({
  user,
  inventory,
  inventoryLoading,
  inventoryError,
  onRetry,
}: {
  user: User | null;
  inventory: InventoryItem[];
  inventoryLoading: boolean;
  inventoryError: string | null;
  onRetry: () => void;
}) {
  const form = useFormContext<KitFormValuesV2>();
  const { errors: kitErrors } = useFormState<KitFormValuesV2>({ control: form.control });
  const itemsError = readError(kitErrors, 'items');
  const values = form.watch();
  const watchedItems = values.items;
  const items = useMemo(() => watchedItems ?? [], [watchedItems]);
  const { openDetail, closeDetail } = useCreateSheet();
  const { haptic } = useHapticFeedback();
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('Divers');
  const [customWeight, setCustomWeight] = useState(0);
  const dragRef = useRef<string | null>(null);

  const products = useMemo(() => inventory.map((item) => mapInventoryItem(item)), [inventory]);

  const setItems = (next: KitItemV2[]) => {
    form.setValue('items', next, { shouldDirty: true, shouldValidate: true });
  };

  const addProduct = (product: PickerProduct) => {
    const existing = items.find((item) => item.ownershipId && item.ownershipId === product.ownershipId);
    if (existing) {
      setItems(items.map((item) => (item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item)));
    } else {
      setItems([
        ...items,
        {
          id: crypto.randomUUID(),
          name: product.name,
          category: product.category?.trim() || 'Divers',
          weightG: product.weightG ?? 0,
          quantity: 1,
          productId: product.productId,
          ownershipId: product.ownershipId,
          isChecked: false,
        },
      ]);
    }
    haptic('selection');
  };

  const openPicker = () => {
    openDetail({
      title: 'Choisir un produit',
      // Sous-titre de la maquette (`.sheet-nav .sub`, HTML L3239).
      meta: `${items.length} dans le sac`,
      node: (
        <ProductPickerSheetV2
          inventory={products}
          inventoryLoading={inventoryLoading}
          inventoryError={inventoryError}
          onRetryInventory={onRetry}
          onPick={(product) => {
            addProduct(product);
            closeDetail();
          }}
        />
      ),
    });
  };

  const patchItem = (id: string, patch: Partial<KitItemV2>) => {
    setItems(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const groups = useMemo(() => {
    const byCategory = new Map<string, KitItemV2[]>();
    for (const item of items) {
      const category = CATEGORY_ORDER.includes(item.category) ? item.category : 'Divers';
      const list = byCategory.get(category) ?? [];
      list.push(item);
      byCategory.set(category, list);
    }
    // Les 6 catégories de la maquette restent affichées même vides (T10).
    for (const category of BASE_CATEGORIES) {
      if (!byCategory.has(category)) byCategory.set(category, []);
    }
    return [...byCategory.entries()].sort(
      (left, right) => CATEGORY_ORDER.indexOf(left[0]) - CATEGORY_ORDER.indexOf(right[0]),
    );
  }, [items]);

  const total = totalWeightG(items);

  // Glisser un objet vers une catégorie (ou sur un autre objet).
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragRef.current) return;
      const targets = document.elementsFromPoint(event.clientX, event.clientY);
      const group = targets
        .map((element) => element.closest<HTMLElement>('[data-kit-category]'))
        .find(Boolean);
      const row = targets.map((element) => element.closest<HTMLElement>('[data-kit-item]')).find(Boolean);
      const current = form.getValues('items') ?? [];
      const moving = current.find((item) => item.id === dragRef.current);
      if (!moving) return;
      if (group?.dataset.kitCategory && group.dataset.kitCategory !== moving.category) {
        form.setValue(
          'items',
          current.map((item) =>
            item.id === moving.id ? { ...item, category: group.dataset.kitCategory ?? item.category } : item,
          ),
          { shouldDirty: true, shouldValidate: true },
        );
        haptic('selection');
      } else if (row?.dataset.kitItem && row.dataset.kitItem !== moving.id) {
        const targetIndex = current.findIndex((item) => item.id === row.dataset.kitItem);
        const fromIndex = current.findIndex((item) => item.id === moving.id);
        if (targetIndex >= 0 && fromIndex >= 0 && targetIndex !== fromIndex) {
          const next = [...current];
          next.splice(fromIndex, 1);
          next.splice(targetIndex, 0, moving);
          form.setValue('items', next, { shouldDirty: true, shouldValidate: true });
        }
      }
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [form, haptic]);

  return (
    <div className="lkdv-cv2c-kit" data-testid="cv2-field-items">
      <WeightBar items={items} />
      {/* Libellé + compteur de la maquette (HTML L3191) : « 0 objet · 0,0 kg ». */}
      <div className="lkdv-cv2c-field-head">
        <span className="lkdv-cv2-field-label">
          Inventaire <span aria-hidden="true">*</span>
        </span>
        <span className="lkdv-cv2-counter">
          {items.length} objet{items.length > 1 ? 's' : ''} · {displayKg(total)}
        </span>
      </div>
      {itemsError ? (
        <p className="lkdv-cv2-field-error" role="alert">
          {itemsError}
        </p>
      ) : null}
      {/* Les catégories restent visibles même vides (maquette) : plus d'écran
          « inventaire vide » à la place de la liste. */}
      <div className="lkdv-cv2c-kit-groups" data-hscroll>
          {groups.map(([category, groupItems]) => {
            const weight = groupItems.reduce((total, item) => total + item.weightG * item.quantity, 0);
            return (
              <section key={category} className="lkdv-cv2c-kit-group" data-kit-category={category}>
                <div className="lkdv-cv2c-kit-group-head">
                  <Backpack size={13} aria-hidden="true" />
                  {category}
                  <small>{displayKg(weight)}</small>
                </div>
                <ul className="lkdv-cv2c-kit-items">
                  {groupItems.length === 0 ? (
                    <li className="lkdv-cv2c-kit-item-empty">Glisse un objet ici</li>
                  ) : null}
                  {groupItems.map((item) => (
                    <li key={item.id} className="lkdv-cv2c-kit-item" data-kit-item={item.id}>
                      <button
                        type="button"
                        className="lkdv-cv2c-icon-btn"
                        aria-label={`Déplacer ${item.name}`}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          dragRef.current = item.id;
                          haptic('medium');
                        }}
                      >
                        <GripVertical size={12} aria-hidden="true" />
                      </button>
                      <span className="lkdv-cv2c-kit-item-name">{item.name}</span>
                      <div className="lkdv-cv2-stepper">
                        <button
                          type="button"
                          aria-label={`Diminuer la quantité de ${item.name}`}
                          onClick={() => {
                            if (item.quantity <= 1) return;
                            patchItem(item.id, { quantity: item.quantity - 1 });
                          }}
                        >
                          −
                        </button>
                        <output>{item.quantity}</output>
                        <button
                          type="button"
                          aria-label={`Augmenter la quantité de ${item.name}`}
                          onClick={() => patchItem(item.id, { quantity: Math.min(20, item.quantity + 1) })}
                        >
                          +
                        </button>
                      </div>
                      <small>{item.weightG ? `${formatWeightG(item.weightG)}` : '—'}</small>
                      <button
                        type="button"
                        className="lkdv-cv2c-icon-btn"
                        aria-label={`Marquer ${item.name} comme emporté`}
                        aria-pressed={item.isChecked}
                        onClick={() => patchItem(item.id, { isChecked: !item.isChecked })}
                      >
                        {item.isChecked ? '✓' : '□'}
                      </button>
                      <button
                        type="button"
                        className="lkdv-cv2c-icon-btn"
                        aria-label={`Retirer ${item.name}`}
                        onClick={() => setItems(items.filter((entry) => entry.id !== item.id))}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
      </div>
      {/* CTA sous la liste, comme la maquette (`row3`, HTML L3192-L3193). */}
      <div className="lkdv-cv2c-inline-add">
        <button type="button" className="lkdv-cv2-add-media" onClick={openPicker}>
          <Backpack size={15} aria-hidden="true" /> Ajouter un produit
        </button>
        <button
          type="button"
          className="lkdv-cv2-chip lkdv-cv2-chip--lg"
          onClick={() => setCustomOpen((open) => !open)}
          aria-expanded={customOpen}
        >
          <Plus size={13} aria-hidden="true" /> Objet personnalisé
        </button>
      </div>
      {customOpen ? (
        <div className="lkdv-cv2c-media-edit">
          <div className="lkdv-cv2c-kit-object-row">
            <input
              type="text"
              className="lkdv-cv2-input"
              value={customName}
              maxLength={100}
              placeholder="Nom de l’objet"
              aria-label="Nom de l’objet personnalisé"
              onChange={(event) => setCustomName(event.target.value)}
            />
            <input
              type="number"
              inputMode="numeric"
              className="lkdv-cv2-input"
              value={customWeight}
              min={0}
              step={10}
              aria-label="Poids de l’objet en grammes"
              onChange={(event) => setCustomWeight(Number(event.target.value) || 0)}
            />
            <select
              className="lkdv-cv2-input"
              value={customCategory}
              aria-label="Catégorie de l’objet"
              onChange={(event) => setCustomCategory(event.target.value)}
            >
              {CATEGORY_ORDER.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="lkdv-cv2c-icon-btn"
              aria-label="Ajouter l’objet personnalisé"
              onClick={() => {
                const name = customName.trim();
                if (!name) return;
                setItems([
                  ...items,
                  {
                    id: crypto.randomUUID(),
                    name,
                    category: customCategory,
                    weightG: Math.max(0, customWeight),
                    quantity: 1,
                    productId: null,
                    ownershipId: null,
                    isChecked: false,
                  },
                ]);
                setCustomName('');
                setCustomWeight(0);
                haptic('selection');
              }}
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </div>
          <p className="lkdv-cv2-field-hint">
            Poids en grammes · catégorie au choix · glisse les objets pour les reclasser.
          </p>
        </div>
      ) : null}

      {user ? null : <p className="lkdv-cv2c-warning">Connecte-toi pour créer un kit.</p>}
    </div>
  );
}

function ComplementsStep({ user }: { user: User | null }) {
  const form = useFormContext<KitFormValuesV2>();
  const values = form.watch();
  const items = values.items ?? [];
  const custom: CustomKitItem[] = items
    .filter((item) => !item.ownershipId)
    .map((item) => ({ id: item.id, name: item.name, category: item.category, weightG: item.weightG, quantity: item.quantity }));
  const template: KitTemplateId = 'bivouac';
  const score = kitCompletionScore([], custom, template);
  const suggestions = suggestKitCompletion([], custom, template).slice(0, 4);
  return (
    <>
      <div className="lkdv-cv2-card lkdv-cv2c-recap">
        <span className="lkdv-cv2-eyebrow">Complétude</span>
        <b>{score} %</b>
        <small>Catégories couvertes pour un bivouac</small>
      </div>
      {suggestions.length > 0 ? (
        <div className="lkdv-cv2-field">
          <span className="lkdv-cv2-field-label">Suggestions pour compléter</span>
          <ul className="lkdv-cv2c-empty" role="list">
            {suggestions.map((suggestion) => (
              <li key={suggestion.category}>
                <b>{suggestion.category}</b> — {suggestion.suggestedName}
              </li>
            ))}
          </ul>
          <p className="lkdv-cv2-field-hint">
            <Sparkles size={11} aria-hidden="true" /> Ajoute-les à l’étape Inventaire si besoin.
          </p>
        </div>
      ) : null}
      <ChipsFieldV2 name="season" label="Saison" options={SEASON_OPTIONS.map((season) => ({ ...season }))} />
      <MediaFieldV2
        name="cover"
        label="Photo de couverture (optionnel)"
        userId={user?.id ?? ''}
        limits={IMAGE_LIMITS}
        max={1}
        showAlt={false}
        addLabel="Ajouter une photo"
      />
      <TextAreaFieldV2
        name="description"
        label="Description"
        placeholder="Usage, terrain, particularités…"
        maxLength={1000}
        rows={4}
      />
    </>
  );
}

function PartageStep() {
  const form = useFormContext<KitFormValuesV2>();
  const values = form.watch();
  const items = values.items ?? [];
  const weight = totalWeightG(items);
  const cover = values.cover?.[0];

  useEffect(() => {
    if (values.name.trim() || weight <= 0) return;
    const seasonLabel =
      SEASON_OPTIONS.find((season) => season.value === values.season)?.label?.toLowerCase() ?? 'toute saison';
    form.setValue('name', `Kit ${seasonLabel} · ${displayKg(weight)}`, { shouldDirty: true });
  }, [form, values.name, values.season, weight]);

  return (
    <>
      <div className="lkdv-cv2-card lkdv-cv2c-crest-row" inert aria-hidden="true">
        {cover?.url || cover?.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- aperçu local ou URL Storage
          <img src={cover.previewUrl || cover.url} alt="" className="lkdv-cv2c-kit-cover" />
        ) : (
          <Backpack size={28} aria-hidden="true" />
        )}
        <div>
          <b>{values.name || 'Kit sans nom'}</b>
          <small>
            {displayKg(weight)} · {items.length} objet{items.length > 1 ? 's' : ''} ·{' '}
            {values.isPublic ? 'Public' : 'Privé'}
          </small>
          <small>{values.season === 'toute_saison' ? 'Toute saison' : values.season}</small>
        </div>
      </div>
      <TextFieldV2
        name="name"
        label="Nom du kit"
        placeholder="Kit bivouac été"
        required
        maxLength={100}
      />
      <div className="lkdv-cv2c-crop-row">
        <span className="lkdv-cv2-field-label">Visibilité</span>
        <div className="lkdv-cv2-seg lkdv-cv2c-seg" role="group" aria-label="Visibilité du kit">
          <button
            type="button"
            aria-pressed={values.isPublic}
            onClick={() => form.setValue('isPublic', true, { shouldDirty: true, shouldValidate: true })}
          >
            Public
          </button>
          <button
            type="button"
            aria-pressed={!values.isPublic}
            onClick={() => form.setValue('isPublic', false, { shouldDirty: true, shouldValidate: true })}
          >
            Privé
          </button>
        </div>
      </div>
      <p className="lkdv-cv2-field-hint">
        Le poids total est calculé par le serveur à partir des objets et de leurs quantités.
      </p>
    </>
  );
}

function KitBody({
  api,
  user,
  inventory,
  inventoryLoading,
  inventoryError,
  onRetry,
}: {
  api: CreateFormEngineApiV2<KitFormValuesV2>;
  user: User | null;
  inventory: InventoryItem[];
  inventoryLoading: boolean;
  inventoryError: string | null;
  onRetry: () => void;
}) {
  return (
    <>
      {api.step === 0 ? (
        <InventoryStep
          user={user}
          inventory={inventory}
          inventoryLoading={inventoryLoading}
          inventoryError={inventoryError}
          onRetry={onRetry}
        />
      ) : null}
      {api.step === 1 ? <ComplementsStep user={user} /> : null}
      {api.step === 2 ? <PartageStep /> : null}
    </>
  );
}

/**
 * Kit V2 (`Kit#1-20`) : Inventaire → Compléter → Partager.
 *
 * Sélecteur de produit en **sous-tiroir empilé** (`detail` de la coque) avec
 * recherche, catégories, inventaire et panier existant ; quantités, poids en
 * direct + objectif ultraléger / léger / standard ; glisser un objet d'une
 * catégorie à l'autre ; objets personnalisés ; couverture ; nom proposé ;
 * visibilité Public/Privé ; aperçu type `KitCard` ; envoi
 * `create_kit_with_items` (poids total calculé en SQL).
 */
export function KitFormV2({ active, onNavChange, stepHosts }: CreateFormV2Props) {
  const { user, reportCreated } = useCreateSheet();
  const defaults = useRef(createDefaultsV2('kit')).current;
  const { inventory, loading, error, retry } = useInventory(user);

  return (
    <CreateFormEngineV2<KitFormValuesV2>
      kind="kit"
      schema={kitSchemaV2}
      defaultValues={defaults}
      active={active}
      disabled={!user}
      onNavChange={onNavChange}
      stepHosts={stepHosts}
      onSubmit={async (values) => {
        try {
          const result = await createKitWithItemsV2(values);
          reportCreated('kit', { id: result.id, name: values.name.trim() });
        } catch (submitError) {
          await deleteMediaObjectsV2(uploadedObjectsOf(values.cover));
          throw submitError;
        }
      }}
    >
      {(api) => (
        <KitBody
          api={api}
          user={user}
          inventory={inventory}
          inventoryLoading={loading}
          inventoryError={error}
          onRetry={retry}
        />
      )}
    </CreateFormEngineV2>
  );
}

export default KitFormV2;
