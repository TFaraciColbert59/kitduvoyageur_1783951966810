// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { makeApi, makeData, makeInput, TRIP, U, WithApi } from './fixtures';
import type { V5Api } from '../context';

/* Frontières réseau uniquement : les actions serveur. Le tiroir, les modèles et le moteur sont les vrais. */
const compas = vi.hoisted(() => ({
  compasSetPartySizeAction: vi.fn(async (_input: unknown) => ({ success: true })),
  compasSetCarriersAction: vi.fn(async (_input: unknown) => ({ success: true })),
}));
vi.mock('../../server/compasActions', () => compas);

import { nousDrawer } from '../drawers/nous';

const Body = nousDrawer.Body;
const SLUG = 'vercors-novembre';

function soloData(extra: Parameters<typeof makeData>[1] = {}, country = 'fr') {
  const i = makeInput();
  return makeData({ trip: { ...i.trip, partySize: 1 }, members: [i.members[0]] }, { countryCode: country, ...extra });
}

const show = (api: V5Api) => render(<WithApi api={api}><Body /></WithApi>);
const again = (view: ReturnType<typeof show>, api: V5Api) => view.rerender(<WithApi api={api}><Body /></WithApi>);

beforeEach(() => {
  Object.values(compas).forEach((m) => m.mockClear());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (navigator as { share?: unknown }).share;
  delete (navigator as { clipboard?: unknown }).clipboard;
});

