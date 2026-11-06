// @vitest-environment jsdom
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NextRequest } from 'next/server';
import {
  DELETE as groupDELETE,
  PATCH as groupPATCH,
  POST as groupPOST,
  sanitizeSharedGroupKitPayload,
} from '@/app/api/kit-studio/group/route';
import { PATCH as configPATCH } from '@/app/api/kit-studio/configuration/route';
import {
  InsignesDrawer,
  validateBadgePlacement,
  type StudioBadgeDefinition,
} from '../drawers/InsignesDrawer';
import { createInitialKitConfiguration } from '../state/kitConfiguration';

vi.mock('@/features/hub/server/featureFlags', () => ({
  currentFeatureFlags: vi.fn(async () => ({ hub_camp_v1: true })),
}));

const mockSupabaseFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockSupabaseFrom,
  })),
}));

describe('Sécurité Groupe, RLS, Insignes & Confidentialité — SEC-01 à SEC-10, E-03..E-10, F-07..F-10', () => {
  afterEach(() => {
    cleanup();
  });

  it('SEC-01..SEC-07, SEC-10 : vérifie la structure et la réversibilité des migrations SQL et suites pgTAP', () => {
    const repoRoot = path.resolve(__dirname, '../../../..');

    const groupUp = fs.readFileSync(
      path.join(repoRoot, 'supabase/migrations/20261031220000_kit_group_read.sql'),
      'utf8'
    );
    const groupDown = fs.readFileSync(
      path.join(repoRoot, 'supabase/migrations_down/20261031220000_kit_group_read.down.sql'),
      'utf8'
    );
    const badgesUp = fs.readFileSync(
      path.join(repoRoot, 'supabase/migrations/20261031215000_kit_studio_badges.sql'),
      'utf8'
    );
    const badgesDown = fs.readFileSync(
      path.join(repoRoot, 'supabase/migrations_down/20261031215000_kit_studio_badges.down.sql'),
      'utf8'
    );
    const replaceUp = fs.readFileSync(
      path.join(repoRoot, 'supabase/migrations/20261031200000_replace_kit_items_rpc.sql'),
      'utf8'
    );

    expect(groupUp).toMatch(/is_shared_with_group\s+boolean\s+not\s+null\s+default\s+false/i);
    expect(groupUp).toMatch(
      /revoke\s+(all|execute)\s+on\s+function\s+public\.can_read_member_kit\(uuid,\s*uuid\)\s+from\s+public,\s*anon/i
    );
    expect(groupUp).toMatch(/for\s+select/i);
    expect(groupUp).not.toMatch(/create\s+policy.*group.*for\s+(update|delete|insert|all)/i);

    expect(badgesUp).toContain('trg_enforce_kit_badge_ownership');
    expect(badgesUp).toMatch(/from\s+public\.user_badges\s+ub/i);

    expect(replaceUp).toContain("errcode = '23514'");
    expect(replaceUp).toContain("nullif(item->>'weight_g', '')::integer");

    expect(groupDown).toMatch(/drop\s+function\s+if\s+exists\s+public\.can_read_member_kit/i);
    expect(badgesDown).toMatch(/drop\s+table\s+if\s+exists\s+public\.kit_placed_badges/i);
  });

  it('SEC-09, E-06, E-10 : sanitizeSharedGroupKitPayload retire les objets privés, les documents et les coordonnées', () => {
    const payload = sanitizeSharedGroupKitPayload({
      memberId: 'user-peer-2',
      memberName: 'Camille',
      kit: {
        id: 'kit-peer-2',
        name: 'Sac Alpes',
        bag_model_id: 'trekker-55',
        latitude: 45.9231,
        longitude: 6.8697,
        documents: [{ passportNumber: 'SECRET-999' }],
      },
      items: [
        {
          id: 'item-public-1',
          name: 'Tente 2P',
          category: 'Abri',
          quantity: 1,
          weight_g: 1380,
          is_checked: true,
          product_ownership_id: 'private-own-uuid',
          is_private: false,
        },
        {
          id: 'item-private-secret',
          name: 'Traitement médical personnel',
          category: 'Santé',
          quantity: 1,
          weight_g: 40,
          is_private: true,
        },
        {
          id: 'item-private-vis',
          name: 'Pochette papiers',
          visibility: 'private',
        },
      ],
      placedBadges: [],
    });

    expect(payload.readOnly).toBe(true);
    expect(payload.viewerCanReadDocs).toBe(false);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].name).toBe('Tente 2P');
    expect(payload.items[0].productOwnershipId).toBeNull();

    const json = JSON.stringify(payload);
    expect(json).not.toContain('Traitement médical personnel');
    expect(json).not.toContain('Pochette papiers');
    expect(json).not.toContain('SECRET-999');
    expect(json).not.toContain('45.9231');
    expect(json).not.toContain('private-own-uuid');
  });

  it('SEC-04 / E-03 : la route /api/kit-studio/group refuse toute écriture (POST, PATCH, DELETE -> 405)', async () => {
    const postRes = await groupPOST();
    const patchRes = await groupPATCH();
    const delRes = await groupDELETE();

    expect(postRes.status).toBe(405);
    expect(patchRes.status).toBe(405);
    expect(delRes.status).toBe(405);
  });

  it('SEC-08 / F-07 : PATCH /api/kit-studio/configuration refuse (403) la pose d’un insigne non possédé dans user_badges', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: '11111111-1111-4111-8111-111111111111' } },
    });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'materiel_kits') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: '22222222-2222-4222-8222-222222222222',
                    user_id: '11111111-1111-4111-8111-111111111111',
                    studio_revision: 1,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'user_badges') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Table inattendue appelée : ${table}`);
    });

    const req = new NextRequest('http://localhost:3000/api/kit-studio/configuration', {
      method: 'PATCH',
      body: JSON.stringify({
        kitId: '22222222-2222-4222-8222-222222222222',
        clientRevision: 2,
        mutation: {
          type: 'badge/place',
          payload: {
            badgeId: 'unearned-summit-trophy',
            anchorId: 'badge-lid',
            scale: 1.0,
          },
        },
      }),
    });

    const res = await configPATCH(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('possédez pas');
  });

  it('F-07, F-09, F-10 : InsignesDrawer distingue Trophées vs Écussons, interdit l’attribution client et refuse toute ancre inconnue', () => {
    const owned = new Set(['trophy-mont-blanc', 'patch-vercors']);

    const badAnchor = validateBadgePlacement({
      badgeId: 'trophy-mont-blanc',
      ownedBadgeIds: owned,
      anchorId: 'unknown-anchor-xyz',
      supportedAnchors: ['badge-lid', 'badge-body-front'],
    });
    expect(badAnchor.ok).toBe(false);
    if (!badAnchor.ok) {
      expect(badAnchor.code).toBe('INCOMPATIBLE_ANCHOR');
    }

    const unowned = validateBadgePlacement({
      badgeId: 'locked-trophy',
      ownedBadgeIds: owned,
      anchorId: 'badge-lid',
      supportedAnchors: ['badge-lid'],
    });
    expect(unowned.ok).toBe(false);
    if (!unowned.ok) {
      expect(unowned.code).toBe('NOT_OWNED');
    }

    const sampleBadges: StudioBadgeDefinition[] = [
      {
        id: 'trophy-mont-blanc',
        label: 'Aiguille Méridionale',
        description: 'Sortie haute montagne validée',
        kind: 'trophy',
        earned: true,
      },
      {
        id: 'patch-vercors',
        label: 'Hauts Plateaux',
        description: 'Écusson brodé du massif',
        kind: 'patch',
        earned: true,
      },
      {
        id: 'locked-gr20',
        label: 'Traversée Corse',
        description: 'Terminer l’itinéraire complet',
        kind: 'trophy',
        earned: false,
      },
    ];

    const config = createInitialKitConfiguration('kit-badges-1');
    render(
      React.createElement(InsignesDrawer, {
        config,
        badges: sampleBadges,
        onPlaceBadge: () => {},
        onRemoveBadge: () => {},
      })
    );

    expect(screen.getByTestId('badge-emblem-trophy').getAttribute('data-badge-kind')).toBe(
      'trophy'
    );
    expect(screen.getByTestId('badge-emblem-patch').getAttribute('data-badge-kind')).toBe(
      'patch'
    );

    fireEvent.click(screen.getByRole('tab', { name: 'À débloquer' }));
    const lockedCard = screen.getByTestId('insigne-locked-locked-gr20');
    expect(within(lockedCard).queryByRole('button')).toBeNull();
  });
});
