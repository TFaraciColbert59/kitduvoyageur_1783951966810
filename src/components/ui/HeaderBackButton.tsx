'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/utils';

export interface HeaderBackButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Destination de repli si l'historique est vide. */
  fallbackHref?: string;
  label?: string;
}

/**
 * Phase 2 (Lot 2) — contrôle retour canonique : toujours à gauche, cible
 * 44×44, même icône, même comportement (historique puis repli explicite).
 */
export default function HeaderBackButton({
  fallbackHref = '/',
  label = 'Retour',
  className,
  onClick,
  ...props
}: HeaderBackButtonProps) {
  const router = useRouter();

  return (
    <button
      {...props}
      type="button"
      aria-label={label}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      className={cn(
        'lkv-glass lkv-glass-interactive inline-flex h-[var(--control-height-md)] w-[var(--control-height-md)] shrink-0 items-center justify-center rounded-full',
        'text-[color:var(--lkv-text-primary)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]',
        className
      )}
    >
      <Icon name="ChevronLeftIcon" size={22} strokeWidth={2.2} />
    </button>
  );
}
