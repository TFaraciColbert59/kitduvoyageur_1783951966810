import React from 'react';

/**
 * Squelettes du hub (proposition n° 12) : silhouettes à la forme des cartes
 * (couverture 4/5 + ligne d'auteur), posées comme repli de streaming de la
 * route serveur — pas de spinner centré au milieu d'une grille vide.
 * Purement décoratif : le seul contenu lisible est le statut « Chargement… ».
 */
export function CarnetsHubSkeleton() {
  return (
    <div className="lkdv-feed-shell lkdv-account-glass">
      <div className="lkdv-feed-column">
        <div className="lkdv-feed-header">
          <div className="lkdh-header">
            <span className="lkdh-eyebrow">Carnets de bord</span>
          </div>
        </div>
        <div className="lkdv-feed-main">
          <div className="lkdh-body">
            <p className="sr-only" role="status">
              Chargement des carnets…
            </p>
            <div className="lkdh-skeletons" aria-hidden="true">
              {[0, 1, 2].map((index) => (
                <div key={index} className="lkdh-skeleton-card">
                  <div className="lkdh-skeleton-cover" />
                  <div className="lkdh-skeleton-line" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CarnetsHubSkeleton;
