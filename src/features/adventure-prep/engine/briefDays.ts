/**
 * Duree du voyage — ce que le brief DEMANDE, et ce que l IA PROPOSE. P0.18.
 *
 * Constat qui a ouvert ce fichier (proof/P018-01-phase-reelle.png, regarde) :
 * le brief « Week-end de randonnee au depart de Chamonix, refuge la premiere
 * nuit » a produit **1 jour, 1 seule etape** de nature `trajet`. Le brief part
 * bien vers le modele (`aiItinerary.ts`), mais le nombre de jours venait du
 * SEUL calendrier : aucune date choisie donc `durationDays` a 1, le prompt
 * annoncait « Duree : 1 jour(s) », et le modele avait donc raison de tenir 1.
 *
 * Le modele ne se trompait pas. C est la question qui n etait pas posee.
 *
 * Deux regles, et aucune invention :
 *   1. le brief peut NOMMER une duree ; on la lit, sans jamais la deviner ;
 *   2. quand la personne n a rien choisi, l IA choisit — exactement comme pour
 *      la date (P0.15). Une duree proposee reste une PROPOSITION : l ecran la
 *      badgee, la personne peut la changer.
 */

import type { AdventurePrepDraft, CalendarBlock } from '../types';
import { isoPlusDays } from './calendar';

/**
 * Borne haute. Elle ne vient pas de nous : `MAX_ITINERARY_DAYS` vaut 30 parce
 * que le schema de sortie refuse un plan de plus de 30 jours et que le prompt
 * l annonce. Proposer 40 jours produirait donc un plan que le modele ne peut
 * pas rendre — une proposition impossible, donc une duree qui ment.
 */
export const MAX_SUGGESTED_DAYS = 30;

/* ------------------------------------------------------------------ */
/* 1. Ce que le brief demande                                          */
/* ------------------------------------------------------------------ */

/** Les nombres en lettres qu une personne ecrit en toutes lettres. */
const WORD_NUMBERS: Readonly<Record<string, number>> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
};

const COUNT = '(\\d{1,2}|une?|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)';
/** « 3 jours », « trois journees » — le journee et le jour comptent pareil. */
const DAY_UNIT = '(?:jours?|journees?)';
const WEEK_UNIT = '(?:semaines?)';

function countOf(raw: string): number {
  if (/^\d+$/.test(raw)) return Number(raw);
  return WORD_NUMBERS[raw] ?? 0;
}

/**
 * Minuscules, sans accents, espaces contractes.
 *
 * Sans accents parce que l utilisateur ecrit « journée » avec l accent et que
 * le motif doit rester lisible ; les motifs ci-dessous n acceptent que des
 * caracteres ASCII, donc « journee » sans accent est la seule forme vue.
 */
function normalize(brief: string): string {
  return brief
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Nombre de jours que le brief DEMANDE, ou `null` quand il n en nomme aucun.
 *
 * `null` veut dire « le brief est muet », ce n est jamais « un jour ». Confondre
 * les deux recreerait exactement le bug qu on corrige : un brief « randonnee a
 * Chamonix » ne doit pas produire une duree d une journee.
 *
 * Les NUITS sont volontairement ignorees : « 2 nuits » signifie deux nuits, soit
 * trois jours. Convertir donnerait un parcours faux d un jour, donc on ne
 * rend aucun nombre et l IA tranche.
 */
export function briefRequestedDays(brief: string | null | undefined): number | null {
  if (typeof brief !== 'string') return null;
  const text = normalize(brief);
  if (text.length === 0) return null;

  // Un nombre explicite l'emporte toujours : « un week-end de 3 jours » est
  // trois jours, pas deux.
  const explicitDays = text.match(new RegExp(`${COUNT}\\s*${DAY_UNIT}`));
  if (explicitDays !== null) {
    const days = countOf(explicitDays[1]);
    if (days >= 1) return Math.min(MAX_SUGGESTED_DAYS, days);
  }

  const explicitWeeks = text.match(new RegExp(`${COUNT}\\s*${WEEK_UNIT}`));
  if (explicitWeeks !== null) {
    const weeks = countOf(explicitWeeks[1]);
    if (weeks >= 1) return Math.min(MAX_SUGGESTED_DAYS, weeks * 7);
  }

  // « week-end » et « weekend » : deux jours par definition, et c est la seule
  // deduction que l on s autorise — elle ne repose sur aucun nombre absent.
  if (/(^|[^a-z])week[\s-]?ends?([^a-z]|$)/.test(text)) return 2;

  return null;
}

/* ------------------------------------------------------------------ */
/* 2. Ce que l IA propose                                              */
/* ------------------------------------------------------------------ */

/**
 * La duree proposee par l IA est-elle recevable ?
 *
 * Un seul refus : un entier dans `1..MAX_SUGGESTED_DAYS`. Le zero et les
 * negatives sont exclus parce qu une duree nulle produirait un ecran sans
 * programme, et une duree de 61 jours une session de reservation impossible.
 */
export function acceptSuggestedDurationDays(
  value: number | null | undefined,
): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < 1 || value > MAX_SUGGESTED_DAYS) return null;
  return value;
}

/**
 * Renvoie un NOUVEAU brouillon dont la duree est celle proposee.
 *
 * Meme regle que `suggestStartDate` : une duree saisie a la main est
 * intouchable (`durationIsSuggested === false` avec une valeur presente), et
 * seule une ancienne proposition peut etre recalee. Une proposition refusee ne
 * touche a rien — le meme objet part, donc ni re-rendu ni autosave pour une
 * duree qui n a pas ete retenue.
 */
export function suggestDurationDays(
  draft: AdventurePrepDraft,
  value: number | null | undefined,
): AdventurePrepDraft {
  const { calendar } = draft;
  const alreadyChosen = calendar.durationDays !== null && !calendar.durationIsSuggested;
  if (alreadyChosen) return draft;

  const accepted = acceptSuggestedDurationDays(value);
  if (accepted === null) return draft;

  const next: CalendarBlock = {
    ...calendar,
    durationDays: accepted,
    durationIsSuggested: true,
    returnDate:
      calendar.startDate !== null
        ? isoPlusDays(calendar.startDate, accepted - 1)
        : calendar.returnDate,
  };

  return { ...draft, calendar: next };
}
