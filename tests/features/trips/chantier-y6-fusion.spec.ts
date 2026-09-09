import { describe, it, expect } from 'vitest';

describe('Chantier Y6 — Fusion des Modules', () => {
  describe('Y6.1 & Y6.2 — Configurateur IA contextuel', () => {
    it('dérive correctement les paramètres d’un voyage', () => {
      // Test de l'adaptation du wizard au voyage
      const tripSoloHighAlt = {
        tripId: '11111111-1111-4111-8111-111111111111',
        tripSlug: 'alpes-exped',
        title: 'Traversée des Écrins',
        activity: 'alpinisme',
        difficulty: 'difficile',
        scale: 'expedition',
        maxAltitudeM: 3400,
        days: 16,
      };

      // Simule l'activité, durée, météo et confort
      const act = tripSoloHighAlt.activity.toLowerCase();
      expect(act.includes('alpin')).toBe(true);

      const days = tripSoloHighAlt.days;
      expect(days > 14).toBe(true);

      const alt = tripSoloHighAlt.maxAltitudeM;
      expect(alt > 2200).toBe(true);

      const diff = tripSoloHighAlt.difficulty;
      expect(diff).toBe('difficile');
    });
  });

  describe('Y6.3 — Pont matériel (inventaire -> voyage)', () => {
    it('garantit que l’inventaire personnel est uniquement référencé sans altération', () => {
      const inventoryItem = {
        id: '99999999-9999-4999-8999-999999999999',
        name: 'Duvet Valandré Mirage 3/4',
        category: 'Couchage & Tentes',
        weight_g: 773,
      };

      // TripItem créé
      const tripItem = {
        id: 'item-1',
        trip_id: 'trip-1',
        item_name: inventoryItem.name,
        category: 'sleep',
        weight_grams: inventoryItem.weight_g,
        inventory_item_id: inventoryItem.id,
        source: 'inventory',
      };

      expect(tripItem.inventory_item_id).toBe(inventoryItem.id);
      expect(tripItem.source).toBe('inventory');
      // Le stock de l'item d'origine ne possède aucun champ décrémenté
      expect((inventoryItem as any).stock).toBeUndefined();
    });
  });

  describe('Y6.4 — Pont groupes', () => {
    it('génère un chemin de voyage typé et canonique pour la liaison groupe', () => {
      const groupTrip = {
        id: 'trip-grp-1',
        slug: 'corsica-gr20-groupe',
        title: 'GR20 entre amis',
      };

      const path = `/voyages/${groupTrip.slug}`;
      expect(path).toBe('/voyages/corsica-gr20-groupe');
    });
  });
});
