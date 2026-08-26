'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface AProposCardProps {
  data: any;
}

export default function AProposCard({ data }: AProposCardProps) {
  const [showSafety, setShowSafety] = useState(false);

  return (
    <div className="glass p-3.5 text-[#17402C] space-y-2.5 transition-all duration-300">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-xs text-[#17402C]">
          Infos &amp; Sécurité
        </h2>
        <span className="glass-pill text-[9px] py-0.2 px-1.5 font-mono font-bold">
          {data.meta.privacy}
        </span>
      </div>
      
      {/* Paramètres principaux */}
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <div className="glass-sub-card p-2 rounded-lg">
          <span className="font-mono uppercase text-[#5C6B5E] block text-[8.5px] font-bold">Massif</span>
          <span className="font-bold text-[#17402C] truncate block">{data.meta.massif}</span>
        </div>
        
        <div className="glass-sub-card p-2 rounded-lg">
          <span className="font-mono uppercase text-[#5C6B5E] block text-[8.5px] font-bold">Difficulté</span>
          <span className="font-bold text-[#17402C] truncate block">{data.meta.difficulty}</span>
        </div>
        
        <div className="glass-sub-card p-2 rounded-lg">
          <span className="font-mono uppercase text-[#5C6B5E] block text-[8.5px] font-bold">Budget</span>
          <span className="font-bold text-[#17402C] truncate block">{data.meta.budgetEstimate}</span>
        </div>

        <div className="glass-sub-card p-2 rounded-lg">
          <span className="font-mono uppercase text-[#5C6B5E] block text-[8.5px] font-bold">Visibilité</span>
          <span className="font-bold text-[#17402C] truncate block">{data.meta.privacy}</span>
        </div>
      </div>

      {/* Rappel de sécurité repliable */}
      <div className="pt-1.5 border-t border-[#17402C]/10">
        <button
          onClick={() => setShowSafety(!showSafety)}
          className="w-full glass-sub-card p-2 rounded-lg flex items-center justify-between text-[11px] font-semibold text-[#17402C] cursor-pointer hover:bg-white/40 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-xs">🛡️</span>
            <span>Charte de sécurité</span>
          </div>
          <span className="text-[10px] text-[#5C6B5E]">{showSafety ? '▲' : '▼'}</span>
        </button>

        {showSafety && (
          <div className="space-y-1.5 mt-1.5 text-[10px] text-[#5C6B5E] leading-relaxed">
            <div className="glass-sub-card p-2 rounded-lg">
              <strong className="text-[#17402C]">📍 Itinéraire :</strong> Transmettez vos étapes à un proche de confiance.
            </div>

            <div className="glass-sub-card p-2 rounded-lg">
              <strong className="text-[#17402C]">☕ Contact :</strong> Échangez par visio ou lieu public avant le départ.
            </div>

            <div className="glass-sub-card p-2 rounded-lg">
              <strong className="text-[#17402C]">💶 Frais :</strong> Utilisez le module Dépenses pour l'équilibrage.
            </div>

            <div className="pt-1 flex items-center justify-between text-[9px]">
              <a href="/contact" className="font-semibold text-[#5C6B5E] hover:underline">Page contact</a>
              <a href="mailto:contact@lekitduvoyageur.fr" className="font-bold text-[#17402C] hover:underline">Assistance →</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
