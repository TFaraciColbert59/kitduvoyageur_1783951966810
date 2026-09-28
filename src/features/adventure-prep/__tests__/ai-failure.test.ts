import { describe, expect, it } from 'vitest';
import { describeAiFailure, shouldRetryAfterFailure } from '../engine/aiFailure';
import type { AIFailureReason } from '@/lib/ai/providers/types';

const TOUTES: AIFailureReason[] = [
  'delai_depasse',
  'quota_epuise',
  'provider_indisponible',
  'reponse_invalide',
];

/**
 * Le preparatory peut observer le provider tomber par intermittence : mesure du
 * 2026-09-28, 3 appels identiques sur le meme brouillon, latences 45 010 ms
 * (delai) puis 2 682 ms et 1 473 ms (succes). Le provider n'est donc ni
 * casse ni lent : il DECROCHE. Un seul reessai sur delai transforme un
 * cul-de-sac de 45 s en reponse en ~2 s, et ne coute rien quand le service
 * est reellement indisponible.
 */
describe('reessai sur delai — AF-01 a AF-04', () => {
  it('AF-01: ne retente QUE sur delai depasse', () => {
    expect(shouldRetryAfterFailure('delai_depasse')).toBe(true);
    expect(shouldRetryAfterFailure('quota_epuise')).toBe(false);
    expect(shouldRetryAfterFailure('provider_indisponible')).toBe(false);
    expect(shouldRetryAfterFailure('reponse_invalide')).toBe(false);
  });

  it('AF-02: une absence de cause ne se retente pas', () => {
    expect(shouldRetryAfterFailure(null)).toBe(false);
    expect(shouldRetryAfterFailure(undefined)).toBe(false);
  });

  it('AF-03: chaque cause a son propre message, jamais un texte partage', () => {
    // Une cause CONNUE a toujours un message : `?? ''` ne sert qu a contenter
    // le type, et le test suivant echouerait sur une chaine vide.
    const messages = TOUTES.map((reason) => describeAiFailure(reason) ?? '');
    expect(new Set(messages).size).toBe(TOUTES.length);
    for (const message of messages) expect(message.trim().length).toBeGreaterThan(20);
  });

  it('AF-04: aucun message n accuse l assistant d etre desactive', () => {
    // C est le faux que l utilisateur a signale : un delai du service presente
    // comme un choix de configuration. Les deux sont des mensonges distincts.
    for (const reason of TOUTES) {
      expect(describeAiFailure(reason)).not.toContain('pas activ');
      expect(describeAiFailure(reason)).not.toContain('désactiv');
    }
  });
});

describe('messages honnetes de degradation — AF-05 a AF-08', () => {
  it('AF-05: le delai nomme le delai', () => {
    const message = describeAiFailure('delai_depasse');
    expect(message).toContain('temps');
    expect(message).toContain('règles');
  });

  it('AF-06: le quota nomme le quota, pas le service', () => {
    const message = describeAiFailure('quota_epuise');
    expect(message).toContain('quotas');
    expect(message).toContain('demain');
  });

  it('AF-07: une reponse illisible ne pretend pas que le service est tombe', () => {
    const message = describeAiFailure('reponse_invalide');
    expect(message).toContain('exploitable');
  });

  it('AF-08: une cause inconnue ne produit pas de message invente', () => {
    const vide = describeAiFailure(undefined);
    expect(vide).toBeNull();
  });
});