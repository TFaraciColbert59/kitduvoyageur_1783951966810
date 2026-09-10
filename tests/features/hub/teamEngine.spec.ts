import { describe, it, expect } from 'vitest';
import {
  carnetRoleLabel,
  dogLoadView,
  formatJoinDate,
  personInitials,
  teamRoleLabel,
} from '@/features/hub/mobile/teamEngine';

describe('team engine (mobile sortie)', () => {
  describe('personInitials', () => {
    it('prend les 2 initiales des mots (max 2)', () => {
      expect(personInitials('Marie Dupont')).toBe('MD');
      expect(personInitials('  jean   claude  van damme ')).toBe('JC');
    });

    it('un seul mot → 1 initiale ; nom vide → fallback', () => {
      expect(personInitials('Alexandre')).toBe('A');
      expect(personInitials('')).toBe('V');
      expect(personInitials(null)).toBe('V');
      expect(personInitials(undefined)).toBe('V');
    });
  });

  describe('labels de rôles', () => {
    it('comptes : owner/editor/viewer', () => {
      expect(teamRoleLabel('owner')).toBe('Organisateur');
      expect(teamRoleLabel('editor')).toBe('Éditeur');
      expect(teamRoleLabel('viewer')).toBe('Lecteur');
    });

    it('carnet : guide/medic/member', () => {
      expect(carnetRoleLabel('guide')).toBe('Guide');
      expect(carnetRoleLabel('medic')).toBe('Secouriste');
      expect(carnetRoleLabel('member')).toBe('Équipier');
    });
  });

  describe('dogLoadView', () => {
    it('chien porteur : pourcentage arrondi et label', () => {
      expect(
        dogLoadView({ isCarryingPack: true, packWeightKg: 2.8, maxCarryingCapacityKg: 3.6 })
      ).toEqual({ pct: 78, over: false, label: '2.8 kg (78%)' });
    });

    it('chien non porteur : 0 % et « Non équipé »', () => {
      expect(
        dogLoadView({ isCarryingPack: false, packWeightKg: 2.8, maxCarryingCapacityKg: 3.6 })
      ).toEqual({ pct: 0, over: false, label: 'Non équipé' });
    });

    it('surcharge détectée ; capacité nulle → jamais NaN', () => {
      expect(
        dogLoadView({ isCarryingPack: true, packWeightKg: 5, maxCarryingCapacityKg: 3.6 }).over
      ).toBe(true);
      expect(
        dogLoadView({ isCarryingPack: true, packWeightKg: 2, maxCarryingCapacityKg: 0 })
      ).toEqual({ pct: 0, over: true, label: '2 kg (0%)' });
    });
  });

  describe('formatJoinDate', () => {
    it('formate en français court', () => {
      const label = formatJoinDate('2026-09-09T00:00:00Z');
      expect(label).toMatch(/9 sept/);
    });

    it('date invalide ou absente → chaîne vide', () => {
      expect(formatJoinDate(null)).toBe('');
      expect(formatJoinDate(undefined)).toBe('');
      expect(formatJoinDate('pas-une-date')).toBe('');
    });
  });
});
