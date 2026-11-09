import React from 'react';

/**
 * Squelette de la fiche carnet v2 : même coque que l'écran (carte 406, barre
 * haute à trois boutons, feuille de carte), et non l'ancienne coque `ckp`.
 */
export default function CarnetLoading() {
  return (
    <div className="lkdv-carnet-v2-root lkdv-compte-v8">
      <div className="lkdv-carnet-bg" aria-hidden="true" />
      <section className="lkdv-carnet-top" aria-label="Chargement du carnet" aria-busy="true">
        <div className="lkdv-carnet-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <div className="ckp-skeleton ckp-skeleton--round" />
            <div className="ckp-skeleton ckp-skeleton--pill" style={{ width: 190 }} />
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            <div className="ckp-skeleton ckp-skeleton--round" />
            <div className="ckp-skeleton ckp-skeleton--round" />
            <div className="ckp-skeleton ckp-skeleton--round" />
          </div>
        </div>
        <div
          className="lkdv-carnet-card"
          style={{ marginTop: 5, padding: 12, display: 'grid', gap: 10 }}
        >
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="ckp-skeleton ckp-skeleton--cover" />
            <div style={{ flex: 1 }}>
              <div className="ckp-skeleton ckp-skeleton--line" style={{ width: '70%' }} />
              <div
                className="ckp-skeleton ckp-skeleton--line"
                style={{ width: '45%', marginTop: 8 }}
              />
            </div>
          </div>
          <div className="ckp-skeleton ckp-skeleton--line" style={{ width: '90%' }} />
          <div className="ckp-skeleton ckp-skeleton--grid" />
        </div>
      </section>
      <section className="lkdv-carnet-mapzone" aria-hidden="true">
        <div className="lkdv-map-loading" />
      </section>
    </div>
  );
}
