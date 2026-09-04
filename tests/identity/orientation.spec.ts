import { describe, it, expect } from 'vitest';
import {
  applyOrientationPrefill,
  isValidOrientation,
  orientationToSessionParams,
  proposeOrientationUpdate,
} from '@/features/identity/orientation';

describe('Orientation & Empreinte — Lot B : l’orientation (privée, prior du configurateur)', () => {
  describe('isValidOrientation', () => {
    it('accepte une orientation vide/NULLABLE', () => {
      expect(isValidOrientation({ terrain: null })).toBe(true);
      expect(isValidOrientation({})).toBe(true);
    });
    it('accepte les valeurs du vocabulaire', () => {
      expect(isValidOrientation({ terrain: 'montagne', autonomy: 'bivouac_1_2', priority: 'legerete', experience: 'aguerri' })).toBe(true);
    });
    it('rejette toute valeur hors enum (réjeu d’invariants)', () => {
      expect(isValidOrientation({ terrain: 'voyageur' })).toBe(false);
      expect(isValidOrientation({ autonomy: 'expert' })).toBe(false);
      expect(isValidOrientation({ experience: 'trakkeur' })).toBe(false);
      expect(isValidOrientation({ source: 'chosen' })).toBe(false);
    });
  });

  describe('orientationToSessionParams (mapping pratique → prior configurateur)', () => {
    it('terrain → activité', () => {
      expect(orientationToSessionParams({ terrain: 'montagne' }).activity).toBe('Randonnée montagne');
      expect(orientationToSessionParams({ terrain: 'hors_sentier' }).activity).toBe('Trek');
    });
    it('expérience → niveau (vocabulaire configurateur)', () => {
      expect(orientationToSessionParams({ experience: 'debut' }).level).toBe('debutant');
      expect(orientationToSessionParams({ experience: 'aguerri' }).level).toBe('confirme');
    });
    it('priorité → bornes pratiques sensées', () => {
      expect(orientationToSessionParams({ priority: 'legerete' }).maxWeightG).toBeLessThan(
        orientationToSessionParams({ priority: 'confort' }).maxWeightG as number
      );
      expect(orientationToSessionParams({ priority: 'budget' }).budgetEur).toBe(400);
    });
    it('ne produit jamais un label de rôle (contrainte dure)', () => {
      const all = [orientationToSessionParams({}), ([] as const)].flat();
      void all;
      const vals = JSON.stringify({
        a: orientationToSessionParams({ terrain: 'montagne' }),
        b: orientationToSessionParams({ experience: 'aguerri' }),
      });
      for (const forbidden of ['voyageur', 'explorateur', 'trakkeur', 'niveau', 'grade', 'rang', 'palier']) {
        expect(vals.toLowerCase()).not.toContain(forbidden);
      }
    });
  });

  describe('applyOrientationPrefill — jamais silencieux, jamais surcharge', () => {
    it('NON-RÉGRESSION STRICTE : sans orientation, sessionParams inchangés', () => {
      const sessionParams = { activity: 'Randonnée', level: 'intermediaire', maxWeightG: 10000, budgetEur: 500 };
      const { sessionParams: out, prefilledFields } = applyOrientationPrefill(sessionParams, null);
      expect(out).toEqual(sessionParams);
      expect(prefilledFields).toEqual([]);
    });
    it('pré-remplit seulement les champs vides et les ANNONCE', () => {
      const { sessionParams, prefilledFields } = applyOrientationPrefill(
        { activity: '', level: '', maxWeightG: 10000, climate: '' },
        { terrain: 'itinerance', experience: 'aguerri', priority: 'legerete' }
      );
      expect(sessionParams.activity).toBe('Trekking');
      expect(sessionParams.level).toBe('confirme');
      expect(sessionParams.climate).toBe('sec');
      expect(prefilledFields).toContain('activity');
      expect(prefilledFields).toContain('level');
      expect(prefilledFields).toContain('climate');
      expect(prefilledFields).not.toContain('maxWeightG');
    });
    it('NE surcharge JAMAIS une valeur explicitement posée', () => {
      const given = { activity: 'Vanlife', level: 'debutant', maxWeightG: 15000, budgetEur: 900, climate: 'humide' };
      const { sessionParams, prefilledFields } = applyOrientationPrefill(
        given,
        { terrain: 'montagne', experience: 'aguerri', priority: 'legerete' }
      );
      // champs explicitement posés → intouchés
      expect(sessionParams.activity).toBe('Vanlife');
      expect(sessionParams.level).toBe('debutant');
      expect(sessionParams.maxWeightG).toBe(15000);
      expect(sessionParams.budgetEur).toBe(900);
      expect(sessionParams.climate).toBe('humide');
      expect(prefilledFields).toEqual([]);
    });
    it('remplit un champ optionnel absent (climate) sans toucher au reste', () => {
      const given = { activity: 'Vanlife', level: 'debutant', maxWeightG: 15000, budgetEur: 900, climate: '' };
      const { sessionParams, prefilledFields } = applyOrientationPrefill(
        given,
        { priority: 'legerete' }
      );
      expect(sessionParams.activity).toBe('Vanlife');
      expect(sessionParams.maxWeightG).toBe(15000); // legerete → 8000, mais maxWeightG posé → conservé
      expect(sessionParams.climate).toBe('sec'); // seul champ absent rempli
      expect(prefilledFields).toEqual(['climate']);
    });
  });

  describe('proposeOrientationUpdate (Boucle de correction, B.4) — propose, jamais n’applique', () => {
    it('ne corrige rien sans écart durable', () => {
      expect(proposeOrientationUpdate({ autonomy: 'bivouac_1_2' }, { bivouacsAfterDeclaredDay: false })).toEqual([]);
      expect(proposeOrientationUpdate(null, null)).toEqual([]);
    });
    it('propose un ajustement si « journée » s’est accumulé en bivouacs — mais n’applique pas', () => {
      const corrections = proposeOrientationUpdate(
        { autonomy: 'journee' },
        { bivouacsAfterDeclaredDay: true }
      );
      expect(corrections.length).toBe(1);
      expect(corrections[0].field).toBe('autonomy');
      expect(corrections[0].suggested).toBe('bivouac_1_2');
      // La proposition est un message, pas une mutation de l'orientation.
      expect(corrections[0].wording).toContain('Veux-tu');
    });
    it('n’applique JAMAIS d’office la valeur suggérée', () => {
      const orientation = { autonomy: 'journee' as const };
      proposeOrientationUpdate(orientation, { bivouacsAfterDeclaredDay: true });
      expect(orientation.autonomy).toBe('journee');
    });
  });
});