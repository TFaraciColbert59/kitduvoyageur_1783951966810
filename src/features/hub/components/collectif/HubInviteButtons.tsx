'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface HubInviteButtonsProps {
  groupId: string;
}

/**
 * H4.3 — Accepter/refuser une invitation (miroir groupes/page handleInvite).
 * update/delete `group_members` (RLS), état busy, refresh hub.
 */
export function HubInviteButtons({ groupId }: HubInviteButtonsProps) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();

  const answer = async (accept: boolean) => {
    if (busy) return;
    setBusy(true);
    triggerHaptic('selection');
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (accept) {
        await supabase.from('group_members').update({ status: 'active' }).eq('group_id', groupId).eq('user_id', user.id);
      } else {
        await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', user.id);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-2 shrink-0">
      <button
        type="button"
        onClick={() => answer(true)}
        disabled={busy}
        className="min-h-[44px] px-4 rounded-full bg-[var(--lkv-primary)] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
      >
        Accepter
      </button>
      <button
        type="button"
        onClick={() => answer(false)}
        disabled={busy}
        className="min-h-[44px] px-4 rounded-full glass text-xs font-bold text-[var(--lkv-text-primary)] cursor-pointer disabled:opacity-50"
      >
        Refuser
      </button>
    </div>
  );
}

export default HubInviteButtons;
