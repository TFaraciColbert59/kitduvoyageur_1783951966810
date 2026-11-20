'use client';

import React from 'react';
import type { User } from '@supabase/supabase-js';
import '@/styles/communaute-v2.css';
import '@/styles/communaute-v2-shell.css';
import { CreateSheetV2 } from '@/features/community/v2/create/CreateSheetV2';
import type { CreateKindV2 } from '@/features/community/v2/create/engine/createSchemasV2';

interface CarnetCommunityCreateBridgeProps {
  initialKind?: CreateKindV2;
  initialPrefill?: Record<string, unknown> | null;
  user: User | null;
  onClose: () => void;
  onCreated: () => void;
}

export function CarnetCommunityCreateBridge({
  initialKind = 'post',
  initialPrefill = null,
  user,
  onClose,
  onCreated,
}: CarnetCommunityCreateBridgeProps) {
  return (
    <CreateSheetV2
      open
      initialKind={initialKind}
      initialPrefill={initialPrefill}
      user={user}
      onClose={onClose}
      onCreated={onCreated}
      onRequireAuth={onClose}
    />
  );
}
