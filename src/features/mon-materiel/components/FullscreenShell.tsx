'use client';

/**
 * LKDV — Mon Matériel : coquille plein écran des 6 vues détaillées.
 * Escape ferme · focus piégé (Tab) · focus initial sur « Fermer » ·
 * shared element (layoutId) pour l'expansion/rétrécissement des cartes ·
 * scroll interne seul · `prefers-reduced-motion` respecté.
 */

import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { IconClose } from './icons';

export interface FullscreenShellProps {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}

export function FullscreenShell({
  id,
  title,
  subtitle,
  icon,
  onClose,
  children,
}: FullscreenShellProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Escape + focus trap
  useEffect(() => {
    const root = document.querySelector('[data-fullscreen]') as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && root) {
        const focusables = [
          ...root.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          ),
        ].filter((el) => !el.hasAttribute('disabled'));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        const inside = !!active && root.contains(active);
        if (e.shiftKey && (!inside || active === first)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (!inside || active === last)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => closeRef.current?.focus(), 50);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [onClose]);

  return (
    <motion.div
      data-fullscreen
      layout
      layoutId={`lkdv-exp-${id}`}
      transition={{ type: 'spring', stiffness: 280, damping: 32, mass: 1.05 }}
      className="fixed inset-0 z-[5000] flex flex-col bg-[#FBFAF6]/97 backdrop-blur-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-[#1C2620]/8 bg-white/60 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-[#2D5A3D]/8 border border-[#1C2620]/8 flex items-center justify-center text-[#2D5A3D] shrink-0">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#1C2620] truncate">{title}</h2>
            {subtitle && <p className="text-xs text-[#1C2620]/60 truncate">{subtitle}</p>}
          </div>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Fermer (échap)"
          className="w-11 h-11 rounded-full bg-[#1C2620]/6 hover:bg-[#1C2620]/10 border border-[#1C2620]/10 flex items-center justify-center text-[#1C2620] shrink-0 transition-colors"
        >
          <IconClose size={18} />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4"
        >
          {children}
        </motion.div>
      </div>
    </motion.div>
  );
}