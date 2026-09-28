import type { ItineraryStepKind } from '../types';

// Le vocabulaire des types d etape, en version stricte et en version tolerante.
//
// Mesure live du 2026-09-28 : le modele a repondu « arrivee » et « randonnee ».
// Le schema n'accepte que les cinq types canoniques, donc la reponse entiere
// a ete refusee et le parcours est tombe sur le repli regles — dont les etapes
// n'ont aucune coordonnee, donc aucune distance mesurable, donc « a verifier »
// partout. Le prompt corrige la cause ; ce module traite le symptome, parce
// qu'aucun modele n'est assez fiable pour qu'on puisse lui faire confiance
// sans filet.
//
// Le filet est volontairement etroit : on ne traduit que des synonymes
// evidents, et tout ce qu on ne sait pas classer est refuse. Rapprocher un
// type inconnu d un type qui existe serait inventer une categorie — le
// contraire exact de ce que l'ecran promet.

const CANONICAL: readonly ItineraryStepKind[] = [
  'trajet',
  'arret',
  'repos',
  'nuit',
  'ravitaillement',
];

// Synonymes releves sur des reponses de modele. Aucun n introduce de sens
// nouveau : chacun designe une categorie deja couverte par un type canonique.
const SYNONYMS: Readonly<Record<string, ItineraryStepKind>> = {
  deplacement: 'trajet',
  deplacements: 'trajet',
  trajet: 'trajet',
  route: 'trajet',
  retour: 'trajet',
  aller: 'trajet',
  depart: 'trajet',
  marche: 'trajet',
  arrivee: 'arret',
  etape: 'arret',
  activite: 'arret',
  activites: 'arret',
  visite: 'arret',
  randonnee: 'arret',
  tournee: 'arret',
  decouverte: 'arret',
  panorama: 'arret',
  sommet: 'arret',
  bivouac: 'nuit',
  hebergement: 'nuit',
  refuge: 'nuit',
  dodo: 'nuit',
  couchage: 'nuit',
  pause: 'repos',
  halte: 'repos',
  sieste: 'repos',
  repos: 'repos',
  repas: 'ravitaillement',
  restaurant: 'ravitaillement',
  picnic: 'ravitaillement',
  casse: 'ravitaillement',
};

// Normalise pour comparer : minuscules, sans accent, separateurs unis.
function canonicaliser(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const INDEXE: ReadonlyMap<string, ItineraryStepKind> = (() => {
  const map = new Map<string, ItineraryStepKind>();
  CANONICAL.forEach((kind) => map.set(canonicaliser(kind), kind));
  Object.entries(SYNONYMS).forEach(([alias, kind]) => map.set(canonicaliser(alias), kind));
  return map;
})();

// Ramene un type propose par le modele a un type canonique.
//
// La valeur null signifie : je ne sais pas classer. L appelant laisse alors
// la reponse etre refusee plutot que d afficher une categorie choisie au hasard.
export function normalizeStepKind(value: string | null | undefined): ItineraryStepKind | null {
  if (typeof value !== 'string') return null;
  const key = canonicaliser(value);
  if (key.length === 0) return null;
  const exact = INDEXE.get(key);
  if (exact) return exact;

  // Forme composee : « ravitaillement_alimentaire », « hebergement_refuge ».
  // On ne tente que des PREFIXES de mots, et seulement si le PREMIER mot est
  // deja connu. C est ce qui borne la regle : « traversee » ne commence par
  // aucun mot connu, donc reste refuse, alors que « randonnee_en_famille »
  // rejoint « randonnee ». Sans cette borne, une correspondance floue
  // ramasserait n'importe quoi et reviendrait a deviner.
  const mots = key.split('_');
  for (let taille = mots.length - 1; taille >= 1; taille -= 1) {
    const prefixe = mots.slice(0, taille).join('_');
    if (taille === 1 && !INDEXE.has(prefixe)) return null;
    const trouve = INDEXE.get(prefixe);
    if (trouve) return trouve;
  }
  return null;
}
