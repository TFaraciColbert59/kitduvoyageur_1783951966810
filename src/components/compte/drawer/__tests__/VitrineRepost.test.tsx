// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { VitrineSlot } from '../slots/VitrineSlot';

afterEach(cleanup);

const REPOSTS = [
  {
    id: 'p2',
    sourceId: '11111111-1111-4111-8111-111111111111',
    sourceTitle: 'Lac Blanc',
    sourceAuthor: '@lea',
    createdAt: '2026-10-01',
    audience: 'public',
  },
  {
    id: 'p3',
    sourceId: '22222222-2222-4222-8222-222222222222',
    sourceTitle: 'Tour du Mont Blanc',
    sourceAuthor: '@noah',
    createdAt: '2026-09-12T08:30:00.000Z',
    audience: 'abonnies',
  },
];

const BADGES = [
  { id: 'b1', name: 'Explorateur', rarity: 'Commun', earned: true },
];

describe('Vitrine — Republication', () => {
  it('affiche les republications et les trophées', () => {
    render(<VitrineSlot lens="repost" reposts={[REPOSTS[0]]} badges={BADGES} />);
    expect(screen.getByText('Lac Blanc')).toBeTruthy();
    cleanup();
    render(<VitrineSlot lens="badges" badges={BADGES} />);
    expect(screen.getByText('Explorateur')).toBeTruthy();
  });

  it('détaille la source, la date, l’audience et le lien original', () => {
    render(<VitrineSlot lens="repost" reposts={REPOSTS} viewer="owner" />);

    expect(screen.getByText('Lac Blanc')).toBeTruthy();
    expect(screen.getByText('@lea')).toBeTruthy();
    expect(screen.getByText(/1 oct\. 2026/)).toBeTruthy();
    expect(screen.getByText('Public')).toBeTruthy();
    expect(screen.getByText('Abonnés')).toBeTruthy();

    const links = screen.getAllByRole('link', { name: /Voir l'original/ });
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('href')).toBe(
      '/communaute/post/11111111-1111-4111-8111-111111111111'
    );
    expect(links[1].getAttribute('href')).toBe(
      '/communaute/post/22222222-2222-4222-8222-222222222222'
    );

    expect(screen.getByText('2 republications')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Republier une publication' })).toBeTruthy();
  });

  it('affiche la vignette de la source et les deux dates', () => {
    const { container } = render(
      <VitrineSlot
        lens="repost"
        viewer="owner"
        payload={{
          reposts: [
            {
              id: 'p9',
              sourceId: '33333333-3333-4333-8333-333333333333',
              sourceTitle: 'Lac Blanc',
              sourceAuthor: '@lea',
              sourceImageUrl: 'https://img/lac.jpg',
              sourceCreatedAt: '2026-09-19T12:00:00.000Z',
              createdAt: '2026-10-01T12:00:00.000Z',
              audience: 'public',
            },
          ],
        }}
      />
    );

    const image = container.querySelector('.lkdv-repost-thumb img');
    expect(image?.getAttribute('src')).toBe('https://img/lac.jpg');
    expect(screen.getByText(/Publié le 19 sept\. 2026/)).toBeTruthy();
    expect(screen.getByText(/Relayé le 1 oct\. 2026/)).toBeTruthy();
  });

  it('nomme une source indisponible au lieu de fabriquer un auteur', () => {
    render(
      <VitrineSlot
        lens="repost"
        viewer="owner"
        payload={{
          reposts: [
            {
              id: 'p10',
              sourceId: 'p10',
              sourceTitle: 'Refuge du Lac',
              sourceAuthor: null,
              sourceUnavailable: true,
              createdAt: '2026-10-02T08:00:00.000Z',
              audience: 'public',
            },
          ],
        }}
      />
    );

    expect(screen.getByText('Source indisponible')).toBeTruthy();
    expect(screen.queryByText(/@tony/)).toBeNull();
    expect(screen.getByText('Refuge du Lac')).toBeTruthy();
  });

  it('porte le nom accessible sur l’élément de liste, pas sur le span auteur', () => {
    render(<VitrineSlot lens="repost" reposts={[REPOSTS[0]]} viewer="owner" />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0].getAttribute('aria-label')).toBe(
      'Republication : Lac Blanc, source @lea'
    );
    expect(screen.getByText('@lea').getAttribute('aria-label')).toBeNull();
  });

  it('affiche l’état vide et le CTA propriétaire', () => {
    render(<VitrineSlot lens="repost" reposts={[]} viewer="owner" />);
    expect(screen.getByText('Aucune republication pour le moment.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Republier une publication' })).toBeTruthy();
  });

  it('masque le CTA pour un visiteur', () => {
    render(<VitrineSlot lens="repost" reposts={[]} viewer="visitor" />);
    expect(screen.getByText('Aucune republication pour le moment.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Republier une publication' })).toBeNull();
  });

  it('masque le CTA en visite même avec un payload authentifié sans viewer explicite', () => {
    render(
      <VitrineSlot
        lens="repost"
        reposts={REPOSTS}
        viewer="visitor"
        payload={{ authenticated: true, reposts: REPOSTS }}
      />
    );

    expect(screen.getByText('Lac Blanc')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Republier une publication' })).toBeNull();
  });

  it('déduit le propriétaire d’un bootstrap authentifié et public, sans viewer explicite', () => {
    render(
      <VitrineSlot
        lens="repost"
        reposts={REPOSTS}
        payload={{ authenticated: true, visibility: { profile: 'public' }, reposts: REPOSTS }}
      />
    );

    expect(screen.getByRole('link', { name: 'Republier une publication' })).toBeTruthy();
  });

  it('ne déduit jamais le propriétaire d’un profil privé sans viewer explicite', () => {
    render(
      <VitrineSlot
        lens="repost"
        reposts={REPOSTS}
        payload={{ authenticated: true, visibility: { profile: 'prive' }, reposts: REPOSTS }}
      />
    );

    expect(screen.queryByRole('link', { name: 'Republier une publication' })).toBeNull();
  });

  it('respecte payload.viewer owner sans prop explicite', () => {
    render(
      <VitrineSlot
        lens="repost"
        reposts={REPOSTS}
        payload={{ viewer: 'owner', reposts: REPOSTS }}
      />
    );

    expect(screen.getByRole('link', { name: 'Republier une publication' })).toBeTruthy();
  });

  it('lit payload.reposts, le contrat de l’hôte', () => {
    render(<VitrineSlot lens="repost" payload={{ reposts: [REPOSTS[0]] }} />);
    expect(screen.getByText('Lac Blanc')).toBeTruthy();
    expect(screen.getByText('1 republication')).toBeTruthy();
  });
});
