import { describe, expect, it } from 'vitest';
import { buildCockpitReservations } from '@/features/hub/cockpit/booking';
import { privateMomentMediaPath, privateMomentMediaRef } from '@/features/carnet/detail/privateMomentMedia';

describe('réservations du cockpit', () => {
  it('retire les réservations confirmées et trie par échéance renseignée', () => {
    const context = {
      trip: {
        destination_name: 'Queyras',
        steps: [
          { id: 'done', title: 'Déjà réservé', accommodation_name: 'Refuge réservé', day_number: 1 },
          { id: 'public-transport', title: 'Bus', transport_mode: 'bus', day_number: 2 },
          { id: 'walk', title: 'Marche', transport_mode: 'foot', day_number: 2 },
          { id: 'must-book', title: 'Refuge', day_number: 3, metadata: { booking_required: true, booking_due_at: '2026-11-17' } },
        ],
      },
      bookingByStepId: {},
    } satisfies Parameters<typeof buildCockpitReservations>[0];
    const result = buildCockpitReservations(context, [
      { id: 'confirmed', vertical: 'hotel', status: 'confirmed', metadata: { step_id: 'done' } },
      { id: 'pending', vertical: 'activity', status: 'pending', metadata: { title: 'Navette', due_at: '2026-11-20T10:30:00Z' } },
      { id: 'held', vertical: 'car', status: 'held', metadata: { title: 'Transport', due_at: '2026-11-31' } },
    ]);
    expect(result.map(({ id, status, due }) => [id, status, due])).toEqual([
      ['step-must-book', 'À réserver', '2026-11-17'],
      ['pending', 'En attente', '2026-11-20'],
      ['step-public-transport', 'À vérifier', null],
      ['held', 'En attente', null],
    ]);
  });
});

describe('références des médias privés de carnet', () => {
  const carnet = '1d51ae48-d25c-489c-a7d5-652b7fbbbf00';
  const owner = 'cf1f672d-e950-49c7-908c-f3c7a332f524';
  const filename = '137668bc-fdaf-4ba4-8cd7-0e3a1cc22184.jpg';

  it('encadre la référence dans le carnet concerné', () => {
    const ref = privateMomentMediaRef(carnet, owner, filename);
    expect(privateMomentMediaPath(ref, carnet)).toBe(`${owner}/carnet-moments/${carnet}/${filename}`);
    expect(privateMomentMediaPath(ref, owner)).toBeNull();
    expect(privateMomentMediaPath(privateMomentMediaRef(carnet, owner, '../secret.jpg'))).toBeNull();
    expect(privateMomentMediaPath(privateMomentMediaRef(carnet, owner, filename.replace('.jpg', 'Xjpg')))).toBeNull();
  });
});
