import { describe, expect, it } from 'vitest';
import { loadOnboarding } from '../onboarding';

function fakeSupabase(counts: Record<string, number>) {
  return {
    from(table: string) {
      const query = {
        count: counts[table] ?? 0,
        error: null as unknown,
        select() {
          return query;
        },
        eq() {
          return query;
        },
        maybeSingle() {
          return Promise.resolve({
            data:
              table === 'user_profiles'
                ? {
                    created_at: new Date().toISOString(),
                    full_name: 'Nouveau Voyageur',
                    handle: 'nouveau',
                    bio: '',
                    location: '',
                    avatar_url: '',
                  }
                : null,
            error: null,
          });
        },
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve({ count: query.count, error: null }).then(resolve);
        },
      };
      return query;
    },
  } as never;
}

describe('onboarding', () => {
  it('détecte un compte neuf sans activité et liste les cinq étapes', async () => {
    const payload = await loadOnboarding(fakeSupabase({}), 'u1');
    expect(payload.isNew).toBe(true);
    expect(payload.steps).toHaveLength(5);
    expect(payload.steps.every((step) => !step.done)).toBe(true);
    expect(payload.profileCompletion).toBe(40);
  });

  it('ne considère pas un compte actif comme neuf', async () => {
    const payload = await loadOnboarding(
      fakeSupabase({ hike_sessions: 1, materiel_kits: 1, user_follows: 1 }),
      'u1'
    );
    expect(payload.isNew).toBe(false);
    expect(payload.steps.find((step) => step.id === 'outing')?.done).toBe(true);
    expect(payload.steps.find((step) => step.id === 'kit')?.done).toBe(true);
  });
});
