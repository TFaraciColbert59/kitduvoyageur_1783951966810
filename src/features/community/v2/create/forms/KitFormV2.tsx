'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Backpack,
  Check,
  Droplets,
  Flame,
  GripVertical,
  Lamp,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  Shirt,
  Sparkles,
  Tent,
  Trash2,
} from 'lucide-react';
import { useFormContext, useFormState } from 'react-hook-form';
import type { User } from '@supabase/supabase-js';
import { CreateFormEngineV2, type CreateFormEngineApiV2 } from '../engine/CreateFormEngineV2';
import {
  createDefaultsV2,
  kitSchemaV2,
  type KitFormValuesV2,
  type KitItemV2,
} from '../engine/createSchemasV2';
import { useCreateSheet } from '../CreateSheetContext';
import { createKitWithItemsV2 } from '../createRpc';
import { ChipsFieldV2 } from '../fields/ChipsV2';
import { TextAreaFieldV2, TextFieldV2 } from '../fields/FieldV2';
import { readError } from '../fields/FieldV2';
import { MediaFieldV2 } from '../fields/MediaFieldV2';
import { IMAGE_LIMITS, deleteMediaObjectsV2, uploadedObjectsOf } from '../fields/media';
import { ProductPickerSheetV2 } from '../kit/ProductPickerSheetV2';
import {
  KIT_GOALS_V2,
  KIT_LAYER_LABELS_V2,
  KIT_MODELS_V2,
  KIT_START_FROM_V2,
  kitGoalOfWeightV2,
  kitGoalV2,
  kitItemsWeightV2,
  kitLayersV2,
  kitModelItemsV2,
  kitProposedNameV2,
  kitSuggestionItemV2,
  kitSuggestionsV2,
  type KitModelV2,
  type KitStartFromV2,
} from '../kit/kitTemplatesV2';
import {
  loadCarnetKitItemsV2,
  loadKitItemsV2,
  loadMyCarnetsV2,
  loadMyKitsV2,
  type KitSourceOptionV2,
} from '../kit/kitSourcesV2';
import { mapInventoryItem } from '@/features/community/create/kit/catalog';
import type { InventoryItem } from '@/features/community/create/kit/kitCompletion';
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

/** Saisons de la maquette (`SEASONS`, HTML L3172) : **3** valeurs. */
const SEASON_OPTIONS = [
  { value: 'ete', label: 'Été' },
  // `toute_saison` est la valeur métier de « 3 saisons » (le schéma garde les
  // anciennes valeurs printemps/automne pour les brouillons existants).
  { value: 'toute_saison', label: '3 saisons' },
  { value: 'hiver', label: 'Hiver' },
] as const;

/**
 * Catégories toujours visibles, même vides, avec « Glisse un objet ici »
 * (maquette `CATS`, HTML L3166 et groupe vide L3191). Les autres catégories
 * n'apparaissent que si elles portent un objet.
 */
const BASE_CATEGORIES = ['Portage', 'Abri', 'Cuisine', 'Vêtements', 'Électronique', 'Sécurité'];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Portage: <Backpack size={13} aria-hidden="true" />,
  Abri: <Tent size={13} aria-hidden="true" />,
  Cuisine: <Flame size={13} aria-hidden="true" />,
  Eau: <Droplets size={13} aria-hidden="true" />,
  Vêtements: <Shirt size={13} aria-hidden="true" />,
  Électronique: <Lamp size={13} aria-hidden="true" />,
  Sécurité: <ShieldCheck size={13} aria-hidden="true" />,
};

const CATALOG_CATEGORIES = ['Portage', 'Abri', 'Cuisine', 'Vêtements', 'Électronique', 'Sécurité'];

function totalWeightG(items: readonly KitItemV2[]): number {
  return kitItemsWeightV2(items);
}

function displayKg(weightG: number): string {
  return `${(weightG / 1000).toFixed(1).replace('.', ',')} kg`;
}

