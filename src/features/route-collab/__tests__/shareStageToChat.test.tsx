// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { baseWorkspace } from '../insights/__tests__/fixtures';

const getConversations = vi.fn();
const sendMessage = vi.fn();
vi.mock('@/features/messaging/services/messagingService', () => ({
  messagingService: {
    getConversations: (...a: unknown[]) => getConversations(...a),
    sendMessage: (...a: unknown[]) => sendMessage(...a),
  },
}));

const api: { workspace: ReturnType<typeof baseWorkspace>; serverSynced: boolean; shareToken: string | null; currentUserId: string } = {
  workspace: baseWorkspace({ id: 'ws-1', title: 'Tour du lac', publishedRevisionNo: 3 }),
  serverSynced: true,
  shareToken: null,
  currentUserId: 'u1',
};
vi.mock('../components/workspace/WorkspaceContext', () => ({ useRouteWorkspace: () => api }));

import { ShareStageToChat } from '../components/workspace/stages/ShareStageToChat';
import { shareableConversations, toStageMessageMeta, trailMessageHref } from '../messageLink';

const convs = [
  { id: 'c1', type: 'direct' as const, status: 'active' as const, other_member: { full_name: 'Mina' } },
  { id: 'c2', type: 'group' as const, title: 'Équipe GR20', status: 'active' as const },
  { id: 'c3', type: 'direct' as const, status: 'pending' as const, other_member: { full_name: 'Inconnu' } },
  { id: 'c4', type: 'direct' as const, status: 'active' as const, is_archived: true, other_member: { full_name: 'Archivé' } },
  { id: 'demo-conv-1', type: 'direct' as const, status: 'active' as const, other_member: { full_name: 'Démo' } },
];

describe('8.10 conversations proposées', () => {
  it('seules les conversations actives, non archivées, hors démonstration', () => {
    expect(shareableConversations(convs).map((c) => [c.id, c.label])).toEqual([
      ['c1', 'Mina'],
      ['c2', 'Équipe GR20'],
    ]);
  });
});

describe('8.10 bouton « Envoyer ce jour dans la messagerie »', () => {
  beforeEach(() => {
    getConversations.mockReset();
    sendMessage.mockReset();
    api.serverSynced = true;
    api.shareToken = null;
    api.currentUserId = 'u1';
  });
  afterEach(() => cleanup());

  it('liste les conversations de la personne puis envoie la carte d’étape (type trail, sans jeton)', async () => {
    getConversations.mockResolvedValue(convs);
    sendMessage.mockResolvedValue({ id: 'm1' });
    const stage = api.workspace.stages[1];
    render(<ShareStageToChat stage={stage} />);
    fireEvent.click(screen.getByTestId('share-stage-message'));
    await waitFor(() => expect(screen.getByTestId('share-stage-conversations')).toBeTruthy());
    expect(getConversations).toHaveBeenCalledWith('u1');
    expect(screen.queryByTestId('share-stage-to-c3')).toBeNull();
    expect(screen.queryByTestId('share-stage-to-demo-conv-1')).toBeNull();
    fireEvent.click(screen.getByTestId('share-stage-to-c2'));
    await waitFor(() => expect(screen.getByTestId('share-stage-sent').textContent).toContain('Équipe GR20'));
    const [convId, sender, content, type, reply, meta] = sendMessage.mock.calls[0] as [string, string, string, string, unknown, Record<string, unknown>];
    expect(convId).toBe('c2');
    expect(sender).toBe('u1');
    expect(type).toBe('trail');
    expect(reply).toBeUndefined();
    expect(content).toBe('Tour du lac · Jour 2');
    expect(meta).toMatchObject({ kind: 'trail', workspace_id: 'ws-1', stage_id: stage.id, stage_day: 2, revision_no: 3, share_token: null });
    // La carte reçue ouvre ce jour, par identifiant d'itinéraire (aucun droit donné par le lien).
    expect(trailMessageHref(meta as never)).toBe('/compas/itineraire?workspaceId=ws-1&jour=2');
    expect(toStageMessageMeta(api.workspace, stage.id)?.name).toBe('Tour du lac · Jour 2');
  });

  it('échec d’envoi : dit, jamais présenté comme envoyé', async () => {
    getConversations.mockResolvedValue(convs);
    sendMessage.mockResolvedValue(null);
    render(<ShareStageToChat stage={api.workspace.stages[0]} />);
    fireEvent.click(screen.getByTestId('share-stage-message'));
    await waitFor(() => screen.getByTestId('share-stage-to-c1'));
    fireEvent.click(screen.getByTestId('share-stage-to-c1'));
    await waitFor(() => expect(screen.getByTestId('share-stage-error').textContent).toContain('rien n’a été envoyé'));
    expect(screen.queryByTestId('share-stage-sent')).toBeNull();
  });

  it('lecture des conversations en échec : erreur dite', async () => {
    getConversations.mockRejectedValue(new Error('x'));
    render(<ShareStageToChat stage={api.workspace.stages[0]} />);
    fireEvent.click(screen.getByTestId('share-stage-message'));
    await waitFor(() => expect(screen.getByTestId('share-stage-error')).toBeTruthy());
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('visiteur, itinéraire non enregistré ou lien de lecture : pas de bouton d’envoi', () => {
    api.currentUserId = 'guest-local';
    const { unmount } = render(<ShareStageToChat stage={api.workspace.stages[0]} />);
    expect(screen.queryByTestId('share-stage-message')).toBeNull();
    unmount();
    api.currentUserId = 'u1';
    api.serverSynced = false;
    const second = render(<ShareStageToChat stage={api.workspace.stages[0]} />);
    expect(screen.queryByTestId('share-stage-message')).toBeNull();
    second.unmount();
    api.serverSynced = true;
    api.shareToken = 'tok';
    const third = render(<ShareStageToChat stage={api.workspace.stages[0]} />);
    expect(third.container.innerHTML).toBe('');
  });
});
