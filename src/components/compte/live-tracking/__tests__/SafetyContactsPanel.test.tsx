// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SafetyContact } from '@/features/live-tracking';

import { SafetyContactsPanel } from '../SafetyContactsPanel';
import type { LiveTrackingApi } from '../liveTrackingApi';

const NOW = Date.UTC(2026, 10, 13, 10, 0, 0);

function contact(overrides: Partial<SafetyContact> = {}): SafetyContact {
  return {
    id: 'c1',
    ownerUserId: 'user-1',
    displayName: 'Camille',
    channel: 'sms',
    destination: '+33612345678',
    consentStatus: 'pending',
    consentedAtMs: null,
    createdAtMs: NOW,
    updatedAtMs: NOW,
    ...overrides,
  };
}

function mockApi(overrides: Partial<LiveTrackingApi> = {}): LiveTrackingApi {
  return Object.assign(
    {
      getStatus: vi.fn(),
      startSession: vi.fn(),
      updateSession: vi.fn(),
      endSession: vi.fn(),
      listLinks: vi.fn(async () => []),
      createShareLink: vi.fn(),
      revokeShareLink: vi.fn(),
      listContacts: vi.fn(async () => []),
      addContact: vi.fn(
        async (input: { displayName: string; channel: 'sms'; destination: string }) =>
          contact({
            displayName: input.displayName,
            channel: input.channel,
            destination: input.destination,
          })
      ),
      setContactConsent: vi.fn(async (id: string, status: 'accepted' | 'revoked') =>
        contact({ id, consentStatus: status })
      ),
      removeContact: vi.fn(async () => undefined),
      fetchGuestView: vi.fn(),
      broadcast: vi.fn(),
      watchCommand: vi.fn(),
    } as LiveTrackingApi,
    overrides
  );
}

afterEach(() => cleanup());

describe('SafetyContactsPanel — contacts et consentement', () => {
  it('ajoute un contact après validation du numéro et affiche son consentement en attente', async () => {
    const api = mockApi();
    render(<SafetyContactsPanel api={api} initialContacts={[]} />);

    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Camille' } });
    fireEvent.change(screen.getByLabelText('Numéro de téléphone'), {
      target: { value: '+33 6 12 34 56 78' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter ce contact' }));

    await waitFor(() => {
      expect(api.addContact).toHaveBeenCalledWith({
        displayName: 'Camille',
        channel: 'sms',
        destination: '+33 6 12 34 56 78',
      });
    });
    expect(await screen.findByText('Camille')).toBeTruthy();
    expect(screen.getByText('Accord à donner')).toBeTruthy();
    expect(screen.queryByText('+33 6 12 34 56 78')).toBeNull();
  });

  it('refuse un numéro invalide sans appeler l’API', async () => {
    const api = mockApi();
    render(<SafetyContactsPanel api={api} initialContacts={[]} />);

    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Camille' } });
    fireEvent.change(screen.getByLabelText('Numéro de téléphone'), { target: { value: '06' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter ce contact' }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('Numéro invalide')
    );
    expect(api.addContact).not.toHaveBeenCalled();
  });

  it('donne puis retire l’accord d’un contact existant', async () => {
    const initial = contact({ consentStatus: 'pending' });
    const accepted = contact({ consentStatus: 'accepted', consentedAtMs: NOW });
    const api = mockApi({ setContactConsent: vi.fn(async () => accepted) });
    render(<SafetyContactsPanel api={api} initialContacts={[initial]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Donner l’accord' }));
    await waitFor(() => {
      expect(api.setContactConsent).toHaveBeenCalledWith('c1', 'accepted');
    });
    expect(await screen.findByText('Accord donné')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Retirer l’accord' }));
    await waitFor(() => {
      expect(api.setContactConsent).toHaveBeenLastCalledWith('c1', 'revoked');
    });
  });

  it('demande une confirmation avant de supprimer un contact', async () => {
    const initial = contact({ consentStatus: 'accepted' });
    const api = mockApi();
    render(<SafetyContactsPanel api={api} initialContacts={[initial]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(api.removeContact).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirmer la suppression' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }));
    await waitFor(() => expect(api.removeContact).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(screen.queryByText('Camille')).toBeNull());
  });

  it('borne la liste à cinq contacts et désactive l’ajout au-delà', () => {
    const contacts = Array.from({ length: 5 }, (_, index) =>
      contact({
        id: `c${index}`,
        displayName: `Contact ${index}`,
        destination: `+3360000000${index}`,
      })
    );
    render(<SafetyContactsPanel api={mockApi()} initialContacts={contacts} />);

    expect(
      screen.getByText('Limite atteinte (5). Supprime un contact pour en ajouter un autre.')
    ).toBeTruthy();
    const add = screen.getByRole('button', { name: 'Ajouter ce contact' }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
  });
});