function visibilityLabel(isPublic: boolean): string {
  return isPublic ? 'Public' : 'Privé';
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

/**
 * FID-025 — aperçu **persistant** des étapes 1 à 3 : la carte kit de la
 * maquette (`.kcard`, HTML L3217) — mosaïque des 4 premiers objets, nom,
 * « N objets · Public/Privé », pastille d'objectif et mini anneau de poids.
 * Implémentation locale (les jetons `--cv2-*` du tiroir) : la `KitCard` de
 * `/compte` est un carrousel 190 px à trois volets, dimensionné pour le
 * drawer Profil, pas pour un en-tête de formulaire.
 */
function KitPreviewV2({ values }: { values: KitFormValuesV2 }) {
  const items = values.items ?? [];
  const weight = totalWeightG(items);
  const goal = kitGoalV2(values.goal);
  // Maquette `.kcard` (L3217) : la pastille est la **classe de poids** atteinte
  // (`goalOf`), l'objectif sélectionné ne pilote que la cible des chips.
  const classGoal = kitGoalV2(kitGoalOfWeightV2(weight));
  const name = values.name.trim() || kitProposedNameV2({ model: values.model, season: values.season, items });
  const percent = Math.min(100, Math.round((weight / goal.maxG) * 100));
  return (
    <div className="lkdv-cv2c-kit-card" data-testid="cv2c-kit-preview" inert aria-hidden="true">
      <div className="lkdv-cv2c-kit-mosaic">
        {[0, 1, 2, 3].map((index) => {
          const item = items[index];
          return (
            <span key={index}>
              {item ? CATEGORY_ICONS[item.category] ?? <Backpack size={13} /> : null}
            </span>
          );
        })}
      </div>
      <div className="lkdv-cv2c-kit-card-body">
        <b>{name}</b>
        <small>
          {items.length} objet{items.length > 1 ? 's' : ''} · {visibilityLabel(values.isPublic)}
        </small>
        <span className="lkdv-cv2c-kit-badge">{classGoal.label}</span>
      </div>
      <span
        className="lkdv-cv2c-kit-mini-ring"
        role="img"
        aria-label={`Poids total ${displayKg(weight)}`}
        style={{ '--p': percent } as React.CSSProperties}
      />
    </div>
  );
}

/**
 * Anneau de poids **conique** (FID-025) et sac en couches. La maquette dessine
 * l'anneau en SVG (`ring()`, L3223) ; ici un `conic-gradient` sur les jetons du
 * tiroir donne le même repère, avec `--p` en pourcentage de l'objectif.
 */
function KitRingV2({ weightG, goal }: { weightG: number; goal: KitFormValuesV2['goal'] }) {
  const target = kitGoalV2(goal);
  const percent = Math.min(100, Math.round((weightG / target.maxG) * 100));
  // Libellé de la maquette (`ring()`, L3223) : la classe de poids atteinte.
  const classGoal = kitGoalV2(kitGoalOfWeightV2(weightG));
  return (
    <div
      className="lkdv-cv2c-kit-ring"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={target.maxG}
      aria-valuenow={weightG}
      aria-label={`Poids total ${displayKg(weightG)} · objectif ${target.label}`}
      style={{ '--p': percent } as React.CSSProperties}
    >
      <div className="lkdv-cv2c-kit-ring-core">
        <b>{displayKg(weightG)}</b>
        <small>{classGoal.label}</small>
      </div>
    </div>
  );
}

/** « Sac en couches » : porté / sac / consommable (FID-025). */
function KitLayersV2({ items }: { items: readonly KitItemV2[] }) {
  const layers = kitLayersV2(items);
  const total = Math.max(1, layers.porte + layers.sac + layers.conso);
  return (
    <div className="lkdv-cv2c-kit-layers" role="group" aria-label="Sac en couches">
      {(['porte', 'sac', 'conso'] as const).map((layer) => (
        <span key={layer} className="lkdv-cv2c-kit-layer" data-layer={layer}>
          <i
            aria-hidden="true"
            style={{ '--share': `${Math.round((layers[layer] / total) * 100)}%` } as React.CSSProperties}
          />
          <b>{KIT_LAYER_LABELS_V2[layer]}</b>
          <small>{displayKg(layers[layer])}</small>
        </span>
      ))}
    </div>
  );
}

/** Objectif sélectionnable (maquette `GOALS`, HTML L3172 / L3206). */
function GoalChipsV2() {
  const form = useFormContext<KitFormValuesV2>();
  const values = form.watch();
  const weight = totalWeightG(values.items ?? []);
  const target = kitGoalV2(values.goal);
  const over = weight - target.maxG;
  const { haptic } = useHapticFeedback();
  return (
    <div className="lkdv-cv2-field">
      <span className="lkdv-cv2-field-label" id="cv2c-kit-goal-label">
        Objectif de poids
      </span>
      <div className="lkdv-cv2-chips" role="radiogroup" aria-labelledby="cv2c-kit-goal-label">
        {KIT_GOALS_V2.map((goal) => (
          <button
            key={goal.id}
            type="button"
            role="radio"
            aria-checked={values.goal === goal.id}
            className="lkdv-cv2-chip lkdv-cv2-chip--lg"
            onClick={() => {
              form.setValue('goal', goal.id, { shouldDirty: true, shouldValidate: true });
              haptic('selection');
            }}
          >
            {goal.label}
            {goal.id !== 'std' ? ` < ${displayKg(goal.maxG)}` : ''}
          </button>
        ))}
      </div>
      <p className="lkdv-cv2-field-hint" data-state={over > 0 ? 'warn' : 'ok'}>
        {over > 0
          ? `${displayKg(over)} au-dessus de l’objectif.`
          : `Dans l’objectif : ${displayKg(-over)} de marge.`}
      </p>
    </div>
  );
}

/**
 * « Partir de » (FID-024) — 4 points de départ de la maquette (`FROM`, L3169) :
 * mon kit, carnet, **modèle** (journée / bivouac / alpinisme) et vide.
 * Le préremplissage remplace l'inventaire courant (comme `onSet` maquette).
 */
function StartFromV2({ user }: { user: User | null }) {
  const form = useFormContext<KitFormValuesV2>();
  const values = form.watch();
  const { haptic } = useHapticFeedback();
  const [choice, setChoice] = useState<KitStartFromV2 | null>(null);
  const [options, setOptions] = useState<KitSourceOptionV2[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setItems = (items: KitItemV2[]) => {
    form.setValue('items', items, { shouldDirty: true, shouldValidate: true });
  };

  const loadOptions = async (source: KitStartFromV2) => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    setOptions(null);
    const result =
      source === 'mine' ? await loadMyKitsV2(user.id) : source === 'carnet' ? await loadMyCarnetsV2(user.id) : null;
    setLoading(false);
    if (!result) return;
    setOptions(result.data);
    setError(result.error);
  };

  const pick = (source: KitStartFromV2) => {
    setChoice(source);
    setOptions(null);
    setError(null);
    haptic('selection');
    if (source === 'empty') {
      setItems([]);
      return;
    }
    if (source === 'mine' || source === 'carnet') void loadOptions(source);
    if (source === 'model') {
      // Le choix du modèle se fait juste dessous (3 chips) : rien à charger.
      setOptions([]);
    }
  };

  const prefillModel = (model: KitModelV2) => {
    form.setValue('model', model, { shouldDirty: true, shouldValidate: true });
    setItems(kitModelItemsV2(model));
    haptic('success');
  };

  const prefillSource = async (option: KitSourceOptionV2) => {
    if (!choice) return;
    setLoading(true);
    setError(null);
    const result =
      choice === 'mine' ? await loadKitItemsV2(option.id) : await loadCarnetKitItemsV2(option.id);
    setLoading(false);
    setError(result.error);
    if (result.data.length > 0 || !result.error) {
      setItems(result.data);
      haptic('success');
    }
  };

  return (
    <div className="lkdv-cv2-field" data-testid="cv2-field-kit-start">
      <span className="lkdv-cv2-field-label" id="cv2c-kit-from-label">
        Partir de
      </span>
      <div className="lkdv-cv2-chips" role="radiogroup" aria-labelledby="cv2c-kit-from-label">
        {KIT_START_FROM_V2.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="radio"
            aria-checked={choice === entry.id}
            className="lkdv-cv2-chip lkdv-cv2-chip--lg"
            onClick={() => pick(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      {choice === 'model' ? (
        <div className="lkdv-cv2-chips" role="radiogroup" aria-label="Modèle de kit">
          {KIT_MODELS_V2.map((model) => (
            <button
              key={model.id}
              type="button"
              role="radio"
              aria-checked={values.model === model.id}
              className="lkdv-cv2-chip lkdv-cv2-chip--lg"
              onClick={() => prefillModel(model.id)}
            >
              {model.label}
            </button>
          ))}
        </div>
      ) : null}
      {choice === 'mine' || choice === 'carnet' ? (
        <div className="lkdv-cv2c-kit-sources">
          {loading ? (
            <p className="lkdv-cv2-field-hint" role="status">
              <Loader2 size={12} className="lkdv-cv2c-spin" aria-hidden="true" /> Chargement…
            </p>
          ) : null}
          {error ? (
            <p className="lkdv-cv2-field-hint" role="status">
              {error}
            </p>
          ) : null}
          {!loading && !error && options && options.length === 0 ? (
            <p className="lkdv-cv2-field-hint">
              {choice === 'mine' ? 'Aucun kit enregistré.' : 'Aucun carnet à reprendre.'}
            </p>
          ) : null}
          {options?.map((option) => (
            <button
              key={option.id}
              type="button"
              className="lkdv-cv2c-kit-source"
              onClick={() => void prefillSource(option)}
            >
              <b>{option.name}</b>
              {option.meta ? <small>{option.meta}</small> : null}
            </button>
          ))}
        </div>
      ) : null}
      {choice === 'empty' ? (
        <p className="lkdv-cv2-field-hint">Inventaire vidé : ajoute les objets un par un.</p>
      ) : null}
      <p className="lkdv-cv2-field-hint">
        Le préremplissage remplace l’inventaire ; tout reste modifiable ensuite.
      </p>
    </div>
  );
}

function KitItemRowV2({
  item,
  onPatch,
  onRemove,
  onDrag,
}: {
  item: KitItemV2;
  onPatch: (patch: Partial<KitItemV2>) => void;
  onRemove: () => void;
  onDrag: () => void;
}) {
  return (
    <li className="lkdv-cv2c-kit-item" data-kit-item={item.id}>
      <button
        type="button"
        className="lkdv-cv2c-icon-btn"
        aria-label={`Déplacer ${item.name}`}
        onPointerDown={(event) => {
          event.preventDefault();
          onDrag();
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
            onPatch({ quantity: item.quantity - 1 });
          }}
        >
          <Minus size={12} aria-hidden="true" />
        </button>
        <output>{item.quantity}</output>
        <button
          type="button"
          aria-label={`Augmenter la quantité de ${item.name}`}
          onClick={() => onPatch({ quantity: Math.min(20, item.quantity + 1) })}
        >
          <Plus size={12} aria-hidden="true" />
        </button>
      </div>
      <small>{item.weightG ? `${formatWeightG(item.weightG)}` : '—'}</small>
      <button
        type="button"
        className="lkdv-cv2c-icon-btn"
        aria-label={`Marquer ${item.name} comme emporté`}
        aria-pressed={item.isChecked}
        onClick={() => onPatch({ isChecked: !item.isChecked })}
      >
        {item.isChecked ? <Check size={13} aria-hidden="true" /> : '□'}
      </button>
      <button
        type="button"
        className="lkdv-cv2c-icon-btn"
        aria-label={`Retirer ${item.name}`}
        onClick={onRemove}
      >
        <Trash2 size={13} aria-hidden="true" />
      </button>
    </li>
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
  const [customWeight, setCustomWeight] = useState(100);
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

  const addCustom = () => {
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
    setCustomWeight(100);
    haptic('selection');
  };

  return (
    <div className="lkdv-cv2c-kit" data-testid="cv2-field-items">
      {/* FID-024 : les 4 points de départ sont en **tête** d'inventaire. */}
      <StartFromV2 user={user} />
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
          const weight = groupItems.reduce((sum, item) => sum + item.weightG * item.quantity, 0);
          return (
            <section key={category} className="lkdv-cv2c-kit-group" data-kit-category={category}>
              <div className="lkdv-cv2c-kit-group-head">
                {CATEGORY_ICONS[category] ?? <Backpack size={13} aria-hidden="true" />}
                {category}
                <small>{displayKg(weight)}</small>
              </div>
              <ul className="lkdv-cv2c-kit-items">
                {groupItems.length === 0 ? (
                  <li className="lkdv-cv2c-kit-item-empty">Glisse un objet ici</li>
                ) : null}
                {groupItems.map((item) => (
                  <KitItemRowV2
                    key={item.id}
                    item={item}
                    onPatch={(patch) => patchItem(item.id, patch)}
                    onRemove={() => setItems(items.filter((entry) => entry.id !== item.id))}
                    onDrag={() => {
                      dragRef.current = item.id;
                      haptic('medium');
                    }}
                  />
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
          {/* Maquette (L3199) : libellé, **chips de catégorie** et stepper de
              poids — plus de select ni de champ numérique nus (FID-053). */}
          <div className="lkdv-cv2-field">
            <label className="lkdv-cv2-field-label" htmlFor="cv2c-kit-custom-name">
              Objet à ajouter
            </label>
            <input
              id="cv2c-kit-custom-name"
              type="text"
              className="lkdv-cv2-input"
              value={customName}
              maxLength={100}
              placeholder="Chaussettes de rechange"
              onChange={(event) => setCustomName(event.target.value)}
            />
          </div>
          <div className="lkdv-cv2-field">
            <span className="lkdv-cv2-field-label" id="cv2c-kit-custom-cat">
              Catégorie
            </span>
            <div className="lkdv-cv2-chips" role="radiogroup" aria-labelledby="cv2c-kit-custom-cat">
              {CATALOG_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  role="radio"
                  aria-checked={customCategory === category}
                  className="lkdv-cv2-chip lkdv-cv2-chip--lg"
                  onClick={() => setCustomCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
          <div className="lkdv-cv2c-stepper-row">
            <div className="lkdv-cv2-stepper">
              <button
                type="button"
                aria-label="Diminuer le poids"
                onClick={() => setCustomWeight((weight) => Math.max(0, weight - 50))}
                disabled={customWeight <= 0}
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <output aria-live="polite">
                {customWeight}
                <span className="lkdv-cv2c-unit">g</span>
              </output>
              <button
                type="button"
                aria-label="Augmenter le poids"
                onClick={() => setCustomWeight((weight) => Math.min(5000, weight + 50))}
                disabled={customWeight >= 5000}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
            <span className="lkdv-cv2-field-hint">Poids en grammes.</span>
          </div>
          <button type="button" className="lkdv-cv2-add-media" onClick={addCustom}>
            <Plus size={14} aria-hidden="true" /> Ajouter l’objet
          </button>
          <p className="lkdv-cv2-field-hint">
            Catégorie au choix · glisse les objets pour les reclasser.
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
  const items = useMemo(() => values.items ?? [], [values.items]);
  const { haptic } = useHapticFeedback();
  const suggestions = useMemo(
    () => kitSuggestionsV2(values.model, values.season, items),
    [items, values.model, values.season],
  );

  const addSuggestion = (name: string, category: string, weightG: number) => {
    form.setValue('items', [...items, kitSuggestionItemV2({ name, category, weightG })], {
      shouldDirty: true,
      shouldValidate: true,
    });
    haptic('success');
  };

  return (
    <>
      <div className="lkdv-cv2c-kit-weight-panel">
        <KitRingV2 weightG={totalWeightG(items)} goal={values.goal} />
        <div className="lkdv-cv2c-kit-weight-side">
          <KitLayersV2 items={items} />
          <small>
            {items.length} objet{items.length > 1 ? 's' : ''} · {displayKg(totalWeightG(items))}
          </small>
        </div>
      </div>
      <GoalChipsV2 />
      <ChipsFieldV2
        name="model"
        label="Modèle"
        options={KIT_MODELS_V2.map((model) => ({ value: model.id, label: model.label }))}
      />
      <ChipsFieldV2
        name="season"
        label="Saison"
        options={SEASON_OPTIONS.map((season) => ({ ...season }))}
      />
      {/* Suggestions actionnables (FID-023) : chaque ligne porte son bouton
          « Ajouter » 44 px, l'ajout est immédiat et le poids recalculé ; une
          suggestion déjà dans le sac laisse un état « ajouté » coché/désactivé
          (maquette `.sgrow`, HTML L3202-3204). */}
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">
          <Sparkles size={11} aria-hidden="true" /> Suggestions ·{' '}
          {KIT_MODELS_V2.find((model) => model.id === values.model)?.label ?? 'Bivouac'} ·{' '}
          {SEASON_OPTIONS.find((season) => season.value === values.season)?.label ?? '3 saisons'}
        </span>
        <ul className="lkdv-cv2c-kit-suggestions" role="list">
          {suggestions.map((suggestion) => (
            <li key={suggestion.name} className="lkdv-cv2c-kit-suggestion" data-added={suggestion.added || undefined}>
              {CATEGORY_ICONS[suggestion.category] ?? <Backpack size={13} aria-hidden="true" />}
              <span>
                <b>{suggestion.name}</b>
                <small>{displayKg(suggestion.weightG)}</small>
              </span>
              {/* FID-023 : après ajout, la ligne reste et le bouton passe à
                  l'état « ajouté » coché/désactivé (pas de doublon possible). */}
              <button
                type="button"
                className="lkdv-cv2-chip lkdv-cv2-chip--lg lkdv-cv2c-kit-add"
                aria-pressed={suggestion.added}
                disabled={suggestion.added}
                onClick={() => {
                  if (suggestion.added) return;
                  addSuggestion(suggestion.name, suggestion.category, suggestion.weightG);
                }}
              >
                {suggestion.added ? (
                  <>
                    <Check size={12} aria-hidden="true" /> Ajouté
                  </>
                ) : (
                  <>
                    <Plus size={12} aria-hidden="true" /> Ajouter
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
        {items.length > 0 ? (
          <p className="lkdv-cv2-field-hint" role="status">
            <Check size={11} aria-hidden="true" /> {items.length} objet{items.length > 1 ? 's' : ''} déjà dans
            le sac · {displayKg(totalWeightG(items))}
          </p>
        ) : null}
      </div>
      <MediaFieldV2
        name="cover"
        label="Photo de couverture (optionnel)"
        userId={user?.id ?? ''}
        limits={IMAGE_LIMITS}
        max={1}
        showAlt={false}
        addLabel="Ajouter une photo"
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
  const proposed = kitProposedNameV2({ model: values.model, season: values.season, items });
  const isAuto = !values.name.trim() || values.name.trim() === proposed;
  const { haptic } = useHapticFeedback();

  // Le nom proposé remplit le champ tant que l'utilisateur ne l'a pas modifié.
  useEffect(() => {
    if (isAuto && items.length > 0 && form.getValues('name') !== proposed) {
      form.setValue('name', proposed, { shouldDirty: true });
    }
  }, [form, isAuto, items.length, proposed]);

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
            {visibilityLabel(values.isPublic)}
          </small>
          <small>{kitGoalV2(kitGoalOfWeightV2(weight)).label}</small>
        </div>
      </div>
      <TextFieldV2
        name="name"
        label="Nom du kit"
        placeholder="Kit bivouac 3 saisons"
        required
        maxLength={100}
        hint={
          isAuto
            ? 'Nom proposé automatiquement, modifiable.'
            : 'Nom personnalisé.'
        }
      />
      {!isAuto ? (
        <button
          type="button"
          className="lkdv-cv2c-linkbtn"
          onClick={() => {
            form.setValue('name', proposed, { shouldDirty: true, shouldValidate: true });
            haptic('selection');
          }}
        >
          Revenir au nom proposé
        </button>
      ) : null}
      {/* FID-053 : la description passe en étape 3 (maquette L3208). */}
      <TextAreaFieldV2
        name="description"
        label="Description"
        placeholder="Usage, terrain, particularités…"
        maxLength={1000}
        rows={3}
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
  const values = api.form.watch();
  return (
    <>
      {/* FID-025 : la carte kit reste en tête des étapes 1 à 3. */}
      {api.active ? <KitPreviewV2 values={values} /> : null}
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
 * FID-023/024/025/053 : 4 points de départ (mon kit, carnet, modèle, vide),
 * aperçu KitCard persistant, anneau de poids conique, sac en couches
 * (porté/sac/consommable), objectif sélectionnable (4,5 / 7,5 kg / standard),
 * suggestions actionnables, 3 saisons, description en étape 3, nom proposé
 * avec retour. Le sélecteur de produit reste un sous-tiroir empilé ; l'envoi
 * est toujours `create_kit_with_items` (poids calculé en SQL).
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
