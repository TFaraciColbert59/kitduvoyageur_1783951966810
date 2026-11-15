// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectCollection, projectHighlight } from '@/features/highlights';
import { buildEditorialGuide } from '@/features/highlights';
import { HighlightDrawer } from '@/components/highlights/HighlightDrawer';
import { HighlightComposer } from '@/components/highlights/HighlightComposer';
import { CollectionDrawer } from '@/components/highlights/CollectionDrawer';
import { GuideDrawer } from '@/components/highlights/GuideDrawer';
import { StreetViewPanel } from '@/components/highlights/StreetViewPanel';
import { TrailViewPanel } from '@/components/highlights/TrailViewPanel';
import type { Collection, Highlight, StreetViewResult } from '@/features/highlights';
import { OTHER, OWNER, makeCollection, makeHighlight, makePhoto } from './fixtures';

afterEach(cleanup);

function hiddenHighlightView() {
  const highlight: Highlight = makeHighlight({
    photos: [makePhoto({ url: 'https://cdn.test/secret.jpg', masked: true })],
    privacy: {
      ...makeHighlight().privacy,
      hideExactLocation: true,
      hidePhotos: true,
    },
  });
  return projectHighlight(highlight, OTHER)!;
}

describe('HighlightDrawer', () => {
  it('n’affiche ni coordonnée ni photo masquée', () => {
    render(<HighlightDrawer highlight={hiddenHighlightView()} onClose={() => {}} />);
    expect(screen.getByTestId('highlight-location-hidden').textContent).toContain(
      'Position exacte masquée'
    );
    expect(screen.getByTestId('highlight-photos-hidden').textContent).toContain('Photos masquées');
    expect(screen.queryByText(/secret\.jpg/)).toBeNull();
    expect(screen.queryByText(/45\.9237/)).toBeNull();
  });

  it('vote et enregistre dans Mes lieux', () => {
    const onVote = vi.fn();
    const onSave = vi.fn();
    render(
      <HighlightDrawer
        highlight={hiddenHighlightView()}
        onClose={() => {}}
        onVote={onVote}
        onSave={onSave}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /👍/ }));
    expect(onVote).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByTestId('highlight-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('publie un conseil après saisie', () => {
    const onContributeTip = vi.fn();
    render(
      <HighlightDrawer
        highlight={hiddenHighlightView()}
        onClose={() => {}}
        onContributeTip={onContributeTip}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un conseil' }));
    fireEvent.change(screen.getByLabelText('Ton conseil'), {
      target: { value: 'Fontaine au col.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publier le conseil' }));
    expect(onContributeTip).toHaveBeenCalledWith('Fontaine au col.');
  });
});

function collectionView(collection: Collection, viewer = OWNER, shared = false) {
  return projectCollection(collection, viewer, { shared })!;
}

describe('HighlightComposer', () => {
  it('publie un brouillon sans position exacte en la masquant', () => {
    const onSubmit = vi.fn();
    render(
      <HighlightComposer
        kind="place"
        targetLabel="Belvédère"
        defaultArea="Chamonix"
        hasLocation={false}
        onClose={() => {}}
        onSubmit={onSubmit}
      />
    );
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Belvédère du lac' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publier le highlight' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'place',
        title: 'Belvédère du lac',
        areaLabel: 'Chamonix',
        audience: 'public',
        hideExactLocation: true,
      })
    );
  });

  it('permet de choisir l’audience et de masquer une position existante', () => {
    const onSubmit = vi.fn();
    render(
      <HighlightComposer
        kind="segment"
        targetLabel="Tronçon"
        defaultArea="Chamonix"
        hasLocation
        onClose={() => {}}
        onSubmit={onSubmit}
      />
    );
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Passage technique' } });
    fireEvent.change(screen.getByLabelText('Audience'), { target: { value: 'private' } });
    fireEvent.click(screen.getByLabelText(/Masquer la position exacte/));
    fireEvent.click(screen.getByRole('button', { name: 'Publier le highlight' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'segment', audience: 'private', hideExactLocation: true })
    );
  });
});

