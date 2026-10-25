/**
 * Phase 5 — Kit voyageur complet : règles déterministes de complétude.
 *
 * Moteur PUR (aucune I/O). Chaque recommandation :
 *   • provient d'une RÈGLE explicite LKDV ou d'une DONNÉE réelle du voyage
 *     (parcours distance/D+/difficulté, activité, pays, durée, taille du groupe) ;
 *   • porte une `reason` qui cite la règle ou la valeur réellement connue —
 *     jamais une justification inventée, jamais un poids/prix estimé présenté
 *     comme mesuré ;
 *   • est classée personnel / partagé, et le statut `missing` est explicite
 *     (le serveur le pose uniquement quand le matériel n'est pas possédé).
 *
 * Le poids n'est renseigné que lorsqu'une source réelle existe (inventaire
 * possédé) : ici `weightGrams` reste null. L'UI affiche « poids non renseigné »
 * au lieu d'inventer une valeur.
 */

export type KitItemOwnership = 'personal' | 'shared';
export type KitItemPriority = 'vital' | 'recommended' | 'optional';
export type KitItemCondition = 'neuf' | 'bon' | 'use' | 'a_remplacer' | 'pour_pieces';

export type KitRecommendationCategory =
  | 'shelter'
  | 'sleep'
  | 'clothing'
  | 'cook'
  | 'water'
  | 'tech'
  | 'safety'
  | 'navigation'
  | 'misc';

export interface KitRouteContext {
  name?: string | null;
  distanceKm?: number | null;
  elevationGainM?: number | null;
  difficulty?: string | null;
}

export interface KitRecommendationInput {
  /** `trips.primary_activity` réel (hiking/trekking/bivouac/roadtrip/…). */
  activity?: string | null;
  /** Code pays ISO-2 réel du voyage (`trips.destination_country_code`). */
  countryCode?: string | null;
  /** Durée réelle du voyage en jours (dates ou étapes). */
  durationDays?: number | null;
  /** Taille réelle du groupe (brief) — détermine le matériel partagé. */
  partySize?: number | null;
  /** Mois de départ (1-12) quand les dates sont connues. */
  seasonMonth?: number | null;
  /** Parcours réel retenu (issu de `phase3_search_navigable_routes`). */
  route?: KitRouteContext | null;
}

export interface KitRecommendation {
  key: string;
  name: string;
  category: KitRecommendationCategory;
  ownership: KitItemOwnership;
  priority: KitItemPriority;
  quantity: number;
  /** Raison vérifiable (règle citée ou donnée réelle du voyage). */
  reason: string;
  /** Poids réel connu (inventaire possédé) — sinon null, jamais estimé. */
  weightGrams: number | null;
}

/** Borne dure du nombre de recommandations contextuelles (sécurité/coût). */
export const MAX_KIT_RECOMMENDATIONS = 16;

/** Longueur maximale d'une raison persistée (alignée sur l'UI). */
export const MAX_REASON_LENGTH = 600;

const HIKING_ACTIVITIES = new Set(['hiking', 'trekking', 'bivouac', 'mixed', 'bushcraft']);
const BIVOUAC_ACTIVITIES = new Set(['bivouac']);

function clampReason(reason: string): string {
  const clean = reason.replace(/\s+/g, ' ').trim();
  return clean.length > MAX_REASON_LENGTH ? `${clean.slice(0, MAX_REASON_LENGTH - 1)}…` : clean;
}

function fmtNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function routeLabel(input: KitRecommendationInput): string {
  const name = input.route?.name?.trim();
  return name ? `parcours « ${name} »` : 'parcours retenu';
}

function routeMetrics(input: KitRecommendationInput): string | null {
  const parts: string[] = [];
  if (typeof input.route?.distanceKm === 'number' && input.route.distanceKm > 0) {
    parts.push(`${fmtNumber(input.route.distanceKm, 1)} km`);
  }
  if (typeof input.route?.elevationGainM === 'number' && input.route.elevationGainM > 0) {
    parts.push(`D+ ${fmtNumber(input.route.elevationGainM)} m`);
  }
  if (input.route?.difficulty) {
    parts.push(`difficulté ${input.route.difficulty}`);
  }
  return parts.length > 0 ? parts.join(', ') : null;
}

