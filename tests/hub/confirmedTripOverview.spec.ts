import { describe, expect, it, vi } from 'vitest';
import { getConfirmedTripOverview } from '@/features/trips/server/getConfirmedTripOverview';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc }) }));

describe('consultation d’un voyage privé par un participant confirmé', () => {
  it('restitue les étapes et conserve des permissions de lecture seule', async () => {
    rpc.mockReturnValue({
      maybeSingle: async () => ({
        error: null,
        data: {
          id: 'voyage-1',
          slug: 'massif',
          title: 'Traversée du massif',
          participant_user_id: 'voyageur',
          participant_role: 'member',
          steps: [{ id: 'étape-1', title: 'Départ', start_time: '07:30:00' }],
        },
      }),
    });

    const trip = await getConfirmedTripOverview('massif');
    expect(rpc).toHaveBeenCalledWith('get_confirmed_trip_overview', { p_slug: 'massif' });
    expect(trip?.confirmed_participant).toEqual({ userId: 'voyageur', role: 'member' });
    expect(trip?.steps[0]).toMatchObject({ title: 'Départ', start_time: '07:30:00', description: null });
    expect(trip?.permissions).toMatchObject({
      canEdit: false, canDelete: false, canInvite: false, canViewDocuments: false, canManageBudget: false,
    });
    expect(trip?.share_token).toBeNull();
    expect(trip?.documents).toEqual([]);
  });

  it('renvoie une absence si la session ne peut pas lire le voyage', async () => {
    rpc.mockReturnValue({ maybeSingle: async () => ({ error: null, data: null }) });
    expect(await getConfirmedTripOverview('massif')).toBeNull();
  });
});
