'use client';

import React from 'react';
import Link from 'next/link';

export default function CopilotFAB() {
  return (
    <Link
      href="/ai-configurator"
      aria-label="Configurateur IA"
      style={{
        position: 'fixed',
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        left: '16px',
        bottom: 'calc(62px + 12px + 12px + env(safe-area-inset-bottom) + 80px)',
        width: '48px',
        height: '48px',
        background: '#3A6EA5',
        boxShadow: '0 4px 16px rgba(58, 110, 165, 0.5)',
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </Link>
  );
}