function durationLabel(input: KitRecommendationInput): string | null {
  if (typeof input.durationDays !== 'number' || input.durationDays <= 0) return null;
  return `${fmtNumber(input.durationDays)} jour${input.durationDays > 1 ? 's' : ''}`;
}

interface RecommendationContext {
  input: KitRecommendationInput;
  isHiking: boolean;
  isBivouac: boolean;
  partySize: number;
  days: number | null;
  metrics: string | null;
  duration: string | null;
  seasonMonth: number | null;
}

function sharedForGroup(context: RecommendationContext): KitItemOwnership {
  return context.partySize > 1 ? 'shared' : 'personal';
}

function baseRecommendation(
  context: RecommendationContext,
  seed: Omit<KitRecommendation, 'reason' | 'weightGrams' | 'quantity'> & {
    quantity?: number;
    reason: string;
  }
): KitRecommendation {
  return {
    key: seed.key,
    name: seed.name,
    category: seed.category,
    ownership: seed.ownership,
    priority: seed.priority,
    quantity: seed.quantity ?? 1,
    reason: clampReason(seed.reason),
    weightGrams: null,
  };
}

/**
 * Recommandations contextuelles triées par priorité (vitales d'abord).
 * Aucune règle ne s'applique sans contexte réel : sans activité ni parcours ni
 * durée, la liste est vide (aucune invention).
 */
