import type { KitFormValuesV2, KitItemV2 } from '../engine/createSchemasV2';

/**
 * Modèles de kit et points de départ — valeurs **de la maquette**
 * (`maquette-communaute.html` L3166-3175) :
 *
 * - `CATS` = les 6 catégories visibles même vides (L3166) ;
 * - `CATALOG` = le catalogue d'exemple (L3167) ;
 * - `FROM` = les points de départ (L3169 : kit existant, carnet, modèle, vide) ;
 * - `MODELS` = journée / bivouac / alpinisme (L3171) ;
 * - `SUGG` = les suggestions par modèle (L3175).
 *
 * Aucune persistance : ces objets ne servent qu'à **préremplir** l'inventaire
 * du formulaire (l'utilisateur peut tout modifier ensuite) et à proposer des
 * suggestions actionnables à l'étape Compléter (FID-023/FID-024).
 */

export type KitModelV2 = 'jour' | 'bivouac' | 'alpi';

export const KIT_MODELS_V2: ReadonlyArray<{ id: KitModelV2; label: string }> = [
  { id: 'jour', label: 'Journée' },
  { id: 'bivouac', label: 'Bivouac' },
  { id: 'alpi', label: 'Alpinisme' },
];

/** Catalogue de la maquette (L3167) : nom, catégorie, poids en grammes. */
const KIT_CATALOG_V2: ReadonlyArray<readonly [string, string, number]> = [
  ['Sac 45 L', 'Portage', 1150],
  ['Bâtons carbone', 'Portage', 440],
  ['Tente 2 places', 'Abri', 1380],
  ['Duvet 0 °C', 'Abri', 780],
  ['Matelas isolant', 'Abri', 420],
  ['Réchaud', 'Cuisine', 360],
  ['Popote', 'Cuisine', 210],
  ['Veste imperméable', 'Vêtements', 320],
  ['Polaire', 'Vêtements', 280],
  ['Doudoune', 'Vêtements', 380],
  ['Frontale', 'Électronique', 85],
  ['Batterie externe', 'Électronique', 240],
  ['Filtre à eau', 'Sécurité', 65],
  ['Trousse de secours', 'Sécurité', 290],
  // Les deux objets des suggestions « alpi » (L3175) entrent dans le modèle.
  ['Casque', 'Sécurité', 320],
  ['Crampons', 'Sécurité', 900],
];

const C = KIT_CATALOG_V2;
const indexOf = (name: string) => C.findIndex((entry) => entry[0] === name);

/** Index des objets de chaque modèle (L3169 pour `model`, L3175 pour alpi). */
const KIT_MODEL_INDEXES_V2: Record<KitModelV2, readonly number[]> = {
  // `FROM.model` = « Modèle “Journée légère” » : [0,7,8,10,12,13] (L3169).
  jour: [0, 7, 8, 10, 12, 13],
  // `FROM.mine` = tout le bivouac de la maquette (L3169).
  bivouac: [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13],
  // Alpinisme : le bivouac + casque et crampons (suggestions L3175).
  alpi: [0, 1, 2, 3, 4, 7, 8, 10, 12, 13, indexOf('Casque'), indexOf('Crampons')],
};

function toKitItem(entry: readonly [string, string, number]): KitItemV2 {
  return {
    id: crypto.randomUUID(),
    name: entry[0],
    category: entry[1],
    weightG: entry[2],
    quantity: 1,
    productId: null,
    ownershipId: null,
    isChecked: false,
  };
}

/** Objets préremplis d'un modèle (neufs, identifiants uniques). */
export function kitModelItemsV2(model: KitModelV2): KitItemV2[] {
  return KIT_MODEL_INDEXES_V2[model].map((index) => toKitItem(C[index])).filter(Boolean);
}

/** Total en grammes d'une liste d'objets (quantités comprises). */
export function kitItemsWeightV2(items: readonly KitItemV2[]): number {
  return items.reduce((total, item) => total + (item.weightG || 0) * (item.quantity || 1), 0);
}

export type KitSuggestionV2 = {
  name: string;
  category: string;
  weightG: number;
  /** Déjà dans le sac : la ligne reste visible, bouton coché/désactivé. */
  added: boolean;
  /** Pourquoi cet objet (météo du jour…) ; absent pour les suggestions de modèle. */
  reason?: string;
};

/**
 * Suggestions de la maquette (L3175). La maquette **filtre** celles déjà dans
 * le sac ; FID-023 demande l'état « ajouté » coché/désactivé : on garde la
 * ligne et on expose `added`, le bouton reste visible mais inerte. En hiver,
 * la doudoune s'ajoute (L3201).
 */
