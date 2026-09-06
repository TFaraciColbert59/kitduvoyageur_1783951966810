'use client';
import React from 'react';
import { motion } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';

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
    <div className="glass p-6 text-lkv-primary relative overflow-hidden">
      <div className="flex justify-between items-start mb-2">
        <h2 className="font-display font-bold text-xl text-lkv-primary">Progression <span className="font-serif italic font-normal text-lkv-primary">du voyage</span></h2>
        <span className="font-display font-bold text-2xl text-lkv-primary font-mono">{progression}%</span>
      </div>
      
      <p className="text-sm text-lkv-text-muted mb-6 font-sans">
        Étape en cours : équipement partagé — il reste 3 tâches à valider avant réservation des refuges.
      </p>
      
      <div className="glass-progress mb-8">
        <motion.div 
          className="glass-progress-fill"
          initial={{ width: 0 }}
          animate={{ width: `${progression}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
      
      <div className="flex justify-between relative">
        <div className="absolute top-3 left-0 right-0 h-[1px] bg-lkv-primary/10 -z-10" />
        
        {steps.map((step) => (
          <div key={step.id} className="flex flex-col items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold z-10 transition-colors
              ${step.completed ? 'bg-lkv-primary text-white' : step.active ? 'bg-white text-lkv-primary ring-4 ring-lkv-primary/20 border border-lkv-primary' : 'glass-sub-card text-lkv-text-muted'}`}
            >
              {step.completed ? <Icon name="CheckIcon" size={12} className="relative z-10" /> : step.id}
            </div>
            <span className={`text-[10px] font-mono uppercase tracking-widest text-center hidden sm:block font-bold ${step.active ? 'text-lkv-primary' : 'text-lkv-text-muted/50'}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
