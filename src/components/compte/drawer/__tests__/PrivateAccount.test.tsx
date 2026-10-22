// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrivateAccountLock } from '../PrivateAccountLock';
import { ProfileDrawerHost } from '../ProfileDrawerHost';

afterEach(cleanup);

describe('Compte privé — verrou et accès sur invitation', () => {
  it('verrouille un compte privé sans invitation, sans slot ni sélecteur .ig-tabs', () => {
    const { container } = render(
      <ProfileDrawerHost viewer="visitor" visibility="prive" invited={false} />
    );
    expect(screen.getByText(/Compte privé/)).toBeTruthy();
    expect(screen.queryByText('Vitrine')).toBeNull();
    expect(screen.queryByTestId('slot-content')).toBeNull();
    expect(container.querySelector('.ig-tabs')).toBeNull();
  });

  it('traite une invitation absente comme non accordée', () => {
    render(<ProfileDrawerHost viewer="visitor" visibility="prive" />);
    expect(screen.getByText('Compte privé · accès sur invitation')).toBeTruthy();
    expect(screen.queryByTestId('slot-content')).toBeNull();
  });

  it('laisse un invité voir les slots', () => {
    render(<ProfileDrawerHost viewer="visitor" visibility="prive" invited />);
    expect(screen.getAllByTestId('slot-content')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'Vitrine' })).toBeTruthy();
  });

  it('le propriétaire voit toujours les slots, même en privé', () => {
    render(<ProfileDrawerHost viewer="owner" visibility="prive" invited={false} />);
    expect(screen.getAllByTestId('slot-content')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'Vitrine' })).toBeTruthy();
    expect(screen.queryByText(/Compte privé/)).toBeNull();
  });

  it('un visiteur d’un compte public voit les slots', () => {
    render(<ProfileDrawerHost viewer="visitor" visibility="public" invited={false} />);
    expect(screen.getAllByTestId('slot-content')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'Vitrine' })).toBeTruthy();
  });

  it('affiche le nom réel fourni par le payload, sans en inventer', () => {
    render(
      <ProfileDrawerHost
        viewer="visitor"
        visibility="prive"
        invited={false}
        payload={{ profile: { name: 'Camille', avatarUrl: null } }}
      />
    );
    expect(screen.getByText('Camille')).toBeTruthy();
    expect(screen.getByText('Compte privé · accès sur invitation')).toBeTruthy();
    expect(screen.queryByTestId('slot-content')).toBeNull();
  });

  it('ne rend aucun CTA de gestion dans le verrou', () => {
    render(<PrivateAccountLock />);
    expect(screen.queryByRole('button', { name: 'Gérer les invitations' })).toBeNull();
    expect(screen.getByText('Compte privé · accès sur invitation')).toBeTruthy();
  });

});
