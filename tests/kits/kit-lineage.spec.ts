import { describe, it, expect } from 'vitest';
import {
  isAutoFork,
  buildAdaptiveForkName,
  decideKitFork,
  assertNoServerKitFields,
} from '@/features/kits/lineage';

describe('lignées de kits — filiation applicative', () => {
  describe('isAutoFork', () => {
    it('forker le kit d’un autre n’est pas un auto-fork', () => {
      expect(isAutoFork('aaaa', 'bbbb')).toBe(false);
    });
    it('forker son propre kit est un auto-fork', () => {
      expect(isAutoFork('aaaa', 'aaaa')).toBe(true);
    });
    it('source sans propriétaire = false (défensif)', () => {
      expect(isAutoFork(null, 'aaaa')).toBe(false);
    });
  });

  describe('buildAdaptiveForkName', () => {
    it('« Nom — Prénom » quand le créateur est connu', () => {
      expect(buildAdaptiveForkName('Kit Alpes', 'Alice')).toBe('Kit Alpes — Alice');
    });
    it('nom seul quand pas de créateur connu', () => {
      expect(buildAdaptiveForkName('Kit Alpes', null)).toBe('Kit Alpes');
    });
    it('le suffixe « (copie) » est interdit', () => {
      const n = buildAdaptiveForkName('Kit Alpes', 'Alice');
      expect(n.includes('(copie)')).toBe(false);
    });
    it('nom vide → « Kit sans nom »', () => {
      expect(buildAdaptiveForkName('   ', 'Alice')).toBe('Kit sans nom');
    });
  });

  describe('decideKitFork', () => {
    it('fork d’autrui → filiation (forked_from=source, origin=fork)', () => {
      expect(
        decideKitFork({
          sourceId: 'AAA',
          sourceUserId: 'owner',
          sourceName: 'Kit Alpes',
          currentUserId: 'cloneur',
          sourceOwnerName: 'Alice',
        })
      ).toEqual({ forkedFrom: 'AAA', origin: 'fork', name: 'Kit Alpes — Alice' });
    });

    it('auto-fork → PAS de filiation (forked_from=null, origin=manuel) — vecteur fraude n°1', () => {
      expect(
        decideKitFork({
          sourceId: 'AAA',
          sourceUserId: 'moi',
          sourceName: 'Kit Alpes',
          currentUserId: 'moi',
        })
      ).toEqual({ forkedFrom: null, origin: 'manuel', name: 'Kit Alpes' });
    });

    it('nom demandé respecté', () => {
      expect(
        decideKitFork({
          sourceId: 'AAA',
          sourceUserId: 'owner',
          sourceName: 'Kit Alpes',
          currentUserId: 'cloneur',
          sourceOwnerName: 'Alice',
          requestedName: 'Kit Queyras',
        }).name
      ).toBe('Kit Queyras');
    });

    it('nom demandé vide → repli sur le nom adaptatif', () => {
      expect(
        decideKitFork({
          sourceId: 'AAA',
          sourceUserId: 'owner',
          sourceName: 'Kit Alpes',
          currentUserId: 'cloneur',
          sourceOwnerName: 'Alice',
          requestedName: '   ',
        }).name
      ).toBe('Kit Alpes — Alice');
    });
  });

  describe('assertNoServerKitFields', () => {
    it('rejette generation', () => {
      expect(() => assertNoServerKitFields({ name: 'Kit', generation: 99 })).toThrow(
        /Champ serveur interdit/
      );
    });
    it('rejette ancestors, lineage_root_id, field_proven_count', () => {
      expect(() => assertNoServerKitFields({ name: 'Kit', ancestors: [] })).toThrow(
        /Champ serveur interdit/
      );
      expect(() => assertNoServerKitFields({ name: 'Kit', lineage_root_id: 'x' })).toThrow(
        /Champ serveur interdit/
      );
      expect(() => assertNoServerKitFields({ name: 'Kit', field_proven_count: 5 })).toThrow(
        /Champ serveur interdit/
      );
    });
    it('accepte un payload normal', () => {
      expect(() =>
        assertNoServerKitFields({ name: 'Kit', description: 'ok', items: [] })
      ).not.toThrow();
    });
  });
});