describe('CollectionDrawer', () => {
  it('montre les liens au propriétaire et révoque', () => {
    const collection = makeCollection({
      shareLinks: [
        {
          id: 'link-1',
          collectionId: 'collection-1',
          token: 'tok-abc',
          createdBy: 'user-owner',
          createdAt: '2026-11-01T10:00:00.000Z',
          expiresAt: '2026-12-01T10:00:00.000Z',
          revokedAt: null,
        },
      ],
      items: [
        { id: 'i1', type: 'highlight', refId: 'h1', title: 'Lac', sport: 'hike', position: 0 },
      ],
    });
    const onRevoke = vi.fn();
    render(
      <CollectionDrawer
        collection={collectionView(collection)}
        onClose={() => {}}
        onRevoke={onRevoke}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Partager' }));
    expect(screen.getByText('/h/c/tok-abc')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Révoquer' }));
    expect(onRevoke).toHaveBeenCalledWith('link-1');
  });

  it('est en lecture seule quand la vue vient d’un lien', () => {
    const collection = makeCollection({ visibility: 'unlisted' });
    render(
      <CollectionDrawer collection={collectionView(collection, OTHER, true)} onClose={() => {}} />
    );
    expect(screen.getByText('Lecture seule · lien')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Créer un lien révocable' })).toBeNull();
  });
});

describe('GuideDrawer', () => {
  it('limite la recherche au périmètre du parc', () => {
    const guide = buildEditorialGuide(
      {
        id: 'g1',
        slug: 'g1',
        title: 'Lacs',
        description: '',
        theme: 'lacs',
        region: 'Chamonix',
        routes: [],
        pois: [],
        highlights: [],
      },
      OTHER
    );
    const routes = [
      {
        id: 'inside',
        title: 'Balcon nord',
        sport: 'hike' as const,
        region: 'Chamonix',
        audience: 'public' as const,
        latitude: 45.9,
        longitude: 6.8,
        updatedAt: '2026-11-01T10:00:00.000Z',
      },
      {
        id: 'outside',
        title: 'Balcon nord du Vercors',
        sport: 'hike' as const,
        region: 'Vercors',
        audience: 'public' as const,
        latitude: 44.9,
        longitude: 5.4,
        updatedAt: '2026-11-01T10:00:00.000Z',
      },
    ];
    render(
      <GuideDrawer
        guide={guide}
        onClose={() => {}}
        park={{ id: 'p1', name: 'Mont-Blanc', region: 'Chamonix', bbox: [6.7, 45.8, 7, 46] }}
        parkRoutes={routes}
      />
    );
    fireEvent.change(screen.getByLabelText('Rechercher un parcours dans Mont-Blanc'), {
      target: { value: 'nord' },
    });
    expect(screen.getByText('Balcon nord')).toBeTruthy();
    expect(screen.queryByText('Balcon nord du Vercors')).toBeNull();
  });
});

describe('StreetViewPanel / TrailViewPanel', () => {
  it('annonce un fournisseur absent et propose Trail View', () => {
    const onFallback = vi.fn();
    const result: StreetViewResult = {
      available: false,
      panoId: null,
      headingDeg: null,
      direction: null,
      distanceM: null,
      reason: 'provider-absent',
    };
    render(<StreetViewPanel result={result} onClose={() => {}} onFallback={onFallback} />);
    expect(screen.getByTestId('street-view-unavailable').textContent).toContain('non configuré');
    fireEvent.click(screen.getByRole('button', { name: 'Voir les photos du tracé' }));
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it('Trail View affiche distance et cap, jamais la coordonnée', () => {
    render(
      <TrailViewPanel
        routeTitle="Tour du lac"
        onClose={() => {}}
        markers={[
          {
            photoId: 'p1',
            url: 'https://cdn.test/p1.jpg',
            caption: 'Le passage',
            authorName: 'Tony',
            distanceAlongM: 1200,
            offsetM: 8,
            bearingDeg: 45,
          },
        ]}
      />
    );
    expect(screen.getAllByText(/1,2 km/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/cap 45/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/45\.9237/)).toBeNull();
  });
});
