import React from 'react';
import Link from 'next/link';

const steps = [
  { label: 'ÉTAPE 1 · GROUPES', desc: 'Le voyage se prépare à plusieurs', status: 'En cours · 3 groupes' },
  { label: 'ÉTAPE 2 · VOYAGE', desc: 'Vous partez et vous vivez le voyage', status: 'Automatique' },
  { label: 'ÉTAPE 3 · CARNET', desc: 'Tout est archivé, prêt à relire', status: '12 archives' },
];

export default function GroupeToCarnetCTA() {
  return (
    <section className="bg-gradient-to-br from-[#1C2620] via-[#1C2620] to-[#33463C] text-[#E7E3D6] py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left */}
          <div>
            <span className="inline-block font-mono text-[9px] uppercase tracking-[0.25em] text-[#17402C] bg-[#17402C]/10 px-3 py-1 rounded-full mb-6">
              + DU GROUPE AU CARNET
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-2 leading-tight">
              Ce que vous <em className="font-serif italic text-[#E7E3D6]/70">préparez</em>
            </h2>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-6 leading-tight">
              devient ce que vous <em className="font-serif italic text-[#E7E3D6]/70">gardez.</em>
            </h2>
            <p className="text-sm text-[#E7E3D6]/60 leading-relaxed mb-8 max-w-lg font-sans">
              Chaque voyage lancé dans Groupes atterrit ici à son retour — étapes, photos, hébergements, dépenses.
              Vous n&apos;avez rien à remplir : le carnet se compose seul, à partir de ce que le groupe a vécu.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/groupes"
                className="inline-flex items-center gap-2 bg-[#E7E3D6] text-[#1C2620] px-6 py-3 rounded-full text-sm font-semibold hover:bg-white transition-colors"
              >
                Voir mes groupes →
              </Link>
              <Link
                href="/guides"
                className="inline-flex items-center gap-2 border border-[#E7E3D6]/20 text-[#E7E3D6]/80 px-6 py-3 rounded-full text-sm font-medium hover:border-[#E7E3D6]/40 hover:text-[#E7E3D6] transition-colors"
              >
                Comment ça marche
              </Link>
            </div>
          </div>

          {/* Right: Pipeline card */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6 md:p-8">
            <div className="space-y-5">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-mono font-bold text-[#E7E3D6] flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#E7E3D6]/40 mb-1">{step.label}</p>
                    <p className="text-sm text-[#E7E3D6]/90 font-sans mb-1">{step.desc}</p>
                    <p className="font-mono text-[10px] text-[#17402C]/80">{step.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
