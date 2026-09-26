export interface PoiTooltipInput {
  name?: unknown;
  category?: unknown;
  altitude?: unknown;
  description?: unknown;
  details?: unknown;
  visited?: unknown;
  stepLabel?: unknown;
  verified?: unknown;
}

export interface PoiTooltipModel {
  title: string;
  categoryLabel: string;
  altitudeLabel: string | null;
  description: string;
  badges: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  refuge: 'Refuge',
  summit: 'Sommet',
  water: "Point d'eau",
  viewpoint: 'Point de vue',
  waterfall: 'Cascade',
  col: 'Col',
  camping: 'Camping',
  food: 'Restauration',
  stay: 'Hébergement',
  transport: 'Transport',
  step: 'Étape',
  poi: "Point d’intérêt",
};

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function categoryLabel(value: unknown): string {
  const category = cleanText(value).toLowerCase();
  if (!category) return "Point d’intérêt";
  return CATEGORY_LABELS[category] ?? 'Point d’intérêt';
}

function altitudeLabel(value: unknown): string | null {
  const altitude = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(altitude)) return null;
  return `${Math.round(altitude)} m`;
}

export function buildPoiTooltipModel(input: PoiTooltipInput): PoiTooltipModel {
  const title = cleanText(input.name) || "Point d’intérêt";
  const description = cleanText(input.description) || cleanText(input.details);
  const badges: string[] = [];

  if (input.visited === true) badges.push('Déjà visité');
  const stepLabel = cleanText(input.stepLabel);
  if (stepLabel) badges.push(stepLabel);
  if (input.verified === true) badges.push('Vérifié');

  return {
    title,
    categoryLabel: categoryLabel(input.category),
    altitudeLabel: altitudeLabel(input.altitude),
    description,
    badges,
  };
}
