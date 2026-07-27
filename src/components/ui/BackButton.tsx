'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface BackButtonProps {
  href?: string;       // destination fixe (optionnel, sinon go back)
  label?: string;      // texte du bouton (défaut : "Retour")
  className?: string;
  variant?: 'light' | 'dark' | 'ghost'; // light = fond blanc, dark = fond sombre, ghost = transparent
}

export default function BackButton({
  href,
  label = 'Retour',
  className = '',
  variant = 'light',
}: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (href) {
      router.push(href);
    } else {
      // Go back in history, fallback to home
      if (window.history.length > 1) {
        router.back();
      } else {
        router.push('/');
      }
    }
  };

  const variantClasses = {
    light: 'bg-white border border-[#E4E0D4] text-[#1C2620] hover:bg-[#F5F2EA] shadow-sm',
    dark: 'bg-[#1C2620]/80 border border-white/10 text-white hover:bg-[#1C2620] backdrop-blur-sm',
    ghost: 'bg-transparent border border-[#E4E0D4]/60 text-[#5A6A5D] hover:bg-[#F5F2EA] hover:text-[#1C2620]',
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 active:scale-95 ${variantClasses[variant]} ${className}`}
      aria-label={label}
    >
      <svg
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
      <span>{label}</span>
    </button>
  );
}
