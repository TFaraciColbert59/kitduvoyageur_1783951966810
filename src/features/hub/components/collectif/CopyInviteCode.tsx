'use client';

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

/**
 * Étape 2 — Copie du code d'invitation du groupe (ex-page /groupes, in-hub).
 */
export function CopyInviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const { triggerHaptic } = useHapticFeedback();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      triggerHaptic('selection');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papier indisponible */
    }
  };

  return (
    <section className="glass p-4 rounded-[var(--lkv-radius-card)]" aria-label="Code d'invitation">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">
        Code d&apos;invitation
      </p>
      <div className="flex items-center gap-3 mt-2">
        <p className="font-semibold tabular-nums text-[var(--lkv-text-primary)] text-sm tracking-widest flex-1 min-w-0 truncate">
          {code}
        </p>
        <button
          type="button"
          onClick={copy}
          className="glass-capsule-btn inline-flex items-center gap-1.5 min-h-[44px] px-4 text-xs font-bold text-[var(--lkv-text-primary)] cursor-pointer"
        >
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          <span>{copied ? 'Copié' : 'Copier'}</span>
        </button>
      </div>
      <p className="text-[11px] text-[var(--lkv-text-secondary)] mt-2">
        Partagez ce code pour que vos compagnons rejoignent le groupe.
      </p>
    </section>
  );
}

export default CopyInviteCode;
