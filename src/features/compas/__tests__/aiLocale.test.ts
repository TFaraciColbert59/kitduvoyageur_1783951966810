import { describe, expect, it } from 'vitest';
import {
  buildCompasAutofillPrompt,
  buildCompasAutofillSystem,
  buildCompasAutofillSystemEn,
  buildCompasStagesSystem,
} from '@/lib/ai/features/compasAutofill';
import { buildCompasVerdictPrompt, buildCompasVerdictSystem } from '@/lib/ai/features/compasVerdict';
import { buildCacheKey } from '@/lib/ai/responseStore';
import { sanitizeAdvice } from '../engine/autofill';
import { aiSuggestion, repeatsRule } from '../engine/advice';
import { keepAiNote, sharedRules } from '../engine/papers';
import { checkExplanation, numbersIn } from '../engine/verdictExplain';
import { looksFrench, tutoyer, voiceFor } from '../engine/voice';

/**
 * PLAN-100 6.2 : consignes de l'IA dans la langue de l'interface, et règles de relecture
 * (`repairAccents`, `tutoyer`, `keepAiNote`, garde-fous du verdict) par langue. Le français
 * reste celui d'avant, au caractère près.
 */
const rule = (system: string, id: string) => system.split('\n').find((l) => l.startsWith(`${id}. `)) ?? '';

