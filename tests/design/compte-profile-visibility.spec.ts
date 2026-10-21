import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  accountVisibilityUpdate,
  signatureVisibilityForValue,
  PROFILE_VISIBILITY_EVENT,
} from '../../src/features/compte/data/accountVisibility';
import {
  persistProfileVisibility,
  rejectProfileVisibility,
} from '../../src/features/compte/data/profileVisibilityBridge';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
const declaration = read('src/components/compte/compte-liquid-glass-v8-runtime.d.ts');
const bridge = read('src/components/compte/CompteLiquidGlassV8.tsx');
const bridgeHelper = read('src/features/compte/data/profileVisibilityBridge.ts');

describe('Compte — confidentialité du compte et visibilité de l’empreinte', () => {
  it('expose une action setprofilevis exacte, idempotente et rejette l’inconnu', async () => {
    const runtimeModule = (await import(
      '../../src/components/compte/compte-liquid-glass-v8-runtime.js'
    )) as unknown as {
      resolveProfileVis?: (value: unknown) => 'public' | 'prive' | null;
      applyProfileVis?: (
        current: unknown,
        value: unknown
      ) => 'public' | 'prive' | null;
    };

    expect(typeof runtimeModule.resolveProfileVis).toBe('function');
    expect(typeof runtimeModule.applyProfileVis).toBe('function');
    const resolveProfileVis = runtimeModule.resolveProfileVis as (
      value: unknown
    ) => 'public' | 'prive' | null;
    const applyProfileVis = runtimeModule.applyProfileVis as (
      current: unknown,
      value: unknown
    ) => 'public' | 'prive' | null;

    // Deux valeurs exactes, aucune traduction inventée.
    expect(resolveProfileVis('public')).toBe('public');
    expect(resolveProfileVis('prive')).toBe('prive');

    for (const unknown of [
      'publique',
      'privée',
      'PRIVE',
      'communaute',
      'private',
      'world',
      '',
      '  ',
      0,
      1,
      2,
      null,
      undefined,
      {},
      [],
    ]) {
      expect(resolveProfileVis(unknown)).toBeNull();
      expect(applyProfileVis('public', unknown)).toBeNull();
    }

    // Idempotence : une cible déjà atteinte ne produit aucun changement.
    expect(applyProfileVis('public', 'public')).toBe('public');
    expect(applyProfileVis('prive', 'prive')).toBe('prive');
    expect(applyProfileVis('public', 'prive')).toBe('prive');
    expect(applyProfileVis(null, 'public')).toBe('public');
  });

  it('déclare le contrat runtime (action setprofilevis et helpers)', () => {
    expect(runtime).toContain('export function resolveProfileVis(value)');
    expect(runtime).toContain('export function applyProfileVis(current, value)');
    expect(runtime).toContain('if (a === "setprofilevis")');
    expect(runtime).toContain('const target = applyProfileVis(S.profileVisibility, v);');
    expect(runtime).toContain('doMut("profilevis", target);');
    expect(runtime).toContain('profilevis: v =>');
    expect(runtime).toContain('S.profileVisibility = target;');
    // `openslot` doit reproduire le contrat public `__lkdvOpenSlot`.
    expect(runtime).toMatch(
      /case "openslot": S\.step = 0; S\.slot = slotIdOf\(v\);/
    );

    expect(declaration).toContain(
      "export declare function resolveProfileVis(value: unknown): 'public' | 'prive' | null;"
    );
    expect(declaration).toContain(
      "export declare function applyProfileVis(current: unknown, value: unknown): 'public' | 'prive' | null;"
    );
    expect(declaration).toContain('setprofilevis');
    expect(declaration).toContain('interface Window');
    expect(declaration).toContain('__lkdvSetProfileVisibility?: SetProfileVisAction');
  });

  it('mappe la visibilité de l’empreinte sur le CHECK signature_visibility', () => {
    // signature_visibility accepte private | communaute | public.
    expect(signatureVisibilityForValue(0)).toBe('private');
    expect(signatureVisibilityForValue(1)).toBe('communaute');
    expect(signatureVisibilityForValue(2)).toBe('public');
    expect(signatureVisibilityForValue('1')).toBe('communaute');
    expect(signatureVisibilityForValue(null)).toBeNull();
    expect(signatureVisibilityForValue(3)).toBeNull();
    // `world` est une valeur de carnet, jamais une valeur signature.
    expect(signatureVisibilityForValue(1)).not.toBe('world');
  });

  it('prépare la mise à jour profile_visibility avec les deux valeurs exactes', () => {
    expect(accountVisibilityUpdate('public')).toEqual({ profile_visibility: 'public' });
    expect(accountVisibilityUpdate('prive')).toEqual({ profile_visibility: 'prive' });
    for (const unknown of ['communaute', 'private', 'world', 0, 1, null, undefined]) {
      expect(accountVisibilityUpdate(unknown)).toBeNull();
    }
  });

  it('ne confirme la persistance qu’après lecture de la valeur écrite', async () => {
    const deferred: { resolve?: (value: unknown) => void } = {};
    const maybeSingle = vi.fn(
      () =>
        new Promise((resolve) => {
          deferred.resolve = resolve;
        })
    );
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({ maybeSingle })),
      })),
    }));
    const client = { from: vi.fn(() => ({ update })) };
    const onPersisted = vi.fn();
    const onFailed = vi.fn();
    const onRollback = vi.fn();

    const pending = persistProfileVisibility({
      client,
      userId: 'user-1',
      value: 'prive',
      previous: 'public',
      onPersisted,
      onFailed,
      onRollback,
    });

    // Aucun succès tant que la lecture de confirmation n’a pas répondu.
    expect(onPersisted).not.toHaveBeenCalled();
    expect(onFailed).not.toHaveBeenCalled();

    deferred.resolve?.({
      data: { profile_visibility: 'prive' },
      error: null,
    });
    await expect(pending).resolves.toBe(true);

    expect(client.from).toHaveBeenCalledWith('user_profiles');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ profile_visibility: 'prive' })
    );
    expect(onPersisted).toHaveBeenCalledWith('prive');
    expect(onFailed).not.toHaveBeenCalled();
    expect(onRollback).not.toHaveBeenCalled();
  });

  it('échoue sans succès et rétablit la valeur précédente sur erreur', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: null,
      error: { message: 'row level security' },
    }));
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({ maybeSingle })),
      })),
    }));
    const onPersisted = vi.fn();
    const onFailed = vi.fn();
    const onRollback = vi.fn();

    const persisted = await persistProfileVisibility({
      client: { from: vi.fn(() => ({ update })) },
      userId: 'user-1',
      value: 'prive',
      previous: 'public',
      onPersisted,
      onFailed,
      onRollback,
    });

    expect(persisted).toBe(false);
    expect(onPersisted).not.toHaveBeenCalled();
    expect(onRollback).toHaveBeenCalledWith('public');
    expect(onFailed).toHaveBeenCalledWith({
      value: 'prive',
      persisted: false,
      revertedTo: 'public',
    });
  });

  it('répond persisted:false et rétablit l’état sans session ou sans pont', () => {
    const onFailed = vi.fn();
    const onRollback = vi.fn();

    const handled = rejectProfileVisibility({
      value: 'prive',
      previous: 'public',
      onFailed,
      onRollback,
    });

    expect(handled).toBe(true);
    expect(onRollback).toHaveBeenCalledWith('public');
    expect(onFailed).toHaveBeenCalledWith({
      value: 'prive',
      persisted: false,
      revertedTo: 'public',
    });

    // Valeur inconnue : rien n’est annoncé, rien n’est rétabli.
    onFailed.mockClear();
    onRollback.mockClear();
    expect(
      rejectProfileVisibility({
        value: 'communaute',
        previous: 'public',
        onFailed,
        onRollback,
      })
    ).toBe(false);
    expect(onFailed).not.toHaveBeenCalled();
    expect(onRollback).not.toHaveBeenCalled();
  });

  it('échoue quand la valeur relue ne correspond pas à la cible', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: { profile_visibility: 'public' },
      error: null,
    }));
    const onPersisted = vi.fn();
    const onFailed = vi.fn();
    const onRollback = vi.fn();

    const persisted = await persistProfileVisibility({
      client: {
        from: vi.fn(() => ({
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({ maybeSingle })),
            })),
          })),
        })),
      },
      userId: 'user-1',
      value: 'prive',
      previous: null,
      onPersisted,
      onFailed,
      onRollback,
    });

    expect(persisted).toBe(false);
    expect(onPersisted).not.toHaveBeenCalled();
    expect(onRollback).not.toHaveBeenCalled();
    expect(onFailed).toHaveBeenCalledWith({ value: 'prive', persisted: false });
  });

  it('persiste la confidentialité du compte via le client RLS et rafraîchit l’hôte', () => {
    // Le pont délègue l'écriture à un helper testable et n'écrit jamais
    // `signature_visibility` pour la confidentialité du compte.
    expect(bridge).toContain('persistProfileVisibility');
    expect(bridge).toContain('profilevis');
    expect(bridgeHelper).toContain("from('user_profiles')");
    expect(bridgeHelper).toMatch(/update\(\{[\s\S]*profile_visibility/);
    expect(bridgeHelper).toContain(".eq('id', options.userId)");
    expect(bridgeHelper).toContain(".select('profile_visibility')");
    expect(bridgeHelper).toContain('maybeSingle');
    expect(bridge).toContain('signatureVisibilityForValue(S.vis)');
    expect(bridge).not.toContain("S.vis === 1 ? 'world'");
    expect(bridge).toContain('PROFILE_VISIBILITY_EVENT');
    expect(bridge).toContain('previousProfileVisibility');
    expect(bridge).toContain('persistProfileVisibility');
    expect(runtime).toContain('previousProfileVisibility');
    expect(PROFILE_VISIBILITY_EVENT).toBe('lkdv:profile-visibility');
  });
});
