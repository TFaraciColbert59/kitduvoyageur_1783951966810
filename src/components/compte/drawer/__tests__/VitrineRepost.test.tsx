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
    clubId: null,
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
    render(<VitrineSlot lens="repost" reposts={REPOSTS} />);

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

  it('affiche l’état vide et le CTA propriétaire', () => {
    render(<VitrineSlot lens="repost" reposts={[]} />);
    expect(screen.getByText('Aucune republication pour le moment.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Republier une publication' })).toBeTruthy();
  });

  it('masque le CTA pour un visiteur', () => {
    render(<VitrineSlot lens="repost" reposts={[]} viewer="visitor" />);
    expect(screen.getByText('Aucune republication pour le moment.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Republier une publication' })).toBeNull();
  });

  it('lit payload.reposts, le contrat de l’hôte', () => {
    render(<VitrineSlot lens="repost" payload={{ reposts: [REPOSTS[0]] }} />);
    expect(screen.getByText('Lac Blanc')).toBeTruthy();
    expect(screen.getByText('1 republication')).toBeTruthy();
  });
});
