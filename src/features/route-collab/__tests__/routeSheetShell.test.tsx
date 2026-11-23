// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SheetShell } from '@/features/compas/v5/ui/SheetShell';
import { detentFromKey, detentHeights, nextDetentOnTap, settleDetent } from '@/features/compas/v5/ui/sheetDetents';
import { RouteSheet } from '../components/workspace/chrome/RouteSheet';

afterEach(cleanup);

describe('4.2 · coquille du tiroir Compas v5, partagée', () => {
  it('SheetShell : même nœud racine fermé et ouvert, Échap et glisser vers le bas ferment (Compas)', () => {
    const onClose = vi.fn();
    const { container, rerender } = render(<SheetShell open={false} title="" closeLabel="Fermer" onClose={onClose}>{null}</SheetShell>);
    const closed = container.firstElementChild as HTMLElement;
    expect(closed.className).toBe('v5-sheet');
    expect(closed.hasAttribute('data-open')).toBe(false);
    rerender(<SheetShell open title="Budget" closeLabel="Fermer" onClose={onClose} onEscape={onClose}>x</SheetShell>);
    expect(container.firstElementChild).toBe(closed);
    expect(closed.hasAttribute('data-open')).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    // La poignée par défaut ferme au clic (le glissé vers le bas > 48 px suit la même fonction).
    fireEvent.click(container.querySelector('.v5-sgrab') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('RouteSheet : trois hauteurs au clavier, la poignée reste « Ajuster la hauteur du tiroir », Échap laissé à la règle des niveaux', () => {
    const onDetent = vi.fn();
    const onClose = vi.fn();
    render(
      <RouteSheet title="" tab={0} onTab={() => undefined} detent="mid" onDetent={onDetent} onClose={onClose} tabs={[
        { id: 'a', label: 'Tracer', icon: 'route', render: () => <p data-testid="pa">A</p> },
        { id: 'b', label: 'Étapes', icon: 'flag', render: () => <p>B</p> },
      ]}>
        {null}
      </RouteSheet>
    );
    const sheet = document.querySelector('.v5-sheet[data-dock]') as HTMLElement;
    expect(sheet.getAttribute('data-detent')).toBe('mid');
    expect(sheet.querySelector('.v5-shead .v5-flow')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Étapes' })).toBeTruthy();
    expect(screen.getByTestId('pa')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Ajuster la hauteur du tiroir' }), { key: 'ArrowUp' });
    expect(onDetent).toHaveBeenCalledWith('full');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('crans : hauteurs croissantes, relâchement, toucher, clavier', () => {
    const h = detentHeights(844);
    expect(h.peek).toBeLessThan(h.mid);
    expect(h.mid).toBeLessThan(h.full);
    expect(settleDetent('mid', h.mid, -0.5, h, false)).toBe('full');
    expect(settleDetent('peek', h.peek, 0.5, h, true)).toBe('close');
    expect(settleDetent('peek', h.peek, 0.5, h, false)).toBe('peek');
    expect(settleDetent('mid', h.full - 5, 0, h, false)).toBe('full');
    expect(nextDetentOnTap('full')).toBe('peek');
    expect(nextDetentOnTap('peek')).toBe('mid');
    expect(detentFromKey('mid', 'Home')).toBe('peek');
    expect(detentFromKey('mid', 'x')).toBeNull();
  });

  it('l’itinéraire n’importe plus ExplorerSheet ; V5Sheet et RouteSheet passent par SheetShell', () => {
    const read = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');
    expect(read('src/features/route-collab/components/RouteCollabWorkspace.tsx')).not.toContain('ExplorerSheet');
    expect(read('src/features/compas/v5/V5Sheet.tsx')).toContain('SheetShell');
    expect(read('src/features/route-collab/components/workspace/chrome/RouteSheet.tsx')).toContain('SheetShell');
  });
});
