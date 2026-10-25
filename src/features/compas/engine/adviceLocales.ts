/**
 * Conseils de l'IA en espagnol, allemand, italien (PLAN-100 6.2) : motifs des thèmes déjà couverts par
 * les règles (le conseil de l'IA qui les redit est écarté) et mention « IA ». Les motifs de gauche sont
 * ceux des règles, écrites en français ; seul le motif du conseil change. Fichier de motifs, hors du lot
 * verrouillé « zéro français en dur » (les motifs de gauche en sont).
 */

/** Les mêmes thèmes en espagnol, allemand et italien (PLAN-100 6.2). */
const TOPICS_ES: Array<[RegExp, RegExp]> = [
  [/2 500 m/, /\b(altitud|aclimata\w*|mal de altura)\b/i],
  [/avalanche/, /\bavalanchas?\b|\ballud\w*/i],
  [/orages/, /\btormentas?\b|\brayos?\b/i],
  [/refuge/, /\brefugios?\b/i],
  [/Bivouac/, /\b(vivac|vivaquear|acampada libre)\b/i],
  [/Rivière/, /\b(chalecos? salvavidas|nivel del agua|caudal)\b/i],
  [/Seul·e/, /\b(solo|sola|a solas|112)\b/i],
  [/traite-la/, /\b(filtr\w*|pastillas|potable|potabiliz\w*|hervir)\b/i],
];
const TOPICS_DE: Array<[RegExp, RegExp]> = [
  [/2 500 m/, /\b(höhe|höhenkrankheit|akklimati\w*|akklimatisier\w*)\b/i],
  [/avalanche/, /\blawine\w*|\blawinen\w*/i],
  [/orages/, /\bgewitter\w*|\bblitz\w*/i],
  [/refuge/, /\b(hütte|hütten|berghütte\w*)\b/i],
  [/Bivouac/, /\b(biwak\w*|wildcamp\w*)\b/i],
  [/Rivière/, /\b(schwimmweste\w*|rettungsweste\w*|wasserstand|pegel)\b/i],
  [/Seul·e/, /\b(allein\w*|solo|112)\b/i],
  [/traite-la/, /\b(filter\w*|tabletten|trinkbar|trinkwasser|abkochen|aufbereit\w*)\b/i],
];
const TOPICS_IT: Array<[RegExp, RegExp]> = [
  [/2 500 m/, /\b(altitudine|acclimata\w*|mal di montagna)\b/i],
  [/avalanche/, /\bvalanghe?\b/i],
  [/orages/, /\btemporal\w*|\bfulmin\w*/i],
  [/refuge/, /\brifugi\w*|\brifugio\b/i],
  [/Bivouac/, /\bbivacc\w*|\bcampeggio libero\b/i],
  [/Rivière/, /\b(giubbott\w*|salvagente|livello dell.acqua|portata)\b/i],
  [/Seul·e/, /\b(da sol[oa]|solitari\w*|112)\b/i],
  [/traite-la/, /\b(filtr\w*|pastiglie|potabil\w*|potabilizz\w*|bollire)\b/i],
];
export const AI_SUGGESTION_PREFIX_ES = 'Sugerencia de la IA (opcional): ';
export const AI_SUGGESTION_PREFIX_DE = 'KI-Vorschlag (optional): ';
export const AI_SUGGESTION_PREFIX_IT = 'Suggerimento dell’IA (facoltativo): ';

type Topics = Array<[RegExp, RegExp]>;

export function topicsFor(locale: 'fr' | 'en' | 'es' | 'de' | 'it', fr: Topics, en: Topics): Topics {
  return { fr, en, es: TOPICS_ES, de: TOPICS_DE, it: TOPICS_IT }[locale];
}
