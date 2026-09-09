'use client';

// Hub V4 — SOS flottant (phase « En cours » uniquement). Bouton fixe en
// bas à droite ; ouvre une confirmation (jamais d'appel automatique) avec
// le 112 et l'accès direct aux points de contrôle.
import React, { useState } from 'react';
import Link from 'next/link';
import { Phone, Shield, Siren } from 'lucide-react';
import { GlassModal } from '@/components/ui/GlassModal';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface SosFloatingButtonProps {
  /** Lien vers la section Sécurité (hubSectionHref). */
  safetyHref: string;
}

export function SosFloatingButton({ safetyHref }: SosFloatingButtonProps) {
  const [open, setOpen] = useState(false);
  const { triggerHaptic } = useHapticFeedback();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          triggerHaptic('warning');
          setOpen(true);
        }}
        aria-label="Urgence — secours et contacts"
        className="fixed bottom-[calc(88px+env(safe-area-inset-bottom,0px))] right-4 z-[900] md:bottom-6 md:right-6 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--lkv-danger)] text-white shadow-xl border-2 border-white/70 transition-transform active:scale-90 cursor-pointer"
      >
        <Siren size={24} aria-hidden="true" />
      </button>

      <GlassModal open={open} onOpenChange={setOpen} title="Urgence" variant="sheet">
        <div className="space-y-4 pb-2">
          <a
            href="tel:112"
            onClick={() => triggerHaptic('success')}
            className="flex items-center gap-4 rounded-2xl border-2 border-[var(--lkv-danger)] bg-[var(--lkv-danger)]/5 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--lkv-danger)] text-white shrink-0">
              <Phone size={22} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-extrabold text-[var(--lkv-danger)]">Appeler le 112</span>
              <span className="block text-xs text-[var(--lkv-text-secondary)]">
                Secours en montagne — urgences UE
              </span>
            </span>
          </a>

          <Link
            href={safetyHref}
            onClick={() => triggerHaptic('selection')}
            className="flex items-center gap-4 rounded-2xl border border-white/60 bg-white/60 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)] shrink-0">
              <Shield size={22} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-bold text-[var(--lkv-text-primary)]">Points de contrôle</span>
              <span className="block text-xs text-[var(--lkv-text-secondary)]">Contacts ICE et jalons horaires</span>
            </span>
          </Link>

          <p className="text-[11px] text-[var(--lkv-text-muted)] px-1">
            Pas d&apos;appel automatique : la confirmation reste toujours manuelle.
          </p>
        </div>
      </GlassModal>
    </>
  );
}

export default SosFloatingButton;