describe('Nous : la capsule', () => {
  it('deux onglets sans texte visible : Solo et Avec d’autres', () => {
    const tabs = nousDrawer.tabs(makeApi());
    expect(tabs.map((t) => t.label)).toEqual(['Solo', 'Avec d’autres']);
    expect(tabs.map((t) => t.icon)).toEqual(['person', 'people']);
  });
  it('titre et contexte suivent le voyage', () => {
    const group = makeApi();
    expect(nousDrawer.title(group)).toBe('Avec d’autres');
    expect(nousDrawer.subtitle(group)).toBe('4 personnes');
    const solo = makeApi({ solo: true, people: 1 }, { data: soloData() });
    expect(nousDrawer.title(solo)).toBe('Solo');
    expect(nousDrawer.subtitle(solo)).toBeNull();
  });
  it('à l’ouverture, l’onglet est remis sur le mode réel SANS rien écrire', () => {
    const api = makeApi({ tab: 0 });
    show(api);
    expect(api.setTab).toHaveBeenCalledWith(1);
    expect(compas.compasSetPartySizeAction).not.toHaveBeenCalled();
    expect(api.ctl.run).not.toHaveBeenCalled();
  });
  it('en solo, l’onglet « Avec d’autres » touché fait passer le voyage à deux personnes, annulable', async () => {
    const api = makeApi({ solo: true, people: 1, tab: 0 }, { data: soloData() });
    const view = show(api);
    expect(compas.compasSetPartySizeAction).not.toHaveBeenCalled();
    again(view, { ...api, tab: 1 });
    await waitFor(() => expect(compas.compasSetPartySizeAction).toHaveBeenCalledTimes(1));
    expect(compas.compasSetPartySizeAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: SLUG, partySize: 2 });
    expect(api.ctl.run).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.ctl.run).mock.calls[0][0]).toBe('Avec d’autres : budget, sac et allure recalculés pour 2');
    // « Annuler » rétablit la taille d’avant
    await vi.mocked(api.ctl.run).mock.calls[0][2]!();
    expect(compas.compasSetPartySizeAction).toHaveBeenLastCalledWith({ tripId: TRIP, tripSlug: SLUG, partySize: 1 });
  });
  it('le bouton « Partir avec d’autres » fait la même chose', async () => {
    const api = makeApi({ solo: true, people: 1 }, { data: soloData() });
    show(api);
    await userEvent.click(screen.getByRole('button', { name: /Partir avec d’autres/ }));
    expect(compas.compasSetPartySizeAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: SLUG, partySize: 2 });
  });
  it('en groupe avec un seul membre, l’onglet Solo repasse à une personne ; l’annulation remet la taille', async () => {
    const i = makeInput();
    const data = makeData({ trip: { ...i.trip, partySize: 3 }, members: [i.members[0]] });
    const api = makeApi({ tab: 1 }, { data });
    expect(api.solo).toBe(false);
    const view = show(api);
    again(view, { ...api, tab: 0 });
    await waitFor(() => expect(compas.compasSetPartySizeAction).toHaveBeenCalledTimes(1));
    expect(compas.compasSetPartySizeAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: SLUG, partySize: 1 });
    expect(vi.mocked(api.ctl.run).mock.calls[0][0]).toBe('En solo : budget, sac et allure recalculés pour toi');
    await vi.mocked(api.ctl.run).mock.calls[0][2]!();
    expect(compas.compasSetPartySizeAction).toHaveBeenLastCalledWith({ tripId: TRIP, tripSlug: SLUG, partySize: 3 });
  });
  it('avec d’autres membres dans le voyage, le retour en solo est refusé et dit pourquoi', async () => {
    const api = makeApi({ tab: 1 });
    const view = show(api);
    const back = screen.getByRole('button', { name: /Repasser en solo/ });
    expect((back as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/D’autres membres sont dans le voyage/)).toBeTruthy();
    again(view, { ...api, tab: 0 });
    await waitFor(() => expect(api.announce).toHaveBeenCalled());
    expect(vi.mocked(api.announce).mock.calls[0][0]).toMatch(/retire-les depuis la gestion du groupe/);
    expect(vi.mocked(api.announce).mock.calls[0][2]).toBe('bad');
    expect(api.setTab).toHaveBeenLastCalledWith(1);
    expect(compas.compasSetPartySizeAction).not.toHaveBeenCalled();
  });
  it('une écriture refusée remet l’onglet sur le mode réel', async () => {
    const api = makeApi({ solo: true, people: 1, tab: 0 }, { data: soloData() });
    vi.mocked(api.ctl.run).mockResolvedValueOnce(false);
    const view = show(api);
    again(view, { ...api, tab: 1 });
    await waitFor(() => expect(api.setTab).toHaveBeenLastCalledWith(0));
  });
  it('lecture seule : rien n’est écrit, la raison est dite', async () => {
    const api = makeApi({ solo: true, people: 1, tab: 0, canEdit: false }, { data: soloData() });
    const view = show(api);
    expect((screen.getByRole('button', { name: /Partir avec d’autres/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Lecture seule : tu ne peux pas modifier ce voyage/)).toBeTruthy();
    again(view, { ...api, tab: 1 });
    await waitFor(() => expect(api.announce).toHaveBeenCalled());
    expect(vi.mocked(api.announce).mock.calls[0][0]).toMatch(/Lecture seule/);
    expect(compas.compasSetPartySizeAction).not.toHaveBeenCalled();
  });
});

