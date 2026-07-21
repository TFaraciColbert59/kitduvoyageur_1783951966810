'use client';

import React from 'react';

const STEPS = [
  {
    num: '01',
    title: 'Décrivez votre voyage',
    desc: 'Destination, durée, activité, budget, niveau. En une phrase ou en répondant à 3 questions.',
    icon: '🗺️',
  },
  {
    num: '02',
    title: 'L\'IA compose votre kit',
    desc: 'Gemini analyse des milliers de combinaisons pour trouver le meilleur rapport poids/prix/performance.',
    icon: '⚡',
  },
  {
    num: '03',
    title: 'Commandez en 1 clic',
    desc: 'Chaque article est disponible en stock. Livraison sous 48h, retour gratuit 30 jours.',
    icon: '📦',
  },
  {
    num: '04',
    title: 'Partez l\'esprit libre',
    desc: 'Votre inventaire est sauvegardé. Prochaine aventure ? L\'IA sait déjà ce que vous possédez.',
    icon: '🏔️',
  },
];

export default function HomepageHowItWorksSection() {
  return (
    <section className="py-20" style={{ background: '#1C2620' }} aria-labelledby="how-heading">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        <div className="text-center mb-14">
          <p className="text-[10px] font-mono text-white/30 tracking-[0.2em] uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
            — Comment ça marche
          </p>
          <h2
            id="how-heading"
            className="font-display font-800 text-white text-3xl md:text-4xl tracking-tight"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
          >
            Simple comme<br />
            <span style={{ color: '#E4501C' }}>bonjour.</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {STEPS?.map((step, i) => (
            <div key={step?.num} className="relative">
              {i < STEPS?.length - 1 && (
                <div className="hidden md:block absolute top-8 left-full w-full h-px z-0" style={{ background: 'linear-gradient(to right, rgba(228,80,28,0.3), transparent)' }} aria-hidden="true" />
              )}
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {step?.icon}
                </div>
                <p className="text-[10px] font-mono text-[#E4501C] tracking-widest mb-2" style={{ fontFamily: 'var(--font-mono)' }}>{step?.num}</p>
                <h3 className="text-sm font-semibold text-white mb-2">{step?.title}</h3>
                <p className="text-xs text-white/45 leading-relaxed">{step?.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
