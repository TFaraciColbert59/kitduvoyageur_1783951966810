'use client';

import React from 'react';
import Link from 'next/link';
import LkvIcon from '@/components/ui/LkvIcon';

export default function StripCTA() {
  return (
    <Link href="/ai-configurator" style={{
      display: 'flex', alignItems: 'center', gap: '16px',
      margin: '0 16px 16px', padding: '16px', borderRadius: '22px',
      background: '#06120C', color: '#fff', textDecoration: 'none',
    }}>
      <div style={{
        width: '42px', height: '42px', borderRadius: '12px',
        background: '#17402C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <LkvIcon name="bag" size={22} color="#A8C8A0" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 500 }}>Composer votre sac</div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Configurateur IA · 2 min</div>
      </div>
      <LkvIcon name="arrow-right" size={18} color="#A8C8A0" />
    </Link>
  );
}
