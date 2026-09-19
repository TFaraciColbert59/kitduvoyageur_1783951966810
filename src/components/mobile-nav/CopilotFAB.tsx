'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

export default function CopilotFAB() {
  return (
    <Link
      href="/ai-configurator"
      aria-label="Configurateur IA"
      className="glass-circle-btn"
      style={{
        position: 'fixed',
        zIndex: 90,
        borderRadius: '50%',
        left: '16px',
        bottom: 'calc(62px + 12px + 12px + env(safe-area-inset-bottom) + 80px)',
        width: '48px',
        height: '48px',
      }}
    >
      <Icon name="message-square" size={22} />
    </Link>
  );
}
