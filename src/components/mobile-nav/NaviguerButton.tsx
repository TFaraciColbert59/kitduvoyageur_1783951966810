'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

interface NaviguerButtonProps {
  isActive: boolean;
}

export default function NaviguerButton({ isActive }: NaviguerButtonProps) {
  return (
    <Link
      href="/randonnee-active"
      aria-label="Rando active — carte et mode rando"
      aria-current={isActive ? 'page' : undefined}
      className="flex flex-col items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17402C] focus-visible:ring-offset-2 rounded-full"
    >
      {/* Elevated circle */}
      <div
        className="glass-circle-btn primary flex items-center justify-center rounded-full transition-all duration-150"
        style={{
          width: '52px',
          height: '52px',
          transform: isActive ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        <Icon name="send" size={24} />
      </div>
      <span
        className="text-[10px] font-medium leading-none"
        style={{ color: isActive ? '#17402C' : '#7A8A7D' }}
      >
        Naviguer
      </span>
    </Link>
  );
}
