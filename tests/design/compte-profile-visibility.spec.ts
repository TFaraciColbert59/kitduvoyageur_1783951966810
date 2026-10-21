import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  accountVisibilityUpdate,
  signatureVisibilityForValue,
  PROFILE_VISIBILITY_EVENT,
} from '../../src/features/compte/data/accountVisibility';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
const declaration = read('src/components/compte/compte-liquid-glass-v8-runtime.d.ts');
const bridge = read('src/components/compte/CompteLiquidGlassV8.tsx');

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

  it('persiste la confidentialité du compte via le client RLS et rafraîchit l’hôte', () => {
    // Le pont doit écrire profile_visibility, pas signature_visibility.
    expect(bridge).toContain(".from('user_profiles')");
    expect(bridge).toMatch(/profilevis[\s\S]{0,900}profile_visibility/);
    expect(bridge).toMatch(/profilevis[\s\S]{0,900}\.eq\('id', user\.id\)/);
    expect(bridge).toContain('signatureVisibilityForValue(S.vis)');
    expect(bridge).not.toContain("S.vis === 1 ? 'world'");
    expect(bridge).toContain('PROFILE_VISIBILITY_EVENT');
    expect(bridge).toContain('previousProfileVisibility');
    expect(runtime).toContain('previousProfileVisibility');
    expect(PROFILE_VISIBILITY_EVENT).toBe('lkdv:profile-visibility');
  });
});
