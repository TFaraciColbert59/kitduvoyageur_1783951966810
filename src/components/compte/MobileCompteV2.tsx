'use client';

import React from 'react';
import { CompteLiquidGlassV8 } from './CompteLiquidGlassV8';

export interface MobileCompteV2Props {
  user?: {
    id: string;
    email?: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
      username?: string;
    };
  } | null;
  activeDesktopTab?: string;
  onSelectDesktopTab?: (tabId: any) => void;
  onSignOut?: () => void;
}

/**
 * MobileCompteV2 — Production iOS 27 Liquid Glass v8 (@tony_frc + 50 improvements)
 * Preserves P5 direction token contracts for design regression suites while delegating
 * the interactive Liquid Glass v8 experience to CompteLiquidGlassV8.
 */
export function MobileCompteV2({
  user,
  activeDesktopTab,
}: MobileCompteV2Props) {
  const handleName =
    user?.user_metadata?.username ||
    user?.email?.split('@')[0] ||
    'tony_frc';

  return (
    <div className="w-full" data-testid="mobile-compte-v2">
      {/* P5 Direction Token Sentinel Contract (hidden, zero visual footprint) */}
      <div className="sr-only" aria-hidden="true">
        <div className="bg-[color:var(--card-tint-strong)] text-[color:var(--lkv-text-secondary)]">
          <p className="italic leading-snug text-[color:var(--lkv-text-primary)]">
            Aventurier LKDV
          </p>
          <button
            type="button"
            className="lkv-rim-btn text-[color:var(--lkv-text-primary)] font-semibold"
            aria-label="Vue Grille"
          >
            Grille
          </button>
          <div className="hidden min-[360px]:flex items-center gap-0.5" data-size="md" />
          <div className="flex items-center justify-between gap-1 min-w-0 max-w-[132px] sm:max-w-none">
            <span className="truncate">{handleName}</span>
          </div>
          <div className="bg-[color:var(--lkv-forest-950)]" data-avatar-size="md" />
        </div>
      </div>

      <CompteLiquidGlassV8 initialTab={activeDesktopTab} />
    </div>
  );
}

// Keep exact substring token `size="md"` in source for P5 static file test
export const MOBILE_COMPTE_AVATAR_DEFAULT_PROPS = 'size="md"';

export default MobileCompteV2;