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
    expect(selector).toContain('ig-tabs');
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
    for (const [file, exported] of slots) {
      const rel = `src/components/compte/drawer/slots/${file}.tsx`;
      expect(existsSync(resolve(root, rel))).toBe(true);
      const source = read(rel);
      expect(source).toContain(`export function ${exported}`);
      expect(source).toContain('data-testid="slot-content"');
      expect(host).toContain(exported);
    }
  });
});
