// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import FollowedVersionBadge from '../FollowedVersionBadge';
import { followedVersionLabel, parseHandoff, readHandoffFor, HANDOFF_KEY } from '@/features/route-collab/depart/activityHandoff';

const h = { tripId: 't1', workspaceId: 'w1', revisionId: 'r1', revisionNo: 3, startedAt: new Date().toISOString(), kitSnapshot: [{ id: 'k', name: 'Tente', category: 'abri', weightGrams: 900, quantity: 1, shared: false, assigneeUserId: null }] };

describe('9.8 « Version vN suivie » dans le cockpit', () => {
  afterEach(() => { cleanup(); window.localStorage.clear(); });

  it('affiche la version et le sac quand une passation existe, rien sinon', () => {
    const { unmount } = render(<FollowedVersionBadge handoff={h} />);
    expect(screen.getByTestId('followed-version-badge').textContent).toBe('Version v3 suivie · 1 objet du sac');
    unmount();
    const { container } = render(<FollowedVersionBadge handoff={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('le cockpit relit la passation du voyage ouvert (?tripId=) ; celle d’un autre voyage est ignorée', () => {
    window.localStorage.setItem(HANDOFF_KEY, JSON.stringify(h));
    expect(readHandoffFor('t1')?.revisionNo).toBe(3);
    expect(readHandoffFor('autre')).toBeNull();
  });

  it('une passation illisible est refusée', () => {
    expect(parseHandoff({ tripId: 't' })).toBeNull();
    expect(parseHandoff(null)).toBeNull();
    expect(followedVersionLabel({ revisionNo: 0, kitSnapshot: [] })).toBe('Version publiée suivie');
  });
});
