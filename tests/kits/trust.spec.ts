import { describe, it, expect } from 'vitest';
import {
  survivalRate,
  shouldDisplayScore,
  scoreStatus,
  descendanceDecay,
  conservationPhrase,
  shouldShowRegionRanking,
} from '@/features/kits/trust';

describe('lignées de kits — conservation & confiance (Lot 4)', () => {
  describe('survivalRate', () => {
    it('retourne le taux de conservation 0..1', () => {
      expect(survivalRate(7, 3)).toBeCloseTo(0.7, 3);
    });
    it('100 % quand rien n’est abandonné', () => {
      expect(survivalRate(5, 0)).toBe(1);
    });
    it('null quand aucune donnée (évite la division par zéro)', () => {
      expect(survivalRate(0, 0)).toBeNull();
    });
  });

  describe('shouldDisplayScore / scoreStatus (plancher de crédibilité)', () => {
    it('plancher : sous 5 sessions terrain, aucun score affiché', () => {
      expect(shouldDisplayScore(4)).toBe(false);
    });
    it('5 sessions suffisent', () => {
      expect(shouldDisplayScore(5)).toBe(true);
    });
    it('0 session → « pas encore éprouvé »', () => {
      expect(scoreStatus(0).label).toBe('pas encore éprouvé');
      expect(scoreStatus(0).displayScore).toBe(false);
    });
    it('1-4 sessions → « lignée jeune », pas de score, mais du chemin parcouru', () => {
      expect(scoreStatus(3).label).toBe('lignée jeune');
      expect(scoreStatus(3).displayScore).toBe(false);
    });
    it('≥5 sessions → « éprouvé », score affichable', () => {
      expect(scoreStatus(8).label).toBe('éprouvé');
      expect(scoreStatus(8).displayScore).toBe(true);
    });
  });

  describe('descendanceDecay (miroir SQL / pow(age+2, 1.5))', () => {
    it('un fork récent (1 h) pèse significativement', () => {
      const d = descendanceDecay(1);
      expect(d).toBeGreaterThan(0.1);
    });
    it('un fork très ancien (3 ans) est très atténué', () => {
      expect(descendanceDecay(24 * 30 * 36)).toBeLessThan(0.0001);
    });
    it('décroît strictement avec l’âge', () => {
      expect(descendanceDecay(10)).toBeGreaterThan(descendanceDecay(1000));
    });
  });

  describe('conservationPhrase (vocabulaire public : voyageurs, jamais ADN)', () => {
    it('« gardé par 7 voyageurs sur 10 »', () => {
      expect(conservationPhrase(0.7)).toBe('gardé par 7 voyageurs sur 10');
    });
    it('arrondi à la dizaine la plus proche', () => {
      expect(conservationPhrase(0.96)).toBe('gardé par 10 voyageurs sur 10');
      expect(conservationPhrase(0.04)).toBe('gardé par 0 voyageur sur 10');
    });
  });

  describe('shouldShowRegionRanking (seuil anti-plateforme-vide)', () => {
    it('pas de classement régional sous 20 lignées publiques', () => {
      expect(shouldShowRegionRanking(19)).toBe(false);
    });
    it('20 lignées publiques suffisent', () => {
      expect(shouldShowRegionRanking(20)).toBe(true);
    });
  });
});