export function buildKitRecommendations(input: KitRecommendationInput): KitRecommendation[] {
  const action: string | null = input.activity ?? null;
  const hasContext = Boolean(
    action ||
      input.route ||
      input.countryCode ||
      (typeof input.durationDays === 'number' && input.durationDays > 0)
  );
  if (!hasContext) return [];

  const context: RecommendationContext = {
    input,
    isHiking: action ? HIKING_ACTIVITIES.has(action) : false,
    isBivouac: action ? BIVOUAC_ACTIVITIES.has(action) : false,
    partySize: Math.max(1, Math.trunc(input.partySize ?? 1)),
    days:
      typeof input.durationDays === 'number' && input.durationDays > 0
        ? Math.trunc(input.durationDays)
        : null,
    metrics: routeMetrics(input),
    duration: durationLabel(input),
    seasonMonth:
      typeof input.seasonMonth === 'number' && input.seasonMonth >= 1 && input.seasonMonth <= 12
        ? Math.trunc(input.seasonMonth)
        : null,
  };

  const recommendations: KitRecommendation[] = [];
  const push = (recommendation: KitRecommendation) => {
    if (recommendations.some((entry) => entry.key === recommendation.key)) return;
    recommendations.push(recommendation);
  };

  // 1. Sécurité — trousse de premiers secours : règle permanente.
  push(
    baseRecommendation(context, {
      key: 'first-aid',
      name: 'Trousse de premiers secours',
      category: 'safety',
      ownership: sharedForGroup(context),
      priority: 'vital',
      reason: `Règle LKDV sécurité : trousse de premiers secours obligatoire pour toute sortie${
        context.metrics ? ` (${context.metrics})` : ''
      }.`,
    })
  );

  // 2. Navigation — dès qu'une activité de marche est engagée.
  if (context.isHiking) {
    push(
      baseRecommendation(context, {
        key: 'navigation',
        name: 'Carte / trace GPS hors-ligne',
        category: 'navigation',
        ownership: 'personal',
        priority: 'recommended',
        reason: `Règle LKDV : conserver la trace du ${routeLabel(input)}${
          context.metrics ? ` (${context.metrics})` : ''
        } disponible hors-ligne pour suivre l'itinéraire réel.`,
      })
    );
  }

  // 3. Éclairage frontal — toute activité hors journée simple.
  if (context.isHiking || (context.days != null && context.days >= 2)) {
    push(
      baseRecommendation(context, {
        key: 'headlamp',
        name: 'Lampe frontale',
        category: 'tech',
        ownership: 'personal',
        priority: 'recommended',
        reason: `Règle LKDV : éclairage frontal nécessaire pour tout départ ou retour hors jour${
          context.duration ? ` sur un voyage de ${context.duration}` : ''
        }.`,
      })
    );
  }

  // 4. Hydratation — capacité à citer la durée réelle.
  push(
    baseRecommendation(context, {
      key: 'water-capacity',
      name: 'Gourde ou réserve d’eau',
      category: 'water',
      ownership: 'personal',
      priority: 'recommended',
      reason: `Règle LKDV : autonomie hydrique personnelle${
        context.duration ? ` sur ${context.duration}` : ''
      }, à compléter selon les points de ravitaillement réellement prévus.`,
    })
  );

  // 5. Protection pluie — sortie longue ou activité en autonomie.
  if ((context.days != null && context.days >= 2) || context.isBivouac) {
    push(
      baseRecommendation(context, {
        key: 'rain-shell',
        name: 'Protection imperméable (veste ou poncho)',
        category: 'clothing',
        ownership: 'personal',
        priority: context.isBivouac ? 'vital' : 'recommended',
        reason: `Règle LKDV : protection pluie obligatoire${
          context.isBivouac ? ' en bivouac' : ''
        }${context.duration ? ` — sortie de ${context.duration} en autonomie` : ''}.`,
      })
    );
  }

  // 6. Abri & couchage — bivouac/trekking ou itinérance ≥ 3 jours.
  const needsShelter = context.isBivouac || action === 'trekking' || (context.days ?? 0) >= 3;
  if (needsShelter) {
    push(
      baseRecommendation(context, {
        key: 'shelter',
        name: 'Abri / tente pour le groupe',
        category: 'shelter',
        ownership: sharedForGroup(context),
        priority: context.isBivouac ? 'vital' : 'recommended',
        reason: `Règle LKDV : abri nécessaire${context.isBivouac ? ' en bivouac' : ''}${
          action === 'trekking' ? ' en trekking itinérant' : ''
        }${context.duration ? ` (${context.duration})` : ''}${
          context.partySize > 1 ? ` pour ${context.partySize} personnes` : ''
        }.`,
      })
    );
    push(
      baseRecommendation(context, {
        key: 'sleep-system',
        name: 'Sac de couchage et matelas isolant',
        category: 'sleep',
        ownership: 'personal',
        priority: context.isBivouac ? 'vital' : 'recommended',
        reason: `Règle LKDV : couchage individuel isolé du sol${
          context.isBivouac ? ' pour la nuit en bivouac' : ' pour la nuit en autonomie'
        }.`,
      })
    );
  }

  // 7. Cuisine partagée — dès 2 jours ou activité itinérante.
  if (context.isBivouac || action === 'trekking' || (context.days ?? 0) >= 2) {
    push(
      baseRecommendation(context, {
        key: 'stove',
        name: 'Réchaud et popote du groupe',
        category: 'cook',
        ownership: sharedForGroup(context),
        priority: 'recommended',
        reason: `Règle LKDV : moyen de cuisson${
          context.partySize > 1 ? ` partagé par ${context.partySize} personnes` : ''
        }${context.duration ? ` pour ${context.duration} en autonomie` : ''}.`,
      })
    );
  }

  // 8. Bâtons — données réelles du parcours (D+ / distance) ou durée.
  const gain = input.route?.elevationGainM ?? 0;
  const distance = input.route?.distanceKm ?? 0;
  if (gain >= 800 || distance >= 15 || (context.days ?? 0) >= 3) {
    push(
      baseRecommendation(context, {
        key: 'trekking-poles',
        name: 'Bâtons de marche',
        category: 'misc',
        ownership: 'personal',
        priority: 'recommended',
        reason:
          gain >= 800 || distance >= 15
            ? `Donnée du ${routeLabel(input)} : ${
                gain >= 800 ? `D+ ${fmtNumber(gain)} m` : `distance ${fmtNumber(distance, 1)} km`
              } — appui et protection des genoux en descente.`
            : `Règle LKDV : itinérance de ${context.duration} — appui recommandé en portage.`,
      })
    );
  }

  // 9. Batterie externe — voyage de 2 jours et plus.
  if ((context.days ?? 0) >= 2) {
    push(
      baseRecommendation(context, {
        key: 'powerbank',
        name: 'Batterie externe',
        category: 'tech',
        ownership: 'personal',
        priority: 'recommended',
        reason: `Règle LKDV : recharge du téléphone/GPS sur ${context.duration}${
          context.isHiking ? ` (navigation ${routeLabel(input)})` : ''
        }.`,
      })
    );
  }

  // 10. Filtration — autonomie de 3 jours ou plus, ou parcours ≥ 20 km.
  if ((context.days ?? 0) >= 3 || distance >= 20) {
    push(
      baseRecommendation(context, {
        key: 'water-filter',
        name: 'Filtre ou traitement de l’eau',
        category: 'water',
        ownership: 'personal',
        priority: 'recommended',
        reason:
          distance >= 20 && (context.days ?? 0) < 3
            ? `Donnée du ${routeLabel(input)} : ${fmtNumber(distance, 1)} km — prévoir un traitement de l'eau sur les sections sans point certifié.`
            : `Règle LKDV : autonomie de ${context.duration} — prévoir un traitement de l'eau entre deux ravitaillements.`,
      })
    );
  }

  // 11. Kit de réparation — sortie longue ou itinérante (partagé si groupe).
  if ((context.days ?? 0) >= 2 || context.isBivouac || action === 'trekking') {
    push(
      baseRecommendation(context, {
        key: 'repair-kit',
        name: 'Kit de réparation',
        category: 'misc',
        ownership: sharedForGroup(context),
        priority: 'recommended',
        reason: `Règle LKDV : réparation du matériel en autonomie${
          context.duration ? ` sur ${context.duration}` : ''
        }${context.partySize > 1 ? ` (kit partagé par ${context.partySize} personnes)` : ''}.`,
      })
    );
  }

  // 12. Couverture de survie — haute difficulté ou D+ élevé.
  if (context.isHiking) {
    const hardRoute = input.route?.difficulty === 'hard' || input.route?.difficulty === 'expert';
    push(
      baseRecommendation(context, {
        key: 'survival-blanket',
        name: 'Couverture de survie',
        category: 'safety',
        ownership: 'personal',
        priority: hardRoute || gain >= 1000 ? 'vital' : 'recommended',
        reason:
          hardRoute || gain >= 1000
            ? `Donnée du ${routeLabel(input)} : ${
                hardRoute ? `difficulté ${input.route?.difficulty}` : `D+ ${fmtNumber(gain)} m`
              } — isolation d'urgence en cas d'immobilisation.`
            : 'Règle LKDV sécurité : couverture de survie dans le kit individuel de toute randonnée.',
      })
    );
  }

  // 13. Protection solaire — randonnée de jour.
  if (context.isHiking) {
    push(
      baseRecommendation(context, {
        key: 'sun-protection',
        name: 'Protection solaire (chapeau, lunettes, crème)',
        category: 'safety',
        ownership: 'personal',
        priority: 'recommended',
        reason: `Règle LKDV : protection UV pour toute activité de marche en extérieur${
          context.seasonMonth && context.seasonMonth >= 5 && context.seasonMonth <= 9
            ? ` (départ au mois ${context.seasonMonth})`
            : ''
        }.`,
      })
    );
  }

  // 14. Traction névés/glace — règle pays ou difficulté déclarée du parcours.
  const icyCountry =
    input.countryCode === 'IS' || input.countryCode === 'NP' || input.countryCode === 'CH';
  const hardRoute = input.route?.difficulty === 'hard' || input.route?.difficulty === 'expert';
  if (icyCountry || hardRoute) {
    push(
      baseRecommendation(context, {
        key: 'crampons',
        name: 'Traction névés / glace',
        category: 'clothing',
        ownership: 'personal',
        priority: 'recommended',
        reason: `Règle LKDV terrain froid : ${
          icyCountry ? `pays ${input.countryCode} (névés/glace possibles)` : `difficulté ${input.route?.difficulty} du parcours`
        } — traction à vérifier selon les conditions réelles avant départ.`,
      })
    );
  }

  const priorityWeight: Record<KitItemPriority, number> = {
    vital: 0,
    recommended: 1,
    optional: 2,
  };
  recommendations.sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority]);
  return recommendations.slice(0, MAX_KIT_RECOMMENDATIONS);
}

