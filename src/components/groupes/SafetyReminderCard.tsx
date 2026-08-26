"use client";

import React, { useState } from 'react';

export default function SafetyReminderCard() {
  const [minimized, setMinimized] = useState(false);

  return (
    <div className="glass tone-info p-5 text-[#17402C] transition-all duration-300">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full glass-sub-card text-[#17402C] flex items-center justify-center text-sm font-bold shrink-0">
            🛡️
          </div>
          <div>
            <h4 className="font-bold text-sm text-[#17402C]">Rappel de sécurité voyage &amp; cadrage</h4>
            <p className="text-[11px] text-[#5C6B5E]">Conseils essentiels pour une expédition sereine et transparente</p>
          </div>
        </div>
        <button
          onClick={() => setMinimized(!minimized)}
          className="glass-capsule-btn py-1 px-2.5 text-xs font-semibold shrink-0"
        >
          <span className="relative z-10">{minimized ? 'Afficher' : 'Réduire'}</span>
        </button>
      </div>

      {!minimized && (
        <div className="space-y-3 pt-2 text-xs border-t border-[#17402C]/10 leading-relaxed">
          <div className="glass-sub-card p-3 rounded-xl flex items-start gap-2.5">
            <span className="text-[#17402C] text-sm shrink-0">📍</span>
            <p>
              <strong className="text-[#17402C]">Partagez votre itinéraire :</strong> Transmettez toujours vos étapes et les contacts du groupe à un proche de confiance avant de partir.
            </p>
          </div>

          <div className="glass-sub-card p-3 rounded-xl flex items-start gap-2.5">
            <span className="text-[#17402C] text-sm shrink-0">☕</span>
            <p>
              <strong className="text-[#17402C]">Premier contact :</strong> Privilégiez un appel vidéo ou un café dans un lieu public pour faire connaissance avant le grand départ.
            </p>
          </div>

          <div className="glass-sub-card p-3 rounded-xl flex items-start gap-2.5">
            <span className="text-[#17402C] text-sm shrink-0">💶</span>
            <p>
              <strong className="text-[#17402C]">Frais partagés &amp; remboursements :</strong> Utilisez exclusivement le module <em className="italic">Dépenses</em>. Les désistements et remboursements éventuels se règlent à l'amiable entre membres (LKDV fournit un tracker de répartition, sans compte séquestre).
            </p>
          </div>

          <div className="glass-sub-card p-3 rounded-xl flex items-start gap-2.5">
            <span className="text-[#17402C] text-sm shrink-0">🤝</span>
            <p>
              <strong className="text-[#17402C]">Cadrage plateforme :</strong> LKDV facilite la mise en relation. L'organisation, les assurances et le déroulement du séjour restent sous la responsabilité des co-voyageurs.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-[#17402C]/10 text-[11px]">
            <span className="text-[#5C6B5E]">Besoin d'aide ou assistance ?</span>
            <div className="flex items-center gap-2">
              <a
                href="/contact"
                className="font-semibold text-[#5C6B5E] hover:underline"
              >
                Page contact
              </a>
              <span>·</span>
              <a
                href="mailto:contact@lekitduvoyageur.fr?subject=Assistance%20Groupe%20Bouteille%20a%20la%20mer"
                className="font-bold text-[#17402C] hover:underline flex items-center gap-1"
              >
                contact@lekitduvoyageur.fr →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
