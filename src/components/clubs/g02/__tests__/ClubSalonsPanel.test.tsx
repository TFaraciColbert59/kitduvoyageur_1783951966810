// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ClubSalonsPanel } from '../ClubSalonsPanel';
import { makeChannel, makeMember, makeMessage, NOW } from './fixtures';

afterEach(() => cleanup());

const clubId = '11111111-1111-4111-8111-111111111111';
const member = makeMember({ clubId, userId: 'me', displayName: 'Moi' });
const other = makeMember({ clubId, userId: 'other', displayName: 'Camille' });
const moderator = makeMember({ clubId, userId: 'mod', displayName: 'Modérateur', role: 'moderator' });
const viewerContext = { viewerId: 'me' };

function renderPanel(overrides: Partial<React.ComponentProps<typeof ClubSalonsPanel>> = {}) {
  return render(
    <ClubSalonsPanel
      channels={[makeChannel()]}
      activeChannelId="66666666-6666-4666-8666-666666666666"
      messages={[makeMessage({ authorId: 'other', body: 'Message visible' })]}
      memberships={[member, other, moderator]}
      viewerContext={viewerContext}
      currentUserId="me"
      nowIso={NOW}
      onSelectChannel={vi.fn()}
      onSendMessage={vi.fn()}
      onModerateMessage={vi.fn()}
      {...overrides}
    />,
  );
}

describe('G02 — salons S5.07', () => {
  it('filtre les messages masqués, supprimés et les auteurs bloqués', () => {
    renderPanel({
      messages: [
        makeMessage({ id: 'visible', authorId: 'other', body: 'Visible' }),
        makeMessage({ id: 'hidden', authorId: 'other', body: 'Masqué', hiddenByModeratorId: 'mod' }),
        makeMessage({ id: 'deleted', authorId: 'other', body: 'Supprimé', deletedAt: NOW }),
        makeMessage({ id: 'blocked', authorId: 'blocked', body: 'Bloqué' }),
      ],
      viewerContext: {
        viewerId: 'me',
        blocks: [{ blockerId: 'me', blockedId: 'blocked', createdAt: NOW }],
      },
    });
    expect(screen.getByText('Visible')).toBeTruthy();
    expect(screen.queryByText('Masqué')).toBeNull();
    expect(screen.queryByText('Supprimé')).toBeNull();
    expect(screen.queryByText('Bloqué')).toBeNull();
  });

  it('publie un message valide et vide le composeur', async () => {
    const onSendMessage = vi.fn().mockResolvedValue(undefined);
    renderPanel({ onSendMessage });
    fireEvent.change(screen.getByLabelText('Votre message'), { target: { value: '  Bonjour le club  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publier' }));
    await waitFor(() => expect(onSendMessage).toHaveBeenCalledTimes(1));
    expect(onSendMessage.mock.calls[0][1]).toBe('Bonjour le club');
    await waitFor(() => expect((screen.getByLabelText('Votre message') as HTMLTextAreaElement).value).toBe(''));
  });

  it('bloque la publication dans un salon en lecture seule pour un membre', () => {
    renderPanel({ channels: [makeChannel({ readOnlyForMembers: true })] });
    expect((screen.getByLabelText('Votre message') as HTMLTextAreaElement).disabled).toBe(true);
    expect(screen.getAllByText(/lecture seule pour les membres/i).length).toBeGreaterThan(0);
  });

  it('affiche les actions de modération uniquement au modérateur', () => {
    const { rerender } = renderPanel({ currentUserId: 'me' });
    expect(screen.queryByRole('button', { name: 'Masquer' })).toBeNull();

    rerender(
      <ClubSalonsPanel
        channels={[makeChannel()]}
        activeChannelId="66666666-6666-4666-8666-666666666666"
        messages={[makeMessage({ authorId: 'other', body: 'À modérer' })]}
        memberships={[member, other, moderator]}
        viewerContext={{ viewerId: 'mod' }}
        currentUserId="mod"
        nowIso={NOW}
        onSelectChannel={vi.fn()}
        onSendMessage={vi.fn()}
        onModerateMessage={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Masquer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeTruthy();
  });

  it('signale un message avec un motif obligatoire', async () => {
    const onReportMessage = vi.fn().mockResolvedValue(undefined);
    renderPanel({ onReportMessage });
    fireEvent.click(screen.getByRole('button', { name: 'Signaler' }));
    const confirm = screen.getByRole('button', { name: 'Envoyer le signalement' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Motif du signalement'), { target: { value: 'Propos agressifs' } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(onReportMessage).toHaveBeenCalledTimes(1));
    expect(onReportMessage.mock.calls[0][1]).toBe('Propos agressifs');
  });
});
