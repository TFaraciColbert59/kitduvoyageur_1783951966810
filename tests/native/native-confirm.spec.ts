import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  available: vi.fn(() => true),
  show: vi.fn(async (): Promise<string | null | undefined> => 'confirm'),
}));

vi.mock('@/lib/native/ui', () => ({
  supportsNativeIOSUI: native.available,
  presentNativeActions: native.show,
}));

import { lkvConfirm, resolveConfirm, subscribeConfirm } from '@/components/ui/dialogs';

const unsubscribers: Array<() => void> = [];
beforeEach(() => {
  native.available.mockReset().mockReturnValue(true);
  native.show.mockReset().mockResolvedValue('confirm');
});
afterEach(() => {
  unsubscribers.splice(0).forEach((fn) => fn());
  resolveConfirm(false);
});

describe('site-wide native confirmations', () => {
  it('routes ordinary and destructive confirms through one SwiftUI contract', async () => {
    expect(await lkvConfirm({ title: 'Supprimer', message: 'Vraiment ?', variant: 'destructive' }))
      .toBe(true);
    expect(native.show).toHaveBeenCalledWith({
      title: 'Supprimer',
      message: 'Vraiment ?',
      actions: [
        { id: 'cancel', title: 'Annuler' },
        { id: 'confirm', title: 'Confirmer', destructive: true },
      ],
    });
  });

  it('treats native dismissal as a cancellation, not a web fallback', async () => {
    native.show.mockResolvedValueOnce(null);
    expect(await lkvConfirm('Continuer ?')).toBe(false);
  });

  it('keeps the synchronous accessible web dialog for non-native routes', async () => {
    native.available.mockReturnValue(false);
    let seen = false;
    unsubscribers.push(subscribeConfirm((request) => {
      if (request) {
        seen = true;
        resolveConfirm(true);
      }
    }));
    expect(await lkvConfirm('Continuer ?')).toBe(true);
    expect(seen).toBe(true);
    expect(native.show).not.toHaveBeenCalled();
  });

  it('falls back to web when an older iPhone app lacks the plugin', async () => {
    native.show.mockResolvedValueOnce(undefined);
    let seen = false;
    unsubscribers.push(subscribeConfirm((request) => {
      if (request) {
        seen = true;
        resolveConfirm(false);
      }
    }));
    expect(await lkvConfirm('Continuer ?')).toBe(false);
    expect(seen).toBe(true);
  });
});
