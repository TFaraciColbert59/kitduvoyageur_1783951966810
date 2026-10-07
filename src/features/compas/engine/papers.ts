/**
 * Compas — papiers, monnaie et prises pour un voyageur français, par règles.
 *
 * L'IA écrivait « pense à ton passeport » pour le Portugal. Les papiers sont
 * décidés ici, sur des listes sûres ; ailleurs on renvoie à France Diplomatie
 * plutôt que d'affirmer. Les conseils de l'IA qui en parlent sont écartés.
 */

import { entryFees } from './costs';

export type PapersKind = 'domestique' | 'carte' | 'passeport' | 'a_verifier';

export interface TravelPapers {
  papers: PapersKind | null;
  /** Euro sur place (pas de change), null si le pays est inconnu. */
  euro: boolean | null;
  /** Les prises françaises (C, E, F) s'y branchent sans adaptateur. */
  frenchPlugs: boolean | null;
  notes: string[];
}

const set = (codes: string) => new Set(codes.split(' '));

/** France et outre-mer. */
const DOMESTIC = set('FR RE GP MQ GF YT PM BL MF NC PF WF');

/** La carte d'identité française suffit : UE, EEE, Suisse, micro-États, Balkans occidentaux. */
const ID_CARD = set(
  'AT BE BG HR CY CZ DK EE FI DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH AD MC SM VA AL BA ME MK RS'
);

/** Europe hors des listes sûres : on n'affirme rien, on renvoie à France Diplomatie. */
const EUROPE_TO_CHECK = set('TR GE MD UA BY RU AM AZ XK FO GL GI IM JE GG SJ');

/** Euro (Bulgarie depuis le 1er janvier 2026). */
const EURO = set(
  'FR RE GP MQ GF YT PM BL MF AT BE BG HR CY EE FI DE GR IE IT LV LT LU MT NL PT SK SI ES AD MC SM VA ME XK'
);

/** Prises incompatibles connues : l'adaptateur est dit par la règle. */
const PLUGS: Record<string, string> = {
  GB: 'G', IE: 'G', MT: 'G', CY: 'G',
  US: 'A/B', CA: 'A/B', MX: 'A/B', JP: 'A/B',
  AU: 'I', NZ: 'I',
};

/** Prises C, E, F : rien à dire, et l'IA ne doit pas parler d'adaptateur. */
const FRENCH_PLUGS = set(
  'FR RE GP MQ GF YT PM BL MF AT BE BG HR CZ DK EE FI DE GR HU IT LV LT LU NL PL PT RO SK SI ES SE IS LI NO CH AD MC SM VA AL BA ME MK RS MA TN DZ TR'
);

export function travelPapers(countryCode: string | null | undefined, countryName?: string | null): TravelPapers {
  const cc = (countryCode ?? '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return { papers: null, euro: null, frenchPlugs: null, notes: [] };
  const where = countryName || cc;
  const notes: string[] = [];
  let papers: PapersKind;
  if (DOMESTIC.has(cc)) papers = 'domestique';
  else if (ID_CARD.has(cc)) {
    papers = 'carte';
    notes.push(`Papiers : carte d’identité ou passeport en cours de validité, sans visa (${where}).`);
  } else {
    const fee = entryFees(cc);
    if (fee) {
      papers = 'passeport';
      notes.push(`Papiers : passeport + ${fee.detail}, conditions à vérifier sur France Diplomatie avant de partir.`);
    } else if (EUROPE_TO_CHECK.has(cc)) {
      papers = 'a_verifier';
      notes.push(`Papiers : conditions d’entrée (${where}) à vérifier sur France Diplomatie avant de partir.`);
    } else {
      papers = 'passeport';
      notes.push(`Papiers : passeport (${where}), conditions d’entrée à vérifier sur France Diplomatie avant de partir.`);
    }
  }
  const plug = PLUGS[cc];
  if (plug) notes.push(`Prises de type ${plug} : adaptateur à prévoir.`);
  return {
    papers,
    euro: EURO.has(cc),
    frenchPlugs: plug ? false : FRENCH_PLUGS.has(cc) ? true : null,
    notes,
  };
}

const PAPERS_RE = /passeport|carte d[’']identit|\bvisas?\b|e-visa|formalit|autorisation (de voyage|électronique)/i;
const PAPERS_ACRONYM_RE = /\b(ESTA|ETA|eTA|NZeTA|AVE)\b/;
const MONEY_RE = /bureau de change|taux de change|devises?\b|monnaie locale|changer (de l[’'])?argent|changer (tes |vos |des )?euros|change tes euros|change vos euros/i;
const PLUG_RE = /adaptateur|prises? (électriques?|de type)/i;

/** Un conseil de l'IA est gardé s'il ne contredit pas, ou ne double pas, une règle connue. */
export function keepAiNote(note: string, rules: TravelPapers): boolean {
  if (rules.papers == null) return true;
  if (PAPERS_RE.test(note) || PAPERS_ACRONYM_RE.test(note)) return false;
  if (rules.euro && MONEY_RE.test(note)) return false;
  if (rules.frenchPlugs != null && PLUG_RE.test(note)) return false;
  return true;
}
