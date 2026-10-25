/**
 * Extraction d'intention - 100 % deterministe, aucun LLM.
 *
 * L'IA n'invente jamais : on ne "devine" pas une destination, on la
 * RECONNAIT dans la phrase. Si aucune destination n'est reconnue, on rend
 * la destination par defaut et on l'assume explicitement (champ `fallback`),
 * plutot que de fabriquer un lieu plausible.
 */

import type { ConstraintId, Destination, IntentionProfile } from './types';

export interface DestinationDef extends Destination {
  /** Motifs de reconnaissance, normalises en minuscules sans accents. */
  match: readonly string[];
  /** Valeur par defaut quand aucune destination n'est reconnue. */
  fallback?: boolean;
}

function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export const DESTINATIONS: readonly DestinationDef[] = [
  {
    id: 'dolomites',
    name: 'Dolomites',
    region: 'Tre Cime',
    countryCode: 'IT',
    paceKmh: 4.2,
    match: ['dolomit', 'itali', 'alpe', 'alp', 'tre cime', 'south tyrol', 'tyrol'],
    fallback: true,
    anchors: [
      'Cortina - marche materiel',
      'Refuge Lavaredo',
      'Tre Cime di Lavaredo',
      'Refuge Locatelli - nuit',
      'Lacs de Misurina',
      'Retour sans voiture',
    ],
  },
  {
    id: 'perou',
    name: 'Perou',
    region: 'Cordillere de Vilcabamba',
    countryCode: 'PE',
    paceKmh: 3.6,
    match: ['perou', 'peru', 'cordillera', 'vilcabamba', 'salkantay', 'cusco', 'machu picchu'],
    anchors: [
      'Cusco - acclimatation',
      'Salkantay - col 4 630 m',
      'Santa Teresa - vallee chaude',
      'Aguas Calientes',
      'Machu Picchu - lever du soleil',
    ],
  },
  {
    id: 'sahara',
    name: 'Desert',
    region: 'Zagora',
    countryCode: 'MA',
    paceKmh: 3.9,
    match: ['desert', 'maroc', 'sahara', 'zagora', 'merzouga', 'chigaga'],
    anchors: ['Ouarzazate', 'Dunes de Chigaga', 'Bivouac', "Puits de l'erg", 'Retour Zagora'],
  },
  {
    id: 'lofoten',
    name: 'Lofoten',
    region: 'Norvege',
    countryCode: 'NO',
    paceKmh: 4.4,
    match: ['norvege', 'norv', 'fjord', 'lofot', 'reine', 'svolvaer', 'arctic'],
    anchors: ['Svolvaer', 'Reine - rorbuer', 'Kvalvika - plage', 'Refuge Munkebu', 'Sommaroy'],
  },
  {
    id: 'alpes',
    name: 'Alpes',
    region: 'Chamonix - Mer de Glace',
    countryCode: 'FR',
    paceKmh: 4.5,
    match: ['chamonix', 'mer de glace', 'aiguille', 'alpe du grand', 'haute savoie'],
    anchors: [
      'Chamonix - marche materiel',
      'Aiguille du Midi',
      'Refuge du Couvercle',
      'Mer de Glace',
      'Lac Blanc',
    ],
  },
  {
    id: 'pyrenees',
    name: 'Pyrenees',
    region: 'Gavarnie - Ordesa',
    countryCode: 'FR',
    paceKmh: 4.1,
    match: ['pyrenee', 'gavarnie', 'ordesa', 'pic du midi', 'aneto', 'camping'],
    anchors: [
      'Gavarnie - Troumouse',
      'Col de la Cascade',
      'Bivouac des Oulettes',
      'Cirque de Gavarnie',
      'Ordesa - Minjeta',
    ],
  },
] as const;

/** Destination de repli : Dolomites, comme dans le prototype de reference. */
export const FALLBACK_DESTINATION_ID = 'dolomites';

interface ConstraintMatcher {
  id: ConstraintId;
  match: readonly string[];
}

const CONSTRAINT_MATCHERS: readonly ConstraintMatcher[] = [
  {
    id: 'sans_voiture',
    match: ['sans voiture', 'sans voiture', 'pas de voiture', 'a pied', 'sans voiture'],
  },
  { id: 'refuges', match: ['refuge', 'refuges', 'gite', 'gites', 'nuit en refuge'] },
  {
    id: 'peu_expose',
    match: ['peu expose', 'peu expos', 'abri', 'abrite', 'sous bois', 'peu expose'],
  },
  {
    id: 'itineraire_ulturel',
    match: ['culturel', 'culturelle', 'patrimoine', 'musée', 'musee', 'ville', 'villes'],
  },
  { id: 'avec_enfants', match: ['enfant', 'enfants', 'famille', 'familial', 'bebe'] },
  { id: 'budget_maitrise', match: ['budget', 'pas cher', 'economique', 'econome', 'petit budget'] },
  { id: 'public', match: ['public', 'groupe', 'famille nombreuse'] },
  { id: 'avance', match: ['avance', 'expert', 'technique', 'sportif', 'fast'] },
] as const;

const BUDGET_PATTERN = /(\d[\d\s.,]*)\s*(?:€|eurs?|euros?)/i;

/**
 * Analyse l'intention brute et rend un profil 100 % deterministe.
 * Meme phrase en entree -> meme sortie, sur n'importe quelle machine.
 */
export function analyzeIntention(raw: string): IntentionProfile {
  const text = normalize(raw ?? '');
  const trimmed = (raw ?? '').trim();

  const destination =
    DESTINATIONS.find((candidate) => candidate.match.some((needle) => text.includes(needle))) ??
    DESTINATIONS.find((candidate) => candidate.fallback) ??
    DESTINATIONS[0];

  const constraints: ConstraintId[] = [];
  for (const matcher of CONSTRAINT_MATCHERS) {
    if (matcher.match.some((needle) => text.includes(needle))) {
      if (!constraints.includes(matcher.id)) constraints.push(matcher.id);
    }
  }

  let budgetMaxEur: number | null = null;
  const budgetMatch = trimmed.match(BUDGET_PATTERN);
  if (budgetMatch) {
    const parsed = Number.parseFloat(
      budgetMatch[1].replace(/[\s.,]/g, '').replace(/,(?=\d{3}\b)/g, '')
    );
    if (Number.isFinite(parsed) && parsed > 0) budgetMaxEur = Math.round(parsed);
  }

  return {
    raw: trimmed,
    destination: {
      id: destination.id,
      name: destination.name,
      region: destination.region,
      countryCode: destination.countryCode,
      anchors: destination.anchors,
      paceKmh: destination.paceKmh,
    },
    constraints,
    budgetMaxEur,
  };
}

/** L'intention a-t-elle vraiment ete reconnue, ou est-ce le repli ? */
export function isRecognizedIntention(profile: IntentionProfile): boolean {
  const text = normalize(profile.raw);
  if (!text) return false;
  const def = DESTINATIONS.find((candidate) => candidate.id === profile.destination.id);
  return Boolean(def?.match.some((needle) => text.includes(needle)));
}
