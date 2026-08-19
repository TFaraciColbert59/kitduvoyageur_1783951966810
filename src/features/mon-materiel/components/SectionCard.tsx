'use client';

/**
 * LKDV — Mon Matériel : section « carte » réutilisable dans les vues plein écran
 * (titre + contenu sur surface claire translucide).
 */

import React from 'react';

export function SectionCard({
  title,
  action,
  children,
  className = '',
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl bg-white/60 border border-[#1C2620]/7 p-4 space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}