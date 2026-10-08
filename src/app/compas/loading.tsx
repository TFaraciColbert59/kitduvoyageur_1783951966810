import AppShell from '@/components/shell/AppShell';
import { LoadingState } from '@/components/ui';
import { CompasLightTheme } from '@/features/compas/components/CompasLightTheme';

/**
 * Le temps que le serveur lise le voyage (plan 2.9) : un état de chargement au
 * lieu d'un écran figé. La préparation, elle, a son propre suivi (CompasPrep).
 * Thème clair forcé comme sur la page : arrivé par navigation dans l'app, le
 * script d'initialisation ne repasse pas, et le Compas quitté a pu rendre le
 * thème sombre.
 */
export default function CompasLoading() {
  return (
    <AppShell hasBottomNav videoBackground={false}>
      <CompasLightTheme />
      <LoadingState label="Ouverture du Compas…" />
    </AppShell>
  );
}
