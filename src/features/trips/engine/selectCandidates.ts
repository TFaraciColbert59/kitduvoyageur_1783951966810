import type {
  CandidateStep,
  CandidateItem,
  GeneratedItem,
  PlannerPace,
} from './types';

/**
 * Sélectionne les étapes candidates pour un pays donné.
 * Seules des étapes réelles existantes sont sélectionnées — AUCUN placeholder n'est inventé.
 */
export function selectCandidateStepsForCountry(
  candidates: CandidateStep[],
  countryCode: string,
  neededDays: number,
  styles: string[] = [],
  _pace: PlannerPace = 'standard'
): CandidateStep[] {
  const code = countryCode.toUpperCase();
  const forCountry = candidates.filter((s) => s.country_code.toUpperCase() === code);

  if (forCountry.length === 0 || neededDays <= 0) {
    return [];
  }

  // Tri déterministe par pertinence de style, puis order_hint, puis id
  const scored = forCountry.map((step) => {
    let score = 0;
    if (styles.length > 0 && step.activity_type) {
      if (styles.includes(step.activity_type.toLowerCase())) {
        score += 10;
      }
    }
    const orderScore = step.order_hint !== undefined ? 100 - step.order_hint : 50;
    return { step, score: score + orderScore };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.step.id.localeCompare(b.step.id);
  });

  const selected: CandidateStep[] = [];
  for (let i = 0; i < neededDays; i++) {
    // Si moins d'étapes que de jours, on boucle proprement sur les étapes disponibles
    const candidate = scored[i % scored.length].step;
    selected.push(candidate);
  }

  return selected;
}

/**
 * Sélectionne les items matériels candidats pour l'expédition.
 * Zéro hallucination : s'appuie uniquement sur le catalogue/inventaire fourni.
 */
export function selectCandidateItems(
  candidates: CandidateItem[],
  styles: string[] = [],
  travelersCount = 1
): GeneratedItem[] {
  if (!candidates || candidates.length === 0) {
    return [];
  }

  const items: GeneratedItem[] = [];

  for (const c of candidates) {
    // Sélectionne les essentiels ou ceux correspondant aux styles
    const isRelevant =
      c.is_essential ||
      styles.some(
        (s) =>
          c.category?.toLowerCase().includes(s.toLowerCase()) ||
          c.name.toLowerCase().includes(s.toLowerCase())
      );

    if (isRelevant) {
      const isPerPerson =
        c.category?.toLowerCase().includes('personnel') ||
        c.category?.toLowerCase().includes('vêtements') ||
        c.category?.toLowerCase().includes('couchage');

      const qty = isPerPerson ? travelersCount : 1;

      items.push({
        item_name: c.name,
        category: c.category || 'Équipement général',
        quantity: qty,
        weight_grams: c.weight_grams ?? null,
        status: 'needed',
        ref_type: c.ref_type,
        ref_id: c.ref_id,
        source: 'import',
      });
    }
  }

  return items;
}
