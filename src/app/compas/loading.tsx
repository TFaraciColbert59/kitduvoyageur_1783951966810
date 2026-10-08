import AppShell from '@/components/shell/AppShell';
import { LoadingState } from '@/components/ui';

/**
 * Le temps que le serveur lise le voyage (plan 2.9) : un état de chargement au
 * lieu d'un écran figé. La préparation, elle, a son propre suivi (CompasPrep).
 */
export default function CompasLoading() {
  return (
    <AppShell hasBottomNav videoBackground={false}>
      <LoadingState label="Ouverture du Compas…" />
    </AppShell>
  );
}
