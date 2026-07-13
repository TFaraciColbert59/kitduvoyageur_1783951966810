'use client';

import React, { useState, useEffect, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';

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

export default function HomeTrustScoreSection() {
  const { ref, visible } = useInViewLocal();
  const dashFill = '426.3';
  const dashTotal = '439.8';

  return (
    <section ref={ref} className="py-28 bg-[#E7E3D6] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className={`text-center mb-16 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <p className="text-[10px] font-mono text-[#E4501C] tracking-[0.25em] uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
              Trust Score
            </p>
            <h2 className="text-section-title text-[#1C2620] mb-4" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
              Votre identité de confiance.
            </h2>
            <p className="text-[#5C6B5E] text-lg max-w-xl mx-auto leading-relaxed">
              Votre profil voyageur devient votre passeport dans l&apos;écosystème. Plus vous voyagez, plus votre score grandit.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-center">
            <div className={`flex flex-col items-center transition-all duration-700 delay-100 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
              <div className="relative w-44 h-44">
                <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
                  <circle cx="80" cy="80" r="70" fill="none" stroke="#C8C3B0" strokeWidth="6" />
                  <circle
                    cx="80" cy="80" r="70" fill="none"
                    stroke="#E4501C" strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${dashFill} ${dashTotal}`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[#1C2620] font-mono font-bold text-4xl leading-none" style={{ fontFamily: 'var(--font-mono)' }}>97</span>
                  <span className="text-[#5C6B5E] text-[10px] font-mono tracking-[0.15em] uppercase mt-1" style={{ fontFamily: 'var(--font-mono)' }}>/100</span>
                </div>
              </div>
              <p className="text-[#5C6B5E] text-sm mt-4 text-center">Voyageur Expert</p>
            </div>

            <div className={`md:col-span-2 space-y-4 transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
              {[
                { icon: 'StarIcon', title: 'Réputation vérifiée', desc: 'Chaque voyage, chaque avis, chaque échange construit votre profil.' },
                { icon: 'KeyIcon', title: 'Accès location & seconde main', desc: 'Un score élevé débloque les meilleures offres de la communauté.' },
                { icon: 'UsersIcon', title: 'Communauté de confiance', desc: 'Rejoignez des voyageurs vérifiés pour des expéditions partagées.' },
              ]?.map(({ icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4 bg-white border border-[#C8C3B0] rounded-2xl p-5">
                  <div className="w-10 h-10 rounded-xl bg-[#E4501C]/10 flex items-center justify-center flex-shrink-0">
                    <Icon name={icon} size={18} variant="outline" className="text-[#E4501C]" />
                  </div>
                  <div>
                    <p className="text-[#1C2620] font-semibold text-sm mb-1">{title}</p>
                    <p className="text-[#5C6B5E] text-sm leading-relaxed">{desc}</p>
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
