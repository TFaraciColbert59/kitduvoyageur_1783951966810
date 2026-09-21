'use client';
import React from 'react';
import { motion } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import { Card } from '@/components/ui';

interface ProgressionCardProps {
  progression: number;
}

export default function ProgressionCard({ progression }: ProgressionCardProps) {
  const steps = [
    { id: 1, label: 'Idée', active: true, completed: true },
    { id: 2, label: 'Dates fixées', active: true, completed: true },
    { id: 3, label: 'Itinéraire', active: true, completed: true },
    { id: 4, label: 'Équipement', active: true, completed: false },
    { id: 5, label: 'Réservations', active: false, completed: false },
    { id: 6, label: 'Prêt à partir', active: false, completed: false }
  ];

  return (
    <Card className="relative overflow-hidden p-[var(--space-6)] text-[color:var(--lkv-text-primary)]">
      <div className="mb-[var(--space-2)] flex items-start justify-between">
        <h2 className="font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
          Progression <span className="font-serif font-normal italic text-[color:var(--lkv-text-primary)]">du voyage</span>
        </h2>
        <span className="font-mono text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">{progression}%</span>
      </div>

      <p className="mb-[var(--space-6)] font-sans text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
        Étape en cours : équipement partagé — il reste 3 tâches à valider avant réservation des refuges.
      </p>

      <div
        role="progressbar"
        aria-valuenow={Math.round(progression)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progression du voyage"
        className="mb-[var(--space-8)] h-2 w-full overflow-hidden rounded-full border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-muted)]"
      >
        <motion.div
          className="h-full rounded-full bg-[color:var(--lkv-primary)]"
          initial={{ width: 0 }}
          animate={{ width: `${progression}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>

      <div className="relative flex justify-between">
        <div aria-hidden className="absolute left-0 right-0 top-3 -z-10 h-px bg-[color:var(--lkv-primary)]/10" />

        {steps.map((step) => (
          <div key={step.id} className="flex flex-col items-center gap-[var(--space-2)]">
            <div
              className={`z-10 flex h-6 w-6 items-center justify-center rounded-full text-[length:var(--lkv-text-caption-2)] font-bold transition-colors ${
                step.completed
                  ? 'bg-[color:var(--lkv-primary)] text-[color:var(--lkv-text-inverted)]'
                  : step.active
                    ? 'border border-[color:var(--lkv-primary)] bg-[color:var(--lkv-surface-card)] text-[color:var(--lkv-text-primary)] ring-4 ring-[color:var(--lkv-primary)]/20'
                    : 'bg-[color:var(--lkv-surface-muted)] text-[color:var(--lkv-text-muted)]'
              }`}
            >
              {step.completed ? <Icon name="CheckIcon" size={12} aria-hidden="true" /> : step.id}
            </div>
            <span className={`hidden text-center font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest sm:block ${step.active ? 'text-[color:var(--lkv-text-primary)]' : 'text-[color:var(--lkv-text-muted)]/50'}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
