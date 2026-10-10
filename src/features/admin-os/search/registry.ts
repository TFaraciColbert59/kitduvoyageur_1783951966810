/**
 * Registre logique des entités recherchables (Global Entity Search).
 * Chaque entrée déclare : permission de lecture, route admin, PII ?
 * Le moteur applique les droits au résultat (jamais d'accès implicite).
 */

export interface SearchableEntity {
  domain: string;
  label: string;
  adminRoute: (id: string) => string;
  requiredPermission: string;
  containsPii: boolean;
}

export const SEARCHABLE_ENTITIES: Record<string, SearchableEntity> = {
  user: {
    domain: 'user',
    label: 'Utilisateur',
    adminRoute: (id) => `/admin/utilisateurs?highlight=${id}`,
    requiredPermission: 'users.read',
    containsPii: true,
  },
  order: {
    domain: 'order',
    label: 'Commande',
    adminRoute: (id) => `/admin/commandes?highlight=${id}`,
    requiredPermission: 'orders.read',
    containsPii: false,
  },
  product: {
    domain: 'product',
    label: 'Produit',
    adminRoute: (id) => `/admin/produits/${id}`,
    requiredPermission: 'products.read',
    containsPii: false,
  },
  ticket: {
    domain: 'ticket',
    label: 'Signalement modération',
    adminRoute: (id) => `/admin/moderation?highlight=${id}`,
    requiredPermission: 'moderation.read',
    containsPii: false,
  },
  audit: {
    domain: 'audit',
    label: 'Événement audit',
    adminRoute: (id) => `/admin/audit?highlight=${id}`,
    requiredPermission: 'audit.read',
    containsPii: false,
  },
  command: {
    domain: 'command',
    label: 'Commande admin',
    adminRoute: (id) => `/admin/work?highlight=${id}`,
    requiredPermission: 'admin.access',
    containsPii: false,
  },
};

/** Masquage PII par défaut : `j***@domaine`. Révélation = `users.pii.reveal` audité. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  return `${email[0]}***@${email.slice(at + 1)}`;
}
