import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

/**
 * C1 — un scroller horizontal dans une lentille doit rester pannable au doigt.
 *
 * Le pager ne doit plus imposer `pan-y!important` (qui gagne sur le
 * `touch-action` du rail), et chaque scroller horizontal interne doit être
 * identifiable par `data-hscroll="true"` pour que `LensPager` lui rende la
 * main au pointerdown.
 */
describe('Compte — scroll tactile des rails dans le pager', () => {
  it('marque chaque scroller horizontal interne de data-hscroll', () => {
    const community = read('src/components/compte/drawer/slots/CommunitySlot.tsx');
    const loanCard = read('src/components/compte/drawer/cards/LoanCard.tsx');
    const yearFilter = read('src/components/compte/drawer/memories/YearFilter.tsx');

    expect(community).toMatch(/data-testid="club-rail"[\s\S]{0,240}data-hscroll="true"/);
    expect(loanCard).toMatch(/className="lkdv-loan-actions"[\s\S]{0,200}data-hscroll="true"/);
    expect(yearFilter).toMatch(/overflow-x-auto[\s\S]{0,200}data-hscroll="true"/);
  });

  it('laisse le pager en pan-y par défaut, sans !important', () => {
    const shell = read('src/components/compte/drawer/SlotShell.tsx');
    const rule = shell.match(/\.lkdv-lens-pager\{[^}]*\}/)?.[0] ?? '';

    expect(rule).toContain('touch-action:pan-y');
    expect(rule).not.toMatch(/touch-action:[^;}]*!important/);
  });

  it('délègue au scroller détecté par data-hscroll', () => {
    const pager = read('src/components/compte/drawer/LensPager.tsx');
    expect(pager).toContain('[data-hscroll]');
    expect(pager).toContain("touchAction = 'auto'");
  });
});