describe('consignes de l’IA par langue', () => {
  it('français par défaut, inchangé (absent, `fr`, ancien appel booléen)', () => {
    const fr = buildCompasAutofillSystem();
    expect((buildCompasAutofillSystem as unknown as (x: unknown) => string)('en')).toBe(fr);
    expect(buildCompasStagesSystem('fr')).toBe(buildCompasStagesSystem());
    expect(buildCompasVerdictSystem('fr')).toBe(buildCompasVerdictSystem());
    expect(buildCompasAutofillPrompt('X', 'fr')).toBe('Faits :\nX\n\nRenvoie le JSON demande.');
    expect(buildCompasVerdictPrompt('X')).toBe('Faits (seule source autorisee) :\nX\n\nExplique ce verdict.');
  });

  it('anglais : mêmes règles, même neutralité (rien sur la nationalité ni les papiers)', () => {
    const en = buildCompasAutofillSystemEn();
    expect(en).toMatch(/in correct English/);
    expect(rule(en, '8a')).toMatch(/whatever the person's nationality/);
    expect(rule(en, '8a')).toMatch(/NEVER mention them/);
    expect(rule(en, '8b')).toMatch(/Do not invent any obligation/);
    expect(en).toMatch(/\{"notes": string\[\]\}/);
    expect(en).not.toMatch(/nationalite francaise|French national|from France/i);
    expect(buildCompasAutofillPrompt('X', 'en')).toBe('Facts:\nX\n\nReturn the requested JSON.');
  });

  it('itinéraire en anglais : seule la note change, les codes de déplacement restent', () => {
    const en = buildCompasStagesSystem('en');
    expect(en.startsWith(buildCompasStagesSystem())).toBe(true);
    expect(rule(en, '12')).toBe('12. Write "note" in English. Keep "move" exactly as one of the codes above.');
  });

  it('verdict en anglais : aucun score, aucune réassurance', () => {
    const en = buildCompasVerdictSystem('en');
    expect(en).toMatch(/You explain in English/);
    expect(rule(en, '3')).toMatch(/no score/);
    expect(buildCompasVerdictPrompt('X', 'en')).toBe('Facts (only allowed source):\nX\n\nExplain this verdict.');
  });

  it('cache : la langue fait partie de la clé, la clé française est celle d’avant', () => {
    expect(buildCacheKey('compas-verdict', 'p', 'fr')).toBe(buildCacheKey('compas-verdict', 'p'));
    expect(buildCacheKey('compas-verdict', 'p', 'en')).not.toBe(buildCacheKey('compas-verdict', 'p'));
  });
});

describe('relecture des conseils par langue', () => {
  it('accents corrigés en français seulement', () => {
    expect(sanitizeAdvice({ notes: ['reserver ton hebergement tot'] }).notes).toEqual(['Réserver ton hébergement tot']);
    expect(sanitizeAdvice({ notes: ['book the region tour before departure'] }, 'en').notes).toEqual([
      'Book the region tour before departure',
    ]);
  });

  it('tutoiement en français, rien à changer en anglais ; un conseil rendu en français est écarté', () => {
    expect(voiceFor('Prévoyez une frontale.', 'fr')).toBe(tutoyer('Prévoyez une frontale.'));
    expect(voiceFor('Bring a headlamp for the early start.', 'en')).toBe('Bring a headlamp for the early start.');
    expect(voiceFor('Pense à réserver le bus pour le retour.', 'en')).toBeNull();
    // Un seul mot-outil peut être un nom de lieu.
    expect(looksFrench('Book your bus to La Paz early.')).toBe(false);
  });

  it('papiers, change et prises écartés aussi quand l’IA écrit en anglais', () => {
    const rules = sharedRules('IT', 'Italie', true);
    expect(rules.papers).not.toBeNull();
    expect(keepAiNote('Check that your passport is valid.', rules)).toBe(false);
    expect(keepAiNote('Apply for an ESTA early.', rules)).toBe(false);
    expect(keepAiNote('Book the Rifugio Vajolet a month ahead.', rules)).toBe(true);
    if (rules.plugs != null) expect(keepAiNote('Pack a type L plug adapter.', rules)).toBe(false);
    if (rules.euro) expect(keepAiNote('Exchange some euros before you leave.', rules)).toBe(false);
    // Le français garde ses propres motifs.
    expect(keepAiNote('Vérifie ton passeport.', rules)).toBe(false);
  });

  it('un conseil anglais qui redit une règle (française) est écarté', () => {
    const rules = ['Au-dessus de 2 400 m, l’eau des névés, des torrents et des sources n’est pas contrôlée : traite-la (filtre ou pastilles).'];
    expect(repeatsRule('Carry a water filter or purification tablets.', rules, 'en')).toBe(true);
    expect(repeatsRule('Start early to enjoy the views.', rules, 'en')).toBe(false);
  });

  it('mention « IA » dans la langue du conseil, majuscule gardée en anglais', () => {
    expect(aiSuggestion('Réserve le refuge.')).toBe('Suggestion de l’IA (facultatif) : réserve le refuge.');
    expect(aiSuggestion('Book Zermatt early.', 'en')).toBe('AI suggestion (optional): Book Zermatt early.');
  });
});

describe('garde-fous du verdict en anglais', () => {
  const facts = 'Niveau décidé par le moteur : Vigilance.\n- Rafales à 90 km/h le J2 (source : MET Norway, 2026-10-12).\n- Altitude 1 200 m.';

  it('nombres lus à l’anglaise (virgule des milliers, point décimal)', () => {
    expect([...numbersIn('1,200 m, 2.5 km and 2 nights', 'en')]).toEqual(['1200|m', '2.5|km', '2|nuit']);
  });

  it('une explication sourcée passe ; un nombre inventé, un score ou une réassurance non', () => {
    expect(checkExplanation('Gusts reach 90 km/h on day 2 near 1,200 m: stay alert on exposed ridges.', facts, 'en').ok).toBe(true);
    expect(checkExplanation('Gusts reach 110 km/h on day 2, so stay alert on the ridges today.', facts, 'en')).toEqual({
      ok: false,
      reason: 'nombre absent des signaux (110 km/h)',
    });
    expect(checkExplanation('Your safety score is good for day 2, keep an eye on gusts.', facts, 'en').ok).toBe(false);
    expect(checkExplanation('Day 2 is windy but the route is completely safe for the group.', facts, 'en').ok).toBe(false);
  });
});
