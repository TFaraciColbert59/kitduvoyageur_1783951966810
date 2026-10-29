// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Check } from 'lucide-react';
import { ActionPill } from '../ActionPill';

describe('ActionPill', () => {
  afterEach(cleanup);

  it('porte son nom complet même sans texte visible', () => {
    const onClick = vi.fn();
    render(<ActionPill label="Enregistrer le profil" icon={<Check />} onClick={onClick} />);
    const pill = screen.getByRole('button', { name: 'Enregistrer le profil' });
    expect(pill.getAttribute('title')).toBe('Enregistrer le profil');
    expect(pill.textContent).toBe('');
    fireEvent.click(pill);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('se bloque et l’annonce pendant l’envoi', () => {
    const onClick = vi.fn();
    render(<ActionPill tone="primary" label="Publier" icon={<Check />} busy onClick={onClick} />);
    const pill = screen.getByRole('button', { name: 'Publier' });
    expect(pill.hasAttribute('disabled')).toBe(true);
    expect(pill.getAttribute('aria-busy')).toBe('true');
    expect(pill.className).toContain('is-primary');
  });

  it('affiche un texte court seulement quand on le demande', () => {
    render(<ActionPill label="Changer mon mot de passe" text="Mot de passe" icon={<Check />} />);
    const pill = screen.getByRole('button', { name: 'Changer mon mot de passe' });
    expect(pill.textContent).toBe('Mot de passe');
    expect(pill.className).toContain('has-text');
  });
});
