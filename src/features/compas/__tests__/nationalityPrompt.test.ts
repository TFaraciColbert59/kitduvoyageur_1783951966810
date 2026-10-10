import { describe, expect, it } from 'vitest';
import { buildCompasAutofillSystem, buildCompasStagesSystem } from '@/lib/ai/features/compasAutofill';

/**
 * Consignes de l'IA (PLAN-100 4.1, 4.2) : rien de « voyageur français » sans
 * nationalité connue, et jamais un départ de France supposé. L'itinéraire de base
 * (cache partagé entre comptes) ne dépend de personne.
 */
const rule = (system: string, id: string) => system.split('\n').find((l) => l.startsWith(`${id}. `)) ?? '';

const NEUTRAL_8A =
  '8a. Chaque conseil doit etre VRAI quelle que soit la nationalite de la personne : n ecris aucun conseil qui depende de sa nationalite, de son pays de residence ou de sa monnaie. Papiers (passeport, carte d identite, visa, autorisation), change et prises electriques sont deja traites par l application : n en parle JAMAIS.';

describe('consignes de l’IA : rien de français sans nationalité connue', () => {
  it('sans profil ou autre nationalité : 8a neutre, ni France ni nationalité supposées', () => {
    expect(rule(buildCompasAutofillSystem(), '8a')).toBe(NEUTRAL_8A);
    expect(buildCompasAutofillSystem(false)).toBe(buildCompasAutofillSystem());
    expect(buildCompasAutofillSystem()).not.toMatch(/part de France|nationalite francaise/);
  });

  it('nationalité française connue : 8a la dit, jamais un départ de France', () => {
    expect(rule(buildCompasAutofillSystem(true), '8a')).toBe(
      '8a. Chaque conseil doit etre VRAI pour une personne de nationalite francaise. Papiers (passeport, carte d identite, visa, autorisation), change et prises electriques sont deja traites par l application : n en parle JAMAIS.'
    );
    expect(buildCompasAutofillSystem(true)).not.toContain('part de France');
  });

  it('8b inchangée : aucune obligation inventée pour CE pays', () => {
    expect(rule(buildCompasAutofillSystem(), '8b')).toContain('N invente aucune obligation (permis, licence, visa, certificat)');
  });

  it('itinéraire de base (cache partagé) : aucun voyageur français supposé', () => {
    const s = buildCompasStagesSystem();
    expect(s).not.toMatch(/voyageur francais|versant francais/);
    expect(rule(s, '11')).toBe(
      '11. Un massif ou une chaine a cheval sur une frontiere (Pyrenees, Alpes, Andes, Himalaya) : le pays donne n est qu un indice ; prends le versant le plus pertinent pour l activite ou passe d un versant a l autre.'
    );
  });
});
