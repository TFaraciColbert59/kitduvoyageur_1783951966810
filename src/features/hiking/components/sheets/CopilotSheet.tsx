'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface CopilotSheetProps {
  isOpen: boolean;
  onClose: () => void;
  distanceKm?: number;
  remainingDistanceKm?: number;
  elevationGainM?: number;
  weatherCondition?: string;
}

export default function CopilotSheet({
  isOpen,
  onClose,
  distanceKm = 6.8,
  remainingDistanceKm = 7.4,
  elevationGainM = 420,
  weatherCondition = 'Ciel dégagé',
}: CopilotSheetProps) {
  const [messages, setMessages] = useState<Array<{ sender: 'me' | 'ai'; text: string }>>([
    {
      sender: 'me',
      text: 'Combien il me reste pour arriver au sommet ?',
    },
    {
      sender: 'ai',
      text: `Il reste ${remainingDistanceKm.toFixed(1)} km et +780 m jusqu'à Chamechaude. Avec votre rythme actuel : environ 3h. La météo est stable jusqu'à 18h.`,
    },
  ]);

  if (!isOpen) return null;

  const handleAskQuick = (question: string) => {
    let reply = `D'après vos métriques (${distanceKm.toFixed(1)} km parcourus, D+ +${elevationGainM} m), tout est sous contrôle. Météo : ${weatherCondition}.`;
    if (question.includes('pause')) {
      reply = 'Oui — le refuge du Habert est à 12 min et propose un point d\'eau potable.';
    } else if (question.includes('eau')) {
      reply = 'La prochaine source est à 450 m sur votre droite.';
    }
    setMessages((prev) => [
      ...prev,
      { sender: 'me', text: question },
      { sender: 'ai', text: reply },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center select-none">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-md bg-[#FBFAF6] text-[#0B1F17] rounded-t-[34px] pt-3 pb-10 px-4 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4"
      >
        {/* Grabber */}
        <div className="w-10 h-1 bg-[#0B1F17]/14 rounded-full mx-auto" />

        {/* Glowing Orb */}
        <div className="text-center">
          <div className="w-18 h-18 rounded-full mx-auto bg-gradient-to-br from-[#EAF1E5] via-[#A8C8A0] to-[#17402C] shadow-lg animate-pulse relative border-2 border-white/40" />
          <h2 className="text-xl font-medium tracking-tight mt-2">
            Copilote <em className="font-serif italic text-[#17402C]">Chartreuse</em>
          </h2>
          <p className="text-[11px] font-mono text-[#6B7A72] tracking-wider mt-0.5">
            APPRIS DE 247 VOYAGEURS · CONTEXTE JOUR 2
          </p>
        </div>

        {/* Conversation List */}
        <div className="space-y-3 px-1 pt-2">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`p-3 rounded-2xl text-xs leading-relaxed max-w-[85%] ${
                m.sender === 'me'
                  ? 'ml-auto bg-[#17402C] text-white rounded-br-xs'
                  : 'mr-auto bg-[#EAF1E5] text-[#0B1F17] border border-[#A8C8A0]/40 rounded-bl-xs'
              }`}
            >
              {m.text}
            </div>
          ))}
        </div>

        {/* Quick Questions Chips */}
        <div className="pt-2">
          <span className="text-[9px] font-mono uppercase tracking-widest text-[#6B7A72] block mb-2">
            Suggestions
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              'Bonne idée de faire une pause avant la crête ?',
              'Où est le prochain point d\'eau ?',
              'Est-ce que la météo va changer ?',
            ].map((q) => (
              <button
                key={q}
                onClick={() => handleAskQuick(q)}
                className="px-3 py-1.5 rounded-full text-[11px] font-medium bg-[#F4F1EA] text-[#0B1F17] hover:bg-[#E9E4D9] border border-[#0B1F17]/06 active:scale-95 transition-transform"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-[#17402C] text-white font-bold text-xs rounded-2xl shadow-lg mt-2"
        >
          Fermer le Copilote
        </button>
      </motion.div>
    </div>
  );
}
