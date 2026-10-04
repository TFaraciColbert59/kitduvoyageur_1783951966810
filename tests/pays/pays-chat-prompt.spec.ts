import { describe, it, expect } from 'vitest';
import { buildPaysChatRequest, extractKitItems } from '@/features/pays/chat/paysChatPrompt';

describe('buildPaysChatRequest', () => {
  it('ancre la requete kit sur le pays et le guide, sans PII', () => {
    const req = buildPaysChatRequest({
      countryCode: 'IS',
      countryName: 'Islande',
      question: 'Crée mon kit de voyage pour juillet',
      seasonMd: 'Juillet : 10-13°C, vent, pluie fréquente.',
    });
    expect(req.provider).toBe('nemotron');
    expect(req.task).toBe('fast');
    expect(req.stream).toBe(false);
    expect(req.system).toContain('Islande');
    expect(req.system).toContain('(IS)');
    expect(req.system).toContain('10-13°C');
    expect(req.system.length).toBeLessThanOrEqual(8000);
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0].role).toBe('user');
    expect(JSON.stringify(req)).not.toMatch(/@/);
  });

  it('tronque le contexte saisonnier pour rester sous 8000 caracteres', () => {
    const req = buildPaysChatRequest({
      countryCode: 'FR',
      countryName: 'France',
      question: 'Quand partir ?',
      seasonMd: 'x'.repeat(20000),
    });
    expect(req.system.length).toBeLessThanOrEqual(8000);
    expect(req.system).toContain('France');
    expect(req.system).toContain('(FR)');
  });
});

describe('extractKitItems', () => {
  it('extrait les puces et numerotees, dedup, max 50', () => {
    const md = '- Veste imperméable\n* Veste imperméable\n1. Pantalon coupe-vent\n• Bonnet\nTexte libre';
    expect(extractKitItems(md)).toEqual(['Veste imperméable', 'Pantalon coupe-vent', 'Bonnet']);
  });

  it('retourne un tableau vide sans puces', () => {
    expect(extractKitItems('Pas de liste ici.')).toEqual([]);
  });
});
