'use client';

import { FileText } from 'lucide-react';
import { Button, Card } from '@/components/ui';
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
    <Card as="section" aria-label="Équipe" className="p-4">
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

      <Button
        onClick={handleOpenSheet}
        aria-haspopup="dialog"
        icon={<FileText size={15} aria-hidden="true" />}
        fullWidth
        className="mt-3 min-h-[44px] py-3 text-sm font-bold"
      >
        Fiche officielle
      </Button>
    </Card>
  );
}
