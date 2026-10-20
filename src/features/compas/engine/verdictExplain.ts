/**
 * Compas — explication du verdict par l'IA : faits d'entrée et garde-fous.
 *
 * Le moteur décide (niveau, signaux) ; l'IA ne fait que reformuler ces faits en
 * deux ou trois phrases. Le texte rendu est REFUSÉ s'il :
 * - cite un nombre absent des faits (un chiffre inventé est une donnée inventée) ;
 * - parle de score ou de note (le Compas n'en donne aucun) ;
 * - rassure au-delà des faits (« sans danger », « aucun risque »…).
 * Fonctions pures, testées sans réseau.
 */

import type { DangerAssessment, DangerAxis } from './danger';

export type VerdictLevel = 'go' | 'vigilance' | 'bloque' | 'incomplet';

export const VERDICT_LEVEL_LABEL: Record<VerdictLevel, string> = {
  go: 'Prêt sur les points vérifiés',
  vigilance: 'Vigilance',
  bloque: 'Bloquant',
  incomplet: 'Incomplet',
};

const AXIS_LABEL: Record<DangerAxis, string> = {
  physique: 'Physique',
  technique: 'Technique',
  conjoncturel: 'Conjoncturel',
};

const AXIS_LEVEL: Record<DangerAssessment['axes'][DangerAxis]['level'], string> = {
  ok: 'rien de signalé',
  vigilance: 'vigilance',
  bloque: 'bloquant',
  non_evalue: 'non évalué',
};

export interface VerdictFactsInput {
  level: VerdictLevel;
  reasons: Array<{ label: string; severity: string; source: string }>;
  danger: DangerAssessment;
}

/**
 * Les faits, une ligne chacun, tels qu'ils sont donnés au modèle ET relus par
 * le validateur : un nombre est « sourcé » s'il figure dans ce texte.
 */
export function verdictFacts(input: VerdictFactsInput): string {
  const lines = [`Niveau décidé par le moteur : ${VERDICT_LEVEL_LABEL[input.level]}.`];
  const dated = new Map(input.danger.signals.map((s) => [`${s.source}|${s.label}`, s.asOf]));
  for (const r of input.reasons.slice(0, 12)) {
    const asOf = dated.get(`${r.source}|${r.label}`);
    lines.push(`- ${r.label} (source : ${r.source}${asOf ? `, ${asOf.slice(0, 10)}` : ''}).`);
  }
  if (input.reasons.length === 0) lines.push('- Aucun signal bloquant ni point de vigilance.');
  for (const axis of ['physique', 'technique', 'conjoncturel'] as const) {
    const a = input.danger.axes[axis];
    const extra = a.level === 'non_evalue' ? ` ${a.note}` : a.partial ? ` ${a.partial}` : '';
    lines.push(`Axe ${AXIS_LABEL[axis]} : ${AXIS_LEVEL[a.level]}.${extra}`);
  }
  return lines.join('\n');
}

const UNITS: Array<[RegExp, string]> = [
  [/^km\s*\/\s*h/i, 'km/h'],
  [/^km\b/i, 'km'],
  [/^mm\b/i, 'mm'],
  [/^m\b/i, 'm'],
  [/^°\s*c?/i, '°c'],
  [/^%/, '%'],
  [/^€|^eur\b/i, '€'],
  [/^h\b/i, 'h'],
  [/^min\b/i, 'min'],
  [/^(?:l\b|litres?\b)/i, 'l'],
  [/^nuits?\b/i, 'nuit'],
  [/^jours?\b/i, 'jour'],
  [/^personnes?\b/i, 'personne'],
];

/** Les mêmes unités écrites en anglais (PLAN-100 6.2), rapportées à la même forme que les faits. */
const UNITS_EN: Array<[RegExp, string]> = [
  [/^(?:litres?|liters?)\b/i, 'l'],
  [/^nights?\b/i, 'nuit'],
  [/^days?\b/i, 'jour'],
  [/^(?:people|persons?)\b/i, 'personne'],
  [/^hours?\b/i, 'h'],
  [/^(?:minutes?|mins?)\b/i, 'min'],
  [/^(?:metres?|meters?)\b/i, 'm'],
  [/^(?:kilometres?|kilometers?)\b/i, 'km'],
];

