import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { HUB_HOME_HREF } from '../../registry/hubSectionRegistry';

/**
 * Hub V4 — Retour au MENU (racine /hub). Nav « retour menu uniquement ».
 * Discret, ≥44px, accessible.
 */
export function MenuBack() {
  return (
    <Link
      href={HUB_HOME_HREF}
      className="inline-flex items-center gap-1.5 min-h-[44px] px-2 -ml-2 text-xs font-semibold text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] active:scale-95 transition-transform"
    >
      <ArrowLeft size={14} aria-hidden="true" />
      <span>Menu</span>
    </Link>
  );
}

export default MenuBack;