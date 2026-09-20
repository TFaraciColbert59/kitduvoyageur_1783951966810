'use client';

import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import { Button, Card, Tabs, type TabOption } from '@/components/ui';
import type { TripFull } from '../types/trip.types';
import { TripNotesView } from './TripNotesView';
import { TripBudgetView } from './TripBudgetView';
import { TripShareModal } from './TripShareModal';

export interface TripPhaseRecountViewProps {
  trip: TripFull;
}

export type RecountSectionId = 'notes' | 'budget';

export function TripPhaseRecountView({ trip }: TripPhaseRecountViewProps) {
  const [activeSection, setActiveSection] = useState<RecountSectionId>('notes');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const sectionOptions: readonly TabOption[] = [
    {
      id: 'notes',
      label: 'Carnet de bord & Notes',
      icon: <Icon name="book-open" size={15} />,
      count: trip.notes?.length ?? 0,
    },
    {
      id: 'budget',
      label: 'Bilan Dépenses & Soldes',
      icon: <Icon name="credit-card" size={15} />,
    },
  ];

  return (
    <div className="space-y-[var(--space-6)]">
      {/* 1. Bannière d'accomplissement & Export */}
      <Card tone="sage">
        <div className="flex flex-col justify-between gap-[var(--space-4)] sm:flex-row sm:items-center">
          <div className="flex items-start gap-[var(--space-4)] sm:items-center">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-action)] text-[color:var(--lkv-on-action)] shadow-elevation-1">
              <Icon name="sparkles" size={24} />
            </div>
            <div>
              <span className="text-[length:var(--lkv-text-footnote)] font-bold uppercase tracking-wider text-[color:var(--lkv-secondary)]">
                Phase Raconter · Retour d’Expédition
              </span>
              <h2 className="mt-0.5 text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--lkv-text-primary)]">
                Récits, Bilan & Partage de l’Aventure
              </h2>
              <p className="mt-1 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)] sm:text-[length:var(--lkv-text-body-sm)]">
                Consignez vos anecdotes, clôturez les comptes et inspirez la communauté.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            size="sm"
            icon={<Icon name="share2" size={15} />}
          >
            Partager / Exporter GPX
          </Button>
        </div>
      </Card>

      {/* 2. Sous-onglets de la phase Raconter */}
      <Tabs
        options={sectionOptions}
        value={activeSection}
        ariaLabel="Sections de la phase Raconter"
        onChange={(id) => setActiveSection(id as RecountSectionId)}
        className="max-w-xl"
      />

      {/* 3. Contenu de la sous-section */}
      <div>
        {activeSection === 'notes' && <TripNotesView trip={trip} />}
        {activeSection === 'budget' && <TripBudgetView trip={trip} />}
      </div>

      <TripShareModal
        trip={trip}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />
    </div>
  );
}
