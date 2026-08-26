'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
  onSignOut: () => Promise<void>;
}

export default function SettingsDrawer({
  isOpen,
  onClose,
  userEmail,
  onSignOut,
}: SettingsDrawerProps) {
  const { triggerHaptic } = useHapticFeedback();
  const router = useRouter();

  if (!isOpen) return null;

  const handleLogout = async () => {
    triggerHaptic('warning');
    await onSignOut();
    onClose();
    router.push('/');
  };

  const sections = [
    {
      title: 'Compte & Sécurité',
      items: [
        { label: 'Adresse e-mail', value: userEmail || '—', action: null },
        { label: 'Mot de passe & Authentification', value: 'Changer', action: () => router.push('/connexion') },
        { label: 'Confidentialité du profil', value: 'Public', action: null },
      ],
    },
    {
      title: 'Préférences',
      items: [
        { label: 'Notifications e-mail', value: 'Activées', action: null },
        { label: 'Unités de mesure', value: 'Métrique (km, m, g)', action: null },
        { label: 'Mode hors-ligne & Cartes', value: 'Gérer le stockage', action: () => router.push('/hors-ligne') },
      ],
    },
    {
      title: 'Aide & Légal',
      items: [
        { label: 'Centre d’aide & FAQ', value: 'Consulter', action: () => router.push('/faq') },
        { label: 'Conditions Générales (CGU/CGV)', value: 'Lire', action: () => router.push('/cgu') },
        { label: 'Protection des données (RGPD)', value: 'Voir', action: () => router.push('/politique-confidentialite') },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs transition-opacity">
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-6  border border-black/[0.06] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-black/[0.06]">
          <h3 className="text-base font-bold text-[#17402C] flex items-center gap-2">
            <span>⚙️</span> Paramètres & Préférences
          </h3>
          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-[#F4F1EB] flex items-center justify-center text-xs text-[#5A7064] hover:text-[#17402C]"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6 pt-4">
          {sections.map((sec, idx) => (
            <div key={idx} className="space-y-2">
              <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#5A7064]">
                {sec.title}
              </h4>
              <div className="bg-[#FBFAF6] rounded-2xl border border-black/[0.04] divide-y divide-black/[0.04] overflow-hidden">
                {sec.items.map((item, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      if (item.action) {
                        triggerHaptic('selection');
                        item.action();
                      }
                    }}
                    className={`p-3.5 flex items-center justify-between gap-3 text-xs ${
                      item.action ? 'cursor-pointer hover:bg-[#F4F1EB] transition-colors' : ''
                    }`}
                  >
                    <span className="font-semibold text-[#17402C]">{item.label}</span>
                    <span className="font-mono text-[#5A7064] flex items-center gap-1">
                      {item.value}
                      {item.action && <span>→</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Bouton Déconnexion */}
          <div className="pt-2">
            <button
              onClick={handleLogout}
              className="w-full py-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors flex items-center justify-center gap-2 active:scale-95"
            >
              <span>🚪</span>
              <span>Se déconnecter du compte</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
