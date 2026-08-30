'use client';

import React, { useState, useEffect } from 'react';
import { HumanParticipant } from '../types/participant.types';

interface GlassBreakModalProps {
  participant: HumanParticipant;
  isOpen: boolean;
  onClose: () => void;
  onUnlock: (id: string) => void;
  onLock: (id: string) => void;
}

export const GlassBreakModal: React.FC<GlassBreakModalProps> = ({
  participant,
  isOpen,
  onClose,
  onUnlock,
  onLock,
}) => {
  const [timeLeft, setTimeLeft] = useState(60);

  const { isUnlocked, publicData, privateData } = participant;

  // Auto-lock timer when unlocked
  useEffect(() => {
    if (!isOpen) return;

    if (isUnlocked) {
      setTimeLeft(60);
      const interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            onLock(participant.id);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isOpen, isUnlocked, participant.id, onLock]);

  if (!isOpen) return null;

  const handleClose = () => {
    // Re-lock immediately on modal close for security
    onLock(participant.id);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 bg-[#17402C] text-[#E7E3D6] border border-white/20 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
        style={{
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 16px))',
        }}
      >
        {/* Header with Public Identity */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 text-white font-bold flex items-center justify-center text-lg border border-white/20">
              {publicData.firstName[0]}
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#A6C1A0]">
                FICHE PARTICIPANT
              </span>
              <h3 id="modal-title" className="text-xl font-bold text-white leading-tight">
                {publicData.firstName}
              </h3>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 text-sm"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Public Summary */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 rounded-xl bg-black/20 border border-white/10">
            <span className="text-[#9AAD9E] block text-[10px] uppercase font-mono">Poids du Sac</span>
            <span className="text-base font-extrabold font-mono text-white">
              {publicData.packWeightKg} kg
            </span>
          </div>
          <div className="p-3 rounded-xl bg-black/20 border border-white/10">
            <span className="text-[#9AAD9E] block text-[10px] uppercase font-mono">Score Forme</span>
            <span className="text-base font-extrabold font-mono text-white">
              {publicData.fitnessScore} / 100
            </span>
          </div>
        </div>

        {/* Sensitive Zone — Strict DOM Privacy Protection */}
        <div className="pt-2">
          {!isUnlocked ? (
            /* LOCKED STATE — Zero private fields in DOM */
            <div className="p-5 rounded-2xl bg-black/40 border border-red-500/30 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-xl mx-auto">
                🔒
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  Données Médicales & ICE Verrouillées
                </h4>
                <p className="text-xs text-[#9AAD9E] mt-1 max-w-xs mx-auto leading-relaxed">
                  Conformément au protocole de sécurité LKDV, les données médicales ne sont pas envoyées au DOM public sans action explicite.
                </p>
              </div>

              <button
                onClick={() => onUnlock(participant.id)}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <span>⚡ Déverrouiller l'accès d'urgence (Glass Break)</span>
              </button>
            </div>
          ) : (
            /* UNLOCKED STATE — Revealed only upon explicit unlock */
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs">
                <span className="font-semibold">⚠️ Mode Glass Break Actif</span>
                <span className="font-mono font-bold">Verrouillage auto : {timeLeft}s</span>
              </div>

              {/* Medical Information Cards */}
              <div className="space-y-2.5">
                <div className="p-3.5 rounded-xl bg-black/30 border border-white/15">
                  <span className="text-[10px] font-mono uppercase text-[#A6C1A0] block">
                    Groupe Sanguin
                  </span>
                  <span className="text-lg font-mono font-extrabold text-white">
                    {privateData.bloodType}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-black/30 border border-white/15">
                  <span className="text-[10px] font-mono uppercase text-[#A6C1A0] block">
                    Allergies & Intolérances
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {privateData.allergies.length > 0 ? (
                      privateData.allergies.map((allergy) => (
                        <span
                          key={allergy}
                          className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 text-xs font-semibold border border-red-500/30"
                        >
                          {allergy}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-white/70">Aucune allergie connue</span>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-black/30 border border-white/15">
                  <span className="text-[10px] font-mono uppercase text-[#A6C1A0] block">
                    Contact d'Urgence (ICE)
                  </span>
                  <div className="mt-1 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-white block">
                        {privateData.iceContact.name} ({privateData.iceContact.relationship})
                      </span>
                      <span className="text-xs font-mono text-[#A6C1A0]">
                        {privateData.iceContact.phone}
                      </span>
                    </div>

                    <a
                      href={`tel:${privateData.iceContact.phone.replace(/\s+/g, '')}`}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
                    >
                      📞 Appeler
                    </a>
                  </div>
                </div>

                {privateData.medications && privateData.medications.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-black/30 border border-white/15">
                    <span className="text-[10px] font-mono uppercase text-[#A6C1A0] block">
                      Traitements / Médicaments
                    </span>
                    <ul className="list-disc list-inside text-xs mt-1 text-white/90 space-y-0.5">
                      {privateData.medications.map((med) => (
                        <li key={med}>{med}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <button
                onClick={() => onLock(participant.id)}
                className="w-full py-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 text-xs font-semibold transition-all"
              >
                🔒 Re-verrouiller immédiatement
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
