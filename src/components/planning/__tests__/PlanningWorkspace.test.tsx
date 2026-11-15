// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlanningWorkspace } from '../PlanningWorkspace';
import { buildDemoPlanningData } from '../sampleData';

afterEach(() => cleanup());

function renderWorkspace() {
  const data = buildDemoPlanningData();
  return render(
    <PlanningWorkspace
      initialPlans={data.plans}
      viewer={data.viewer}
      nowIso={data.nowIso}
      route={data.route}
      weatherFeed={data.weatherFeed}
      lodgings={data.lodgings}
    />,
  );
}

describe('PlanningWorkspace — bibliothèque K1.13 et P01', () => {
  it('affiche les plans visibles, exclut le plan privé et applique la recherche', () => {
    const { container } = renderWorkspace();
    const library = within(screen.getByTestId('planning-library'));

    expect(screen.getByText(/3 visibles/)).toBeTruthy();
    expect(screen.getByText(/1 exclu P01/)).toBeTruthy();
    expect(library.getByText('Traversée des Alpes — exemple')).toBeTruthy();
    expect(library.getByText('Dolomites — exemple')).toBeTruthy();
    expect(library.queryByText('Reconnaissance privée — exemple')).toBeNull();

    fireEvent.change(screen.getByLabelText('Rechercher un plan multi-jours'), {
      target: { value: 'France' },
    });

    expect(library.getByText('Traversée des Alpes — exemple')).toBeTruthy();
    expect(library.getByText('Crêtes des Pyrénées — exemple')).toBeTruthy();
    expect(library.queryByText('Dolomites — exemple')).toBeNull();
    expect(container.textContent).not.toContain('Reconnaissance privée');
  });

  it('corrige les critères compris sans panneau de filtres standard', () => {
    renderWorkspace();

    fireEvent.change(screen.getByLabelText('Rechercher un plan multi-jours'), {
      target: { value: 'France 3-5 jours alpin' },
    });
    const criteria = within(screen.getByTestId('planning-criteria'));
    expect(criteria.getByText(/Compris/)).toBeTruthy();
    expect(criteria.getByText('France')).toBeTruthy();
    expect(criteria.getByText('3 à 5 jours')).toBeTruthy();
    expect(criteria.getByText('Alpin')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Pays'), { target: { value: 'IT' } });
    expect(within(screen.getByTestId('planning-library')).getByText('Dolomites — exemple')).toBeTruthy();
  });
});

describe('PlanningWorkspace — K2.32 lancement par étape', () => {
  it('affiche le payload de l’étape et masque l’action si le sport actif diffère', () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Démarrer l’étape 1' }));
    const launchPanel = within(screen.getByTestId('planning-launch-panel'));
    expect(launchPanel.getByText('Étape prête')).toBeTruthy();
    expect(launchPanel.getByText('Jour 1 · Trekking')).toBeTruthy();
    expect(launchPanel.getByText(/fuseau Europe\/Paris/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Sport actif pour le lancement'), {
      target: { value: 'cycling' },
    });

    expect(screen.queryByRole('button', { name: 'Démarrer l’étape 1' })).toBeNull();
    expect(screen.getAllByText(/Action masquée : Sport actif différent du plan/).length).toBeGreaterThan(0);
  });
});

describe('PlanningWorkspace — météo explicite', () => {
  it('affiche l’absence de fournisseur et n’invente aucune fenêtre', () => {
    const { container } = renderWorkspace();

    fireEvent.click(screen.getByRole('tab', { name: 'Météo' }));

    expect(screen.getByText('Fournisseur indisponible')).toBeTruthy();
    expect(
      within(screen.getByTestId('planning-weather-status')).getByText(
        'Aucun fournisseur météo réel configuré.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Aucune fenêtre optimale disponible')).toBeTruthy();
    expect(container.querySelector('[data-weather-status="provider_unavailable"]')).not.toBeNull();
  });
});

describe('PlanningWorkspace — partage P01', () => {
  it('crée, vérifie puis révoque un partage public', () => {
    renderWorkspace();

    fireEvent.click(
      within(screen.getByTestId('planning-library')).getByText('Traversée des Alpes — exemple'),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Partage' }));
    fireEvent.click(screen.getByRole('button', { name: 'Créer le partage' }));

    expect(screen.getByText(/^Partage share-/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier l’accès public' }));
    expect(screen.getByText(/Visiteur public autorisé \(Public\)/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Révoquer' }));
    expect(screen.getByText('Révoqué')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier l’accès public' }));
    expect(screen.getByText(/Visiteur public refusé : Partage révoqué/)).toBeTruthy();
  });
});

describe('PlanningWorkspace — K2.30 et K2.31', () => {
  it('prévisualise et confirme le déplacement d’une borne', () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole('tab', { name: 'Ajuster' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir l’ajustement des bornes' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Ajuster les bornes' })).toBeTruthy();
    expect(screen.getByText('Jour 2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le décalage' }));
    expect(screen.getByText(/Bornes des jours 1 et 2 mises à jour/)).toBeTruthy();
  });

  it('ancre un refuge proche du tracé', () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole('tab', { name: 'Ajuster' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le choix d’hébergement' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ancrer ce refuge à l’étape' }));
    expect(screen.getByText(/Refuge ancré à/)).toBeTruthy();
  });
});
