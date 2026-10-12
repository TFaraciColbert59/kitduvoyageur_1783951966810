// @vitest-environment jsdom

/**
 * PLAN-100 5.3 (lot Z2) : la mention « IA » du Compas.
 *
 * Principe : la personne sait quand une IA intervient et quel contenu vient d'elle, en TEXTE
 * (jamais une icône seule). La mention n'existe que s'il y a une IA derrière : interrupteur
 * `AI_MODE=off`, ou IA qui n'a rien produit → rien ne parle d'IA.
 *
 * Source relue le 11 oct. 2026 : règlement (UE) 2024/1689, art. 50, §1 (informer la personne
 * qu'elle interagit avec une IA), §5 (information claire et distincte, au plus tard à la
 * première exposition, conforme aux exigences d'accessibilité).
 * https://artificialintelligenceact.eu/article/50/
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/compas',
}));
vi.mock('../server/compasActions', () => ({ compasCreateTripAction: vi.fn() }));

import { AiNotice } from '../components/AiNotice';
import { CompasPrep, type PrepState } from '../components/CompasPrep';
import { CompasStart } from '../components/CompasStart';
import {
  AI_NOTICE_DONE,
  AI_NOTICE_RUN,
  AI_STEP_LABEL,
  readAiProposed,
  withAiProposed,
} from '../engine/aiNotice';

afterEach(cleanup);

const noop = vi.fn();
const prep = (state: PrepState, aiOn?: boolean) =>
  render(
    <CompasPrep prep={state} aiOn={aiOn} onStop={noop} onClose={noop} onRetry={noop} onEditRequest={noop} />
  );

const scan = async (root: Element): Promise<string[]> => {
  const res = await axe.run(root as HTMLElement, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: {
      'color-contrast': { enabled: false },
      region: { enabled: false },
      'landmark-one-main': { enabled: false },
      'page-has-heading-one': { enabled: false },
    },
  });
  return res.violations.map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
};

describe('marque « proposée par l’IA » sur une étape (métadonnées)', () => {
  it('une étape de l’IA porte la marque, sans perdre la source de sa distance', () => {
    const meta = withAiProposed({ distance: { source: 'geoapify' } }, true);
    expect(meta).toEqual({ distance: { source: 'geoapify' }, aiProposed: true });
    expect(readAiProposed(meta)).toBe(true);
  });

  it('une étape calculée par le Compas ne porte aucune marque (objet inchangé)', () => {
    const meta = { distance: { source: 'valhalla' } };
    expect(withAiProposed(meta, false)).toEqual(meta);
    expect(readAiProposed(withAiProposed(meta, false))).toBe(false);
    expect(readAiProposed({})).toBe(false);
  });

  it('lecture tolérante : seul `true` compte (jamais une chaîne, un nombre, null)', () => {
    for (const bad of [null, undefined, 'true', 1, [], { aiProposed: 'true' }, { aiProposed: 1 }, { aiProposed: false }])
      expect(readAiProposed(bad)).toBe(false);
    expect(readAiProposed({ aiProposed: true })).toBe(true);
  });
});

describe('<AiNotice />', () => {
  it('une note textuelle (role note), pas seulement une icône ; l’icône est décorative', () => {
    const { container } = render(<AiNotice variant="run" />);
    const note = screen.getByRole('note');
    expect(note.textContent).toContain(AI_NOTICE_RUN);
    // Le texte porte l’information : l’icône éventuelle est cachée aux lecteurs d’écran.
    for (const icon of Array.from(container.querySelectorAll('svg, [role="img"]')))
      expect(icon.getAttribute('aria-hidden')).toBe('true');
  });

  it('variante « terminé » : dit où se reconnaître l’IA', () => {
    render(<AiNotice variant="done" />);
    expect(screen.getByRole('note').textContent).toContain(AI_NOTICE_DONE);
    expect(AI_NOTICE_DONE).toContain(AI_STEP_LABEL);
    expect(AI_NOTICE_DONE).toContain('Suggestion de l’IA');
  });

  it('tutoiement et sobriété : aucune promesse de fiabilité', () => {
    for (const t of [AI_NOTICE_RUN, AI_NOTICE_DONE]) {
      expect(t).not.toMatch(/\bvous\b|\bvotre\b|\bvos\b/i);
      expect(t).not.toMatch(/garanti|infaillible|100 ?%|toujours juste/i);
    }
  });
});

describe('préparation : la mention vient avec l’IA, pas sans elle', () => {
  it('en cours, IA allumée : la mention est là, avant la première production', () => {
    prep({ stage: 'understand' }, true);
    expect(screen.getByRole('note').textContent).toContain(AI_NOTICE_RUN);
  });

  it('en cours, IA éteinte (AI_MODE=off) : rien ne parle d’IA', () => {
    const { container } = prep({ stage: 'understand' }, false);
    expect(screen.queryByRole('note')).toBeNull();
    expect(container.textContent ?? '').not.toMatch(/\bIA\b|intelligence artificielle/i);
  });

  it('IA allumée sans que le drapeau soit passé : pas de mention (le défaut est « éteinte »)', () => {
    prep({ stage: 'itinerary' });
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('terminée : la mention reste seulement si l’IA a contribué', () => {
    const { unmount } = prep({ stage: 'done', total: 'Budget 210 €', usedAi: true }, true);
    expect(screen.getByRole('note').textContent).toContain(AI_NOTICE_DONE);
    unmount();
    prep({ stage: 'done', total: 'Budget 210 €', usedAi: false }, true);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('terminée par les règles seules (IA éteinte) : aucune mention, même si le drapeau traîne', () => {
    prep({ stage: 'done', usedAi: true }, false);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('erreur ou arrêt : pas de mention (rien n’a été produit de plus)', () => {
    const { unmount } = prep({ stage: 'error', at: 'itinerary', message: 'Coupée.' }, true);
    expect(screen.queryByRole('note')).toBeNull();
    unmount();
    prep({ stage: 'stopped', at: 'rest', message: 'Arrêtée.' }, true);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('axe-core : zéro violation, IA allumée (en cours et terminée)', async () => {
    const run = prep({ stage: 'understand' }, true);
    expect(await scan(run.container)).toEqual([]);
    run.unmount();
    const done = prep({ stage: 'done', total: 'Budget 210 €', digest: '3 nuits', usedAi: true }, true);
    expect(await scan(done.container)).toEqual([]);
  });
});

describe('Compas vide : la mention avant le premier envoi', () => {
  it('IA allumée : dite sous « Préparer mon aventure », avec le lien vers la confidentialité', () => {
    render(<CompasStart signedIn aiOn />);
    const note = screen.getByRole('note');
    expect(note.textContent).toContain(AI_NOTICE_RUN);
    const link = note.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/politique-confidentialite');
    // Dans le DOM, la mention vient après le bouton qui lance la préparation.
    const button = screen.getByRole('button', { name: /Préparer mon aventure/ });
    expect(button.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('IA éteinte ou non précisée : aucune mention', () => {
    const off = render(<CompasStart signedIn aiOn={false} />);
    expect(screen.queryByRole('note')).toBeNull();
    expect(off.container.textContent ?? '').not.toMatch(/\bIA\b/);
    off.unmount();
    render(<CompasStart signedIn />);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('axe-core : zéro violation avec la mention', async () => {
    const { container } = render(<CompasStart signedIn aiOn />);
    expect(await scan(container)).toEqual([]);
  });
});

describe('panneau de préparation : la mention ne le fait pas sortir de l’écran', () => {
  it('il défile au lieu de déborder (paysage, écran court) : « Arrêter » reste atteignable', () => {
    const css = readFileSync(path.resolve(__dirname, '../compas.css'), 'utf8');
    const block = /\n\.cp-prep \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(block).toMatch(/max-height:\s*calc\(100dvh/);
    expect(block).toMatch(/overflow-y:\s*auto/);
  });
});
