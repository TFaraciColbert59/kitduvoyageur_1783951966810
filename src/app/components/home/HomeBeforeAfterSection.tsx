'use client';

import React, { useState, useEffect, useRef } from 'react';

function useInViewLocal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref?.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs?.observe(el);
    return () => obs?.disconnect();
  }, [threshold]);
  return { ref, visible };
}

export default function HomeBeforeAfterSection() {
  const { ref, visible } = useInViewLocal();

  const before = [
    '15 onglets ouverts',
    'Listes trouvées sur internet',
    'Achats inutiles et doublons',
    'Sac trop lourd, stress au départ',
  ];

  const after = [
    'Votre inventaire personnel centralisé',
    'Votre matériel déjà connu et répertorié',
    'Vos besoins analysés par destination',
    'Votre sac optimisé, rien de trop',
  ];

  return (
    <section ref={ref} className="py-28 bg-[#1C2620] relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cpath d='M0 150 Q75 50 150 150 Q225 250 300 150' fill='none' stroke='%23E7E3D6' stroke-width='1'/%3E%3Cpath d='M0 100 Q75 0 150 100 Q225 200 300 100' fill='none' stroke='%23E7E3D6' stroke-width='1'/%3E%3Cpath d='M0 200 Q75 100 150 200 Q225 300 300 200' fill='none' stroke='%23E7E3D6' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '300px 300px',
        }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className={`text-center mb-16 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-[10px] font-mono text-[#E4501C] tracking-[0.25em] uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
            La différence
          </p>
          <h2 className="text-section-title text-white" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
            Elle connaît votre sac.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className={`bg-white/4 border border-white/8 rounded-3xl p-8 transition-all duration-700 delay-100 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center">
                <span className="text-white/40 text-sm font-bold">✕</span>
              </div>
              <p className="text-[11px] font-mono text-white/30 tracking-[0.2em] uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
                Avant
              </p>
            </div>
            <ul className="space-y-4">
              {before?.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="text-white/20 text-lg leading-none mt-0.5 flex-shrink-0">✕</span>
                  <span className="text-white/45 text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={`bg-[#E4501C]/8 border border-[#E4501C]/20 rounded-3xl p-8 transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-xl bg-[#E4501C]/20 flex items-center justify-center">
                <span className="text-[#E4501C] text-sm font-bold">✓</span>
              </div>
              <p className="text-[11px] font-mono text-[#E4501C]/70 tracking-[0.2em] uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
                Avec Le Kit du Voyageur
              </p>
            </div>
            <ul className="space-y-4">
              {after?.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="text-[#E4501C] text-lg leading-none mt-0.5 flex-shrink-0">✓</span>
                  <span className="text-white/75 text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
