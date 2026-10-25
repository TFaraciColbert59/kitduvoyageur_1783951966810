import React from 'react';

/** Squelette de l'écran fixe : barre 48, carte 406, barre basse. */
export default function CarnetLoading() {
  return (
    <div className="ckp-screen lkdv-account-glass">
      <div className="ckp-screen-header">
        <div className="ckp-topbar">
          <div className="ckp-skeleton ckp-skeleton--pill" />
          <div style={{ display: 'flex', gap: 6 }}>
            <div className="ckp-skeleton ckp-skeleton--round" />
            <div className="ckp-skeleton ckp-skeleton--round" />
            <div className="ckp-skeleton ckp-skeleton--round" />
          </div>
        </div>
      </div>
      <div className="ckp-screen-body" aria-busy="true" aria-label="Chargement du carnet">
        <div className="ckp-card" style={{ padding: 12, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="ckp-skeleton ckp-skeleton--cover" />
            <div style={{ flex: 1 }}>
              <div className="ckp-skeleton ckp-skeleton--line" style={{ width: '70%' }} />
              <div className="ckp-skeleton ckp-skeleton--line" style={{ width: '45%', marginTop: 8 }} />
            </div>
          </div>
          <div className="ckp-skeleton ckp-skeleton--line" style={{ width: '90%' }} />
          <div className="ckp-skeleton ckp-skeleton--grid" />
        </div>
      </div>
    </div>
  );
}