/** Langue dans laquelle l'IA explique le verdict (PLAN-100 6.2). */
export type ExplainLocale = 'fr' | 'en' | 'es' | 'de' | 'it';

/** Unités écrites en espagnol, allemand ou italien, rapportées à la forme des faits. */
const UNITS_ES: Array<[RegExp, string]> = [
  [/^(?:litros?)\b/i, 'l'],
  [/^noches?\b/i, 'nuit'],
  [/^d[ií]as?\b/i, 'jour'],
  [/^personas?\b/i, 'personne'],
  [/^horas?\b/i, 'h'],
  [/^minutos?\b/i, 'min'],
  [/^metros?\b/i, 'm'],
  [/^kil[oó]metros?\b/i, 'km'],
];
const UNITS_DE: Array<[RegExp, string]> = [
  [/^liter[n]?\b/i, 'l'],
  [/^n[aä]chte?\b/i, 'nuit'],
  [/^nacht\b/i, 'nuit'],
  [/^tage?[n]?\b/i, 'jour'],
  [/^personen?\b/i, 'personne'],
  [/^stunden?\b/i, 'h'],
  [/^minuten?\b/i, 'min'],
  [/^metern?\b|^meter\b/i, 'm'],
  [/^kilometern?\b|^kilometer\b/i, 'km'],
];
const UNITS_IT: Array<[RegExp, string]> = [
  [/^litri?\b/i, 'l'],
  [/^nott[ei]\b/i, 'nuit'],
  [/^giorn[oi]\b/i, 'jour'],
  [/^person[ae]\b/i, 'personne'],
  [/^ore?\b/i, 'h'],
  [/^minut[oi]\b/i, 'min'],
  [/^metri?\b/i, 'm'],
  [/^chilometri?\b/i, 'km'],
];
const UNITS_BY: Record<'es' | 'de' | 'it', Array<[RegExp, string]>> = { es: UNITS_ES, de: UNITS_DE, it: UNITS_IT };

/** Nombres : « 1 200,5 » en français, « 1,200.5 » en anglais, « 1.200,5 » en espagnol, allemand, italien. */
const NUMBER_RE: Record<ExplainLocale, RegExp> = {
  es: /\d+(?:\.\d{3})*(?:,\d+)?/g,
  de: /\d+(?:\.\d{3})*(?:,\d+)?/g,
  it: /\d+(?:\.\d{3})*(?:,\d+)?/g,
  fr: /\d+(?:[\s\u00a0\u202f]\d{3})*(?:[.,]\d+)?/g,
  en: /\d+(?:,\d{3})*(?:\.\d+)?/g,
};

/**
 * Nombres d'un texte, normalisés (« 1 200 » → 1200, « 2,5 » → 2.5), avec leur
 * unité quand elle suit : `1200`, `1200|m`. Un nombre suivi d'une unité n'est
 * sourcé que si les faits portent le même nombre avec la même unité ; sinon
 * « 3 litres » passerait parce que les faits citent « J3 ».
 */
export function numbersIn(text: string, locale: ExplainLocale = 'fr'): Set<string> {
  const out = new Set<string>();
  const units =
    locale === 'en' ? [...UNITS_EN, ...UNITS] : locale === 'fr' ? UNITS : [...UNITS_BY[locale], ...UNITS];
  const dotThousands = locale === 'es' || locale === 'de' || locale === 'it';
  for (const m of text.matchAll(NUMBER_RE[locale])) {
    const n = Number(
      locale === 'en'
        ? m[0].replace(/,/g, '')
        : dotThousands
          ? m[0].replace(/\./g, '').replace(',', '.')
          : m[0].replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')
    );
    if (!Number.isFinite(n)) continue;
    const after = text.slice((m.index ?? 0) + m[0].length).replace(/^[\s\u00a0\u202f]+/, '');
    const unit = units.find(([u]) => u.test(after))?.[1];
    out.add(unit ? `${n}|${unit}` : String(n));
  }
  return out;
}

const NO_SCORE = /\bscores?\b|\bnot(?:e|é)\s+(?:de|sur|globale)\b|\/\s*(?:10|20|100)\b|\bsur\s+(?:10|20|100)\b/i;
const NO_REASSURANCE =
  /sans (?:aucun )?(?:risque|danger)|aucun (?:risque|danger)|en toute s[ée]curit[ée]|garanti|aucun souci|tout est (?:bon|ok|pr[eê]t)/i;

