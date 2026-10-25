// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/community/feed/useAccountUnreadCount', () => ({
  useAccountUnreadCount: () => 3,
}));

import { CarnetTopBar } from '../CarnetTopBar';

afterEach(() => cleanup());

const noop = () => {};

describe('CarnetTopBar — barre de la Communauté', () => {
  it('rend la pilule avec chevron et les trois boutons', () => {
    render(<CarnetTopBar title="Tour du Mont-Blanc" onOpenCarnet={noop}  />);
    const pill = screen.getByRole('button', { name: 'Carnet Tour du Mont-Blanc' });
    expect(pill.className).toContain('ckp-title-pill');
    expect(pill.querySelector('.ckp-title-chevron')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Créer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rechercher dans la communauté' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Notifications, 3/ })).toBeTruthy();
    const actions = screen.getByRole('button', { name: 'Créer' }).parentElement;
    expect(actions?.querySelectorAll('.gbtn').length).toBe(3);
  });

  it('ouvre le drawer Carnet au clic sur la pilule', () => {
    const onOpenCarnet = vi.fn();
    render(<CarnetTopBar title="Tour" onOpenCarnet={onOpenCarnet}  />);
    fireEvent.click(screen.getByRole('button', { name: 'Carnet Tour' }));
    expect(onOpenCarnet).toHaveBeenCalledOnce();
  });
});
