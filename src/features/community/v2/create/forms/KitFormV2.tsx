'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Backpack,
  Bookmark,
  Check,
  CloudSun,
  Droplets,
  Flame,
  GripVertical,
  Lamp,
  Loader2,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Sparkles,
  Tent,
  Trash2,
} from 'lucide-react';
import { useFormContext, useFormState } from 'react-hook-form';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
import { SelectDropdownV2 } from '../fields/SelectDropdownV2';
import { VisibilityPickerV2 } from '../fields/VisibilityPickerV2';
import { useMyClubsV2 } from '../club/useMyClubsV2';
import { CollapsibleHeroPreview, useScrollCollapsePreview } from '../photo/CollapsibleHeroPreview';
import { KitCatalogDrawerV2 } from '../kit/KitCatalogDrawerV2';
import { KitFavoritesDrawerV2 } from '../kit/KitFavoritesDrawerV2';
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
import { SheetPreview } from '../../shared/SheetPreview';
import { getCurrentGeoPosition } from '@/lib/native/geolocation';
import {
  fetchKitWeatherV2,
  formatKitItemWeightV2,
  formatKitWeightV2,
  isItemBorrowedV2,
  kitWeatherSuggestionsV2,
  loadBorrowedLoansV2,
  mergeKitSuggestionsV2,
  readStoredUnitsV2,
  type BorrowedLoansV2,
  type KitUnitsV2,
  type KitWeatherV2,
} from '../kit/kitContextV2';
import type { CreateFormV2Props } from './types';

import {
  KIT_CHART_COLORS as CHART_COLORS,
  KitRectangularPreviewV2,
  KitUnitsContext,
  useKitWeight,
} from './KitRectangularPreviewV2';
export { KitRectangularPreviewV2 };

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

/** Les 4 saisons sélectionnables (multi-sélection). */
const SEASON_OPTIONS = [
  { value: 'printemps', label: 'Printemps' },
  { value: 'ete', label: 'Été' },
  { value: 'automne', label: 'Automne' },
  { value: 'hiver', label: 'Hiver' },
] as const;

function formatSeasonsSummary(seasons: readonly string[] | undefined, fallbackSeason: string): string {
  const active = seasons && seasons.length > 0 ? seasons : [];
  if (active.length === 4) return '4 saisons';
  if (active.length > 0) {
    const labels = active
      .map((s) => SEASON_OPTIONS.find((opt) => opt.value === s)?.label)
      .filter((label) => label !== undefined);
    if (labels.length > 0) return labels.join(' · ');
  }
  return SEASON_OPTIONS.find((opt) => opt.value === fallbackSeason)?.label ?? 'Toute saison';
}

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
  const { kg } = useKitWeight();
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
        aria-label={`Poids total ${kg(weight)}`}
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
  const { kg } = useKitWeight();
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
      aria-label={`Poids total ${kg(weightG)} · objectif ${target.label}`}
      style={{ '--p': percent } as React.CSSProperties}
    >
      <div className="lkdv-cv2c-kit-ring-core">
        <b>{kg(weightG)}</b>
        <small>{classGoal.label}</small>
      </div>
    </div>
  );
}

/** « Sac en couches » : porté / sac / consommable (FID-025). */
function KitLayersV2({ items }: { items: readonly KitItemV2[] }) {
  const { kg } = useKitWeight();
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
          <small>{kg(layers[layer])}</small>
        </span>
      ))}
    </div>
  );
}

