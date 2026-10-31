'use client';

import React from 'react';
import LKDVMap from '@/features/carto/LKDVMap';
import '@/features/carto/carto.css';

/**
 * Aperçu interne du composant cartographique partagé (chantier CARTO).
 * Route non indexée, utilisée pour les captures de recette.
 */
export default function CartoPreview() {
  const [base, setBase] = React.useState<'maptoolkit' | 'hybrid'>('maptoolkit');
  const [terrain3d, setTerrain3d] = React.useState(true);
  const [ready, setReady] = React.useState(false);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <LKDVMap
        center={[6.8694, 45.9237]}
        zoom={12.6}
        pitch={terrain3d ? 58 : 0}
        bearing={-16}
        base={base}
        terrain3d={terrain3d}
        onReady={() => setReady(true)}
      />
      <div
        style={{
          position: 'absolute',
          left: 12,
          top: 12,
          zIndex: 30,
          display: 'flex',
          gap: 8,
          padding: 8,
          borderRadius: 12,
          background: 'rgb(255 255 255 / 88%)',
          font: '12px system-ui',
        }}
      >
        <button type="button" onClick={() => setBase(base === 'maptoolkit' ? 'hybrid' : 'maptoolkit')}>
          {base === 'maptoolkit' ? 'Hybride satellite' : 'Maptoolkit'}
        </button>
        <button type="button" onClick={() => setTerrain3d(!terrain3d)}>
          {terrain3d ? '2D' : '3D'}
        </button>
        <span data-testid="ready">{ready ? 'prêt' : 'chargement'}</span>
      </div>
    </div>
  );
}
