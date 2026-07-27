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
    <div className="bg-[#33463C] rounded-[2rem] p-6 text-[#E7E3D6] shadow-sm relative overflow-hidden">
      <div className="flex justify-between items-start mb-2">
        <h2 className="font-display text-xl text-white">Progression <span className="font-serif italic text-[#E7E3D6] font-bold">du voyage</span></h2>
        <span className="font-display font-bold text-2xl text-white">{progression}%</span>
      </div>
      
      <p className="text-sm text-white/70 mb-6 font-sans">
        Étape en cours : équipement partagé — il reste 3 tâches à valider avant réservation des refuges.
      </p>
      
      <div className="relative h-2 bg-black/20 rounded-full mb-8 overflow-hidden">
        <motion.div 
          className="absolute top-0 left-0 h-full bg-[#E4501C] rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progression}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
      
      <div className="flex justify-between relative">
        {/* Ligne de connexion */}
        <div className="absolute top-3 left-0 right-0 h-[1px] bg-white/10 -z-10" />
        
        {steps.map((step) => (
          <div key={step.id} className="flex flex-col items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold z-10 transition-colors
              ${step.completed ? 'bg-[#E4501C] text-white' : step.active ? 'bg-white text-[#1C2620] ring-4 ring-white/20' : 'bg-[#1C2620] text-white/50 border border-white/20'}`}
            >
              {step.completed ? <Icon name="CheckIcon" size={12} /> : step.id}
            </div>
            <span className={`text-[10px] font-mono uppercase tracking-widest text-center hidden sm:block ${step.active ? 'text-white' : 'text-white/40'}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