describe('Nous : avec d’autres', () => {
  it('liste les membres avec rôle, niveau, allure ; « toi » ; le plus lent donne l’allure', () => {
    show(makeApi({ tab: 1 }));
    const tony = screen.getByText('Tony · toi').closest('.v5-li') as HTMLElement;
    expect(within(tony).getByText(/Organisateur · niveau régulier · 4,2 km\/h/)).toBeTruthy();
    const leo = screen.getAllByText('Léo')[0].closest('.v5-li') as HTMLElement;
    expect(within(leo).getByText(/Membre · niveau débutant · 3,4 km\/h/)).toBeTruthy();
    expect(within(leo).getByText('Donne l’allure')).toBeTruthy();
    expect(screen.getAllByText('Donne l’allure')).toHaveLength(1);
    expect(screen.getByText('Allure retenue : celle de Léo')).toBeTruthy();
    expect(screen.getByText(/3,4 km\/h · les temps de marche suivent le plus lent \(4 allures connues sur 4\)/)).toBeTruthy();
  });
  it('dit « non renseigné » plutôt que d’inventer, et n’affiche pas une moyenne de population comme la sienne', () => {
    const i = makeInput();
    const data = makeData({
      trip: { ...i.trip, partySize: 2 },
      members: [
        { ...i.members[0], flatSpeedKmh: 4.5, experienceLevel: 'advanced', profileSources: { flatSpeedKmH: 'average', experienceLevel: 'average' } },
        { ...i.members[1], flatSpeedKmh: 4.6, experienceLevel: 'advanced', profileSources: { flatSpeedKmH: 'learned', experienceLevel: 'estimated' } },
      ],
    });
    show(makeApi({ tab: 1 }, { data }));
    const tony = screen.getByText('Tony · toi').closest('.v5-li') as HTMLElement;
    expect(within(tony).getByText(/niveau non renseigné · allure non renseignée/)).toBeTruthy();
    expect(within(tony).queryByText(/4,5/)).toBeNull();
    const claire = screen.getAllByText('Claire')[0].closest('.v5-li') as HTMLElement;
    expect(within(claire).getByText(/niveau confirmé · estimé · 4,6 km\/h · mesurée/)).toBeTruthy();
  });
  it('sans aucune allure connue : allure retenue non renseignée, 4 km/h dit comme repère de calcul', () => {
    const i = makeInput();
    const bare = i.members.slice(0, 2).map((m) => ({ ...m, flatSpeedKmh: null, experienceLevel: null }));
    show(makeApi({ tab: 1 }, { data: makeData({ trip: { ...i.trip, partySize: 2 }, members: bare }) }));
    expect(screen.getByText('Allure retenue : non renseignée')).toBeTruthy();
    expect(screen.getByText(/le Compas compte 4 km\/h/)).toBeTruthy();
    expect(screen.queryByText('Donne l’allure')).toBeNull();
  });
  it('invitation : lien vers la gestion du groupe du Hub, et invitations en attente', () => {
    const data = makeData({}, { pendingInvites: [{ id: 'i1', userId: null, name: 'Sophie', avatarUrl: null, role: 'viewer', createdAt: '2026-10-20' }] });
    show(makeApi({ tab: 1 }, { data }));
    const link = screen.getByRole('link', { name: 'Gérer le groupe' });
    expect(link.getAttribute('href')).toBe('/hub/groupe');
    const sophie = screen.getByText('Sophie').closest('.v5-li') as HTMLElement;
    expect(within(sophie).getByText('Invitation en attente · lecture seule')).toBeTruthy();
  });
  it('taille du groupe : plus, moins, bornée par les membres présents ; annulable', async () => {
    const i = makeInput();
    const data = makeData({ trip: { ...i.trip, partySize: 6 } });
    const api = makeApi({ tab: 1 }, { data });
    show(api);
    expect(screen.getByText(/dont 2 sans compte dans le groupe/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Une personne de plus' }));
    expect(compas.compasSetPartySizeAction).toHaveBeenLastCalledWith({ tripId: TRIP, tripSlug: SLUG, partySize: 7 });
    await userEvent.click(screen.getByRole('button', { name: 'Une personne de moins' }));
    expect(compas.compasSetPartySizeAction).toHaveBeenLastCalledWith({ tripId: TRIP, tripSlug: SLUG, partySize: 5 });
    await vi.mocked(api.ctl.run).mock.calls[1][2]!();
    expect(compas.compasSetPartySizeAction).toHaveBeenLastCalledWith({ tripId: TRIP, tripSlug: SLUG, partySize: 6 });
  });
  it('pas de « moins » sous le nombre de membres présents', () => {
    show(makeApi({ tab: 1 }));
    expect((screen.getByRole('button', { name: 'Une personne de moins' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('matériel commun : répartition en UNE demande, annulable', async () => {
    const api = makeApi({ tab: 1 });
    show(api);
    expect(screen.getByText('Matériel commun à répartir')).toBeTruthy();
    expect(screen.getByText('2 objets sans porteur')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Répartir' }));
    expect(compas.compasSetCarriersAction).toHaveBeenCalledTimes(1);
    const call = compas.compasSetCarriersAction.mock.calls[0][0] as { tripId: string; shared: boolean; assignments: Array<{ itemId: string; carrierId: string | null }> };
    expect(call.tripId).toBe(TRIP);
    expect(call.shared).toBe(true);
    expect(call.assignments.map((a) => a.itemId).sort()).toEqual(['i5', 'i6']);
    const members = [U.tony, U.claire, U.leo, U.maya];
    expect(call.assignments.every((a) => a.carrierId && members.includes(a.carrierId))).toBe(true);
    expect(vi.mocked(api.ctl.run).mock.calls[0][0]).toBe('2 objets communs répartis');
    await vi.mocked(api.ctl.run).mock.calls[0][2]!();
    const undo = compas.compasSetCarriersAction.mock.calls[1][0] as { assignments: Array<{ carrierId: string | null }> };
    expect(undo.assignments.every((a) => a.carrierId === null)).toBe(true);
  });
  it('matériel commun déjà réparti : qui porte quoi, sans bouton « Répartir »', () => {
    const base = makeInput();
    const items = base.items.map((it) => (it.id === 'i5' ? { ...it, ownerId: U.claire } : it.id === 'i6' ? { ...it, ownerId: U.maya } : it));
    show(makeApi({ tab: 1 }, { data: makeData({ items }) }));
    expect(screen.getByText('Matériel commun réparti')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Répartir' })).toBeNull();
    const claire = screen.getAllByText('Claire').map((n) => n.closest('.v5-li') as HTMLElement).find((li) => within(li).queryByText('Tente 2 places'));
    expect(claire).toBeTruthy();
    expect(within(claire!).getByText(/\+1,9 kg/)).toBeTruthy();
  });
  it('« Voir » mène au sac et au budget', async () => {
    const api = makeApi({ tab: 1 });
    show(api);
    await userEvent.click(screen.getAllByRole('button', { name: 'Voir' })[1]);
    expect(api.openSpace).toHaveBeenCalledWith('budget');
    await userEvent.click(screen.getAllByRole('button', { name: 'Voir' })[0]);
    expect(api.openSpace).toHaveBeenCalledWith('sac', { tab: 2 });
  });
  it('budget partagé : part par personne issue du modèle', () => {
    show(makeApi({ tab: 1 }));
    expect(screen.getByText(/20\s€ par personne/)).toBeTruthy();
  });
  it('lecture seule : ni stepper ni répartition', () => {
    show(makeApi({ tab: 1, canEdit: false }));
    expect(screen.queryByRole('button', { name: 'Une personne de plus' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Répartir' })).toBeNull();
    expect((screen.getByRole('button', { name: /Repasser en solo/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Nous : solo', () => {
  const api = () => makeApi({ solo: true, people: 1, tab: 0 }, { data: soloData() });

  it('montre la personne avec ce que le profil dit, et la phrase du budget', () => {
    show(api());
    expect(screen.getByText('Tony · toi')).toBeTruthy();
    expect(screen.getByText(/Organisateur · niveau régulier · 4,2 km\/h/)).toBeTruthy();
    expect(screen.getByText(/ne compte qu’une part dans le budget/)).toBeTruthy();
    expect(screen.queryByText(/Allure retenue/)).toBeNull();
  });
  it('prévient quand le voyage est réglé pour une personne mais compte plusieurs membres', () => {
    const data = makeData({ trip: { ...makeInput().trip, partySize: 1 } });
    show(makeApi({ solo: true, people: 1, tab: 0 }, { data }));
    expect(screen.getByRole('status').textContent).toMatch(/4 membres y figurent/);
  });

  describe('prévenir un proche', () => {
    const sharedBody = () => (screen.getByLabelText('Aperçu du message') as HTMLTextAreaElement).value;

    it('l’aperçu est fabriqué sur l’appareil à partir du voyage', () => {
      show(api());
      const body = sharedBody();
      expect(body).toContain('Je pars en solo : Randonnée · Vercors.');
      expect(body).toContain('Rencurel');
      expect(body).toContain('préviens les secours : 112.');
      expect(screen.getByText(/Rien n’est enregistré ni envoyé par nos serveurs/)).toBeTruthy();
    });
    it('l’heure de retour saisie entre dans le message', async () => {
      show(api());
      fireEvent.change(screen.getByLabelText('Heure de retour prévue (facultatif)'), { target: { value: '18:30' } });
      expect(sharedBody()).toMatch(/vers 18:30\./);
    });
    it('navigator.share : le message part par l’application de messages, aucun serveur du Compas appelé', async () => {
      const share = vi.fn(async () => undefined);
      Object.defineProperty(navigator, 'share', { value: share, configurable: true });
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const a = api();
      show(a);
      await userEvent.click(await screen.findByRole('button', { name: 'Envoyer à un proche' }));
      expect(share).toHaveBeenCalledTimes(1);
      const arg = (share.mock.calls[0] as unknown as [{ title: string; text: string }])[0];
      expect(arg.title).toBe('Mon itinéraire : Randonnée · Vercors');
      expect(arg.text).toContain('Rencurel');
      expect(a.announce).toHaveBeenCalledWith('Itinéraire partagé');
      expect(a.ctl.run).not.toHaveBeenCalled();
      expect(compas.compasSetPartySizeAction).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
    it('partage annulé par la personne : rien d’autre ne se passe', async () => {
      const share = vi.fn(async () => {
        throw new DOMException('annulé', 'AbortError');
      });
      const writeText = vi.fn(async () => undefined);
      Object.defineProperty(navigator, 'share', { value: share, configurable: true });
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      const a = api();
      show(a);
      await userEvent.click(await screen.findByRole('button', { name: 'Envoyer à un proche' }));
      expect(writeText).not.toHaveBeenCalled();
      expect(a.announce).not.toHaveBeenCalled();
    });
    it('partage en échec : repli sur la copie', async () => {
      const share = vi.fn(async () => {
        throw new Error('indisponible');
      });
      const writeText = vi.fn(async () => undefined);
      Object.defineProperty(navigator, 'share', { value: share, configurable: true });
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      const a = api();
      show(a);
      await userEvent.click(await screen.findByRole('button', { name: 'Envoyer à un proche' }));
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
      expect(a.announce).toHaveBeenCalledWith('Texte copié');
    });
    it('sans navigator.share : lien mailto: prérempli et copie', async () => {
      const writeText = vi.fn(async () => undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      const a = api();
      show(a);
      expect(screen.queryByRole('button', { name: 'Envoyer à un proche' })).toBeNull();
      const mail = screen.getByRole('link', { name: 'Écrire un e-mail' });
      const href = mail.getAttribute('href') as string;
      expect(href.startsWith('mailto:?subject=')).toBe(true);
      expect(decodeURIComponent(href)).toContain('Rencurel');
      await userEvent.click(screen.getByRole('button', { name: 'Copier le texte' }));
      expect(writeText).toHaveBeenCalledWith(sharedBody());
      expect(a.announce).toHaveBeenCalledWith('Texte copié');
    });
    it('copie impossible : la personne en est informée', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn(async () => Promise.reject(new Error('refusé'))) },
        configurable: true,
      });
      const a = api();
      show(a);
      await userEvent.click(screen.getByRole('button', { name: 'Copier le texte' }));
      await waitFor(() => expect(a.announce).toHaveBeenCalled());
      expect(vi.mocked(a.announce).mock.calls[0][2]).toBe('bad');
    });
    it('message trop long pour un e-mail : plus de lien mailto:, la copie reste', () => {
      const i = makeInput();
      const steps = Array.from({ length: 60 }, (_, n) => ({ ...i.steps[0], id: `s${n}`, dayNumber: n + 1, title: `Étape numéro ${n + 1} du grand tour de la montagne` }));
      show(makeApi({ solo: true, people: 1 }, { data: makeData({ trip: { ...i.trip, partySize: 1, startDate: null, endDate: null }, members: [i.members[0]], steps }) }));
      expect(screen.queryByRole('link', { name: 'Écrire un e-mail' })).toBeNull();
      expect(screen.getByText(/trop long pour un e-mail prérempli/)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Copier le texte' })).toBeTruthy();
    });
    it('sans étape : rien à partager, dit clairement', () => {
      const i = makeInput();
      show(makeApi({ solo: true, people: 1 }, { data: makeData({ trip: { ...i.trip, partySize: 1 }, members: [i.members[0]], steps: [] }) }));
      expect(screen.getByText(/Ajoute des étapes au voyage/)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Copier le texte' })).toBeNull();
    });
  });

  describe('numéros de secours', () => {
    it('le 112 en France, avec sa source, appelable', () => {
      show(api());
      expect(screen.getByText(/numéro d’urgence européen/)).toBeTruthy();
      const call = screen.getByRole('link', { name: 'Appeler le 112' });
      expect(call.getAttribute('href')).toBe('tel:112');
    });
    it('le numéro établi d’un autre pays', () => {
      show(makeApi({ solo: true, people: 1 }, { data: soloData({}, 'us') }));
      expect(screen.getByRole('link', { name: 'Appeler le 911' }).getAttribute('href')).toBe('tel:911');
      expect(screen.getByText(/numéro d’urgence national du pays de destination/)).toBeTruthy();
    });
    it('pays inconnu : le 112 seul, avec la mise en garde', () => {
      show(makeApi({ solo: true, people: 1 }, { data: soloData({ countryCode: null }) }));
      expect(screen.getAllByRole('link', { name: /Appeler le/ })).toHaveLength(1);
      expect(screen.getByText(/vérifie le numéro local avant de partir/)).toBeTruthy();
    });
  });
});

describe('Nous : pas de note globale', () => {
  it.each([
    ['solo', () => makeApi({ solo: true, people: 1 }, { data: soloData() })],
    ['groupe', () => makeApi({ tab: 1 })],
  ])('%s : aucun score, aucune note sur 10 ou 100', (_name, build) => {
    const { container } = show(build());
    expect(container.textContent).not.toMatch(/\bscore\b|\bnote globale\b|\/\s?(10|100)\b/i);
  });
});

describe('Nous : accessibilité (axe-core)', () => {
  const scan = async (root: Element) => {
    const res = await axe.run(root as HTMLElement, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false }, 'landmark-one-main': { enabled: false }, 'page-has-heading-one': { enabled: false } },
    });
    return res.violations.map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
  };
  it('solo', async () => {
    const { container } = show(makeApi({ solo: true, people: 1 }, { data: soloData() }));
    expect(await scan(container)).toEqual([]);
  });
  it('groupe, avec invitations en attente et répartition à faire', async () => {
    const data = makeData({}, { pendingInvites: [{ id: 'i1', userId: null, name: 'Sophie', avatarUrl: null, role: 'editor', createdAt: '2026-10-20' }] });
    const { container } = show(makeApi({ tab: 1 }, { data }));
    expect(await scan(container)).toEqual([]);
  });
  it('les cibles tactiles portent la classe de 44 px', () => {
    const { container } = show(makeApi({ tab: 1 }));
    const small = [...container.querySelectorAll('.v5-mbtn')].filter((b) => !b.classList.contains('nb-btn'));
    expect(small).toEqual([]);
  });
});
