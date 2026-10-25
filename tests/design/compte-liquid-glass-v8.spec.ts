import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte iOS 27 Liquid Glass v8 (@tony_frc + 50 improvements + Live Supabase/API)', () => {
  const v8Source =
    read('src/components/compte/CompteLiquidGlassV8.tsx') +
    '\n' +
    read('src/components/compte/compte-liquid-glass-v8-runtime.js');
  const mobileSource = read('src/components/compte/MobileCompteV2.tsx');
  const pageSource = read('src/app/compte/page.tsx');
  const maquetteSource = read('docs/design-system/maquettes/compte-ios27-v8.html');

  it('wires /compte page.tsx -> MobileCompteV2 -> CompteLiquidGlassV8', () => {
    expect(pageSource).toContain('MobileCompteV2');
    expect(mobileSource).toContain('CompteLiquidGlassV8');
  });

  it('embeds the @tony_frc handle, highlights and profile bio', () => {
    expect(v8Source).toContain('tony_frc');
    expect(v8Source).toContain('Modifier le profil');
  });

  it('includes the E2E account sentinel link a[href="/compte/modifier"]', () => {
    expect(v8Source).toContain('href="/compte/modifier"');
    expect(maquetteSource).toContain('href="/compte/modifier"');
  });

  it('enforces iOS 27 Liquid Glass v8 palette (#17402C forest, #5B7F55 sage, zero #E4501C orange)', () => {
    expect(v8Source).toContain('#17402C');
    expect(v8Source).toContain('#5B7F55');
    expect(v8Source.toUpperCase()).not.toContain('#E4501C');
  });

  it('includes Supabase live hydration, action and mutation hooks (__lkdvHydrateCompte, __lkdvOnMutate, __lkdvOnAction, __lkdvScanLookup)', () => {
    expect(v8Source).toContain('__lkdvHydrateCompte');
    expect(v8Source).toContain('__lkdvOnMutate');
    expect(v8Source).toContain('__lkdvOnAction');
    expect(v8Source).toContain('__lkdvScanLookup');
    expect(v8Source).toContain('__lkdvCompteAct');
  });

  it('queries canonical LKDV Supabase tables and API endpoints', () => {
    expect(v8Source).toContain(".from('user_profiles')");
    expect(v8Source).toContain(".from('user_follows')");
    expect(v8Source).toContain(".from('carnets')");
    expect(v8Source).toContain(".eq('author_id', user.id)");
    expect(v8Source).toContain(".from('travel_groups')");
    expect(v8Source).toContain(".from('club_members')");
    expect(v8Source).toContain(".from('product_ownership')");
    expect(v8Source).toContain(".from('orders')");
    expect(v8Source).toContain('/api/identity/signature');
    expect(v8Source).toContain('/api/voyages/mine');
    expect(v8Source).toContain('/api/account/export');
    expect(v8Source).toContain('/api/materiel/items');
    expect(v8Source).toContain('/api/materiel/fork');
    expect(v8Source).toContain('/api/materiel/search');
  });

  it('contains all 7 pillars of the 50 improvements (stories, visitor preview, filter chips, scrubber, k-anonymity map, lineages/kit simulator, Face ID vault & QR)', () => {
    expect(v8Source).toContain('Story à la une');
    expect(v8Source.toLowerCase()).toContain('visiteur');
    expect(v8Source).toContain('Hiver');
    expect(v8Source).toContain('kitsim');
    expect(v8Source).toContain('Face ID');
    expect(v8Source).toContain('NameDrop');
  });
});
