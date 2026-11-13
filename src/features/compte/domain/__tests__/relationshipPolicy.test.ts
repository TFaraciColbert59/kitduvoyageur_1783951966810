import { describe, expect, it } from 'vitest';
import {
  canPerformRelationshipAction,
  resolveRelationship,
} from '../relationshipPolicy';

const VIEWER = '00000000-0000-4000-8000-000000000001';
const TARGET = '00000000-0000-4000-8000-000000000002';

describe('resolveRelationship — sourdine de contenu distincte', () => {
  it('active la sourdine de contenu sans toucher à la conversation', () => {
    const policy = resolveRelationship({
      viewerId: VIEWER,
      targetId: TARGET,
      mutedContent: true,
      followState: 'following',
    });

    expect(policy.muted).toBe(true);
    expect(policy.mutedContent).toBe(true);
    expect(policy.mutedConversation).toBe(false);
    expect(policy.canUnmuteContent).toBe(true);
    expect(policy.canMuteConversation).toBe(true);
    expect(policy.canUnmuteConversation).toBe(false);
    expect(policy.canFollow).toBe(false);
    expect(policy.canUnfollow).toBe(true);
  });

  it('active la sourdine de conversation sans masquer les contenus', () => {
    const policy = resolveRelationship({
      viewerId: VIEWER,
      targetId: TARGET,
      mutedConversation: true,
      hasDirectConversation: true,
      followState: 'following',
    });

    expect(policy.muted).toBe(true);
    expect(policy.mutedContent).toBe(false);
    expect(policy.mutedConversation).toBe(true);
    expect(policy.canMuteContent).toBe(true);
    expect(policy.canUnmuteContent).toBe(false);
    expect(policy.canUnmuteConversation).toBe(true);
    expect(policy.canMuteConversation).toBe(false);
  });

  it('garde les deux sourdines indépendantes quand elles sont actives', () => {
    const policy = resolveRelationship({
      viewerId: VIEWER,
      targetId: TARGET,
      mutedContent: true,
      mutedConversation: true,
      hasDirectConversation: true,
    });

    expect(policy.mutedContent).toBe(true);
    expect(policy.mutedConversation).toBe(true);
    expect(policy.canUnmuteContent).toBe(true);
    expect(policy.canUnmuteConversation).toBe(true);
  });
});

describe('resolveRelationship — priorités et garde-fous', () => {
  it('un blocage neutralise la pose des deux sourdines mais pas leur levée', () => {
    const policy = resolveRelationship({
      viewerId: VIEWER,
      targetId: TARGET,
      blockedByViewer: true,
      mutedContent: true,
      mutedConversation: true,
    });

    expect(policy.blocked).toBe(true);
    expect(policy.canMuteContent).toBe(false);
    expect(policy.canMuteConversation).toBe(false);
    expect(policy.canUnmuteContent).toBe(true);
    expect(policy.canUnmuteConversation).toBe(true);
    expect(policy.canFollow).toBe(false);
    expect(policy.canMessage).toBe(false);
  });

  it('sans conversation directe, seule la conversation est indisponible', () => {
    const policy = resolveRelationship({
      viewerId: VIEWER,
      targetId: TARGET,
      hasDirectConversation: false,
      followState: 'following',
    });

    expect(policy.canMuteContent).toBe(true);
    expect(policy.canMuteConversation).toBe(false);
    expect(policy.canUnmuteConversation).toBe(false);
  });

  it('ne propose la sourdine de contenu que pour un compte suivi', () => {
    const notFollowing = resolveRelationship({
      viewerId: VIEWER,
      targetId: TARGET,
      followState: 'none',
    });
    const following = resolveRelationship({
      viewerId: VIEWER,
      targetId: TARGET,
      followState: 'following',
    });

    expect(notFollowing.canMuteContent).toBe(false);
    expect(following.canMuteContent).toBe(true);
  });

  it('refuse les deux sourdines sur son propre profil', () => {
    const policy = resolveRelationship({
      viewerId: VIEWER,
      targetId: VIEWER,
      followState: 'none',
    });

    expect(policy.isSelf).toBe(true);
    expect(policy.denial).toBe('self');
    expect(policy.canMuteContent).toBe(false);
    expect(policy.canMuteConversation).toBe(false);
    expect(policy.canUnmuteContent).toBe(false);
  });

  it('expose les alias historiques et les actions nommées', () => {
    const contentMuted = resolveRelationship({
      viewerId: VIEWER,
      targetId: TARGET,
      mutedContent: true,
    });

    expect(contentMuted.canMute).toBe(contentMuted.canMuteConversation);
    expect(contentMuted.canUnmute).toBe(contentMuted.canUnmuteConversation);
    expect(canPerformRelationshipAction(contentMuted, 'unmute_content')).toBe(true);
    expect(canPerformRelationshipAction(contentMuted, 'mute_content')).toBe(false);
    expect(canPerformRelationshipAction(contentMuted, 'mute_conversation')).toBe(true);
    expect(canPerformRelationshipAction(contentMuted, 'unmute_conversation')).toBe(false);
  });

  it('un refus de suivi ne bloque pas les autres réglages, mais ne vaut pas suivi', () => {
    const policy = resolveRelationship(
      {
        viewerId: VIEWER,
        targetId: TARGET,
        lastFollowRequestAt: new Date().toISOString(),
        lastFollowRequestStatus: 'declined',
      },
      { now: Date.now() }
    );

    expect(policy.canFollow).toBe(false);
    // La sourdine de contenu est réservée aux comptes suivis : un refus ne
    // crée pas ce droit. La conversation, elle, reste réglable.
    expect(policy.canMuteContent).toBe(false);
    expect(policy.canMuteConversation).toBe(true);
  });
});
