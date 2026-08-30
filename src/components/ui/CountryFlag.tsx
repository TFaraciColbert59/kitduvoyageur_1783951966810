'use client';

import React, { useState } from 'react';

interface CountryFlagProps {
  code: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'w-4 h-3 rounded-[2px]',
  sm: 'w-5 h-3.5 rounded-[3px]',
  md: 'w-7 h-5 rounded-[4px]',
  lg: 'w-9 h-6 rounded-[5px]',
  xl: 'w-12 h-8 rounded-[6px]',
};

export default function CountryFlag({
  code,
  name,
  size = 'md',
  className = '',
}: CountryFlagProps) {
  const [hasError, setHasError] = useState(false);
  const isoCode = (code || '').toLowerCase();

  if (!isoCode || hasError) {
    return (
      <span
        className={`inline-flex items-center justify-center bg-white/80 border border-white/60 font-mono font-bold text-[10px] text-[#17402C] shadow-2xs ${sizeClasses[size]} ${className}`}
        title={name || code}
      >
        {code ? code.toUpperCase() : '🌐'}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden shrink-0 shadow-2xs border border-black/10 bg-white/40 ${sizeClasses[size]} ${className}`}
      title={name || code}
    >
      <img
        src={`https://flagcdn.com/w80/${isoCode}.png`}
        alt={name || code}
        loading="lazy"
        onError={() => setHasError(true)}
        className="w-full h-full object-cover"
      />
    </span>
  );
}
