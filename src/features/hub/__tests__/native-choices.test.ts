// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as nativeUI from '@/lib/native/ui';
import {
  defaultWebChoiceModal,
  defaultWebDateModal,
  presentResilientChoices,
  presentResilientDate,
  type ChoiceRequest,
} from '../lib/nativeChoices';

describe('presentResilientChoices', () => {
  const sampleRequest: ChoiceRequest = {
    title: 'Choisir une option',
    options: [
      { id: 'opt-1', title: 'Option 1', subtitle: 'Description 1' },
      { id: 'opt-2', title: 'Option 2', subtitle: 'Description 2' },
      { id: 'opt-3', title: 'Option 3', disabled: true },
    ],
  };

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('appelle le fallback web lorsque le pont natif est absent', async () => {
    vi.spyOn(nativeUI, 'hasNativeChoices').mockResolvedValue(false);
    const mockFallback = vi.fn().mockResolvedValue('opt-2');

    const result = await presentResilientChoices(sampleRequest, mockFallback);
    expect(result).toBe('opt-2');
    expect(mockFallback).toHaveBeenCalledWith(sampleRequest);
  });

  it('renvoie directement le choix natif si le pont est supporté et réussit', async () => {
    vi.spyOn(nativeUI, 'hasNativeChoices').mockResolvedValue(true);
    vi.spyOn(nativeUI, 'presentNativeChoices').mockResolvedValue('opt-1');
    const mockFallback = vi.fn();

    const result = await presentResilientChoices(sampleRequest, mockFallback);
    expect(result).toBe('opt-1');
    expect(mockFallback).not.toHaveBeenCalled();
  });

  it('renvoie null sans ouvrir le web fallback si l utilisateur annule nativement', async () => {
    vi.spyOn(nativeUI, 'hasNativeChoices').mockResolvedValue(true);
    vi.spyOn(nativeUI, 'presentNativeChoices').mockResolvedValue(null);
    const mockFallback = vi.fn();

    const result = await presentResilientChoices(sampleRequest, mockFallback);
    expect(result).toBeNull();
    expect(mockFallback).not.toHaveBeenCalled();
  });

  it('bascule sur le web fallback sans planter si le pont natif lève une exception', async () => {
    vi.spyOn(nativeUI, 'hasNativeChoices').mockResolvedValue(true);
    vi.spyOn(nativeUI, 'presentNativeChoices').mockRejectedValue(new Error('Bridge IPC broken'));
    const mockFallback = vi.fn().mockResolvedValue('opt-1');

    const result = await presentResilientChoices(sampleRequest, mockFallback);
    expect(result).toBe('opt-1');
    expect(mockFallback).toHaveBeenCalledWith(sampleRequest);
  });

  it('bascule sur le web fallback si le pont natif subit un timeout', async () => {
    vi.spyOn(nativeUI, 'hasNativeChoices').mockResolvedValue(true);
    // Simule un appel natif qui ne répond jamais
    vi.spyOn(nativeUI, 'presentNativeChoices').mockImplementation(
      () => new Promise(() => {})
    );
    const mockFallback = vi.fn().mockResolvedValue('opt-1');

    const result = await presentResilientChoices(
      { ...sampleRequest, timeoutMs: 50 },
      mockFallback
    );
    expect(result).toBe('opt-1');
    expect(mockFallback).toHaveBeenCalled();
  });

  it('le modal web par défaut permet de sélectionner une option', async () => {
    const promise = defaultWebChoiceModal(sampleRequest);

    const btn = document.querySelector('button[data-choice-id="opt-2"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();

    const result = await promise;
    expect(result).toBe('opt-2');
    expect(document.querySelector('.lkdv-choice-modal-overlay')).toBeNull();
  });

  it('le modal web par défaut permet d annuler', async () => {
    const promise = defaultWebChoiceModal(sampleRequest);

    const cancelBtn = document.querySelector('button[data-choice-cancel="true"]') as HTMLButtonElement;
    expect(cancelBtn).not.toBeNull();
    cancelBtn.click();

    const result = await promise;
    expect(result).toBeNull();
  });

  it('le modal web par défaut se ferme via la touche Escape', async () => {
    const promise = defaultWebChoiceModal(sampleRequest);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    const result = await promise;
    expect(result).toBeNull();
  });
});

describe('presentResilientDate', () => {
  it('appelle le fallback web quand le sélecteur natif de date est absent', async () => {
    vi.spyOn(nativeUI, 'hasNativeDatePicker').mockResolvedValue(false);
    const mockFallback = vi.fn().mockResolvedValue('2026-11-01');

    const result = await presentResilientDate({ title: 'Date de départ' }, mockFallback);
    expect(result).toBe('2026-11-01');
    expect(mockFallback).toHaveBeenCalled();
  });

  it('renvoie la date native si le pont est supporté', async () => {
    vi.spyOn(nativeUI, 'hasNativeDatePicker').mockResolvedValue(true);
    vi.spyOn(nativeUI, 'presentNativeDate').mockResolvedValue('2026-11-05');

    const result = await presentResilientDate({ title: 'Date de départ' });
    expect(result).toBe('2026-11-05');
  });
});
