'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { QuickCreateTripModal } from '@/features/trips/components/QuickCreateTripModal';
import { HUB_NEW_HREF } from '../registry/hubSectionRegistry';

/**
 * UX Hub — CTA "Nouvelle activité" de la sidebar : ouvre la création rapide
 * (QuickCreateTripModal réintégré, déjà hub-aware). Lien secondaire vers la
 * création complète (wizard / génération IA) sous le CTA.
 */
export function HubQuickCreate() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass-capsule-btn primary w-full min-h-[44px] !px-3 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer active:scale-[0.98]"
      >
        <Plus size={14} aria-hidden="true" />
        <span>Nouvelle activité</span>
      </button>
      <Link
        href={HUB_NEW_HREF}
        className="w-full text-center text-[10.5px] font-semibold text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] cursor-pointer min-h-[44px] flex items-center justify-center"
      >
        Création guidée ou IA →
      </Link>
      <QuickCreateTripModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default HubQuickCreate;
