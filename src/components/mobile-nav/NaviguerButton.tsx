'use client';

import React from 'react';
import Link from 'next/link';

interface NaviguerButtonProps {
  isActive: boolean;
}

export default function NaviguerButton({ isActive }: NaviguerButtonProps) {
  return (
    <Link
      href="/naviguer"
      aria-label="Naviguer — carte et mode rando"
      aria-current={isActive ? 'page' : undefined}
      className="flex flex-col items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17402C] focus-visible:ring-offset-2 rounded-full"
    >
      {/* Elevated circle */}
      <div
        className="flex items-center justify-center rounded-full transition-all duration-150"
        style={{
          width: '52px',
          height: '52px',
          background: isActive
            ? 'linear-gradient(135deg, #17402C 0%, #cc3d10 100%)'
            : 'linear-gradient(135deg, #17402C 0%, #d44518 100%)',
          boxShadow: isActive
            ? '0 4px 16px rgba(228, 80, 28, 0.55), 0 2px 4px rgba(0,0,0,0.15)'
            : '0 4px 12px rgba(228, 80, 28, 0.4), 0 2px 4px rgba(0,0,0,0.12)',
          transform: isActive ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
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
