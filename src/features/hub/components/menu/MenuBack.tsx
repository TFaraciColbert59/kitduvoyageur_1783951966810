import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { HUB_HOME_HREF } from '../../registry/hubSectionRegistry';

/**
 * Hub V4 — Retour au MENU (racine /hub). Icône seule (V7), ≥44px, accessible.
 */
export function MenuBack() {
  return (
    <Link
      href={HUB_HOME_HREF}
      aria-label="Retour au hub"
      title="Retour au hub"
      className="inline-flex h-11 w-11 -ml-2 items-center justify-center rounded-full text-[var(--lkv-text-secondary)] transition-transform hover:text-[var(--lkv-text-primary)] active:scale-95"
    >
      <Icon name="arrow-left" size={18} aria-hidden="true" />
    </Link>
  );
}

export default MenuBack;
