'use client';

import React from 'react';

export default function StatsRow() {
  return (
    <div style={{ padding: '20px 16px' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px',
        borderRadius: '18px', overflow: 'hidden', background: 'rgba(11,31,23,0.06)',
      }}>
        <div style={{ background: '#FBFAF6', padding: '16px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8B978F', fontWeight: 500, marginBottom: '4px' }}>Refuges</div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: '#0B1F17' }}>47+</div>
        </div>
        <div style={{ background: '#FBFAF6', padding: '16px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8B978F', fontWeight: 500, marginBottom: '4px' }}>Objets testés</div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: '#0B1F17' }}>340</div>
        </div>
        <div style={{ background: '#FBFAF6', padding: '16px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8B978F', fontWeight: 500, marginBottom: '4px' }}>Aventuriers</div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: '#0B1F17' }}>1.3k</div>
        </div>
      </div>
    </div>
  );
}
