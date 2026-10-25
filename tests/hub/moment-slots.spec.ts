import { describe, it, expect } from 'vitest';
import {
  MOMENT_SLOT_LABELS,
  momentSlotOf,
  momentTitleBody,
} from '@/features/trips/engine/momentSlots';

/**
 * T10 — Moments d'enrichissement (§4.3) : lignes `trip_steps` écrites avec
 * `metadata.kind='moment'` et titre préfixé Matin/Après-midi/Soir. Le rendu
 * itinéraire (mobile + desktop) les style par créneau — jamais une étape.
 */
describe('momentSlotOf — classement déterministe', () => {
  it('lit metadata.kind = moment et le préfixe canonique', () => {
    const slot = momentSlotOf({ title: 'Matin — Marché du village', metadata: { kind: 'moment' } });

    expect(slot).toBe('matin');
    expect(momentTitleBody('Matin — Marché du village')).toBe('Marché du village');
  });

  it('reconnaît Après-midi et Soir sans métadonnée (préfixe seul)', () => {
    expect(momentSlotOf({ title: 'Après-midi — Kayak sur le lac' })).toBe('apres-midi');
    expect(momentSlotOf({ title: 'Soir — Bivouac au col' })).toBe('soir');
  });

  it('retombe sur l’heure de passage quand le titre ne porte pas le créneau', () => {
    expect(momentSlotOf({ title: 'Détour cascade', metadata: { kind: 'moment' }, start_time: '08:30:00' })).toBe('matin');
    expect(momentSlotOf({ title: 'Détour cascade', metadata: { kind: 'moment' }, start_time: '14:00:00' })).toBe('apres-midi');
    expect(momentSlotOf({ title: 'Détour cascade', metadata: { kind: 'moment' }, start_time: '19:30:00' })).toBe('soir');
  });

  it('ne classe jamais une étape normale comme un moment', () => {
    expect(momentSlotOf({ title: 'Étape 1 — Refuge de la Vanoise', start_time: '08:00:00' })).toBeNull();
    expect(momentSlotOf({ title: 'Matinée libre' })).toBeNull();
    expect(momentSlotOf({ metadata: { kind: 'step' } })).toBeNull();
  });

  it('expose les libellés d’affichage des trois créneaux', () => {
    expect(MOMENT_SLOT_LABELS).toEqual({
      matin: 'Matin',
      'apres-midi': 'Après-midi',
      soir: 'Soir',
    });
  });
});
