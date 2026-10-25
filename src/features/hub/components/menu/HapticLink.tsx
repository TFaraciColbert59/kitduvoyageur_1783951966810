'use client';

import Link from 'next/link';
import type { MouseEvent, ReactNode } from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

/**
 * Hub V4 — Lien de navigation avec retour haptique (`selection`) au tap.
 * Wrapper client autour de next/link pour les actions du menu.
 */
export function HapticLink({
  href,
  className,
  children,
  ariaLabel,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  const { triggerHaptic } = useHapticFeedback();
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={className}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
        triggerHaptic('selection');
      }}
    >
      {children}
    </Link>
  );
}

export default HapticLink;
