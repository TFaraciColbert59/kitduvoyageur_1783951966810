'use client';

import { Suspense } from 'react';
import RandonneeActiveContent from './RandonneeActiveContent';

export default function RandonneeActivePage() {
  return (
    <Suspense fallback={
      <div style={{ width: '100%', height: '100dvh', background: '#0d1a12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#8BAF7C', fontFamily: 'monospace', fontSize: 12 }}>Chargement...</span>
      </div>
    }>
      <RandonneeActiveContent />
    </Suspense>
  );
}
