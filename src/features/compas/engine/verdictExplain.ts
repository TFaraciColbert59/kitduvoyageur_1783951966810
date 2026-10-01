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

/**
 * Nombres d'un texte, normalisés (« 1 200 » → 1200, « 2,5 » → 2.5), avec leur
 * unité quand elle suit : `1200`, `1200|m`. Un nombre suivi d'une unité n'est
 * sourcé que si les faits portent le même nombre avec la même unité ; sinon
 * « 3 litres » passerait parce que les faits citent « J3 ».
 */
export function numbersIn(text: string): Set<string> {
  const out = new Set<string>();
  const re = /\d+(?:[\s\u00a0\u202f]\d{3})*(?:[.,]\d+)?/g;
  for (const m of text.matchAll(re)) {
    const n = Number(m[0].replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
    if (!Number.isFinite(n)) continue;
    const after = text.slice((m.index ?? 0) + m[0].length).replace(/^[\s\u00a0\u202f]+/, '');
    const unit = UNITS.find(([u]) => u.test(after))?.[1];
    out.add(unit ? `${n}|${unit}` : String(n));
  }
  return out;
}

const NO_SCORE = /\bscores?\b|\bnot(?:e|é)\s+(?:de|sur|globale)\b|\/\s*(?:10|20|100)\b|\bsur\s+(?:10|20|100)\b/i;
const NO_REASSURANCE =
  /sans (?:aucun )?(?:risque|danger)|aucun (?:risque|danger)|en toute s[ée]curit[ée]|garanti|aucun souci|tout est (?:bon|ok|pr[eê]t)/i;

export const MAX_EXPLANATION_CHARS = 900;

export type ExplanationCheck =
  | { ok: true; text: string }
  | { ok: false; reason: string };

/** Le texte de l'IA, accepté tel quel ou refusé avec la raison. */
export function checkExplanation(raw: string, facts: string): ExplanationCheck {
  const text = raw
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/```\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length < 20) return { ok: false, reason: 'réponse vide' };
  if (text.length > MAX_EXPLANATION_CHARS) return { ok: false, reason: 'réponse trop longue' };
  const sourced = numbersIn(facts);
  const bare = new Set([...sourced].map((n) => n.split('|')[0]));
  const invented = [...numbersIn(text)]
    .filter((n) => (n.includes('|') ? !sourced.has(n) : !bare.has(n)))
    .map((n) => n.replace('|', ' '));
  if (invented.length) {
    return { ok: false, reason: `nombre absent des signaux (${invented.slice(0, 3).join(', ')})` };
  }
  if (NO_SCORE.test(text)) return { ok: false, reason: 'parle de score ou de note' };
  if (NO_REASSURANCE.test(text)) return { ok: false, reason: 'rassure au-delà des signaux' };
  return { ok: true, text };
}