const NO_SCORE_EN = /\bscores?\b|\brating\b|\/\s*(?:10|20|100)\b|\bout of\s+(?:10|20|100)\b/i;
const NO_REASSURANCE_EN =
  /\b(?:no|without(?: any)?|zero) (?:risks?|danger)\b|risk-free|(?:completely|perfectly|totally|entirely) safe|guaranteed|nothing to worry|all (?:good|set)|everything is (?:fine|ok|ready)/i;

const NO_SCORE_ES = /\bpuntuaci[oó]n\b|\bnota\b|\bcalificaci[oó]n\b|\bscore\b|\/\s*(?:10|20|100)\b|\bsobre\s+(?:10|20|100)\b/i;
const NO_REASSURANCE_ES =
  /sin (?:ning[uú]n )?(?:riesgo|peligro)|ning[uú]n (?:riesgo|peligro)|totalmente seguro|completamente seguro|garantizado|no hay (?:de )?qu[eé] preocuparse|todo (?:est[aá] )?(?:bien|listo)/i;
const NO_SCORE_DE = /\bpunktzahl\b|\bbewertung\b|\bnote\b|\bscore\b|\/\s*(?:10|20|100)\b|\bvon\s+(?:10|20|100)\b/i;
const NO_REASSURANCE_DE =
  /ohne (?:jedes |jegliches )?(?:risiko|gefahr)|kein(?:e)? (?:risiko|gefahr)|v[oö]llig sicher|vollkommen sicher|garantiert|keine sorge|alles (?:gut|in ordnung|bereit)/i;
const NO_SCORE_IT = /\bpunteggio\b|\bvoto\b|\bvalutazione\b|\bscore\b|\/\s*(?:10|20|100)\b|\bsu\s+(?:10|20|100)\b/i;
const NO_REASSURANCE_IT =
  /senza (?:alcun )?(?:rischio|pericolo)|nessun (?:rischio|pericolo)|del tutto sicuro|completamente sicuro|garantito|niente di cui preoccuparsi|tutto (?:ok|a posto|pronto)/i;
const NO_SCORE_BY = { es: NO_SCORE_ES, de: NO_SCORE_DE, it: NO_SCORE_IT } as const;
const NO_REASSURANCE_BY = { es: NO_REASSURANCE_ES, de: NO_REASSURANCE_DE, it: NO_REASSURANCE_IT } as const;

export const MAX_EXPLANATION_CHARS = 900;

export type ExplanationCheck =
  | { ok: true; text: string }
  | { ok: false; reason: string };

/**
 * Le texte de l'IA, accepté tel quel ou refusé avec la raison. `locale` : langue dans
 * laquelle l'IA a écrit (PLAN-100 6.2) ; les faits, eux, restent écrits en français.
 * Les deux langues de garde-fous s'appliquent en anglais (une phrase française glissée
 * dans la réponse n'y échappe pas).
 */
export function checkExplanation(raw: string, facts: string, locale: ExplainLocale = 'fr'): ExplanationCheck {
  const text = raw
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/```\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length < 20) return { ok: false, reason: 'réponse vide' };
  if (text.length > MAX_EXPLANATION_CHARS) return { ok: false, reason: 'réponse trop longue' };
  const sourced = numbersIn(facts);
  const bare = new Set([...sourced].map((n) => n.split('|')[0]));
  const invented = [...numbersIn(text, locale)]
    .filter((n) => (n.includes('|') ? !sourced.has(n) : !bare.has(n)))
    .map((n) => n.replace('|', ' '));
  if (invented.length) {
    return { ok: false, reason: `nombre absent des signaux (${invented.slice(0, 3).join(', ')})` };
  }
  const en = locale === 'en';
  const other = locale === 'es' || locale === 'de' || locale === 'it' ? locale : null;
  if (NO_SCORE.test(text) || (en && NO_SCORE_EN.test(text)) || (other && NO_SCORE_BY[other].test(text)))
    return { ok: false, reason: 'parle de score ou de note' };
  if (NO_REASSURANCE.test(text) || (en && NO_REASSURANCE_EN.test(text)) || (other && NO_REASSURANCE_BY[other].test(text)))
    return { ok: false, reason: 'rassure au-delà des signaux' };
  return { ok: true, text };
}
