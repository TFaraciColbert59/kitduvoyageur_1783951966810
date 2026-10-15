import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  available: vi.fn(() => true),
  show: vi.fn(async (): Promise<string | null | undefined> => 'confirm'),
  prompt: vi.fn(async (): Promise<string | null | undefined> => 'Montagne'),
}));

vi.mock('@/lib/native/ui', () => ({
  supportsNativeIOSUI: native.available,
  presentNativeActions: native.show,
  presentNativePrompt: native.prompt,
}));

import { lkvConfirm, lkvPromptAsync, resolveConfirm, resolvePrompt, subscribeConfirm, subscribePrompt } from '@/components/ui/dialogs';

const unsubscribers: Array<() => void> = [];
beforeEach(() => {
  native.available.mockReset().mockReturnValue(true);
  native.show.mockReset().mockResolvedValue('confirm');
  native.prompt.mockReset().mockResolvedValue('Montagne');
});
afterEach(() => {
  unsubscribers.splice(0).forEach((fn) => fn());
  resolveConfirm(false);
  resolvePrompt(null);
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

  it('routes existing text prompts through SwiftUI without duplicating form state', async () => {
    expect(await lkvPromptAsync({ title: 'Destination', defaultValue: 'Alpes' })).toBe('Montagne');
    expect(native.prompt).toHaveBeenCalledWith({ title: 'Destination', defaultValue: 'Alpes' });
    native.prompt.mockResolvedValueOnce(null);
    expect(await lkvPromptAsync({ title: 'Destination' })).toBeNull();
  });

  it('uses the previous web prompt when the native plugin is unavailable', async () => {
    native.prompt.mockResolvedValueOnce(undefined);
    let seen = false;
    unsubscribers.push(subscribePrompt((request) => {
      if (request) { seen = true; resolvePrompt('Web'); }
    }));
    expect(await lkvPromptAsync({ title: 'Nom' })).toBe('Web');
    expect(seen).toBe(true);
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
