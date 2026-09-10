'use client';

import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import { GlassCard, GlassCapsuleBtn } from '@/components/ui';
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

  return (
    <div className="space-y-6">
      {/* 1. Bannière d'accomplissement & Export */}
      <GlassCard tone="sage" className="p-5 sm:p-6 rounded-3xl border border-white/70">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-lkv-primary text-white flex items-center justify-center shrink-0 shadow-md">
              <Icon name="sparkles" size={24} />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-lkv-secondary">
                Phase Raconter · Retour d’Expédition
              </span>
              <h2 className="text-xl font-extrabold text-lkv-primary mt-0.5">
                Récits, Bilan & Partage de l’Aventure
              </h2>
              <p className="text-xs sm:text-sm text-lkv-secondary mt-1">
                Consignez vos anecdotes, clôturez les comptes et inspirez la communauté.
              </p>
            </div>
          </div>

          <GlassCapsuleBtn
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            variant="primary"
            size="sm"
            icon={<Icon name="share2" size={15} />}
          >
            Partager / Exporter GPX
          </GlassCapsuleBtn>
        </div>
      </GlassCard>

      {/* 2. Sous-onglets de la phase Raconter */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveSection('notes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all border min-h-[44px] ${
            activeSection === 'notes'
              ? 'bg-[var(--lkv-primary)] text-white border-[var(--lkv-primary)] shadow-sm'
              : 'glass-sub-card border border-white/60 text-[var(--lkv-text-primary)] hover:bg-white'
          }`}
        >
          <Icon name="book-open" size={15} />
          <span>Carnet de bord & Notes</span>
          {trip.notes && trip.notes.length > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeSection === 'notes'
                  ? 'bg-white/20 text-white'
                  : 'text-[var(--lkv-text-muted)]'
              }`}
            >
              {trip.notes.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('budget')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all border min-h-[44px] ${
            activeSection === 'budget'
              ? 'bg-[var(--lkv-primary)] text-white border-[var(--lkv-primary)] shadow-sm'
              : 'glass-sub-card border border-white/60 text-[var(--lkv-text-primary)] hover:bg-white'
          }`}
        >
          <Icon name="credit-card" size={15} />
          <span>Bilan Dépenses & Soldes</span>
        </button>
      </div>

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
