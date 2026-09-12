'use client';

import { FileText } from 'lucide-react';
import { DepartParticipants } from '@/features/materiel/components/depart/DepartParticipants';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';

export interface DepartEquipeSectionProps {
  depart: DepartDetail;
  onOpenSheet: () => void;
}

export function DepartEquipeSection({ depart, onOpenSheet }: DepartEquipeSectionProps) {
  const { triggerHaptic } = useHapticFeedback();

  const handleOpenSheet = () => {
    triggerHaptic('light');
    onOpenSheet();
  };

  return (
    <section className="glass rounded-[1.75rem] p-4" aria-label="Équipe">
      <header>
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
          Équipe
        </p>
      </header>

      <div className="mt-3">
        <DepartParticipants
          participants={depart.participants}
          emergencyContact={depart.emergencyContact}
        />
      </div>

      <button
        type="button"
        onClick={handleOpenSheet}
        aria-haspopup="dialog"
        className="glass-capsule-btn primary mt-3 min-h-[44px] w-full !py-3 text-sm font-bold active:scale-[0.97]"
      >
        <FileText size={15} aria-hidden="true" />
        Fiche officielle
      </button>
    </section>
  );
}