/** Objectif sélectionnable (maquette `GOALS`, HTML L3172 / L3206). */
function GoalChipsV2() {
  const { kg } = useKitWeight();
  const form = useFormContext<KitFormValuesV2>();
  const values = form.watch();
  const weight = totalWeightG(values.items ?? []);
  const target = kitGoalV2(values.goal);
  const over = weight - target.maxG;
  return (
    <SelectDropdownV2
      name="goal"
      label="Objectif de poids"
      options={KIT_GOALS_V2.map((goal) => ({
        value: goal.id,
        label: `${goal.label}${goal.id !== 'std' ? ` (< ${kg(goal.maxG)})` : ''}`,
      }))}
      hint={
        over > 0
          ? `${kg(over)} au-dessus de l’objectif.`
          : `Dans l’objectif : ${kg(-over)} de marge.`
      }
    />
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
  const weight = useKitWeight();
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
      <small>{item.weightG ? weight.item(item.weightG) : '—'}</small>
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
  const { kg } = useKitWeight();
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

  const [favOpen, setFavOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogCategory, setCatalogCategory] = useState('');
  const [inventoryQuery, setInventoryQuery] = useState('');

  const addedKeys = useMemo(() => {
    const keys = new Set<string>();
    items.forEach((item) => {
      if (item.ownershipId) keys.add(item.ownershipId);
      if (item.productId) keys.add(item.productId);
      keys.add(item.id);
      keys.add(`name:${item.name.trim().toLowerCase()}`);
    });
    return keys;
  }, [items]);

  const addCatalogProduct = (
    product: PickerProduct,
    targetCategory?: string,
    overrides?: { category?: string; quantity?: number; weightG?: number; borrowed?: boolean },
  ) => {
    const cat = overrides?.category || targetCategory || product.category || 'Divers';
    const nextItem: KitItemV2 = {
      id: product.id || crypto.randomUUID(),
      name: product.name,
      category: CATEGORY_ORDER.includes(cat) ? cat : 'Divers',
      weightG: Math.max(0, overrides?.weightG ?? product.weightG ?? 0),
      quantity: Math.max(1, Math.min(20, overrides?.quantity ?? 1)),
      productId: product.productId,
      ownershipId: product.ownershipId,
      isChecked: false,
      ...(overrides?.borrowed ? { borrowed: true } : {}),
    };
    setItems([...items, nextItem]);
    haptic('success');
  };

  const removeCatalogProduct = (product: PickerProduct) => {
    setItems(
      items.filter(
        (item) =>
          item.id !== product.id &&
          !(product.productId && item.productId === product.productId) &&
          !(product.ownershipId && item.ownershipId === product.ownershipId) &&
          item.name.trim().toLowerCase() !== product.name.trim().toLowerCase(),
      ),
    );
    haptic('selection');
  };

  return (
    <div className="lkdv-cv2c-kit" data-testid="cv2-field-items">
      <div className="lkdv-cv2-field" data-testid="cv2-field-kit-start">
        <span className="lkdv-cv2-field-label" id="cv2c-kit-from-label">
          Partir de
        </span>
        <button
          type="button"
          className="lkdv-cv2c-kit-fav-trigger"
          onClick={() => setFavOpen(true)}
        >
          <span className="lkdv-cv2c-kit-fav-ico" aria-hidden="true">
            <Bookmark size={15} />
          </span>
          <span className="lkdv-cv2c-kit-fav-txt">
            <b>Nos favoris</b>
            <small>Posts, carnets et modèles enregistrés</small>
          </span>
        </button>
      </div>
      <div className="lkdv-cv2c-field-head">
        <span className="lkdv-cv2-field-label">
          Inventaire <span aria-hidden="true">*</span>
        </span>
        <span className="lkdv-cv2-counter">
          {items.length} objet{items.length > 1 ? 's' : ''} · {kg(total)}
        </span>
      </div>
      {items.length > 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
          }}
        >
          <div className="lkdv-cv2c-stack-search" style={{ height: 34, flex: 1 }}>
            <Search size={13} aria-hidden="true" />
            <input
              type="search"
              value={inventoryQuery}
              onChange={(event) => setInventoryQuery(event.target.value)}
              placeholder="Filtrer tes objets…"
              aria-label="Filtrer les objets du kit"
            />
          </div>
          <button
            type="button"
            className="lkdv-cv2-chip lkdv-cv2-chip--sm"
            onClick={() => {
              setCatalogCategory('');
              setCatalogOpen(true);
            }}
          >
            <ShoppingBag size={12} aria-hidden="true" /> Boutique
          </button>
        </div>
      ) : null}
      {itemsError ? (
        <p className="lkdv-cv2-field-error" role="alert">
          {itemsError}
        </p>
      ) : null}
      <div className="lkdv-cv2c-kit-groups" data-hscroll>
        {groups.map(([category, groupItems]) => {
          const visibleItems = inventoryQuery.trim()
            ? groupItems.filter((item) =>
                item.name.toLowerCase().includes(inventoryQuery.trim().toLowerCase()),
              )
            : groupItems;
          if (inventoryQuery.trim() && visibleItems.length === 0) return null;
          const weight = groupItems.reduce((sum, item) => sum + item.weightG * item.quantity, 0);
          return (
            <section key={category} className="lkdv-cv2c-kit-group" data-kit-category={category}>
              <div className="lkdv-cv2c-kit-group-head">
                {CATEGORY_ICONS[category] ?? <Backpack size={13} aria-hidden="true" />}
                {category}
                <small>
                  {groupItems.length > 0 ? `${groupItems.length} · ` : ''}
                  {kg(weight)}
                </small>
              </div>
              <div className="lkdv-cv2c-kit-plus-row" data-hscroll>
                {visibleItems.map((item) => (
                  <div key={`tile-${item.id}`} className="lkdv-cv2c-kit-mini-tile" data-kit-item={item.id}>
                    <div className="lkdv-cv2c-kit-mini-tile-top">
                      <span className="lkdv-cv2c-kit-mini-ico" aria-hidden="true">
                        {CATEGORY_ICONS[category] ?? <Backpack size={13} />}
                      </span>
                      <button
                        type="button"
                        className="lkdv-cv2c-kit-mini-del"
                        aria-label={`Retirer ${item.name}`}
                        onClick={() => setItems(items.filter((entry) => entry.id !== item.id))}
                      >
                        <Trash2 size={11} aria-hidden="true" />
                      </button>
                    </div>
                    <b title={item.name}>{item.name}</b>
                    <div className="lkdv-cv2c-kit-mini-tile-foot">
                      <small>{kg(item.weightG * item.quantity)}</small>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        {item.quantity > 1 ? (
                          <button
                            type="button"
                            className="lkdv-cv2c-kit-mini-qty"
                            aria-label={`Diminuer quantité ${item.name}`}
                            onClick={() => patchItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}
                          >
                            −
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="lkdv-cv2c-kit-mini-qty"
                          aria-label={`Quantité ${item.name} : ${item.quantity}`}
                          onClick={() =>
                            patchItem(item.id, { quantity: Math.min(20, item.quantity + 1) })
                          }
                        >
                          ×{item.quantity}
                        </button>
                      </span>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="lkdv-cv2c-kit-plus-box"
                  aria-label={`Ajouter un produit dans ${category}`}
                  onClick={() => {
                    setCatalogCategory(category);
                    setCatalogOpen(true);
                  }}
                >
                  <Plus size={18} aria-hidden="true" />
                </button>
              </div>
            </section>
          );
        })}
      </div>
      <div className="lkdv-cv2c-inline-add">
        <button
          type="button"
          className="lkdv-cv2-chip lkdv-cv2-chip--lg"
          onClick={() => setCustomOpen((open) => !open)}
          aria-expanded={customOpen}
        >
          <Plus size={13} aria-hidden="true" /> Objet personnalisé
        </button>
      </div>
      <KitCatalogDrawerV2
        open={catalogOpen}
        initialCategory={catalogCategory}
        inventory={products}
        addedKeys={addedKeys}
        currentKitWeightG={total}
        addedCount={items.length}
        units={form.watch('units') === 'imperial' ? 'imperial' : 'metric'}
        emptyCategories={groups.filter(([, g]) => g.length === 0).map(([c]) => c)}
        onClose={() => setCatalogOpen(false)}
        onAddProduct={addCatalogProduct}
        onRemoveProduct={removeCatalogProduct}
        onCreateCustom={(presetName, cat) => {
          setCustomName(presetName);
          if (cat && CATEGORY_ORDER.includes(cat)) setCustomCategory(cat);
          setCustomOpen(true);
          setCatalogOpen(false);
        }}
      />
      <KitFavoritesDrawerV2
        open={favOpen}
        userId={user?.id ?? ''}
        onClose={() => setFavOpen(false)}
        onImport={(imported) => {
          setItems(imported);
          haptic('success');
        }}
      />
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
          </div>
          <button type="button" className="lkdv-cv2-add-media" onClick={addCustom}>
            <Plus size={14} aria-hidden="true" /> Ajouter l’objet
          </button>
        </div>
      ) : null}

      {user ? null : <p className="lkdv-cv2c-warning">Connecte-toi pour créer un kit.</p>}
    </div>
  );
}

/**
 * Commutateur de la maquette (`F.sw`, « Mode préparation », « Unités
 * impériales »). Sans `on`/`off`, la valeur du champ est un booléen.
 */
function KitSwitchV2({
  name,
  label,
  hint,
  on = true,
  off = false,
}: {
  name: 'prep' | 'units';
  label: string;
  hint: string;
  on?: string | boolean;
  off?: string | boolean;
}) {
  const form = useFormContext<KitFormValuesV2>();
  const { haptic } = useHapticFeedback();
  const current = form.watch(name) as unknown;
  const checked = current === on;
  const id = `cv2c-kit-switch-${name}`;
  return (
    <div
      className="lkdv-cv2c-kit-switch"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 14,
        background: '#ffffff',
        border: '1px solid #e5e7eb',
      }}
    >
      <span
        id={`${id}-label`}
        style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}
      >
        <b style={{ fontSize: '0.86rem', lineHeight: 1.25 }}>{label}</b>
        <small id={`${id}-hint`} style={{ fontSize: '0.75rem', opacity: 0.72, lineHeight: 1.3 }}>
          {hint}
        </small>
      </span>
      <button
        type="button"
        className="lkdv-cv2c-switch"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        data-testid={id}
        onClick={() => {
          form.setValue(name, (checked ? off : on) as never, { shouldDirty: true });
          haptic('selection');
        }}
      >
        <span className="lkdv-cv2c-switch-track" aria-hidden="true">
          <span className="lkdv-cv2c-switch-dot" />
        </span>
      </button>
    </div>
  );
}

