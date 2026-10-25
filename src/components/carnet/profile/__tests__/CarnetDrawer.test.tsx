// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetDrawer } from '../CarnetDrawer';
import { DETAIL, detail } from './fixtures';

afterEach(() => cleanup());

describe('CarnetDrawer — coquille', () => {
  it('rend la poignée, la capsule et le volet', () => {
    render(<CarnetDrawer detail={DETAIL} drawer="carnet" onDrawerChange={() => {}} onClose={() => {}}><p>volet</p></CarnetDrawer>);
    expect(screen.getByRole('button', { name: 'Fermer le panneau' })).toBeTruthy();
    expect(screen.getByRole('tablist', { name: 'Volets du carnet' })).toBeTruthy();
    expect(screen.getByText('volet')).toBeTruthy();
  });

  it('n’expose pas Gérer à un visiteur', () => {
    render(<CarnetDrawer detail={detail({ isOwner: false })} drawer="carnet" onDrawerChange={() => {}} onClose={() => {}}><p>v</p></CarnetDrawer>);
    expect(screen.queryByRole('tab', { name: 'Gérer' })).toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(6);
  });

  it('remonte le changement de volet', () => {
    const onDrawerChange = vi.fn();
    render(<CarnetDrawer detail={detail({ isOwner: true })} drawer="carnet" onDrawerChange={onDrawerChange} onClose={() => {}}><p>v</p></CarnetDrawer>);
    fireEvent.click(screen.getByRole('tab', { name: 'Gérer' }));
    expect(onDrawerChange).toHaveBeenCalledWith('manage');
  });

  it('ferme sur Échap et sur la poignée', () => {
    const onClose = vi.fn();
    render(<CarnetDrawer detail={DETAIL} drawer="carnet" onDrawerChange={() => {}} onClose={onClose}><p>v</p></CarnetDrawer>);
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le panneau' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
