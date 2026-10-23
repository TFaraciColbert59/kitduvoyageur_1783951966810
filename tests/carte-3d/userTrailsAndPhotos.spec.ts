import { describe, it, expect } from 'vitest';
import { userFootprintService } from '@/features/carte-3d/services/userFootprintService';

describe('Carte 3D — User Personal Trails, Photos & Field Notes', () => {
  it('les photos géolocalisées ont des coordonnées et altitudes cohérentes avec le relief', async () => {
    const photos = await userFootprintService.fetchUserPhotos('tony_frc');
    expect(photos.length).toBeGreaterThan(0);

    photos.forEach((photo) => {
      // Coordonnées géographiques valides
      expect(photo.lng).toBeGreaterThan(-180);
      expect(photo.lng).toBeLessThan(180);
      expect(photo.lat).toBeGreaterThan(-90);
      expect(photo.lat).toBeLessThan(90);

      // Altitude de montagne crédible
      expect(photo.altitudeM).toBeGreaterThan(500);
      expect(photo.altitudeM).toBeLessThan(5000);

      // Titre non vide
      expect(photo.title.trim().length).toBeGreaterThan(0);
    });
  });

  it('les notes de terrain couvrent les catégories indispensables de l aventure', async () => {
    const notes = await userFootprintService.fetchUserFieldNotes('tony_frc');
    const categories = notes.map((n) => n.category);

    expect(categories).toContain('source');
    expect(categories).toContain('delicate_passage');
    expect(categories).toContain('wildlife');
    expect(categories).toContain('camp');
  });

  it('les détails de massif incluent le matériel testé pour chaque sortie archivée', async () => {
    const details = await userFootprintService.fetchUserMassifDetails('tony_frc', 'mont-blanc');
    const completedOuting = details.outings.find((o) => o.status === 'completed');

    expect(completedOuting).toBeDefined();
    expect(completedOuting?.gearTested.length).toBeGreaterThan(0);
    expect(completedOuting?.gearTested.some((g) => g.includes('Osprey'))).toBe(true);
  });

  it('les sommets conquis contiennent la date et une altitude officielle', async () => {
    const details = await userFootprintService.fetchUserMassifDetails('tony_frc', 'mont-blanc');
    expect(details.summitsConquered.length).toBeGreaterThan(0);

    const montBlanc = details.summitsConquered.find((s) => s.id === 'summit-mont-blanc');
    expect(montBlanc).toBeDefined();
    expect(montBlanc?.altitudeM).toBe(4809);
    expect(montBlanc?.conqueredDate).toBeDefined();
  });
});
