// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

/**
 * Plan 5.1 : « Squelette de chargement et page d'erreur propres au Compas ».
 *
 * Chargement : un squelette qui reprend la forme du vrai Compas (capsule des cinq
 * étapes, carte d'étape, carte en bas), pour qu'il n'y ait aucun saut quand
 * l'écran réel arrive ; annoncé une fois aux lecteurs d'écran, sans élément
 * cliquable, immobile si la personne a demandé moins d'animation.
 * Erreur : dans la langue visuelle du Compas, tutoyée, sans message interne,
 * avec la référence des journaux, « Réessayer » qui relit le serveur.
 */

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/compas' }));
// Le shell (barre, fond, stores) n'est pas l'objet : on garde son contenu.
vi.mock('@/components/shell/AppShell', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}));
// Le thème clair touche au document et à matchMedia : testé à part, absent ici.
vi.mock('@/features/compas/components/CompasLightTheme', () => ({ CompasLightTheme: () => null }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import CompasLoading from '@/app/compas/loading';
import CompasError from '@/app/compas/error';
import { COMPAS_STEPS } from '../engine/compasModel';

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

beforeEach(() => {
  router.refresh.mockClear();
});
afterEach(cleanup);

describe('chargement du Compas', () => {
  it('reprend la forme du vrai écran : racine .compas, capsule d’étapes, carte d’étape, carte', () => {
    const { container } = render(<CompasLoading />);
    const root = container.querySelector('.compas');
    expect(root).not.toBeNull();
    expect(root!.querySelector('.cp-top .cp-headrow .cp-steps')).not.toBeNull();
    expect(root!.querySelectorAll('.cp-steps .cp-step')).toHaveLength(COMPAS_STEPS.length);
    expect(root!.querySelector('.cp-top > .cp-card')).not.toBeNull();
    expect(root!.querySelector(':scope > .cp-map')).not.toBeNull();
    // Même fond que la page (paysage), sinon il clignote à l'arrivée du vrai écran.
    expect(root!.querySelector('.cp-bg')).not.toBeNull();
  });

  it('est annoncé une fois : un seul état « chargement », les formes sont muettes', () => {
    const { container } = render(<CompasLoading />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.textContent).toContain('Ouverture du Compas…');
    // Tout ce qui est dessiné est masqué aux lecteurs d'écran ; seul le texte parle.
    for (const part of container.querySelectorAll('.cp-top, .cp-map')) {
      expect(part.getAttribute('aria-hidden')).toBe('true');
    }
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('ne propose rien de cliquable tant que le Compas n’est pas là', () => {
    const { container } = render(<CompasLoading />);
    expect(container.querySelectorAll('button, a, input, textarea, select, [tabindex]')).toHaveLength(0);
  });
});

describe('squelette : styles du Compas', () => {
  const css = read('src/features/compas/compas.css');
  const skeleton = css.slice(css.indexOf('/* ---------- Squelette de chargement'));

  it('le bloc de squelette existe', () => {
    expect(css).toContain('/* ---------- Squelette de chargement');
    expect(skeleton).toMatch(/\.cp-skel\s*\{/);
  });

  it('couleurs prises aux jetons --lkv-*, aucune couleur littérale', () => {
    expect(skeleton).toMatch(/var\(--lkv-ink-900\)/);
    expect(skeleton).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(skeleton).not.toMatch(/rgba?\(/);
    expect(skeleton).not.toMatch(/E4501C/i);
  });

  it('anime l’opacité seulement (jamais de position ni de dimension)', () => {
    const keyframes = skeleton.match(/@keyframes cp-skel-pulse\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(keyframes).toMatch(/opacity/);
    expect(keyframes).not.toMatch(/\b(width|height|top|left|right|bottom|margin|padding|background)/);
  });

  it('s’immobilise avec prefers-reduced-motion', () => {
    expect(skeleton).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.cp-skel[^}]*\{[^}]*animation:\s*none/
    );
  });

  it('loading.tsx et error.tsx chargent la feuille du Compas (sans elle le squelette arrive nu)', () => {
    for (const f of ['src/app/compas/loading.tsx', 'src/app/compas/error.tsx']) {
      expect(read(f), f).toContain("@/features/compas/compas.css");
    }
  });
});

describe('page d’erreur du Compas', () => {
  const boom = Object.assign(new Error('relation "trips" does not exist (SQLSTATE 42P01)'), {
    digest: '2487391850',
  });
  const reset = vi.fn();

  beforeEach(() => {
    reset.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('dans la langue du Compas : verre, carte d’écran vide, boutons .cp-btn', () => {
    const { container } = render(<CompasError error={boom} reset={reset} />);
    expect(container.querySelector('.compas.compas--empty .cp-bg')).not.toBeNull();
    expect(container.querySelector('section.cp-empty.cp-sheet-glass')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Réessayer' }).className).toContain('cp-btn');
  });

  it('est annoncée tout de suite (role=alert) et reçoit le focus pour le clavier', () => {
    render(<CompasError error={boom} reset={reset} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    const heading = screen.getByRole('heading', { name: 'Le Compas n’a pas pu s’afficher' });
    expect(document.activeElement).toBe(heading);
  });

  it('tutoie la personne, comme le reste du Compas', () => {
    const { container } = render(<CompasError error={boom} reset={reset} />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/ton voyage/);
    expect(text).toMatch(/Réessaie/);
    expect(text).not.toMatch(/\b(votre|vos|vous|Réessayez|Vérifiez)\b/);
  });

  it('n’affiche aucun message interne, seulement la référence des journaux', () => {
    const { container } = render(<CompasError error={boom} reset={reset} />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/relation|SQLSTATE|trips|42P01/);
    expect(text).toContain('2487391850');
    expect(text).toMatch(/Référence/);
    expect(console.error).toHaveBeenCalledWith('[compas] rendu impossible', '2487391850');
  });

  it('sans référence, ne montre pas de ligne vide', () => {
    const { container } = render(<CompasError error={new Error('x')} reset={reset} />);
    expect(container.textContent).not.toMatch(/Référence/);
  });

  it('ne prétend prévenir personne', () => {
    const { container } = render(<CompasError error={boom} reset={reset} />);
    expect(container.textContent).not.toMatch(/notifi|prévenu|équipe a été/i);
  });

  it('« Réessayer » relit le serveur puis remonte la page', () => {
    render(<CompasError error={boom} reset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('propose une sortie : retour au hub', () => {
    render(<CompasError error={boom} reset={reset} />);
    const link = screen.getByRole('link', { name: /Retour au hub/ });
    expect(link.getAttribute('href')).toBe('/hub');
    expect(link.className).toContain('cp-btn');
  });
});
