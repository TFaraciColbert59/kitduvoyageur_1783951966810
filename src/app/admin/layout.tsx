import type { Metadata } from 'next';

import { getOrIssueCsrfToken } from '@/server/admin/csrf';
import { requireAdminOrRedirect } from '@/features/admin/queries';

export const metadata: Metadata = {
  title: 'Administration',
  robots: { index: false, follow: false },
};

/**
 * Layout /admin — garde serveur : seuls les administrateurs atteignent
 * le back-office (aucun flash de contenu, contrairement à l'ancien
 * guard client). Le jeton CSRF est émis ici pour les îlots clients.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminOrRedirect('users.read');
  await getOrIssueCsrfToken();
  return <>{children}</>;
}
