// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ClubChallengesPanel } from '../ClubChallengesPanel';
import { makeChallenge, makeSummary, NOW } from './fixtures';

afterEach(() => cleanup());

describe('G02 — défis', () => {
  it('affiche la progression consolidée et le badge', () => {
    render(
      <ClubChallengesPanel
        summaries={[makeSummary({ totalProgressValue: 100_000, progressPct: 100, isCompleted: true, badgeAwarded: { id: 'badge', challengeId: 'c', title: 'Centurion', icon: '🏅', awardedAt: NOW } })]}
        progress={[]}
        currentUserId="me"
        nowIso={NOW}
        onJoin={vi.fn()}
      />,
    );
    expect(screen.getByText('100 km de novembre')).toBeTruthy();
    expect(screen.getByText(/Badge obtenu/)).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: '100 % de l’objectif' })).toBeTruthy();
  });

  it('rejoint un défi non commencé', () => {
    const onJoin = vi.fn();
    render(
      <ClubChallengesPanel
        summaries={[makeSummary()]}
        progress={[]}
        currentUserId="me"
        nowIso={NOW}
        onJoin={onJoin}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rejoindre le défi' }));
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it('n’affiche plus le bouton quand le lecteur participe déjà', () => {
    render(
      <ClubChallengesPanel
        summaries={[makeSummary()]}
        progress={[{ challengeId: makeChallenge().id, userId: 'me', currentValue: 12_000, recordedActivityIds: [], completedAt: null, badge: null }]}
        currentUserId="me"
        nowIso={NOW}
        onJoin={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Rejoindre le défi' })).toBeNull();
    expect(screen.getByText(/votre part : 12 km/)).toBeTruthy();
  });

  it('valide le formulaire de création avant d’appeler le serveur', () => {
    const onCreate = vi.fn();
    render(
      <ClubChallengesPanel
        summaries={[]}
        currentUserId="admin"
        nowIso={NOW}
        canCreate
        onJoin={vi.fn()}
        onCreate={onCreate}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Créer un défi' }));
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Défi test' } });
    fireEvent.change(screen.getByLabelText(/Objectif/), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer le défi' }));
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/strictement positif/);
  });
});