/** Normalise un libellé pour comparer recommandations et contenu du kit. */
export function normalizeKitItemName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Mots-clés de recouvrement entre une recommandation et un item existant. */
const RECOMMENDATION_KEYWORDS: Record<string, string[]> = {
  'first-aid': ['trousse de secours', 'trousse de premiers', 'pharmacie', 'trousse pharmacie'],
  navigation: ['carte', 'gps', 'boussole', 'trace', 'navigation'],
  headlamp: ['lampe', 'frontale', 'torche', 'eclairage'],
  'water-capacity': ['gourde', 'bouteille', 'eau', 'thermos', 'reserve'],
  'rain-shell': ['veste', 'poncho', 'impermeable', 'pluie', 'coupe vent'],
  shelter: ['tente', 'abri', 'shelter', 'bivouac'],
  'sleep-system': ['couchage', 'duvet', 'matelas', 'drap de sac', 'sleeping'],
  stove: ['rechaud', 'popote', 'cuisine', 'gamelle', 'gaz'],
  'trekking-poles': ['baton', 'batons', 'pole'],
  powerbank: ['batterie', 'powerbank', 'power bank', 'charge'],
  'water-filter': ['filtre', 'traitement', 'micropur', 'purif'],
  'repair-kit': ['reparation', 'repar', 'collier', 'jokari'],
  'survival-blanket': ['couverture de survie', 'survie'],
  'sun-protection': ['solaire', 'chapeau', 'lunettes', 'creme'],
  crampons: ['crampons', 'traction', 'neve', 'glace'],
};

