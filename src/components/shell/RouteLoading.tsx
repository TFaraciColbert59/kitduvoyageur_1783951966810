import React from 'react';

/**
 * Chargement d'une route : le fond de l'app reste seul à l'écran, un spinner
 * centré n'apparaît qu'après 300 ms. Une navigation rapide ne montre donc rien
 * (aucun squelette d'une ancienne mise en page ne s'intercale entre deux pages).
 * Composant serveur, sans JavaScript.
 */
export default function RouteLoading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="lkdv-route-loading" role="status" aria-busy="true" aria-label={label}>
      <span className="lkdv-route-spinner" aria-hidden="true" />
    </div>
  );
}
