import { COMPAS_STEPS } from '../engine/compasModel';
import { CompasText } from './CompasText';

/**
 * Squelette de chargement du Compas (plan 5.1).
 *
 * Il reprend la grille du vrai écran (`.compas` > `.cp-top` + `.cp-map`) et
 * ses mesures (capsule des cinq étapes, carte d'étape, carte en bas) : quand
 * l'écran réel arrive, rien ne se déplace. Verre et fond sont ceux du Compas.
 *
 * - Annoncé UNE fois aux lecteurs d'écran (`role="status"`, texte seul) ; les
 *   formes sont muettes (`aria-hidden`).
 * - Aucun élément cliquable : rien n'est proposé tant que le Compas n'est pas là.
 * - Pas d'état : composant serveur, rendu sans JavaScript.
 * - Aucune donnée n'est suggérée : des blocs vides, pas de faux voyage ni de
 *   faux chiffre.
 * - Le libellé suit la locale du site (`compas.skeleton.opening`) : seule cette
 *   feuille est cliente (`CompasText`), le reste reste serveur.
 */
export function CompasSkeleton({ label }: { label?: string }) {
  return (
    <div className="compas compas--skeleton" role="status" aria-live="polite" aria-busy="true">
      <div className="cp-bg" aria-hidden="true" />
      <span className="sr-only">{label ?? <CompasText k="compas.skeleton.opening" />}</span>
      <div className="cp-top" aria-hidden="true">
        <div className="cp-headrow">
          <div className="cp-steps cp-glass">
            {COMPAS_STEPS.map((s) => (
              <div key={s.id} className="cp-step cp-skel-step">
                <span className="cp-skel cp-skel--icon" />
                <span className="cp-skel cp-skel--label" />
              </div>
            ))}
          </div>
        </div>
        <div className="cp-card cp-sheet-glass">
          <span className="cp-skel cp-skel--title" />
          <span className="cp-skel cp-skel--sub" />
          <div className="cp-skel-rows">
            {[0, 1, 2].map((i) => (
              <div key={i} className="cp-skel-row">
                <span className="cp-skel cp-skel--thumb" />
                <span className="cp-skel-row__t">
                  <span className="cp-skel cp-skel--line" />
                  <span className="cp-skel cp-skel--line cp-skel--short" />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="cp-map cp-skel cp-skel--map" aria-hidden="true" />
    </div>
  );
}
