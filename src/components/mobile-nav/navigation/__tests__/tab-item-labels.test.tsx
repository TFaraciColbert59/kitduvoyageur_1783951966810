import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TabItem from '../TabItem';
import { DESTINATIONS } from '../../destinationRegistry';

/* La barre unifiée iOS 27 affiche uniquement les icônes. Le nom complet
 * reste porté par le lien accessible, quelle que soit la largeur du tab. */

function renderOne(id: string): string {
  const destination = DESTINATIONS.find((d) => d.id === id);
  if (!destination) throw new Error(`destination inconnue: ${id}`);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(TabItem, {
        destination,
        isActive: false,
        prefetch: false,
        onPress: () => {},
        badge: 0,
      }),
    ),
  );
}

describe('TabItem — libelles de la barre basse', () => {
  it('ne tronque pas le libelle le plus long', () => {
    const html = renderOne('community');
    // `truncate` est precisement la classe qui produit « Communau... ».
    expect(html).not.toContain('truncate');
  });

  it('conserve le nom complet sur le lien de navigation icon-only', () => {
    const html = renderOne('community');
    const destination = DESTINATIONS.find((d) => d.id === 'community')!;
    expect(html).toContain(`aria-label="${destination.ariaLabel}"`);
    expect(html).not.toContain(`>${destination.label}</`);
  });

  it('l onglet ne se verrouille pas a une largeur qui tronque le mot', () => {
    // La largeur disponible se redistribue via flex ; un minWidth eleve la
    //walkerait les liens sur un petit ecran au lieu de laisser le libelle
    //deborder proprement. La garantie de lisibilite tient donc au nowrap.
    const html = renderOne('community');
    expect(html).toMatch(/min-width:\s*0(?:px)?[;"]/);
  });
  it('conserve le libelle complet dans le HTML rendu', () => {
    expect(renderOne('community')).toContain('Communauté');
  });

  it('garde un aria-label accessible independant du libelle visible', () => {
    const html = renderOne('community');
    expect(html).toContain('aria-label=');
  });
});


