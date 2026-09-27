import AppShell from '@/components/shell/AppShell';
import PrepFlow from './PrepFlow';
import '../adventure-prep.css';

/**
 * Le preparateur d'aventure, tel qu'il apparait sur /prepare quand aucune
 * aventure n'est encore creee.
 *
 * `hasBottomNav={false}` : le flux occupe tout l'ecran, la barre d'onglets
 * n'a pas sa place ici. `safeTop` garde sa valeur par defaut — le shell
 * applique `env(safe-area-inset-top)`, la page ne le fait jamais elle-meme.
 */
export default function AdventurePrepScreen() {
  return (
    <AppShell hasBottomNav={false} videoBackground={false} className="app-shell--preparer">
      <PrepFlow />
    </AppShell>
  );
}