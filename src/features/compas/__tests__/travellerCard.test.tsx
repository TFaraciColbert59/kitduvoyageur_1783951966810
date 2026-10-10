// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  saveTravellerAction: vi.fn(),
  skipTravellerAction: vi.fn(async () => ({ success: true })),
}));
vi.mock('../server/travellerActions', () => actions);

import TravellerCard from '@/components/identity/TravellerCard';

const SAVED = { nationality: 'FR', residenceCountry: null, currency: null, language: null, timeZone: null, homeName: 'Lyon' };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('profil voyageur demandé une fois (Compas vide)', () => {
  it('nationalité et domicile seulement, « Passer » toujours visible', () => {
    render(<TravellerCard mode="collect" />);
    expect(screen.getByRole('heading', { name: 'Pour des conseils justes' })).toBeTruthy();
    expect(screen.getByLabelText('Nationalité')).toBeTruthy();
    expect(screen.getByLabelText('Ville de domicile')).toBeTruthy();
    expect(screen.queryByLabelText('Devise')).toBeNull();
    expect(screen.queryByLabelText('Pays de résidence')).toBeNull();
    expect(screen.getByRole('button', { name: 'Passer' })).toBeTruthy();
  });

  it('« Enregistrer » envoie tout le profil, puis la carte se retire', async () => {
    actions.saveTravellerAction.mockResolvedValueOnce({ success: true, view: SAVED });
    const onDone = vi.fn();
    const { container } = render(<TravellerCard mode="collect" onDone={onDone} />);
    fireEvent.change(screen.getByLabelText('Nationalité'), { target: { value: 'FR' } });
    fireEvent.change(screen.getByLabelText('Ville de domicile'), { target: { value: ' Lyon ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(container.innerHTML).toBe(''));
    expect(actions.saveTravellerAction).toHaveBeenCalledWith({
      nationality: 'FR',
      residenceCountry: null,
      currency: null,
      language: null,
      timeZone: null,
      home: 'Lyon',
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('« Passer » range la réponse et la carte se retire, sans rien enregistrer d’autre', async () => {
    const onDone = vi.fn();
    const { container } = render(<TravellerCard mode="collect" onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Passer' }));
    await waitFor(() => expect(container.innerHTML).toBe(''));
    expect(actions.skipTravellerAction).toHaveBeenCalledTimes(1);
    expect(actions.saveTravellerAction).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('un refus est dit ; la carte reste, « Passer » aussi', async () => {
    actions.saveTravellerAction.mockResolvedValueOnce({ success: false, error: '« Atlantide » introuvable sur la carte.' });
    const onDone = vi.fn();
    render(<TravellerCard mode="collect" onDone={onDone} />);
    fireEvent.change(screen.getByLabelText('Ville de domicile'), { target: { value: 'Atlantide' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect((await screen.findByRole('alert')).textContent).toBe('« Atlantide » introuvable sur la carte.');
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Passer' })).toBeTruthy();
  });
});

describe('profil voyageur dans /compte', () => {
  it('tout le profil, prérempli, sans « Passer »', () => {
    render(
      <TravellerCard
        mode="edit"
        initial={{ nationality: 'FR', residenceCountry: 'CH', currency: 'CHF', language: 'fr', timeZone: 'Europe/Zurich', homeName: 'Genève' }}
      />
    );
    expect(screen.getByRole('heading', { name: 'Ce que le Compas sait de toi' })).toBeTruthy();
    expect((screen.getByLabelText('Nationalité') as HTMLSelectElement).value).toBe('FR');
    expect((screen.getByLabelText('Pays de résidence') as HTMLSelectElement).value).toBe('CH');
    expect((screen.getByLabelText('Devise') as HTMLSelectElement).value).toBe('CHF');
    expect((screen.getByLabelText('Langue') as HTMLSelectElement).value).toBe('fr');
    expect((screen.getByLabelText('Fuseau horaire') as HTMLSelectElement).value).toBe('Europe/Zurich');
    expect((screen.getByLabelText('Ville de domicile') as HTMLInputElement).value).toBe('Genève');
    expect(screen.queryByRole('button', { name: 'Passer' })).toBeNull();
  });

  it('enregistré : la carte le dit et reste ouverte', async () => {
    actions.saveTravellerAction.mockResolvedValueOnce({ success: true, view: SAVED });
    render(<TravellerCard mode="edit" initial={SAVED} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    // (le bouton en attente montre aussi un indicateur `status` : on cherche le texte)
    expect((await screen.findByText('Profil voyageur enregistré.')).getAttribute('role')).toBe('status');
    expect(screen.getByLabelText('Nationalité')).toBeTruthy();
  });
});
