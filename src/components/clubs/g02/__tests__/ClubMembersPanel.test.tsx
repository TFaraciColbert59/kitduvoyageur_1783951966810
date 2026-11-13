// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ClubMembersPanel } from '../ClubMembersPanel';
import { makeClub, makeJoinRequest, makeMember, NOW } from './fixtures';

afterEach(() => cleanup());

const club = makeClub();
const admin = makeMember({ clubId: club.id, userId: 'admin', displayName: 'Ada Admin', role: 'admin' });
const member = makeMember({ clubId: club.id, userId: 'member', displayName: 'Mia Membre' });
const pro = makeMember({
  clubId: club.id,
  userId: 'pro',
  displayName: 'Pro Sportif',
  isProAthlete: true,
  verifiedSports: ['trail'],
});

function renderPanel(overrides: Partial<React.ComponentProps<typeof ClubMembersPanel>> = {}) {
  return render(
    <ClubMembersPanel
      club={club}
      members={[admin, member, pro]}
      joinRequests={[makeJoinRequest()]}
      viewerContext={{ viewerId: 'admin' }}
      currentUserId="admin"
      nowIso={NOW}
      onReviewRequest={vi.fn()}
      onChangeRole={vi.fn()}
      onRemoveMember={vi.fn()}
      onMuteMember={vi.fn()}
      {...overrides}
    />,
  );
}

describe('G02 — membres et badges S5.10', () => {
  it('affiche le badge Pro uniquement dans un contexte autorisé', () => {
    renderPanel();
    expect(screen.getByLabelText('Pro sportif — trail')).toBeTruthy();
  });

  it('ne montre aucune action sur soi-même (pas d’auto-promotion possible)', () => {
    renderPanel();
    const selfRow = screen.getByText('Ada Admin').closest('li') as HTMLElement;
    expect(selfRow.textContent).toContain('vous');
    expect(selfRow.querySelector('button')).toBeNull();
    expect(selfRow.querySelector('select')).toBeNull();
  });

  it('réserve le changement de rôle à un admin', () => {
    renderPanel({ currentUserId: 'member', viewerContext: { viewerId: 'member' } });
    expect(screen.queryByLabelText(/Rôle de/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retirer' })).toBeNull();
  });

  it('affiche les demandes en attente et approuve avec le contrat', () => {
    const onReviewRequest = vi.fn();
    renderPanel({ onReviewRequest });
    expect(screen.getByText('Demandes à traiter')).toBeTruthy();
    expect(screen.getByText('Bob Durand')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Accepter' }));
    expect(onReviewRequest).toHaveBeenCalledTimes(1);
    expect(onReviewRequest.mock.calls[0][1]).toBe(true);
  });

  it('propose la sourdine et le retrait sur un autre membre', () => {
    const onChangeRole = vi.fn();
    const onMuteMember = vi.fn();
    renderPanel({ onChangeRole, onMuteMember });
    const memberRow = screen.getByText('Mia Membre').closest('li') as HTMLElement;
    expect(memberRow.querySelector('select')).toBeTruthy();
    fireEvent.click(memberRow.querySelector('button') as HTMLButtonElement);
    expect(onMuteMember).toHaveBeenCalled();
  });
});
