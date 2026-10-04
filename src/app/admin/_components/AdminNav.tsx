'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: "Vue d'ensemble" },
  { href: '/admin/utilisateurs', label: 'Utilisateurs' },
  { href: '/admin/produits', label: 'Produits' },
  { href: '/admin/commandes', label: 'Commandes' },
  { href: '/admin/moderation', label: 'Modération' },
  { href: '/admin/recompenses', label: 'Récompenses' },
  { href: '/admin/audit', label: 'Audit' },
];

/** Navigation du back-office — onglets défilants canoniques. */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections administration" className="flex gap-2 overflow-x-auto pb-2">
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'shrink-0 rounded-full bg-[color:var(--g3-bg)] px-4 py-2 text-sm font-semibold text-[color:var(--g3-text)]'
                : 'shrink-0 rounded-full border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] px-4 py-2 text-sm font-semibold text-[color:var(--glass-label)]'
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
