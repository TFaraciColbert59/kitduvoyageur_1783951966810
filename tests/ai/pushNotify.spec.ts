import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { sendNotificationMock, serviceFromMock } = vi.hoisted(() => ({
  sendNotificationMock: vi.fn(async (..._args: unknown[]) => {}),
  serviceFromMock: vi.fn(),
}));

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: sendNotificationMock,
  },
}));

vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: () => ({ from: serviceFromMock }),
}));

import { sendPushToUser } from '../../src/lib/ai/pushNotify';

function subscriptionChain(subs: { subscription: unknown }[]) {
  const eq = vi.fn(async () => ({ data: subs, error: null }));
  const select = vi.fn(() => ({ eq }));
  serviceFromMock.mockReturnValue({ select });
  return { select, eq };
}

describe('src/lib/ai/pushNotify — notification web-push (carnet prêt)', () => {
  beforeEach(() => {
    sendNotificationMock.mockClear().mockResolvedValue(undefined);
    serviceFromMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('TEST-PUSH-01: VAPID absentes → false, aucun envoi, aucune requête', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', undefined);
    vi.stubEnv('VAPID_PRIVATE_KEY', undefined);

    const result = await sendPushToUser('11111111-1111-4111-8111-111111111111', {
      title: 'Votre carnet est prêt',
      body: 'Récit disponible',
    });

    expect(result).toBe(false);
    expect(sendNotificationMock).not.toHaveBeenCalled();
    expect(serviceFromMock).not.toHaveBeenCalled();
  });

  it('TEST-PUSH-02: abonnements présents → sendNotification par abonnement, true', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'pub-key');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv-key');
    subscriptionChain([
      { subscription: { endpoint: 'https://fcm/1', keys: { p256dh: 'a', auth: 'b' } } },
      { subscription: { endpoint: 'https://fcm/2', keys: { p256dh: 'c', auth: 'd' } } },
    ]);

    const result = await sendPushToUser('11111111-1111-4111-8111-111111111111', {
      title: 'Votre carnet est prêt',
      body: 'Récit disponible',
    });

    expect(result).toBe(true);
    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
    const payload = JSON.parse(sendNotificationMock.mock.calls[0][1] as string);
    expect(payload.title).toBe('Votre carnet est prêt');
  });

  it('TEST-PUSH-03: échec d’un envoi → les autres abonnements tentés quand même', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'pub-key');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv-key');
    sendNotificationMock
      .mockRejectedValueOnce(new Error('410 Gone'))
      .mockResolvedValueOnce(undefined);
    subscriptionChain([
      { subscription: { endpoint: 'https://fcm/1' } },
      { subscription: { endpoint: 'https://fcm/2' } },
    ]);

    const result = await sendPushToUser('11111111-1111-4111-8111-111111111111', {
      title: 'T',
      body: 'B',
    });

    expect(result).toBe(true);
    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
  });

  it('TEST-PUSH-04: tous les envois échouent → false (jamais de throw)', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'pub-key');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv-key');
    sendNotificationMock.mockRejectedValue(new Error('boom'));
    subscriptionChain([{ subscription: { endpoint: 'https://fcm/1' } }]);

    await expect(
      sendPushToUser('11111111-1111-4111-8111-111111111111', { title: 'T', body: 'B' })
    ).resolves.toBe(false);
  });
});
