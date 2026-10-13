import { describe, expect, it } from 'vitest';
import { buildCompasAutofillSystem, buildCompasStagesSystem } from '@/lib/ai/features/compasAutofill';

/**
 * Consignes de l'IA (PLAN-100 4.1, 4.2) : rien de « voyageur français », jamais une
 * nationalité (même connue) ni un départ de France supposé. L'itinéraire de base
 * (cache partagé entre comptes) ne dépend de personne.
 */
const rule = (system: string, id: string) => system.split('\n').find((l) => l.startsWith(`${id}. `)) ?? '';

const NEUTRAL_8A =
  '8a. Chaque conseil doit etre VRAI quelle que soit la nationalite de la personne : n ecris aucun conseil qui depende de sa nationalite, de son pays de residence ou de sa monnaie. Papiers (passeport, carte d identite, visa, autorisation), change et prises electriques sont deja traites par l application : n en parle JAMAIS.';

describe('consignes de l’IA : jamais une nationalité, rien de français supposé', () => {
  it('8a neutre pour tout le monde : ni France ni nationalité supposées', () => {
    expect(rule(buildCompasAutofillSystem(), '8a')).toBe(NEUTRAL_8A);
    expect(buildCompasAutofillSystem()).not.toMatch(/part de France|nationalite francaise/);
  });

  it('aucune nationalité ne part à l’IA : même une demande « française » donne la consigne neutre (vie privée, lot Z1)', () => {
    // Un tiers (NVIDIA) ne reçoit jamais la nationalité : le seul réglage de la consigne a disparu,
    // et un appelant qui en passerait encore un (ancienne signature) obtient le même texte.
    const legacy = buildCompasAutofillSystem as unknown as (frenchNational: boolean) => string;
    expect(legacy(true)).toBe(buildCompasAutofillSystem());
    expect(rule(legacy(true), '8a')).toBe(NEUTRAL_8A);
    expect(legacy(true)).not.toMatch(/nationalite francaise|part de France/);
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
