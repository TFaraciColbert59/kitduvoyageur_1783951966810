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
    <div className="glass p-6 text-[#17402C] relative overflow-hidden">
      <div className="flex justify-between items-start mb-2">
        <h2 className="font-display font-bold text-xl text-[#17402C]">Progression <span className="font-serif italic font-normal text-[#17402C]">du voyage</span></h2>
        <span className="font-display font-bold text-2xl text-[#17402C] font-mono">{progression}%</span>
      </div>
      
      <p className="text-sm text-[#5C6B5E] mb-6 font-sans">
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
        <div className="absolute top-3 left-0 right-0 h-[1px] bg-[#17402C]/10 -z-10" />
        
        {steps.map((step) => (
          <div key={step.id} className="flex flex-col items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold z-10 transition-colors
              ${step.completed ? 'bg-[#17402C] text-white' : step.active ? 'bg-white text-[#17402C] ring-4 ring-[#17402C]/20 border border-[#17402C]' : 'glass-sub-card text-[#5C6B5E]'}`}
            >
              {step.completed ? <Icon name="CheckIcon" size={12} className="relative z-10" /> : step.id}
            </div>
            <span className={`text-[10px] font-mono uppercase tracking-widest text-center hidden sm:block font-bold ${step.active ? 'text-[#17402C]' : 'text-[#5C6B5E]/50'}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
