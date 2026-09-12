import type { TripBrief } from '../schemas/autoGen.schema';

/**
 * Phase 3 — Préparation automatique d'un voyage créé depuis l'intention AutoGen.
 *
 * Moteur PUR (aucune I/O, aucun accès Supabase) dérivé des couches
 * déterministes réellement produites par le pipeline AutoGen :
 *   • brouillon de voyage (titre, destination, dates) ;
 *   • kit matériel estimé (`materiel_kits` + items) ;
 *   • lignes budgétaires prévisionnelles (`trip_expenses`, is_planned) ;
 *   • checklist de préparation et documents ATTENDUS (`trip_checklist_items` —
 *     `trip_documents` exige un fichier réel, jamais inventé) ;
 *   • polyline réelle du parcours retenu (pour l'ETA map-matchée).
 *
 * Règle : toute valeur est marquée comme estimation ; une source absente ne
 * crée rien et produit un avertissement explicite (jamais de donnée inventée).
 */

/** Couche minimale lue par le moteur — le reste des champs est ignoré. */
export interface PreparationLayerLike {
  value?: unknown;
}

export type PreparationLayers = Record<string, PreparationLayerLike | undefined>;

export interface AutogenPreparationInput {
  brief: TripBrief | null;
  layers: PreparationLayers;
  /** Nombre de voyageurs retenu par le brief (défaut 1). */
  partySize?: number;
  /** Parcours réel retenu (déjà sélectionné en base) — sinon null. */
  routeName?: string | null;
}

export interface PreparationKitItem {
  name: string;
  category: string;
  quantity: number;
}

export interface PreparationKit {
  name: string;
  description: string;
  totalWeightGrams: number;
  items: PreparationKitItem[];
}

export interface PreparationBudgetLine {
  title: string;
  amountEur: number;
  category: string;
}

export interface PreparationChecklistItem {
  label: string;
  dueOffsetDays: number;
}

export interface PreparationDocumentExpectation {
  label: string;
  dueOffsetDays: number;
}

export interface AutogenPreparationPlan {
  kit: PreparationKit | null;
  budgetLines: PreparationBudgetLine[];
  checklist: PreparationChecklistItem[];
  documents: PreparationDocumentExpectation[];
  warnings: string[];
}

/** Nombre maximal d'items persistés par table (bornes de sécurité). */
export const MAX_KIT_ITEMS = 40;
export const MAX_CHECKLIST_ITEMS = 30;
export const MAX_PREPARATION_WARNINGS = 20;

