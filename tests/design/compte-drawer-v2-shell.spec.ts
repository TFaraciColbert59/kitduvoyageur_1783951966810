import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte drawer v2 — sélecteur, swipe et carte contexte', () => {
  it('réutilise ig-tabs, gère le swipe et la carte contexte', () => {
    const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
    const selector = read('src/components/compte/drawer/SlotSelector.tsx');
    const pager = read('src/components/compte/drawer/LensPager.tsx');
    expect(runtime).toContain('__lkdvOpenSlot');
    expect(runtime).toContain('lkdv-slot-root');
    expect(runtime).toContain('data-map-context');
    expect(selector).toContain('segc');
    expect(selector).toContain('lg-tabs');
    expect(selector).toContain('sel-lens');
    expect(read('src/components/compte/drawer/SlotShell.tsx')).toContain('ig-tabs');
    expect(selector).toContain('vitrine');
    expect(selector).toContain('kit');
    expect(selector).toContain('prets');
    expect(selector).toContain('souvenirs');
    expect(selector).toContain('communaute');
    expect(pager).toContain('pointerdown');
    expect(pager).toContain('translateX');
  });

  it('expose les 5 slots et leurs états vides', () => {
    const slots: Array<[string, string]> = [
      ['VitrineSlot', 'VitrineSlot'],
      ['KitSlot', 'KitSlot'],
      ['LoansSlot', 'LoansSlot'],
      ['MemoriesSlot', 'MemoriesSlot'],
      ['CommunitySlot', 'CommunitySlot'],
    ];
    const host = read('src/components/compte/drawer/ProfileDrawerHost.tsx');
    const shell = read('src/components/compte/drawer/SlotShell.tsx');
    expect(shell).toContain("'slot-content'");
    expect(shell).toContain('slot-pane-');
    expect(host).toContain("activeSlot = 'vitrine'");
    expect(host).toContain('portalRoot');
    for (const [file, exported] of slots) {
      const rel = `src/components/compte/drawer/slots/${file}.tsx`;
      expect(existsSync(resolve(root, rel))).toBe(true);
      const source = read(rel);
      expect(source).toContain(`export function ${exported}`);
      expect(source).toContain('data-testid="slot-content"');
      expect(host).toContain(exported);
    }
  });

  it('remappe les onglets legacy et sécurise l’entrée du drawer', () => {
    const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
    const compte = read('src/components/compte/CompteLiquidGlassV8.tsx');
    expect(runtime).toMatch(
      /window\.__lkdvOpenSlot = function\(slotId\) \{[\s\S]*?S\.step = 0;/
    );
    expect(runtime).toContain('tb === "3" ? "communaute" : "vitrine"');
    expect(runtime).toContain(
      'openSheet("step", S.step === 0 ? 0 : (+tb || 0), "large")'
    );
    expect(compte).toContain("__lkdvOpenSlot?.('communaute')");
    expect(compte).toContain("act('openAccountDrawer')");
    expect(compte).toContain("act('openStep', '3:3')");
  });
});
