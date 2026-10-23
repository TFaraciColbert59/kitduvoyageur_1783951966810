import { describe, expect, it } from 'vitest';
import {
  buildCompasAutofillPrompt,
  buildCompasAutofillSystem,
  buildCompasAutofillSystemFor,
  buildCompasStagesSystem,
} from '@/lib/ai/features/compasAutofill';
import { buildCompasVerdictPrompt, buildCompasVerdictSystem } from '@/lib/ai/features/compasVerdict';
import { aiSuggestion, repeatsRule } from '../engine/advice';
import { sanitizeAdvice } from '../engine/autofill';
import { keepAiNote } from '../engine/papers';
import { checkExplanation, numbersIn } from '../engine/verdictExplain';
import { voiceFor } from '../engine/voice';

const LOCALES = ['es', 'de', 'it'] as const;

describe('consignes de l’IA en espagnol, allemand, italien (plan 6.2)', () => {
  it('la consigne française est celle d’avant', () => {
    expect(buildCompasStagesSystem()).toBe(buildCompasStagesSystem('fr'));
    expect(buildCompasAutofillSystem()).not.toContain('Eres');
    expect(buildCompasVerdictSystem('fr')).toBe(buildCompasVerdictSystem());
  });

  it.each(LOCALES)('%s : consigne propre, sans nationalité, mêmes garde-fous', (l) => {
    const sys = buildCompasAutofillSystemFor(l);
    expect(sys).not.toBe(buildCompasAutofillSystem());
    expect(sys).toContain('{"notes": string[]}');
    expect(sys).toMatch(/null/);
    expect(buildCompasStagesSystem(l)).toContain('"note"');
    expect(buildCompasVerdictSystem(l)).toContain('350');
    expect(buildCompasVerdictPrompt('X', l)).toContain('X');
    expect(buildCompasAutofillPrompt('X', l)).toContain('X');
  });

  it.each(LOCALES)('%s : un conseil resté en français est écarté, le bon passe', (l) => {
    expect(voiceFor('Pense à réserver pour les nuits et vérifie les horaires.', l)).toBeNull();
    const ok = { es: 'Reserva el refugio con antelación.', de: 'Reserviere die Hütte rechtzeitig.', it: 'Prenota il rifugio in anticipo.' }[l];
    expect(voiceFor(ok, l)).toBe(ok);
  });

  it('mention « IA » dans la langue', () => {
    expect(aiSuggestion('Reserva el refugio.', 'es')).toBe('Sugerencia de la IA (opcional): reserva el refugio.');
    expect(aiSuggestion('Reserviere die Hütte.', 'de')).toBe('KI-Vorschlag (optional): Reserviere die Hütte.');
    expect(aiSuggestion('Prenota il rifugio.', 'it')).toBe('Suggerimento dell’IA (facoltativo): prenota il rifugio.');
  });

  it('un conseil qui redit une règle est écarté, papiers et prises aussi', () => {
    const rules = ['Au-dessus de 2 400 m, l’eau des névés n’est pas contrôlée : traite-la (filtre ou pastilles).'];
    expect(repeatsRule('Lleva un filtro o pastillas potabilizadoras.', rules, 'es')).toBe(true);
    expect(repeatsRule('Nimm einen Filter oder Tabletten mit.', rules, 'de')).toBe(true);
    expect(repeatsRule('Porta filtro o pastiglie.', rules, 'it')).toBe(true);
    expect(repeatsRule('Sal temprano.', rules, 'es')).toBe(false);
    const papers = { papers: 'x', euro: false, sameMoney: null, plugs: 'C' } as unknown as Parameters<typeof keepAiNote>[1];
    expect(keepAiNote('Comprueba que tu pasaporte esté vigente.', papers)).toBe(false);
    expect(keepAiNote('Prüfe, ob Dein Reisepass gültig ist.', papers)).toBe(false);
    expect(keepAiNote('Controlla il passaporto.', papers)).toBe(false);
    expect(keepAiNote('Lleva un adaptador de enchufe.', papers)).toBe(false);
    expect(keepAiNote('Reserva el refugio.', papers)).toBe(true);
  });

  it('les conseils sont bornés, majuscule selon la langue', () => {
    const r = sanitizeAdvice({ notes: ['reserva el refugio con tiempo'] }, 'es');
    expect(r.notes).toEqual(['Reserva el refugio con tiempo']);
  });

  describe('garde-fous du verdict', () => {
    const facts = 'Niveau décidé : Vigilance.\n- Rafales à 90 km/h le J2.\n- Altitude 1 200 m.';
    it('les nombres sont lus à la façon de la langue', () => {
      for (const l of LOCALES) expect([...numbersIn('Altitud 1.200 m y 90 km/h', l)].sort()).toEqual(['1200|m', '90|km/h']);
      expect([...numbersIn('1.200,5 km', 'de')]).toEqual(['1200.5|km']);
    });
    it('un nombre inventé, un score, une réassurance : refusés', () => {
      expect(checkExplanation('Hay ráfagas de 90 km/h el J2, a 1.200 m de altitud.', facts, 'es').ok).toBe(true);
      expect(checkExplanation('Hay ráfagas de 120 km/h el J2, a 1.200 m de altitud.', facts, 'es').ok).toBe(false);
      expect(checkExplanation('Böen von 90 km/h am J2, es besteht kein Risiko für Sie.', facts, 'de').ok).toBe(false);
      expect(checkExplanation('Raffiche a 90 km/h il J2, punteggio 7/10 per questa uscita.', facts, 'it').ok).toBe(false);
      expect(checkExplanation('Raffiche a 90 km/h il J2, altitudine 1.200 m: prudenza.', facts, 'it').ok).toBe(true);
    });
  });
});
