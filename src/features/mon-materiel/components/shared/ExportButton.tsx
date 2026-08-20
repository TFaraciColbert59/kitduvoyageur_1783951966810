'use client';

/**
 * LKDV — Mon Matériel : bouton d'export CSV réutilisable.
 * Génère un blob CSV côté client via ExportService (données réelles, jamais de mock).
 */

import React from 'react';
import { ExportService } from '../../services/ExportService';

export interface ExportButtonProps {
  onExport: () => { ok: boolean; fileName?: string; error?: string };
  label?: string;
  onResult?: (result: { ok: boolean; fileName?: string; error?: string }) => void;
  className?: string;
}

export function ExportButton({ onExport, label = 'Exporter CSV', onResult, className = '' }: ExportButtonProps) {
  const handle = () => {
    const result = onExport();
    onResult?.(result);
    if (!result.ok && result.error) {
      console.warn('[ExportButton]', result.error);
    }
  };

  return (
    <button
      type="button"
      onClick={handle}
      className={`px-3 py-1.5 rounded-full bg-white/60 hover:bg-[#2D5A3D]/8 border border-[#1C2620]/10 text-[#2D5A3D] text-xs font-bold min-h-[44px] inline-flex items-center gap-1.5 ${className}`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 3v12m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
      </svg>
      {label}
    </button>
  );
}

export const exportServiceSingleton = new ExportService();