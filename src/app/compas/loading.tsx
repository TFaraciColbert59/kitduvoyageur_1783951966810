import AppShell from '@/components/shell/AppShell';
import { CompasLightTheme } from '@/features/compas/components/CompasLightTheme';
import { CompasSkeleton } from '@/features/compas/components/CompasSkeleton';
// Dans la page aussi : importée ici, la feuille du Compas est livrée avec le
// squelette, qui arrive avant la page et ne doit pas s'afficher nu.
import '@/features/compas/compas.css';

/**
 * Le temps que le serveur lise le voyage (plans 2.9 et 5.1) : le squelette du
 * Compas (même grille que l'écran réel, aucun saut à l'arrivée) au lieu d'un
 * écran figé ou d'un simple spinner. La préparation, elle, a son propre suivi
 * (CompasPrep).
 * Thème clair forcé comme sur la page : arrivé par navigation dans l'app, le
 * script d'initialisation ne repasse pas, et le Compas quitté a pu rendre le
 * thème sombre.
 */
export default function CompasLoading() {
  return (
    <AppShell hasBottomNav videoBackground={false}>
      <CompasLightTheme />
      <CompasSkeleton />
    </AppShell>
  );
}
