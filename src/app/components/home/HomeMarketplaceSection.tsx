'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
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

export default function HomeMarketplaceSection() {
  const { ref, visible } = useInViewLocal();

  return (
    <section ref={ref} className="py-28 bg-[#1C2620] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <p className="text-[10px] font-mono text-[#E4501C] tracking-[0.25em] uppercase mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
              Marketplace intelligente
            </p>
            <h2 className="text-section-title text-white mb-6" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
              Pas besoin de chercher.
            </h2>
            <p className="text-white/50 text-lg leading-relaxed mb-8">
              Nous savons exactement ce qu&apos;il vous manque. L&apos;IA compare votre inventaire avec votre kit cible et identifie les écarts.
            </p>
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Acheter neuf', icon: 'ShoppingBagIcon', primary: true },
                { label: 'Louer', icon: 'KeyIcon', primary: false },
                { label: "Trouver d'occasion", icon: 'TagIcon', primary: false },
              ]?.map(({ label, icon, primary }) => (
                <Link
                  key={label}
                  href="/boutique"
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    primary
                      ? 'bg-[#E4501C] text-white hover:bg-[#cc3d10] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#E4501C]/30'
                      : 'bg-white/8 border border-white/10 text-white/70 hover:text-white hover:bg-white/14'
                  }`}
                >
                  <Icon name={icon} size={15} variant="outline" />
                  {label}
                </Link>
              ))}
            </div>
            <p className="mt-6 text-white/25 text-xs leading-relaxed">
              Vision circulaire · Économie de partage · Matériel vérifié
            </p>
          </div>

          <div className={`transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="bg-[#243028] border border-white/8 rounded-3xl p-8">
              <div className="mb-6">
                <p className="text-[10px] font-mono text-white/30 tracking-[0.2em] uppercase mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
                  Votre inventaire
                </p>
                <div className="space-y-3">
                  {[
                    { name: 'Sac à dos 40L', brand: 'Osprey Atmos' },
                    { name: 'Veste imperméable', brand: "Arc'teryx Beta" },
                  ]?.map(({ name, brand }) => (
                    <div key={name} className="flex items-center gap-3 bg-white/4 rounded-xl px-4 py-3">
                      <div className="w-5 h-5 rounded-full bg-[#E4501C]/20 border border-[#E4501C]/40 flex items-center justify-center flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-[#E4501C]" />
                      </div>
                      <div>
                        <p className="text-white/80 text-sm font-medium">{name}</p>
                        <p className="text-white/30 text-[10px] font-mono" style={{ fontFamily: 'var(--font-mono)' }}>{brand}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-[10px] font-mono text-white/20 tracking-[0.2em] uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
                  Il vous manque
                </span>
                <div className="flex-1 h-px bg-white/8" />
              </div>
              <div className="space-y-3">
                {[
                  { name: 'Batterie externe 20 000 mAh', price: '49 €' },
                  { name: 'Couche thermique Merino', price: '89 €' },
                  { name: 'Lampe frontale 350 lm', price: '35 €' },
                ]?.map(({ name, price }) => (
                  <div key={name} className="flex items-center gap-3 bg-[#E4501C]/6 border border-[#E4501C]/15 rounded-xl px-4 py-3">
                    <span className="text-[#E4501C] text-base flex-shrink-0">+</span>
                    <p className="text-white/70 text-sm flex-1">{name}</p>
                    <span className="text-[#E4501C] text-sm font-mono font-bold" style={{ fontFamily: 'var(--font-mono)' }}>{price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
