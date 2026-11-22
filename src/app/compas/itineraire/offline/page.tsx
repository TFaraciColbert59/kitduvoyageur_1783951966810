import type { Metadata } from 'next';
import { RouteCollabOfflineClient } from '@/features/route-collab/components/RouteCollabOfflineClient';

export const metadata: Metadata = {
  title: 'Pack hors ligne — Compas LKDV',
  description: 'Ouverture hors connexion de la dernière copie complète vérifiée sur cet appareil.',
};

/**
 * Coquille 100 % anonyme (aucune donnée personnelle dans le HTML SSR, conforme RGPD) :
 * mise en cache par le Service Worker pour rouvrir le dernier pack vérifié en mode avion
 * après fermeture et redémarrage complet du navigateur.
 */
export default function CompasItineraireOfflinePage() {
  return <RouteCollabOfflineClient />;
}
