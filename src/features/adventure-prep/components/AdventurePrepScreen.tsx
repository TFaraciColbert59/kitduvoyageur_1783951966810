import AppShell from '@/components/shell/AppShell';
import PrepFlow from './PrepFlow';
import '../adventure-prep.css';

/**
 * Le preparateur d'aventure, tel qu'il apparait sur /prepare quand aucune
 * aventure n'est encore creee.
 *
 * `hasBottomNav` : la barre d'onglets est rendue par `MobileNavWrapper`, qui
 * ne la masque plus sur cette route. Passer `false` ici ne faisait qu'annuler
 * la reservation `--bottom-nav-height` alors que la barre prenait reellement
 * de la place — l'ecran etait donc mesure trop grand et le bas du contenu
 * passait dessous. `true` garde les deux cotes d'accord.
 *
 * `videoBackground={false}` : le fond est peint par `.adventure-prep`, opaque,
 * pour qu'aucune image d'apparriere-plan ne traverse le texte.
 *
 * `safeTop` garde sa valeur par defaut — le shell applique
 * `env(safe-area-inset-top)`, la page ne le fait jamais elle-meme.
 */
export default function AdventurePrepScreen() {
  return (
    <AppShell hasBottomNav videoBackground={false} className="app-shell--preparer">
      <PrepFlow />
    </AppShell>
  );
}