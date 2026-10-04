import type { Metadata } from 'next';

import { getAccountBadge as getOsAccount, getNavBadges as getOsBadges } from '@/features/admin/osQueries';
import { AdminShell, type PaletteAction } from './_os/osUi';

export const metadata: Metadata = {
  title: 'Administration',
  robots: { index: false, follow: false },
};

/**
 * Layout /admin — garde serveur + shell Admin OS (sidebar, topbar,
 * Dynamic Island, palette ⌘K). Les pages enfants fournissent le contenu.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [badges, account] = await Promise.all([getOsBadges(), getOsAccount()]);
  const total = badges.community + badges.support;
  const actions: PaletteAction[] = [
    { label: 'Ajouter un produit', detail: 'Catalogue boutique', href: '/admin/produits/nouveau', icon: 'bag' },
    { label: 'Voir les utilisateurs', detail: 'Annuaire et rôles', href: '/admin/utilisateurs', icon: 'users' },
    { label: 'Voir la file de modération', detail: 'Trust & Safety', href: '/admin/moderation', icon: 'shield' },
    { label: 'Voir le journal d’audit', detail: 'Traçabilité', href: '/admin/audit', icon: 'report' },
    { label: 'Gérer le MFA', detail: 'Sécurité', href: '/admin/securite', icon: 'lock' },
  ];
  return (
    <AdminShell
      eyebrow="MISSION CONTROL"
      badges={badges}
      account={account}
      island={{
        count: total > 0 ? `${total} actions prioritaires` : 'File nominale',
        label: total > 0 ? 'aujourd’hui' : 'rien en attente',
        href: '/admin/support',
      }}
      actions={actions}
    >
      {children}
    </AdminShell>
  );
}
