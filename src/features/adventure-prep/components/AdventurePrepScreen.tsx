import AppShell from '@/components/shell/AppShell';
import PrepFlow from './PrepFlow';
import '../adventure-prep.css';
import '../prep-compas.css';

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
 *
 * `material="compas"` : la creation lancee depuis /compas prend le verre clair
 * du Compas (prep-compas.css) et son fond, le paysage eclairci `.cp-bg` de
 * compas.css. Sans lui, le materiau sombre d'origine reste celui de l'ecran.
 */
export default function AdventurePrepScreen({ material }: { material?: 'compas' } = {}) {
  const compas = material === 'compas';
  return (
    <AppShell
      hasBottomNav
      videoBackground={false}
      className={compas ? 'app-shell--preparer prep-material-compas' : 'app-shell--preparer'}
    >
      {compas && <div className="cp-bg" aria-hidden="true" />}
      <PrepFlow />
    </AppShell>
  );
}
