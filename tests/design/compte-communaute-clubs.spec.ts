import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Communauté — drawer club autonome et rail mobile', () => {
  it('porte le CSS plein écran et le backdrop avec ClubDrawer, pas avec le slot', () => {
    const css = read('src/components/compte/drawer/ClubDrawer.css');
    const drawer = read('src/components/compte/drawer/ClubDrawer.tsx');
    const slot = read('src/components/compte/drawer/slots/CommunitySlot.tsx');

    expect(drawer).toContain("import './ClubDrawer.css'");
    expect(css).toContain('.lkdv-club-dialog');
    expect(css).toMatch(/position:\s*fixed/);
    expect(css).toMatch(/width:\s*100%/);
    expect(css).toMatch(/height:\s*100%/);
    expect(css).toContain('::backdrop');
    expect(css).toMatch(/backdrop-filter:\s*blur/);

    // Le CSS du dialogue ne doit plus dépendre de la lentille Clubs du slot.
    expect(slot).not.toContain('.lkdv-club-dialog');
  });

  it('laisse le rail gérer les deux axes et bloquer le swipe du pager', () => {
    const slot = read('src/components/compte/drawer/slots/CommunitySlot.tsx');
    expect(slot).toContain('touch-action:pan-x pan-y');
    expect(slot).toContain('touchAction: \'pan-x pan-y\'');
    expect(slot).toContain('onPointerDown={(event) => event.stopPropagation()}');
  });
});
