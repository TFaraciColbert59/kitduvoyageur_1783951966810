import React from 'react';

/** Squelette de la fiche : même colonne, mêmes cartes, même top bar. */
export default function CarnetLoading() {
  return (
    <div className="ckp-shell lkdv-account-glass">
      <div className="ckp-column">
        <div className="ckp-header"><div className="ckp-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="ckp-skeleton ckp-skeleton--round" />
            <div className="ckp-skeleton ckp-skeleton--pill" />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div className="ckp-skeleton ckp-skeleton--round" />
            <div className="ckp-skeleton ckp-skeleton--round" />
            <div className="ckp-skeleton ckp-skeleton--round" />
          </div>
        </div></div>

        <div className="ckp-main" aria-busy="true" aria-label="Chargement du carnet">
          <div className="ckp-card">
            <div className="ckp-head">
              <div className="ckp-skeleton ckp-skeleton--cover" />
              <div style={{ flex: 1 }}>
                <div className="ckp-skeleton ckp-skeleton--line" style={{ width: '72%' }} />
                <div className="ckp-skeleton ckp-skeleton--line" style={{ width: '48%', marginTop: 8 }} />
                <div className="ckp-skeleton ckp-skeleton--line" style={{ width: '60%', marginTop: 18 }} />
              </div>
            </div>
            <div className="ckp-skeleton ckp-skeleton--line" style={{ width: '40%', marginTop: 14 }} />
            <div className="ckp-skeleton ckp-skeleton--line" style={{ width: '92%', marginTop: 12 }} />
            <div className="ckp-skeleton ckp-skeleton--line" style={{ width: '80%', marginTop: 6 }} />
            <div className="ckp-skeleton ckp-skeleton--tabs" />
          </div>
          <div className="ckp-skeleton ckp-skeleton--grid" />
          <div className="ckp-skeleton ckp-skeleton--section" />
        </div>
      </div>
    </div>
  );
}
