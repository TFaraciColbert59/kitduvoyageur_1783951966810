"use client";

import React, { useState } from 'react';

export default function SafetyReminderCard() {
  const [minimized, setMinimized] = useState(false);

  return (
    <div className="bg-[#FBFAF6] border border-[#17402C]/15 rounded-[24px] p-5 text-[#1C2620] shadow-sm transition-all">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#17402C]/10 text-[#17402C] flex items-center justify-center text-sm font-bold">
            🛡️
          </div>
          <div>
            <h4 className="font-bold text-sm text-[#0B1F17]">Rappel de sécurité voyage &amp; cadrage</h4>
            <p className="text-[11px] text-[#63736C]">Conseils essentiels pour une expédition sereine et transparente</p>
          </div>
        </div>
        <button
          onClick={() => setMinimized(!minimized)}
          className="text-xs text-[#63736C] hover:text-[#1C2620] px-2 py-1 rounded hover:bg-black/5 transition-colors font-medium"
        >
          {minimized ? 'Afficher' : 'Réduire'}
        </button>
      </div>

      {!minimized && (
        <div className="space-y-3 pt-2 text-xs border-t border-[#1C2620]/8 leading-relaxed">
          <div className="flex items-start gap-2.5">
            <span className="text-[#17402C] text-sm shrink-0">📍</span>
            <p>
              <strong className="text-[#0B1F17]">Partagez votre itinéraire :</strong> Transmettez toujours vos étapes et les contacts du groupe à un proche de confiance avant de partir.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="text-[#17402C] text-sm shrink-0">☕</span>
            <p>
              <strong className="text-[#0B1F17]">Premier contact :</strong> Privilégiez un appel vidéo ou un café dans un lieu public pour faire connaissance avant le grand départ.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="text-[#17402C] text-sm shrink-0">💶</span>
            <p>
              <strong className="text-[#0B1F17]">Frais partagés &amp; remboursements :</strong> Utilisez exclusivement le module <em className="italic">Dépenses</em>. Les désistements et remboursements éventuels se règlent à l'amiable entre membres (LKDV fournit un tracker de répartition, sans compte séquestre).
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="text-[#17402C] text-sm shrink-0">🤝</span>
            <p>
              <strong className="text-[#0B1F17]">Cadrage plateforme :</strong> LKDV facilite la mise en relation. L'organisation, les assurances et le déroulement du séjour restent sous la responsabilité des co-voyageurs.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-[#1C2620]/5 text-[11px]">
            <span className="text-[#63736C]">Besoin d'aide ou assistance ?</span>
            <div className="flex items-center gap-2">
              <a
                href="/contact"
                className="font-semibold text-[#63736C] hover:underline"
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