/** Vrai si le kit contient déjà un item couvrant la recommandation. */
export function kitContainsRecommendation(
  existingNames: string[],
  recommendation: Pick<KitRecommendation, 'key' | 'name'>
): boolean {
  const keywords = RECOMMENDATION_KEYWORDS[recommendation.key] ?? [];
  const normalizedExisting = existingNames.map(normalizeKitItemName);
  const normalizedName = normalizeKitItemName(recommendation.name);
  return normalizedExisting.some((name) => {
    if (name === normalizedName) return true;
    return keywords.some((keyword) => name.includes(normalizeKitItemName(keyword)));
  });
}

/**
 * Rapprochement conservateur item de kit ↔ matériel possédé (inventaire).
 * Aucun faux positif volontaire : égalité normalisée, inclusion d'un libellé
 * d'au moins 6 caractères, ou recouvrement d'au moins 2 mots significatifs
 * (préfixes ≥ 4 caractères). Sert uniquement à marquer « possédé » quand la
 * correspondance est forte — jamais à inventer un stock.
 */
export function matchesOwnedItemName(itemName: string, ownedName: string): boolean {
  const item = normalizeKitItemName(itemName);
  const owned = normalizeKitItemName(ownedName);
  if (!item || !owned) return false;
  if (item === owned) return true;
  if (item.length >= 6 && owned.includes(item)) return true;
  if (owned.length >= 6 && item.includes(owned)) return true;

  const itemTokens = item.split(' ').filter((token) => token.length >= 4);
  const ownedTokens = owned.split(' ').filter((token) => token.length >= 4);
  if (itemTokens.length === 0 || ownedTokens.length === 0) return false;
  const shared = itemTokens.filter((token) =>
    ownedTokens.some(
      (ownedToken) =>
        token === ownedToken ||
        token.startsWith(ownedToken) ||
        ownedToken.startsWith(token)
    )
  );
  return shared.length >= 2;
}

/**
 * Mots-clés STRICTS de correspondance inventaire par recommandation : évite
 * les faux positifs du type « lampe de chevet » pour une lampe frontale.
 */
