'use client';

/**
 * LKDV — Mon Matériel : composant client chargé d'exécuter la migration du stockage
 * UNE SEULE FOIS au montage (via `useMonMaterielMigration`).
 * Rendu dans le RootLayout (Server Component) : les hooks React ne sont pas
 * appelables côté serveur, d'où ce petit composant d'échelon.
 */

import { useMonMaterielMigration } from '@/hooks/useMonMaterielMigration';

export default function MigrationEffect() {
  useMonMaterielMigration();
  return null;
}