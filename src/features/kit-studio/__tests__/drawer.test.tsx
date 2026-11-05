// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Dock } from '../ui/Drawer/Dock';
import { Grabber } from '../ui/Drawer/Grab';
import { Capsule, type CapsuleItem } from '../ui/Drawer/Capsule';
import { Pager } from '../ui/Drawer/Pager';
import { Strip } from '../ui/Drawer/Strip';
import { Pill } from '../ui/Pill';
import { Icon } from '../ui/icons';

afterEach(cleanup);

const ITEMS: CapsuleItem[] = [
  { id: 'a', label: 'Abri', icon: <Icon name="tent" /> },
  { id: 'b', label: 'Eau', icon: <Icon name="bottle" /> },
  { id: 'c', label: 'Vêtements', icon: <Icon name="jacket" /> },
];

function Harness({ kind = 'tablist' as 'tablist' | 'radiogroup' }) {
  const [v, setV] = useState('a');
  return <Capsule kind={kind} label="Familles" items={ITEMS} value={v} onChange={setV} />;
}

describe('Dock', () => {
  it('Échap ferme, le focus passe au tiroir puis revient au déclencheur', () => {
    const onClose = vi.fn();
    function App() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>declencheur</button>
          <Dock
            open={open}
            label="Objets"
            onClose={() => {
              onClose();
              setOpen(false);
            }}
          >
            <p>contenu</p>
          </Dock>
        </>
      );
    }
    render(<App />);
    const trigger = screen.getByText('declencheur');
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Objets' });
    expect(dialog.getAttribute('aria-modal')).toBe('false');
    expect(document.activeElement).toBe(dialog);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);
  });

  it('la poignée a un nom accessible et glisser vers le bas ferme', () => {
    const onClose = vi.fn();
    render(
      <Dock open label="Objets" onClose={onClose}>
        <span />
      </Dock>,
    );
    const grab = screen.getByRole('button', { name: 'Fermer le tiroir' });
    fireEvent.pointerDown(grab, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(grab, { clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(grab, { clientY: 200, pointerId: 1 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Capsule', () => {
  it('un clic change la sélection (tablist : aria-selected)', () => {
    render(<Harness />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    fireEvent.click(tabs[2]);
    expect(screen.getAllByRole('tab').map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true']);
    expect(screen.getByRole('tablist', { name: 'Familles' })).toBeTruthy();
  });

  it('les flèches déplacent la sélection (radiogroup : aria-checked)', () => {
    render(<Harness kind="radiogroup" />);
    const group = screen.getByRole('radiogroup', { name: 'Familles' });
    const radios = screen.getAllByRole('radio');
    radios[0].focus();
    fireEvent.keyDown(radios[0], { key: 'ArrowRight' });
    expect(screen.getAllByRole('radio').map((t) => t.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(screen.getAllByRole('radio').map((t) => t.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true']);
  });

  it('chaque bouton icône porte un aria-label et un seul tabindex 0', () => {
    render(
      <>
        <Harness />
        <Grabber open={false} onOpen={() => {}} />
        <Dock open label="x" onClose={() => {}}>
          <Strip>
            <Harness kind="radiogroup" />
          </Strip>
        </Dock>
      </>,
    );
    for (const b of screen.getAllByRole('button', { hidden: true })) {
      expect((b.getAttribute('aria-label') ?? '').length).toBeGreaterThan(0);
    }
    for (const b of screen.getAllByRole('tab')) expect(b.getAttribute('aria-label')).toBeTruthy();
    expect(screen.getAllByRole('tab').filter((t) => t.tabIndex === 0)).toHaveLength(1);
  });
});

describe('Pager', () => {
  it('rend une page par entrée', () => {
    render(<Pager pages={[<p key="1">un</p>, <p key="2">deux</p>]} page={0} onPageChange={() => {}} />);
    expect(screen.getAllByRole('group', { name: /Page \d sur 2/ })).toHaveLength(2);
  });
});

describe('Pilule', () => {
  it('reçoit la translation calculée depuis la hauteur mesurée du tiroir', () => {
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const h = this.classList.contains('ks-dock') ? 262 : 44;
      return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: h, width: 100, height: h, toJSON: () => ({}) };
    });
    Object.defineProperty(window, 'innerHeight', { value: 874, configurable: true });
    function App({ open, view }: { open: boolean; view: string }) {
      const ref = useRef<HTMLElement | null>(null);
      return (
        <>
          <Dock open={open} label="Objets" onClose={() => {}} dockRef={ref}>
            <span />
          </Dock>
          <Pill kg={7.25} ratio={0.5} alerts={2} open={open} dockRef={ref} viewKey={view} label="Ouvrir le bilan" onClick={() => {}} />
        </>
      );
    }
    const { container, rerender } = render(<App open={false} view="cards" />);
    const top = () => container.querySelector<HTMLElement>('.ks-top')!;
    expect(top().style.getPropertyValue('--ks-ity')).toBe('0px');
    rerender(<App open view="cards" />);
    // 874 - 12 (marge basse) - 262 (tiroir) - 2 - 44 (pilule) - 0 (padding)
    expect(top().style.getPropertyValue('--ks-ity')).toBe('554px');
    Object.defineProperty(window, 'innerHeight', { value: 700, configurable: true });
    fireEvent(window, new Event('resize'));
    expect(top().style.getPropertyValue('--ks-ity')).toBe('380px');
    const btn = screen.getByRole('button', { name: 'Ouvrir le bilan' });
    expect(btn.textContent).toContain('7,3');
    rect.mockRestore();
  });
});

describe('Aucune bordure colorée', () => {
  it('ni classe ni style de bordure dans le DOM rendu', () => {
    const { container } = render(
      <>
        <Harness />
        <Dock open label="x" onClose={() => {}}>
          <span />
        </Dock>
      </>,
    );
    for (const e of container.querySelectorAll<HTMLElement>('*')) {
      expect(e.className.toString()).not.toMatch(/border|outline|ring-(green|orange|blue)/i);
      expect(e.getAttribute('style') ?? '').not.toMatch(/border|outline/i);
    }
  });

  it('la feuille de style ne déclare aucune bordure ni contour colorés, ni hex', () => {
    const css = readFileSync(join(__dirname, '../ui/kit-studio.css'), 'utf8');
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/rgba\(0,\s*0,\s*0/);
    const decls = [...css.matchAll(/(^|[;{\s])(border(?:-(?!radius)[a-z-]+)?|outline)\s*:\s*([^;}]+)/g)];
    for (const [, , prop, val] of decls) {
      const ok = /^(0|none)$/.test(val.trim()) || (prop === 'outline' && /var\(--ks-on\)/.test(val));
      expect(ok, `${prop}: ${val}`).toBe(true);
    }
  });
});
