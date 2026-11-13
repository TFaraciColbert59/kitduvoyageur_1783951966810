// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import StoriesViewer, { type StoryUser } from '../StoriesViewer';
import { acquireStoryOpen, storyOpenHolders } from '../storyOpenMarker';

vi.mock('@/features/posts/ui/PostReplyComposer', () => ({ PostReplyComposer: () => null }));

const users: StoryUser[] = [
  {
    id: 'u-other',
    name: 'Lea',
    slides: [{ image: '/a.jpg', storyId: 's1' }, { image: '/b.jpg', storyId: 's2' }],
  },
];

const marker = () => ({
  html: document.documentElement.dataset.storyOpen ?? null,
  body: document.body.dataset.storyOpen ?? null,
});

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.storyOpen;
  delete document.body.dataset.storyOpen;
});

describe('marqueur « story ouverte » (module)', () => {
  it('pose le marqueur sur html et body, le retire à la dernière libération', () => {
    const a = acquireStoryOpen();
    const b = acquireStoryOpen();
    expect(marker()).toEqual({ html: 'true', body: 'true' });
    expect(storyOpenHolders()).toBe(2);
    a();
    a(); // idempotent
    expect(marker()).toEqual({ html: 'true', body: 'true' });
    b();
    expect(marker()).toEqual({ html: null, body: null });
    expect(storyOpenHolders()).toBe(0);
  });

  it("n'émet l'événement de barre native que sur iOS natif", () => {
    const seen: boolean[] = [];
    const handler = (e: Event) => seen.push((e as CustomEvent<{ hide: boolean }>).detail.hide);
    window.addEventListener('lkdv-toggle-bottom-bar', handler);
    acquireStoryOpen()();
    window.removeEventListener('lkdv-toggle-bottom-bar', handler);
    expect(seen).toEqual([]); // web (jsdom) : aucun demandeur concurrent n'est perturbé
  });
});

describe('StoriesViewer : marqueur global', () => {
  it('lecture : marqueur posé au montage, retiré au démontage', () => {
    const { unmount } = render(<StoriesViewer users={users} startUser={0} onClose={() => undefined} />);
    expect(marker()).toEqual({ html: 'true', body: 'true' });
    unmount();
    expect(marker()).toEqual({ html: null, body: null });
  });

  it('mode composition : marqueur posé aussi', () => {
    const { unmount } = render(
      <StoriesViewer users={[]} startUser={0} onClose={() => undefined} compose={{ media: null }} />
    );
    expect(marker()).toEqual({ html: 'true', body: 'true' });
    unmount();
    expect(marker()).toEqual({ html: null, body: null });
  });

  it('deux instances : retiré seulement après la dernière', () => {
    const one = render(<StoriesViewer users={users} startUser={0} onClose={() => undefined} />);
    const two = render(
      <StoriesViewer users={[]} startUser={0} onClose={() => undefined} compose={{ media: null }} />
    );
    one.unmount();
    expect(marker().html).toBe('true');
    two.unmount();
    expect(marker()).toEqual({ html: null, body: null });
  });

  it('une barre montée APRÈS l\'ouverture est couverte par la même règle (marqueur sur html et body)', () => {
    render(<StoriesViewer users={users} startUser={0} onClose={() => undefined} />);
    const late = document.createElement('nav');
    late.setAttribute('aria-label', 'Navigation principale');
    document.body.appendChild(late);
    expect(late.closest('[data-story-open="true"]')).not.toBeNull();
    late.remove();
  });
});

describe('StoriesViewer : menu d\'options', () => {
  const setup = () =>
    render(
      <StoriesViewer
        users={users}
        startUser={0}
        onClose={() => undefined}
        onReport={() => undefined}
        myUserId="me"
      />
    );

  it('déclencheur : aria-haspopup/expanded, panneau role=menu, lignes role=menuitem', () => {
    setup();
    const trigger = screen.getByRole('button', { name: 'Options de la story' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    const menu = document.querySelector('[role="menu"]') as HTMLElement;
    expect(menu.getAttribute('data-open')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(menu.getAttribute('data-open')).toBe('true');
    const labels = Array.from(menu.querySelectorAll('[role="menuitem"]')).map((n) => n.textContent);
    expect(labels).toEqual(['Copier le lien', 'Partager', 'Signaler']);
    expect(menu.querySelector('[role="separator"]')).not.toBeNull();
    expect(menu.querySelector('.is-danger')?.textContent).toBe('Signaler');
  });

  it('Échap ferme le menu et rend le focus au déclencheur, sans fermer la story', () => {
    const onClose = vi.fn();
    render(<StoriesViewer users={users} startUser={0} onClose={onClose} myUserId="me" />);
    const trigger = screen.getByRole('button', { name: 'Options de la story' });
    fireEvent.click(trigger);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('tap à l\'extérieur ferme le menu', () => {
    setup();
    const trigger = screen.getByRole('button', { name: 'Options de la story' });
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.querySelector('.lkdv-story-viewer') as HTMLElement);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('la progression est en pause tant que le menu est ouvert', () => {
    vi.useFakeTimers();
    try {
      let now = 0;
      const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        return window.setTimeout(() => { now += 100; cb(now); }, 100) as unknown as number;
      });
      const caf = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => window.clearTimeout(id));
      setup();
      const trigger = screen.getByRole('button', { name: 'Options de la story' });
      act(() => { vi.advanceTimersByTime(400); });
      const width = () => (document.querySelector('.lkdv-story-progress span span[style]') as HTMLElement | null)?.style.width ?? '0%';
      expect(width()).not.toBe('0%'); // la lecture avance avant l'ouverture du menu
      fireEvent.click(trigger);
      const frozen = width();
      act(() => { vi.advanceTimersByTime(1000); });
      expect(width()).toBe(frozen);
      raf.mockRestore();
      caf.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });
});