function ComplementsStep({ user }: { user: User | null }) {
  const form = useFormContext<KitFormValuesV2>();
  const values = form.watch();
  const items = useMemo(() => values.items ?? [], [values.items]);
  const { haptic } = useHapticFeedback();
  const { kg } = useKitWeight();
  // Kit#9 — météo du lieu où la personne se trouve, demandée sur geste.
  const [weather, setWeather] = useState<KitWeatherV2 | null>(null);
  const [weatherState, setWeatherState] = useState<'idle' | 'loading' | 'error'>('idle');
  // Kit#12 — prêts : objets empruntés reconnus par leur propriété.
  const [loans, setLoans] = useState<BorrowedLoansV2 | null>(null);
  const suggestions = useMemo(
    () =>
      mergeKitSuggestionsV2(
        kitSuggestionsV2(values.model, values.season, items, values.seasons),
        kitWeatherSuggestionsV2(weather, items),
      ),
    [items, values.model, values.season, values.seasons, weather],
  );

  const fetchLiveWeather = async () => {
    setWeatherState('loading');
    try {
      let coords = { lat: 45.9237, lng: 6.8694 };
      try {
        const position = await getCurrentGeoPosition({ enableHighAccuracy: false, timeout: 6_000 });
        coords = { lat: position.latitude, lng: position.longitude };
      } catch {
        /* fallback Chamonix si géoloc refusée */
      }
      const today = new Date().toISOString().slice(0, 10);
      const forecast = await fetchKitWeatherV2(coords, today);
      if (!forecast) throw new Error('weather');
      setWeather(forecast);
      setWeatherState('idle');
    } catch {
      setWeather(null);
      setWeatherState('error');
    }
  };

  useEffect(() => {
    void fetchLiveWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestWeather = async () => {
    haptic('selection');
    await fetchLiveWeather();
  };

  useEffect(() => {
    if (!values.prep || loans || !user?.id) return;
    let alive = true;
    void loadBorrowedLoansV2(user.id).then((result) => {
      if (alive) setLoans(result);
    });
    return () => {
      alive = false;
    };
  }, [loans, user?.id, values.prep]);

  const patchItem = (id: string, patch: Partial<KitItemV2>) => {
    form.setValue(
      'items',
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      { shouldDirty: true, shouldValidate: true },
    );
  };

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
            {items.length} objet{items.length > 1 ? 's' : ''} · {kg(totalWeightG(items))}
          </small>
        </div>
      </div>
      {totalWeightG(items) > 0 ? (
        <KitCategoryChartV2 items={items} />
      ) : null}
      <GoalChipsV2 />
      <div className="lkdv-cv2c-row-2">
        <TextFieldV2
          name="model"
          label="Modèle"
          placeholder="Bivouac, Trail, Alpi…"
          maxLength={80}
        />
        <SelectDropdownV2
          name="seasons"
          label="Saison"
          multiple
          options={SEASON_OPTIONS.map((season) => ({ ...season }))}
          placeholder="Choisir…"
          onChange={(next) => {
            const arr = Array.isArray(next) ? next : [next];
            form.setValue('seasons', arr as KitFormValuesV2['seasons'], {
              shouldDirty: true,
              shouldValidate: true,
            });
            const rpcSeason =
              arr.length === 1 && (arr[0] === 'printemps' || arr[0] === 'ete' || arr[0] === 'automne' || arr[0] === 'hiver')
                ? arr[0]
                : 'toute_saison';
            form.setValue('season', rpcSeason, { shouldDirty: true });
          }}
        />
      </div>
      {/* Suggestions actionnables (FID-023) */}
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">
          <Sparkles size={11} aria-hidden="true" /> Suggestions ·{' '}
          {values.model?.trim() || 'Bivouac'} ·{' '}
          {formatSeasonsSummary(values.seasons, values.season)}
        </span>
        {weather || weatherState === 'error' ? (
          <div className="lkdv-cv2c-kit-weather">
            {weather ? (
              <small role="status">
                Près de toi : {weather.tempMax}° / {weather.tempMin}° · {weather.label}
              </small>
            ) : (
              <small role="status">
                Météo locale indisponible : suggestions de saison proposées.
              </small>
            )}
          </div>
        ) : null}
        <ul className="lkdv-cv2c-kit-suggestions" role="list">
          {suggestions.map((suggestion) => (
            <li key={suggestion.name} className="lkdv-cv2c-kit-suggestion" data-added={suggestion.added || undefined}>
              {CATEGORY_ICONS[suggestion.category] ?? <Backpack size={13} aria-hidden="true" />}
              <span>
                <b>{suggestion.name}</b>
                <small>
                  {kg(suggestion.weightG)}
                  {suggestion.reason ? ` · ${suggestion.reason}` : ''}
                </small>
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
            le sac · {kg(totalWeightG(items))}
          </p>
        ) : null}
      </div>
    </>
  );
}

function KitCategoryChartV2({ items }: { items: readonly KitItemV2[] }) {
  const data = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of items) {
      const cat = item.category?.trim() || 'Divers';
      totals.set(cat, (totals.get(cat) ?? 0) + (item.weightG ?? 0) * (item.quantity ?? 1));
    }
    return Array.from(totals.entries())
      .filter(([, g]) => g > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, grams]) => ({ name, kg: Number((grams / 1000).toFixed(2)) }));
  }, [items]);

  if (data.length === 0) return null;

  const canObserveResize = typeof ResizeObserver !== 'undefined';

  return (
    <div className="lkdv-cv2-card" style={{ padding: '10px 12px' }}>
      <span className="lkdv-cv2-eyebrow">Répartition par catégorie (kg)</span>
      <div style={{ width: '100%', height: Math.max(88, data.length * 26) }}>
        {canObserveResize ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={78}
                tick={{ fontSize: 11, fill: '#334155' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip formatter={(v) => [`${v} kg`, 'Poids']} />
              <Bar dataKey="kg" radius={[0, 6, 6, 0]} barSize={14}>
                {data.map((_, idx) => (
                  <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <BarChart width={280} height={Math.max(88, data.length * 26)} data={data} layout="vertical">
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={78} hide />
            <Bar dataKey="kg" barSize={14}>
              {data.map((_, idx) => (
                <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        )}
      </div>
    </div>
  );
}

function PartageStep() {
  const form = useFormContext<KitFormValuesV2>();
  const values = form.watch();
  const items = values.items ?? [];
  const { kg } = useKitWeight();
  const proposed = kitProposedNameV2({
    model: values.model,
    season: values.season,
    seasons: values.seasons,
    items,
  });
  const isAuto = !values.name.trim() || values.name.trim() === proposed;
  const { haptic } = useHapticFeedback();
  const categoriesCount = useMemo(
    () => new Set(items.map((item) => item.category?.trim() || 'Divers')).size,
    [items],
  );
  const totalG = totalWeightG(items);
  const classGoal = kitGoalV2(kitGoalOfWeightV2(totalG));

  // Le nom proposé remplit le champ tant que l'utilisateur ne l'a pas modifié.
  useEffect(() => {
    if (isAuto && items.length > 0 && form.getValues('name') !== proposed) {
      form.setValue('name', proposed, { shouldDirty: true });
    }
  }, [form, isAuto, items.length, proposed]);

  const appendTagToDescription = (tag: string) => {
    const current = (form.getValues('description') ?? '').trim();
    if (current.toLowerCase().includes(tag.toLowerCase())) return;
    form.setValue('description', current ? `${current} · ${tag}` : tag, {
      shouldDirty: true,
    });
    haptic('selection');
  };

  return (
    <>
      <div className="lkdv-cv2c-kit-summary-card" role="group" aria-label="Synthèse du kit">
        <div className="lkdv-cv2c-kit-summary-stat">
          <small>Contenu</small>
          <b>{items.length} objet{items.length > 1 ? 's' : ''}</b>
        </div>
        <div className="lkdv-cv2c-kit-summary-stat">
          <small>Poids total</small>
          <b>{kg(totalG)}</b>
        </div>
        <div className="lkdv-cv2c-kit-summary-stat">
          <small>{categoriesCount} cat. · Classe</small>
          <b>{classGoal.label}</b>
        </div>
      </div>
      <TextFieldV2
        name="name"
        label="Nom du kit"
        placeholder="Kit bivouac 3 saisons"
        required
        maxLength={100}
      />
      <TextAreaFieldV2
        name="description"
        label="Description"
        placeholder="Usage, terrain, particularités…"
        maxLength={1000}
        rows={3}
      />
      <div className="lkdv-cv2-chips" aria-label="Compléments rapides de description">
        {['Ultraléger', 'Autonomie 2 jours', 'Haute montagne', 'Bivouac confort'].map((tag) => (
          <button
            key={tag}
            type="button"
            className="lkdv-cv2-chip lkdv-cv2-chip--sm"
            onClick={() => appendTagToDescription(tag)}
          >
            + {tag}
          </button>
        ))}
      </div>
      <KitVisibilitySection />
    </>
  );
}

function KitVisibilitySection() {
  const form = useFormContext<KitFormValuesV2>();
  const isPublic = form.watch('isPublic');
  const clubId = form.watch('clubId');
  const { requestCreate, user } = useCreateSheet();
  const myClubs = useMyClubsV2(user?.id ?? null);
  const [visMode, setVisMode] = useState<'public' | 'private' | 'club'>(() =>
    clubId ? 'club' : isPublic ? 'public' : 'private',
  );

  useEffect(() => {
    if (visMode === 'club') void myClubs.load();
  }, [myClubs, visMode]);

  return (
    <VisibilityPickerV2
      name="clubId"
      label="Visibilité"
      value={visMode}
      onSelectValue={(next) => {
        const mode = next as 'public' | 'private' | 'club';
        setVisMode(mode);
        form.setValue('isPublic', mode === 'public', { shouldDirty: true, shouldValidate: true });
        if (mode !== 'club') {
          form.setValue('clubId', '', { shouldDirty: true });
        }
      }}
      clubs={myClubs.clubs ?? []}
      clubsLoading={myClubs.loading}
      clubsError={myClubs.error}
      onCreateClub={() => requestCreate('club')}
    />
  );
}

function KitBody({
  api,
  user,
  inventory,
  inventoryLoading,
  inventoryError,
  onRetry,
  prefill,
  prefillNonce = 0,
}: {
  api: CreateFormEngineApiV2<KitFormValuesV2>;
  user: User | null;
  inventory: InventoryItem[];
  inventoryLoading: boolean;
  inventoryError: string | null;
  onRetry: () => void;
  prefill?: Record<string, unknown> | null;
  prefillNonce?: number;
}) {
  const appliedPrefillRef = useRef<number>(-1);
  useEffect(() => {
    if (!prefill || appliedPrefillRef.current === prefillNonce) return;
    appliedPrefillRef.current = prefillNonce;
    if (typeof prefill.name === 'string' && prefill.name.trim()) {
      api.form.setValue('name', prefill.name.trim(), { shouldDirty: true, shouldValidate: true });
    }
    if (Array.isArray(prefill.items) && prefill.items.length > 0) {
      api.form.setValue('items', prefill.items as KitItemV2[], {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [api.form, prefill, prefillNonce]);

  const values = api.form.watch();
  const items = values.items ?? [];
  const [previewCollapsed, setPreviewCollapsed] = useScrollCollapsePreview(api.active);
  const totalGrams = totalWeightG(items);
  const weightLabel =
    totalGrams >= 1000
      ? `${(totalGrams / 1000).toFixed(2).replace('.', ',')} kg`
      : `${totalGrams} g`;
  const kitTitle =
    values.name.trim() ||
    kitProposedNameV2({ model: values.model, season: values.season, items }) ||
    'Mon kit';

  return (
    <KitUnitsContext.Provider value={values.units === 'imperial' ? 'imperial' : 'metric'}>
      {api.active ? (
        <SheetPreview compact={false}>
          <CollapsibleHeroPreview
            collapsed={previewCollapsed}
            onExpand={() => setPreviewCollapsed(false)}
            title={kitTitle}
            subtitle={`${items.length} objet${items.length > 1 ? 's' : ''} · ${weightLabel}`}
            badge={<Backpack size={14} aria-hidden="true" />}
          >
            <KitRectangularPreviewV2 items={items} values={values} />
          </CollapsibleHeroPreview>
        </SheetPreview>
      ) : null}
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
    </KitUnitsContext.Provider>
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
export function KitFormV2({
  active,
  onNavChange,
  stepHosts,
  prefill,
  prefillNonce,
}: CreateFormV2Props) {
  const { user, reportCreated } = useCreateSheet();
  const defaults = useRef({ ...createDefaultsV2('kit'), units: readStoredUnitsV2() }).current;
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
          prefill={prefill}
          prefillNonce={prefillNonce}
        />
      )}
    </CreateFormEngineV2>
  );
}

export default KitFormV2;
