import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const profile = readFileSync('src/components/profile/PublicMobileProfileView.tsx', 'utf8');
const inbox = readFileSync('src/features/messaging/components/MessageInbox.tsx', 'utf8');
const service = readFileSync('src/features/messaging/services/messagingService.ts', 'utf8');

describe('Community public profile -> direct messaging', () => {
  it('profile links to a real selected traveler rather than a placeholder', () => {
    expect(profile).toContain('/messagerie?dest=${profile.id}');
  });
  it('messaging inbox checks blocks, respects access controls and opens the DM', () => {
    for (const needle of [
      "searchParams.get('dest')", 'recipientLinkHandled.current',
      'blockedByMe', 'blockedMe', 'user_blocks', 'getOrCreateDirectConversation',
      'refreshConversations()', 'setSelectedConvId(id)',
      'onActiveConversationChange?.(true)',
      "address.searchParams.delete('dest')", 'role="alert"',
    ]) expect(inbox).toContain(needle);
  });
  it('reuses existing RPC and never bypasses RLS', () => {
    expect(service).toContain("supabase.rpc('get_or_create_direct_conversation'");
    expect(inbox).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