const OWNED_MATCH_KEYWORDS: Record<string, string[]> = {
  'first-aid': ['trousse de secours', 'trousse de premiers', 'pharmacie', 'trousse pharmacie'],
  navigation: ['gps', 'boussole', 'carte topographique', 'carte ign'],
  headlamp: ['frontale', 'lampe frontale', 'torche'],
  'water-capacity': ['gourde', 'bouteille', 'thermos', 'poche a eau'],
  'rain-shell': ['poncho', 'veste impermeable', 'veste de pluie', 'veste pluie', 'gore tex'],
  shelter: ['tente', 'abri', 'hamac', 'tarp'],
  'sleep-system': [
    'sac de couchage',
    'drap de sac',
    'matelas',
    'sleeping bag',
    'couverture de randonnee',
  ],
  stove: ['rechaud', 'popote', 'gamelle'],
  'trekking-poles': ['baton', 'batons', 'pole trekking'],
  powerbank: ['powerbank', 'power bank', 'batterie externe'],
  'water-filter': ['filtre', 'micropur', 'purificateur', 'sawyer', 'katadyn'],
  'repair-kit': ['kit de reparation', 'jokari', 'colliers de cable', 'reparation'],
  'survival-blanket': ['couverture de survie'],
  'sun-protection': ['lunettes de soleil', 'creme solaire', 'chapeau'],
  crampons: ['crampons', 'microspikes', 'couteaux a neige', 'traction'],
};

/**
 * Vrai si un item de kit correspond à un matériel réellement possédé.
 * `recommendationKey` (si l'item vient d'une règle contextuelle) active en plus
 * les mots-clés stricts de la recommandation.
 */
export function kitItemMatchesOwned(
  itemName: string,
  ownedName: string,
  recommendationKey?: string | null
): boolean {
  if (matchesOwnedItemName(itemName, ownedName)) return true;
  if (!recommendationKey) return false;
  const keywords = OWNED_MATCH_KEYWORDS[recommendationKey] ?? [];
  if (keywords.length === 0) return false;
  const owned = normalizeKitItemName(ownedName);
  return keywords.some((keyword) => owned.includes(normalizeKitItemName(keyword)));
}

// ── Classification de complétude (personnel / partagé / manquant) ────────────

export interface KitCompletenessItem {
  ownership?: KitItemOwnership | string | null;
  status?: string | null;
  purchase_state?: string | null;
  weight_grams?: number | string | null;
  quantity?: number | string | null;
  is_packed?: boolean | null;
}

export interface KitCompletenessSummary {
  totalCount: number;
  personalCount: number;
  sharedCount: number;
  missingCount: number;
  packedCount: number;
  knownWeightGrams: number;
  unweighedCount: number;
}

export interface KitCompletenessBuckets<T extends KitCompletenessItem> {
  personal: T[];
  shared: T[];
  missing: T[];
  summary: KitCompletenessSummary;
}

/**
 * Classe les items du voyage :
 *   • manquant : `status = 'missing'` (posé uniquement par le serveur quand le
 *     matériel n'est ni dans l'inventaire ni dans le sac) ;
 *   • partagé : `ownership = 'shared'` ;
 *   • personnel : tout le reste.
 * Le poids connu est la somme `weight × quantity` des seuls poids renseignés.
 */
export function classifyKitCompleteness<T extends KitCompletenessItem>(
  items: T[]
): KitCompletenessBuckets<T> {
  const personal: T[] = [];
  const shared: T[] = [];
  const missing: T[] = [];
  let knownWeightGrams = 0;
  let unweighedCount = 0;
  let packedCount = 0;

  for (const item of items) {
    if (item.is_packed) packedCount++;
    const weight = Number(item.weight_grams);
    const quantity = Number(item.quantity);
    if (item.weight_grams === null || item.weight_grams === undefined || !Number.isFinite(weight)) {
      unweighedCount++;
    } else {
      knownWeightGrams += weight * (Number.isFinite(quantity) && quantity > 0 ? quantity : 1);
    }

    if (item.status === 'missing') {
      missing.push(item);
      continue;
    }
    if (item.ownership === 'shared') {
      shared.push(item);
    } else {
      personal.push(item);
    }
  }

  return {
    personal,
    shared,
    missing,
    summary: {
      totalCount: items.length,
      personalCount: personal.length,
      sharedCount: shared.length,
      missingCount: missing.length,
      packedCount,
      knownWeightGrams: Math.round(knownWeightGrams),
      unweighedCount,
    },
  };
}