export function kitSuggestionsV2(
  model: KitModelV2,
  season: KitFormValuesV2['season'],
  items: readonly KitItemV2[],
): KitSuggestionV2[] {
  const base: Record<KitModelV2, ReadonlyArray<readonly [string, string, number]>> = {
    jour: [['Eau 1 L', 'Sécurité', 1000]],
    bivouac: [
      ['Duvet 0 °C', 'Abri', 780],
      ['Réchaud', 'Cuisine', 360],
    ],
    alpi: [
      ['Casque', 'Sécurité', 320],
      ['Crampons', 'Sécurité', 900],
    ],
  };
  const list: Array<readonly [string, string, number]> = [...base[model]];
  if (season === 'hiver') list.push(['Doudoune', 'Vêtements', 380]);
  const names = new Set(items.map((item) => item.name.trim()));
  return list.map(([name, category, weightG]) => ({
    name,
    category,
    weightG,
    added: names.has(name),
  }));
}

/** Objet prêt à ajouter depuis une suggestion (id neuf, quantité 1). */
export function kitSuggestionItemV2(
  suggestion: Omit<KitSuggestionV2, 'added'>,
): KitItemV2 {
  return {
    id: crypto.randomUUID(),
    name: suggestion.name,
    category: suggestion.category,
    weightG: suggestion.weightG,
    quantity: 1,
    productId: null,
    ownershipId: null,
    isChecked: false,
  };
}

/** Objectif de poids de la maquette (`GOALS`, L3172) : 4,5 kg / 7,5 kg / std. */
export const KIT_GOALS_V2 = [
  { id: 'ultra', label: 'Ultraléger', maxG: 4500 },
  { id: 'light', label: 'Léger', maxG: 7500 },
  { id: 'std', label: 'Standard', maxG: 20_000 },
] as const;

export type KitGoalV2 = (typeof KIT_GOALS_V2)[number]['id'];

export function kitGoalV2(goal: KitGoalV2) {
  return KIT_GOALS_V2.find((entry) => entry.id === goal) ?? KIT_GOALS_V2[1];
}

/** Objectif atteint par le poids courant (maquette `goalOf`, L3174). */
export function kitGoalOfWeightV2(weightG: number): KitGoalV2 {
  if (weightG <= 4500) return 'ultra';
  if (weightG <= 7500) return 'light';
  return 'std';
}

/**
 * Nom proposé de la maquette (`autoName`, L3177) :
 * « Kit bivouac 3 saisons · 12,3 kg » → ici « Kit bivouac · 12,3 kg ».
 */
export function kitProposedNameV2(values: {
  model: KitModelV2;
  season: KitFormValuesV2['season'];
  items: readonly KitItemV2[];
}): string {
  const model = KIT_MODELS_V2.find((entry) => entry.id === values.model)?.label ?? 'Bivouac';
  const season =
    values.season === 'hiver'
      ? 'hiver'
      : values.season === 'printemps'
        ? 'printemps'
        : values.season === 'automne'
          ? 'automne'
          : values.season === 'ete'
            ? 'été'
            : '3 saisons';
  const kg = (kitItemsWeightV2(values.items) / 1000).toFixed(1).replace('.', ',');
  return `Kit ${model.toLowerCase()} ${season} · ${kg} kg`;
}

/**
 * « Sac en couches » (FID-025) : la maquette empile les **catégories**
 * (`bagSVG`, L3225). Le schéma V2 ne stocke pas de couche par objet : on la
 * dérive des catégories, sans nouvelle colonne.
 * - porté : vêtements sur soi ;
 * - consommable : eau et nutrition ;
 * - sac : tout le reste.
 */
export type KitLayerV2 = 'porte' | 'sac' | 'conso';

export function kitLayerOfCategoryV2(category: string): KitLayerV2 {
  const normalized = category.trim().toLowerCase();
  if (normalized === 'vêtements' || normalized === 'vetements') return 'porte';
  if (normalized === 'eau' || normalized === 'nutrition') return 'conso';
  return 'sac';
}

export const KIT_LAYER_LABELS_V2: Record<KitLayerV2, string> = {
  porte: 'Porté',
  sac: 'Sac',
  conso: 'Consommable',
};

/** Poids par couche (porté / sac / consommable), en grammes. */
export function kitLayersV2(items: readonly KitItemV2[]): Record<KitLayerV2, number> {
  const layers: Record<KitLayerV2, number> = { porte: 0, sac: 0, conso: 0 };
  for (const item of items) {
    layers[kitLayerOfCategoryV2(item.category)] += (item.weightG || 0) * (item.quantity || 1);
  }
  return layers;
}

/**
 * Points de départ de la maquette (L3169). « Carnet » et « Mon kit » lisent les
 * données réelles de l'utilisateur (`kitSourcesV2`) ; « Modèle » préremplit
 * depuis le catalogue ci-dessus ; « Vide » remet l'inventaire à zéro.
 */
export const KIT_START_FROM_V2 = [
  { id: 'mine', label: 'Mon kit' },
  { id: 'carnet', label: 'Carnet' },
  { id: 'model', label: 'Modèle' },
  { id: 'empty', label: 'Vide' },
] as const;

export type KitStartFromV2 = (typeof KIT_START_FROM_V2)[number]['id'];
