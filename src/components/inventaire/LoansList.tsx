// src/components/mon-materiel/LoansList.tsx

'use client';

import React from 'react';
import LoansCard from './LoansCard';
import { LoanItemData } from '@/lib/mock/mon-materiel-marceline';

interface LoansListProps {
  loans: LoanItemData[];
}

/**
 * LoansList – simple wrapper that renders a list of loan cards.
 * It mirrors the pattern used by other list components (e.g., KitsList).
 */
export default function LoansList({ loans }: LoansListProps) {
  if (!loans || loans.length === 0) {
    return (
      <div className="text-center text-sm text-[#132219]/60 py-4">
        Aucun prêt en cours
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <h3 className="font-display font-800 text-lg text-[#132219] mb-2">
        Prêts en cours
      </h3>
      {/* List of loan cards */}
      <LoansCard loans={loans} />
    </div>
  );
}

