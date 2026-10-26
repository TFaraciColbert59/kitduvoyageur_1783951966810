export type KitTemplateId = 'day' | 'bivouac' | 'alpine' | 'ski' | 'bike' | 'water';

export interface InventoryItem {
  id: string;
  name: string;
  photoUrl?: string | null;
  condition?: string | null;
  category?: string | null;
  weightG?: number | null;
}

export interface CustomKitItem {
  id: string;
  name: string;
  category: string;
  weightG: number;
  quantity: number;
}

export interface KitSuggestion {
  category: string;
  suggestedName: string;
  reason: string;
}

const TEMPLATE_CATEGORIES: Record<KitTemplateId, string[]> = {
  day: ['Portage', 'Eau', 'Nutrition', 'Vêtements', 'Sécurité', 'Navigation'],
  bivouac: ['Portage', 'Abri', 'Sommeil', 'Cuisine', 'Eau', 'Nutrition', 'Vêtements', 'Sécurité', 'Navigation', 'Hygiène'],
  alpine: ['Portage', 'Abri', 'Sommeil', 'Cuisine', 'Eau', 'Nutrition', 'Vêtements', 'Sécurité', 'Navigation', 'Réparation'],
  ski: ['Portage', 'Abri', 'Sommeil', 'Cuisine', 'Eau', 'Nutrition', 'Vêtements', 'Sécurité', 'Navigation', 'Réparation'],
  bike: ['Portage', 'Eau', 'Nutrition', 'Vêtements', 'Sécurité', 'Navigation', 'Réparation'],
  water: ['Portage', 'Eau', 'Nutrition', 'Vêtements', 'Sécurité', 'Navigation', 'Réparation'],
};

const TEMPLATE_NAMES: Record<KitTemplateId, string> = {
  day: 'Journée', bivouac: 'Bivouac', alpine: 'Alpinisme', ski: 'Ski', bike: 'Vélo', water: 'Eau',
};

export const KIT_TEMPLATES = Object.entries(TEMPLATE_NAMES).map(([id, label]) => ({
  id: id as KitTemplateId,
  label,
}));

export function kitCompletionScore(selected: InventoryItem[], custom: CustomKitItem[], template: KitTemplateId): number {
  const required = TEMPLATE_CATEGORIES[template];
  const present = new Set([...selected, ...custom].map((item) => (item.category || '').toLowerCase()));
  if (required.length === 0) return 100;
  return Math.round((required.filter((category) => present.has(category.toLowerCase())).length / required.length) * 100);
}

export function suggestKitCompletion(
  selected: InventoryItem[],
  custom: CustomKitItem[],
  template: KitTemplateId,
): KitSuggestion[] {
  const required = TEMPLATE_CATEGORIES[template];
  const present = new Set([...selected, ...custom].map((item) => (item.category || '').toLowerCase()));
  return required
    .filter((category) => !present.has(category.toLowerCase()))
    .map((category) => ({
      category,
      suggestedName: `Ajouter ${category.toLowerCase()}`,
      reason: `Catégorie requise pour un kit ${TEMPLATE_NAMES[template].toLowerCase()}.`,
    }));
}

export function inventoryWeight(selected: InventoryItem[], custom: CustomKitItem[]): number {
  const base = selected.reduce((total, item) => total + (item.weightG ?? 0), 0);
  const extra = custom.reduce((total, item) => total + item.weightG * item.quantity, 0);
  return base + extra;
}
