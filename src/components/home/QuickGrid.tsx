'use client';

import React from 'react';
import Link from 'next/link';
import LkvIcon from '@/components/ui/LkvIcon';

export default function QuickGrid() {
  return (
    <div style={{ padding: '20px 16px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h2 style={{ fontSize: '20px', letterSpacing: '-0.015em', margin: 0, color: '#17402C' }}>
          Par où <em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#17402C' }}>commencer.</em>
        </h2>
        <Link href="/explorer" style={{ fontSize: '12px', color: '#17402C', fontWeight: 500, textDecoration: 'none' }}>
          Tout voir &rarr;
        </Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {/* Card 1: green gradient - "Configurer mon kit" */}
        <Link href="/ai-configurator" style={{ textDecoration: 'none' }}>
          <div style={{ aspectRatio: '1/1', borderRadius: '20px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(160deg, #365233 0%, #17402C 60%, #17402C 100%)', color: '#fff' }}>
            <LkvIcon name="bag" size={22} color="#A8C8A0" />
            <div>
              <div style={{ fontSize: '15px', fontWeight: 500, lineHeight: 1.2 }}>Configurer<br/>mon kit</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>Guide IA</div>
            </div>
          </div>
        </Link>
        {/* Card 2: stone - "Carte des refuges" */}
        <Link href="/carte-interactive" style={{ textDecoration: 'none' }}>
          <div style={{ aspectRatio: '1/1', borderRadius: '20px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#F4F1EA', color: '#17402C' }}>
            <LkvIcon name="map-pin" size={22} color="#17402C" />
            <div>
              <div style={{ fontSize: '15px', fontWeight: 500, lineHeight: 1.2 }}>Carte des<br/>refuges</div>
              <div style={{ fontSize: '10px', color: '#6B7A72', marginTop: '4px' }}>47 partenaires</div>
            </div>
          </div>
        </Link>
        {/* Card 3: sage - "Tests terrain" */}
        <Link href="/guides" style={{ textDecoration: 'none' }}>
          <div style={{ aspectRatio: '1/1', borderRadius: '20px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#EAF1E5', color: '#17402C' }}>
            <LkvIcon name="doc" size={22} color="#17402C" />
            <div>
              <div style={{ fontSize: '15px', fontWeight: 500, lineHeight: 1.2 }}>Tests<br/>terrain</div>
              <div style={{ fontSize: '10px', color: '#6B7A72', marginTop: '4px' }}>6 sem. min.</div>
            </div>
          </div>
        </Link>
        {/* Card 4: forest-900 dark - "Boutique" */}
        <Link href="/boutique" style={{ textDecoration: 'none' }}>
          <div style={{ aspectRatio: '1/1', borderRadius: '20px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#17402C', color: '#fff' }}>
            <LkvIcon name="star" size={22} color="#C6DCBE" />
            <div>
              <div style={{ fontSize: '15px', fontWeight: 500, lineHeight: 1.2 }}>Boutique<br/>essentielle</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>Sélection LKDV</div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
