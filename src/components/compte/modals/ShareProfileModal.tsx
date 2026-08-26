'use client';

import React, { useState } from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface ShareProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  userName?: string;
}

export default function ShareProfileModal({
  isOpen,
  onClose,
  userId,
  userName = 'Voyageur',
}: ShareProfileModalProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const profileUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/profil/${userId || 'me'}`
    : `https://lekitduvoyageur.fr/profil/${userId || 'me'}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      triggerHaptic('success');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div
        className="w-full max-w-sm bg-white rounded-3xl p-6  border border-black/[0.06] text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-2xl bg-[#E1EBDD] flex items-center justify-center text-2xl mx-auto mb-3">
          🔗
        </div>

        <h3 className="text-base font-bold text-[#17402C]">Partager mon profil</h3>
        <p className="text-xs text-[#5A7064] mt-1 mb-5">
          Partagez vos récits, vos statistiques et votre équipement avec vos amis randonneurs.
        </p>

        <div className="flex items-center gap-2 p-2 bg-[#FBFAF6] rounded-2xl border border-black/[0.06] mb-5">
          <input
            type="text"
            readOnly
            value={profileUrl}
            className="flex-1 bg-transparent text-xs text-[#17402C] font-mono outline-none px-2 truncate"
          />
          <button
            onClick={handleCopy}
            className="px-3 py-2 rounded-xl bg-[#17402C] text-white text-xs font-bold shrink-0 shadow-2xs active:scale-95 transition-transform"
          >
            {copied ? 'Copié ✓' : 'Copier'}
          </button>
        </div>

        <button
          onClick={() => {
            triggerHaptic('light');
            onClose();
          }}
          className="w-full py-2.5 rounded-xl bg-[#F4F1EB] hover:bg-[#EBE7DF] text-[#17402C] text-xs font-semibold"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
