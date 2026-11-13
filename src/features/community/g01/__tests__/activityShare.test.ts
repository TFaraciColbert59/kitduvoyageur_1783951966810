import { describe, expect, it } from 'vitest';
import {
  activitySessionFromShareMeta,
  buildActivityShareContent,
  buildActivityShareDraft,
  buildRevokedActivityContent,
  isActivityShareActive,
  parseActivityShareMeta,
  revokeActivityShareMeta,
  type ActivityShareMeta,
} from '../activityShare';
import type { SportSessionMetrics } from '../sportStats';

const OWNER = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const REQUEST = '33333333-3333-4333-8333-333333333333';
const CLUB = '44444444-4444-4444-8444-444444444444';

const session: SportSessionMetrics = {
  id: SESSION,
  ownerId: OWNER,
  sport: 'rando',
  title: 'Tour du lac',
  startedAt: '2026-11-13T08:00:00.000Z',
  distanceKm: 12.4,
  durationSeconds: 7200,
  elevationGainM: 850,
  maxAltitudeM: 2100,
  visibility: 'collective_anonymized',
  coverUrl: null,
};

function draft() {
  const result = buildActivityShareDraft(session, {
    audience: 'public',
    requestId: REQUEST,
    allowLikes: true,
    allowComments: false,
    now: '2026-11-13T10:00:00.000Z',
  });
  if (!result.ok) throw new Error(`draft refusé: ${result.reason}`);
  return result;
}

describe('G01 activity share — contrat', () => {
  it('construit une publication sans snapshot, sans média et sans trace', () => {
    const result = draft();
    expect(result.meta.schema).toBe('lkdv.activity.share.v1');
    expect(result.post.creation_meta.session_id).toBe(SESSION);
    expect(result.post.creation_meta.metrics.distanceKm).toBe(12.4);
    expect(result.post.creation_meta.activity_visibility).toBe('shared');
    expect(result.post.creation_meta.options).toEqual({
      allow_likes: true,
      allow_comments: false,
    });
    expect(Object.keys(result.post)).not.toContain('snapshot_payload');
    expect(Object.keys(result.post)).not.toContain('media_urls');
    expect(Object.keys(result.post)).not.toContain('image_url');
    expect(Object.keys(result.post)).not.toContain('linked_carnet_id');
    expect(JSON.stringify(result.post.creation_meta)).not.toMatch(
      /position|trace|geojson|latitude|longitude|polyline/i
    );
  });

  it('refuse une séance privée', () => {
    const result = buildActivityShareDraft(
      { ...session, visibility: 'private' },
      { audience: 'public', requestId: REQUEST }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('private_activity');
  });

  it('refuse une audience inconnue', () => {
    const result = buildActivityShareDraft(session, {
      audience: 'followers-only-probably',
      requestId: REQUEST,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_audience');
  });

  it('exige un club valide pour l’audience club', () => {
    const missing = buildActivityShareDraft(session, { audience: 'club', requestId: REQUEST });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.reason).toBe('club_required');

    const invalid = buildActivityShareDraft(session, {
      audience: 'club',
      clubId: 'pas-un-uuid',
      requestId: REQUEST,
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.reason).toBe('invalid_club');

    const ok = buildActivityShareDraft(session, {
      audience: 'club',
      clubId: CLUB,
      requestId: REQUEST,
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.post.club_id).toBe(CLUB);
      expect(ok.post.audience).toBe('club');
      expect(ok.post.creation_meta.club_id).toBe(CLUB);
    }
  });

  it('refuse un identifiant de requête non UUID', () => {
    const result = buildActivityShareDraft(session, { audience: 'public', requestId: 'abc' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_request');
  });

  it('ne met aucun lieu précis dans le texte', () => {
    const content = buildActivityShareContent(session, draft().meta, 'Belle lumière');
    expect(content).toContain('Tour du lac');
    expect(content).toContain('Belle lumière');
    expect(content).not.toMatch(/latitude|longitude|position|trace/i);
  });
});

describe('G01 activity share — lecture et révocation', () => {
  it('rejette un schéma inconnu ou une version inconnue', () => {
    expect(parseActivityShareMeta({ schema: 'autre' })).toBeNull();
    const meta = draft().meta;
    expect(parseActivityShareMeta({ ...meta, contract_version: 99 })).toBeNull();
  });

  it('ignore les champs de trace ajoutés par un client malveillant', () => {
    const raw = {
      ...draft().meta,
      positions: [{ lat: 45.1, lng: 6.2 }],
      trace: 'abc',
      latitude: 45.1,
    };
    const parsed = parseActivityShareMeta(raw);
    expect(parsed).not.toBeNull();
    expect(JSON.stringify(parsed)).not.toMatch(/positions|trace|latitude/);
  });

  it('considère une visibilité absente comme privée', () => {
    const raw = { ...draft().meta } as Record<string, unknown>;
    delete raw.activity_visibility;
    const parsed = parseActivityShareMeta(raw);
    expect(parsed?.activity_visibility).toBe('private');
  });

  it('projette une séance figée sans relire hike_sessions', () => {
    const meta = draft().meta;
    const frozen = activitySessionFromShareMeta(meta, '**Tour du lac**\n\nSortie');
    expect(frozen.id).toBe(SESSION);
    expect(frozen.ownerId).toBe(OWNER);
    expect(frozen.sport).toBe('rando');
    expect(frozen.distanceKm).toBe(12.4);
    expect(frozen.visibility).toBe('shared');
    expect(Object.keys(frozen)).not.toContain('positions_timed');
    expect(Object.keys(frozen)).not.toContain('positions_geojson');
  });

  it('retire le partage en incrémentant la version', () => {
    const meta = draft().meta;
    expect(isActivityShareActive(meta)).toBe(true);
    const revoked = revokeActivityShareMeta(meta, '2026-11-13T12:00:00.000Z');
    expect(revoked.status).toBe('revoked');
    expect(revoked.version).toBe(meta.version + 1);
    expect(revoked.revoked_at).toBe('2026-11-13T12:00:00.000Z');
    expect(isActivityShareActive(revoked)).toBe(false);
    expect(buildRevokedActivityContent()).not.toMatch(/km|D\+|Tour du lac/);
  });

  it('conserve la méta d’origine dans le retrait', () => {
    const meta: ActivityShareMeta = draft().meta;
    const revoked = revokeActivityShareMeta(meta);
    expect(revoked.session_id).toBe(meta.session_id);
    expect(revoked.metrics).toEqual(meta.metrics);
    expect(revoked.audience).toBe(meta.audience);
  });
});
