import { describe, expect, it } from 'vitest';
import {
  AnchorSchema,
  CommentSchema,
  DecideSchema,
  MemberActionSchema,
  PresenceSchema,
  ProposalSchema,
  RelocateSchema,
  VoteSchema,
} from '../_teamSchemas';

const anchor = { anchorType: 'stage', entityId: 'st2', entityVersion: 1, originalLat: 45, originalLon: 6 };

describe('MemberActionSchema', () => {
  it('droit, révocation et étapes confiées (8.3)', () => {
    expect(MemberActionSchema.safeParse({ kind: 'member', targetUserId: 'u2', role: 'contributor' }).success).toBe(true);
    expect(MemberActionSchema.safeParse({ kind: 'member', targetUserId: 'u2', revoke: true }).success).toBe(true);
    const scoped = MemberActionSchema.parse({ kind: 'member', targetUserId: 'u2', stageScopeIds: ['st2'] });
    expect(scoped).toMatchObject({ stageScopeIds: ['st2'] });
    expect(MemberActionSchema.safeParse({ kind: 'member', targetUserId: 'u2', stageScopeIds: [] }).success).toBe(true);
    expect(MemberActionSchema.safeParse({ kind: 'member', targetUserId: 'u2', stageScopeIds: new Array(201).fill('s') }).success).toBe(false);
    expect(MemberActionSchema.safeParse({ kind: 'member', targetUserId: 'u2', stageScopeIds: [''] }).success).toBe(false);
  });
  it('refuse les anciens corps (kind role/revoke), les clés inconnues et les rôles inventés', () => {
    expect(MemberActionSchema.safeParse({ kind: 'role', userId: 'u2', role: 'editor' }).success).toBe(false);
    expect(MemberActionSchema.safeParse({ kind: 'revoke', userId: 'u2' }).success).toBe(false);
    expect(MemberActionSchema.safeParse({ kind: 'member', targetUserId: 'u2', admin: true }).success).toBe(false);
    expect(MemberActionSchema.safeParse({ kind: 'member', targetUserId: 'u2', role: 'root' }).success).toBe(false);
  });
  it('lien de lecture : durée bornée, zone de départ privée jamais désactivable', () => {
    expect(MemberActionSchema.safeParse({ kind: 'share_link', action: 'create', expiresInHours: 48, hidePrivateStartRadiusM: 300 }).success).toBe(true);
    expect(MemberActionSchema.safeParse({ kind: 'share_link', action: 'create', hidePrivateStartRadiusM: 0 }).success).toBe(false);
    expect(MemberActionSchema.safeParse({ kind: 'share_link', action: 'create', hidePrivateStartRadiusM: 199 }).success).toBe(false);
    expect(MemberActionSchema.safeParse({ kind: 'share_link', action: 'create', expiresInHours: 721 }).success).toBe(false);
    expect(MemberActionSchema.safeParse({ kind: 'share_link', action: 'delete' }).success).toBe(false);
  });
});

describe('présence, commentaires, ancres', () => {
  it('présence : mode fermé, clés inconnues refusées', () => {
    expect(PresenceSchema.parse({ activeStageId: 'st1' }).mode).toBe('viewing');
    expect(PresenceSchema.safeParse({ mode: 'admin' }).success).toBe(false);
    expect(PresenceSchema.safeParse({ lat: 45 }).success).toBe(false);
  });
  it('ancre sur point, tronçon, jour ou position ; identifiants et distances bornés', () => {
    for (const t of ['point', 'section', 'stage', 'position']) {
      expect(AnchorSchema.safeParse({ ...anchor, anchorType: t }).success).toBe(true);
    }
    expect(AnchorSchema.parse(anchor).maxRelocateMeters).toBe(250);
    expect(AnchorSchema.safeParse({ ...anchor, anchorType: 'day' }).success).toBe(false);
    expect(AnchorSchema.safeParse({ ...anchor, entityId: 'x'.repeat(121) }).success).toBe(false);
    expect(AnchorSchema.safeParse({ ...anchor, originalLat: 91 }).success).toBe(false);
    expect(AnchorSchema.safeParse({ ...anchor, maxRelocateMeters: 1e9 }).success).toBe(false);
  });
  it('commentaire : non vide après rognage, 1000 caractères au plus ; relocate réutilise la même ancre', () => {
    expect(CommentSchema.safeParse({ body: '  ', anchor }).success).toBe(false);
    expect(CommentSchema.safeParse({ body: 'x'.repeat(1001), anchor }).success).toBe(false);
    expect(CommentSchema.safeParse({ body: 'Eau au refuge ?', anchor }).success).toBe(true);
    expect(CommentSchema.safeParse({ body: 'ok', anchor, extra: 1 }).success).toBe(false);
    expect(RelocateSchema.safeParse({ newAnchor: anchor }).success).toBe(true);
    expect(RelocateSchema.safeParse({ newAnchor: { ...anchor, entityId: '' } }).success).toBe(false);
  });
});

describe('propositions', () => {
  it('opérations validées comme des opérations directes, strictement', () => {
    const op = { type: 'move_point', pointId: 'p1', lat: 45, lon: 6 };
    expect(ProposalSchema.safeParse({ title: 'Crête', rationale: 'Moins boueux', operations: [op] }).success).toBe(true);
    expect(ProposalSchema.parse({ title: 'Crête', operations: [op] }).rationale).toBe('');
    expect(ProposalSchema.safeParse({ title: 'Crête', operations: [] }).success).toBe(false);
    expect(ProposalSchema.safeParse({ title: 'C', operations: [op] }).success).toBe(false);
    expect(ProposalSchema.safeParse({ title: 'Crête', operations: [{ type: 'drop_database' }] }).success).toBe(false);
    expect(ProposalSchema.safeParse({ title: 'Crête', operations: [op], status: 'accepted' }).success).toBe(false);
  });
  it('vote et décision : enums fermés', () => {
    expect(VoteSchema.safeParse({ vote: 'up' }).success).toBe(true);
    expect(VoteSchema.safeParse({ vote: 'maybe' }).success).toBe(false);
    expect(DecideSchema.safeParse({ decision: 'accept', expectedHeadSeq: 3 }).success).toBe(true);
    expect(DecideSchema.safeParse({ decision: 'accept', expectedHeadSeq: -1 }).success).toBe(false);
    expect(DecideSchema.safeParse({ decision: 'merge' }).success).toBe(false);
  });
});