/** Longueur maximale d'un libellé persisté (aligné sur les colonnes texte). */
const MAX_LABEL_LENGTH = 160;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function layerValue(layers: PreparationLayers, id: string): Record<string, unknown> | null {
  const candidate = layers[id]?.value;
  return isRecord(candidate) ? candidate : null;
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function numberField(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function booleanField(value: unknown): boolean {
  return value === true;
}

function clampLabel(label: string): string {
  const clean = label.replace(/\s+/g, ' ').trim();
  return clean.length > MAX_LABEL_LENGTH ? `${clean.slice(0, MAX_LABEL_LENGTH - 1)}…` : clean;
}

/** « drap_de_sac » → « Drap de sac » (libellé lisible, jamais un slug brut). */
export function humanizeSlug(slug: string): string {
  const spaced = slug.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (spaced === '') return slug;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Catégorie matériel canonique (`lib/schemas/materiel`) déduite du libellé. */
export function categoryForGearSlug(slug: string): string {
  const s = slug.toLowerCase();
  if (/tente|duvet|drap|couchage|matelas|hamac|bivouac/.test(s)) return 'Couchage & Tentes';
  if (/veste|pantalon|chaussure|cuissard|doudoune|polaire|gant|bonnet|chaussette|chapeau|cheche/.test(s)) {
    return 'Vêtements & Vestes';
  }
  if (/rechaud|gaz|cuisine|gamelle|popote/.test(s)) return 'Cuisine & Réchauds';
  if (/gourde|filtre|eau|isotherme|pastille|micropur|purif/.test(s)) return 'Eau & Filtres';
  if (/lampe|frontale|eclairage|éclairage|torche/.test(s)) return 'Lampes & Éclairage';
  if (/carte|gps|boussole|altimetre|altimètre/.test(s)) return 'Navigation & GPS';
  if (/secours|trousse|survie|soin|pharmacie|pansement/.test(s)) return 'Sécurité & Soins';
  if (/sac|sacoche|baton|bâton|outil|meche|mèche|multi/.test(s)) return 'Accessoires & Outils';
  return 'Autre';
}

/**
 * Brouillon de voyage déterministe depuis le brief — jamais un écran parallèle :
 * le titre et la destination servent la création réelle (`trips`).
 */
export function deriveAutogenTripDraft(input: {
  rawInput: string;
  brief: TripBrief | null;
  title?: string;
  startDate?: string | null;
  endDate?: string | null;
}): {
  title: string;
  description: string;
  destinationName: string | null;
  destinationCountryCode: string | null;
  startDate: string | null;
  endDate: string | null;
  partySize: number;
} {
  const brief = input.brief;
  const destination = brief?.destinations?.value?.[0] ?? null;
  const days = brief?.duration?.value?.days ?? null;
  const destinationLabel = destination ? destination.region || destination.country : null;

  const explicitTitle = input.title?.trim();
  const fallbackTitle =
    destinationLabel && days
      ? `${destinationLabel} — ${days} j`
      : destinationLabel ?? 'Aventure générée';
  const title = (explicitTitle && explicitTitle.length >= 3 ? explicitTitle : fallbackTitle)
    .slice(0, 120);

  const countryCode = destination && /^[A-Za-z]{2}$/.test(destination.country)
    ? destination.country.toUpperCase()
    : null;

  const windowStart = brief?.window?.value?.start;
  const windowEnd = brief?.window?.value?.end;
  const startDate = DATE_PATTERN.test(input.startDate ?? '')
    ? (input.startDate as string)
    : DATE_PATTERN.test(windowStart ?? '')
      ? (windowStart as string)
      : null;

  let endDate = DATE_PATTERN.test(input.endDate ?? '')
    ? (input.endDate as string)
    : DATE_PATTERN.test(windowEnd ?? '')
      ? (windowEnd as string)
      : null;

  if (!endDate && startDate && days && days > 1) {
    const start = new Date(`${startDate}T00:00:00Z`);
    if (!Number.isNaN(start.getTime())) {
      start.setUTCDate(start.getUTCDate() + days - 1);
      endDate = start.toISOString().slice(0, 10);
    }
  }

  const adults = numberField(brief?.party?.value?.adults) ?? 1;

  return {
    title: title.length >= 3 ? title : 'Aventure générée',
    description:
      'Voyage généré par le pipeline IA LKDV à partir du brief original — estimations à confirmer.',
    destinationName: destinationLabel,
    destinationCountryCode: countryCode,
    startDate,
    endDate,
    partySize: Math.max(1, Math.min(50, Math.trunc(adults))),
  };
}

export type AutogenTripActivity =
  | 'hiking'
  | 'trekking'
  | 'bivouac'
  | 'roadtrip'
  | 'cultural'
  | 'bushcraft'
  | 'mixed';

export type AutogenTripDifficulty = 'easy' | 'moderate' | 'hard' | 'expert';

/** Activité `trips.primary_activity` déterministe depuis les styles du brief. */
export function derivePrimaryActivity(brief: TripBrief | null): AutogenTripActivity {
  const styles = brief?.style?.value ?? [];
  if (styles.includes('bivouac')) return 'bivouac';
  if (styles.includes('trekking')) return 'trekking';
  if (styles.includes('cultural')) return 'cultural';
  if (styles.includes('van') || styles.includes('bikepacking')) return 'roadtrip';
  if (styles.includes('hiking') || styles.includes('trail') || styles.includes('fast_light')) {
    return 'hiking';
  }
  return 'mixed';
}

/** Difficulté `trips.difficulty` depuis la couche itinéraire (estimation). */
export function deriveDifficulty(layers: PreparationLayers): AutogenTripDifficulty {
  const itinerary = layerValue(layers, 'itinerary');
  const raw = typeof itinerary?.difficulty === 'string' ? itinerary.difficulty : null;
  if (raw === 'easy' || raw === 'moderate' || raw === 'hard' || raw === 'expert') {
    return raw;
  }
  return 'moderate';
}

/**
 * Termes de recherche de parcours issus de la région du brief (noms/refs/région
 * des tracés OSM). Retourne [] si aucun terme significatif : la recherche par
 * texte est alors désactivée — jamais une correspondance inventée.
 */
export function regionSearchTerms(brief: TripBrief | null): string[] {
  if (!brief) return [];
  const terms = new Set<string>();
  for (const destination of brief.destinations?.value ?? []) {
    const source = `${destination.region ?? ''} ${destination.country ?? ''}`;
    for (const word of source.split(/[^A-Za-zÀ-ÿ0-9]+/)) {
      const clean = word.trim();
      if (clean.length >= 4 && !/^(dans|avec|vers|pour|sous|entre|tour|massif|vallee|vallée)$/i.test(clean)) {
        terms.add(clean);
      }
    }
  }
  return [...terms].slice(0, 8);
}

/**
 * Polyline {lat,lng} d'une géométrie PostGIS sérialisée en GeoJSON
 * (LineString ou MultiLineString). Retourne null sans coordonnées exploitables —
 * l'appelant ne doit alors JAMAIS activer la navigation sur une estimation.
 */
export function polylineFromRouteGeom(
  geom: unknown,
  maxPoints = 5000
): { lat: number; lng: number }[] | null {
  let raw: unknown = geom;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isRecord(raw)) return null;
  const type = raw.type;
  const coordinates = raw.coordinates;
  if (!Array.isArray(coordinates)) return null;

  const lines: unknown[] =
    type === 'LineString'
      ? [coordinates]
      : type === 'MultiLineString' && coordinates.every((entry) => Array.isArray(entry))
        ? coordinates
        : [];
  if (lines.length === 0) return null;

  const points: { lat: number; lng: number }[] = [];
  for (const line of lines) {
    if (!Array.isArray(line)) continue;
    for (const position of line) {
      if (!Array.isArray(position) || position.length < 2) continue;
      const lng = Number(position[0]);
      const lat = Number(position[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
      points.push({ lat, lng });
      if (points.length >= maxPoints) return points;
    }
  }
  return points.length >= 2 ? points : null;
}

function buildKit(
  layers: PreparationLayers,
  title: string,
  warnings: string[]
): PreparationKit | null {
  const kitValue = layerValue(layers, 'kit');
  if (!kitValue) {
    warnings.push('Couche kit absente — aucun kit matériel créé.');
    return null;
  }

  const targetWeightKg = numberField(kitValue.targetWeightKg);
  const rawCategories = Array.isArray(kitValue.essentialCategories)
    ? kitValue.essentialCategories.filter((entry): entry is string => typeof entry === 'string')
    : [];

  const items: PreparationKitItem[] = [];
  const seen = new Set<string>();
  for (const slug of rawCategories) {
    const name = humanizeSlug(slug);
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      name: clampLabel(name),
      category: categoryForGearSlug(slug),
      quantity: 1,
    });
    if (items.length >= MAX_KIT_ITEMS) break;
  }

  if (items.length === 0) {
    warnings.push('Couche kit sans catégories essentielles — kit créé vide.');
  }

  const weightNote =
    targetWeightKg != null ? ` Poids cible estimé : ${targetWeightKg} kg.` : '';
  return {
    name: clampLabel(`Kit estimé — ${title}`),
    description: clampLabel(
      `Kit généré depuis le brief AutoGen (provenance : estimation).${weightNote} À ajuster avant départ.`
    ),
    totalWeightGrams: targetWeightKg != null ? Math.round(targetWeightKg * 1000) : 0,
    items,
  };
}

function buildBudgetLines(
  layers: PreparationLayers,
  partySize: number,
  days: number | null,
  warnings: string[]
): PreparationBudgetLine[] {
  const budgetValue = layerValue(layers, 'budget');
  if (!budgetValue) {
    warnings.push('Couche budget absente — aucune ligne budgétaire créée.');
    return [];
  }

  const currency = stringField(budgetValue.currency);
  if (currency && currency.toUpperCase() !== 'EUR') {
    // Les valeurs de la couche sont des montants `…Eur` : on ne convertit
    // jamais une devise implicitement, on le signale.
    warnings.push(
      `Devise ${currency} mentionnée dans la couche budget — ligne posée en EUR (montants de la couche libellés « Eur »), à vérifier.`
    );
  }

  const totalPerPerson = numberField(budgetValue.totalPerPersonEur);
  const dailyAverage = numberField(budgetValue.dailyAverageEur);

  let amount = 0;
  if (totalPerPerson != null && totalPerPerson > 0) {
    amount = Math.round(totalPerPerson * partySize);
  } else if (dailyAverage != null && dailyAverage > 0 && days != null && days > 0) {
    amount = Math.round(dailyAverage * days * partySize);
  }

  if (amount <= 0) {
    warnings.push('Budget estimé indisponible dans la couche — aucune ligne créée.');
    return [];
  }

  return [
    {
      title: clampLabel(
        `Budget prévisionnel estimé (${partySize} voyageur${partySize > 1 ? 's' : ''})`
      ),
      amountEur: amount,
      category: 'budget_prev',
    },
  ];
}

interface ChecklistSeed {
  label: string;
  dueOffsetDays: number;
}

function buildComplianceSeeds(compliance: Record<string, unknown> | null): ChecklistSeed[] {
  if (!compliance) return [];
  const seeds: ChecklistSeed[] = [];

  if (stringField(compliance.idRequired)) {
    seeds.push({
      label: `Préparer une pièce d'identité valide (${stringField(compliance.idRequired)})`,
      dueOffsetDays: 30,
    });
  }
  const validityMonths = numberField(compliance.passportValidityMonths);
  if (validityMonths != null && validityMonths > 0) {
    seeds.push({
      label: `Vérifier la validité du passeport (≥ ${validityMonths} mois après le retour)`,
      dueOffsetDays: 30,
    });
  }
  if (booleanField(compliance.visaRequired)) {
    seeds.push({ label: 'Obtenir le visa (délai de traitement)', dueOffsetDays: 30 });
  }
  if (booleanField(compliance.guideMandatory)) {
    seeds.push({ label: 'Réserver un guide officiel', dueOffsetDays: 21 });
  }
  if (booleanField(compliance.timsCard)) {
    seeds.push({ label: 'Obtenir la carte TIMS', dueOffsetDays: 21 });
  }
  if (booleanField(compliance.acapPermit)) {
    seeds.push({ label: 'Obtenir le permis ACAP', dueOffsetDays: 21 });
  }
  if (booleanField(compliance.permitsRequired) || booleanField(compliance.reservationPNRC)) {
    seeds.push({ label: "Obtenir les permis/réservations d'accès obligatoires", dueOffsetDays: 21 });
  }
  if (stringField(compliance.bivouacRule)) {
    seeds.push({
      label: `Prendre connaissance de la réglementation bivouac (${stringField(compliance.bivouacRule)})`,
      dueOffsetDays: 14,
    });
  }
  if (booleanField(compliance.mandatoryTracking) || stringField(compliance.registryUrl)) {
    seeds.push({
      label: "Enregistrer l'itinéraire sur le registre officiel",
      dueOffsetDays: 7,
    });
  }
  if (booleanField(compliance.pnrCharter) || booleanField(compliance.heartOfPark)) {
    seeds.push({ label: 'Relire la charte du parc (réglementation locale)', dueOffsetDays: 14 });
  }
  return seeds;
}

function buildDocumentSeeds(
  hasDestination: boolean,
  compliance: Record<string, unknown> | null,
  transport: Record<string, unknown> | null,
  accommodations: Record<string, unknown> | null
): PreparationDocumentExpectation[] {
  const seeds: PreparationDocumentExpectation[] = [];
  const push = (label: string, dueOffsetDays: number) => {
    if (!seeds.some((seed) => seed.label === label)) {
      seeds.push({ label: clampLabel(label), dueOffsetDays });
    }
  };

  // Pièce d'identité : attendue dès qu'un voyage réel a une destination (ou une
  // couche conformité). Sans aucune source, aucun document n'est inventé.
  if (hasDestination || compliance) {
    push('Document attendu : pièce d’identité ou passeport en cours de validité', 30);
  }
  if (booleanField(compliance?.visaRequired)) {
    push('Document attendu : visa en cours de validité', 30);
  }
  if (stringField(transport?.mode) === 'plane') {
    push('Document attendu : billets / réservation de transport', 21);
  }
  if (accommodations && (stringField(accommodations.name) || numberField(accommodations.priceEur) != null)) {
    push('Document attendu : confirmation de réservation d’hébergement', 14);
  }
  return seeds;
}

function buildOperationalSeeds(
  layers: PreparationLayers,
  routeName: string | null,
  kit: PreparationKit | null
): ChecklistSeed[] {
  const seeds: ChecklistSeed[] = [];
  const push = (label: string, dueOffsetDays: number) => {
    if (!seeds.some((seed) => seed.label === label)) {
      seeds.push({ label: clampLabel(label), dueOffsetDays });
    }
  };

  if (routeName) {
    push(`Vérifier le parcours retenu : ${routeName}`, 7);
  }
  if (kit) {
    push(`Vérifier le contenu du kit « ${kit.name} »`, 7);
    if (kit.totalWeightGrams > 0) {
      push(`Peser le sac et viser ≤ ${Math.round(kit.totalWeightGrams / 1000)} kg`, 7);
    }
  }

  const transport = layerValue(layers, 'major_transport');
  if (transport) {
    const mode = stringField(transport.mode);
    const arrival = stringField(transport.hubArrival);
    if (mode || arrival) {
      push(
        `Réserver le transport${mode ? ` (${mode})` : ''}${arrival ? ` — arrivée ${arrival}` : ''}`,
        mode === 'plane' ? 30 : 14
      );
    }
  }

  const accommodations = layerValue(layers, 'accommodations');
  if (accommodations) {
    const name = stringField(accommodations.name);
    const price = numberField(accommodations.priceEur);
    if (name || price != null) {
      push(
        `Réserver l'hébergement${name ? ` : ${name}` : ''}${price != null ? ` (estimation ${price} €)` : ''}`,
        30
      );
    }
  }

  const foodWater = layerValue(layers, 'food_water');
  const resupply = foodWater ? numberField(foodWater.resupplyEveryDays) : null;
  if (resupply != null && resupply > 0) {
    push(`Planifier les ravitaillements tous les ${resupply} jour${resupply > 1 ? 's' : ''}`, 7);
  }

  const safety = layerValue(layers, 'safety');
  if (safety) {
    const unit = stringField(safety.rescueUnit);
    const phone = stringField(safety.rescuePhone);
    if (unit || phone) {
      push(
        `Enregistrer les secours locaux${unit ? ` (${unit})` : ''}${phone ? ` — ${phone}` : ''}`,
        7
      );
    }
    const hazard = stringField(safety.primaryHazard);
    if (hazard) {
      push(`Préparer la parade au risque : ${hazard}`, 14);
    }
  }

  return seeds;
}

/** Assemble la préparation complète à partir du brief et des couches. */
export function buildAutogenPreparation(input: AutogenPreparationInput): AutogenPreparationPlan {
  const warnings: string[] = [];
  const title = input.brief
    ? deriveAutogenTripDraft({ rawInput: input.brief.rawInput, brief: input.brief }).title
    : 'Aventure générée';
  const partySize = Math.max(1, Math.trunc(input.partySize ?? 1));
  const days = input.brief?.duration?.value?.days ?? null;

  const kit = buildKit(input.layers, title, warnings);
  const budgetLines = buildBudgetLines(input.layers, partySize, days, warnings);

  const compliance = layerValue(input.layers, 'compliance');
  const transport = layerValue(input.layers, 'major_transport');
  const accommodations = layerValue(input.layers, 'accommodations');

  const documents = buildDocumentSeeds(
    input.brief != null,
    compliance,
    transport,
    accommodations
  );

  const seeds: ChecklistSeed[] = [
    ...buildComplianceSeeds(compliance),
    ...buildOperationalSeeds(input.layers, input.routeName ?? null, kit),
  ];

  const checklist: PreparationChecklistItem[] = [];
  const seen = new Set<string>();
  for (const seed of seeds) {
    const key = seed.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    checklist.push({
      label: clampLabel(seed.label),
      dueOffsetDays: Math.max(0, Math.trunc(seed.dueOffsetDays)),
    });
    if (checklist.length >= MAX_CHECKLIST_ITEMS) break;
  }

  // Tri décroissant d'échéance (le plus tôt en premier à l'affichage) — stable.
  checklist.sort((a, b) => b.dueOffsetDays - a.dueOffsetDays);
  documents.sort((a, b) => b.dueOffsetDays - a.dueOffsetDays);

  return {
    kit,
    budgetLines,
    checklist,
    documents,
    warnings: warnings.slice(0, MAX_PREPARATION_WARNINGS),
  };
}
