'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { POPULAR_KITS } from '@/app/components/home/data';

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

export default function HomePopularKitsSection() {
  const { ref, visible } = useInViewLocal();

  return (
    <section ref={ref} className="py-28 bg-[#E7E3D6] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-14 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div>
            <p className="text-[10px] font-mono text-[#E4501C] tracking-[0.25em] uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
              Kits populaires
            </p>
            <h2 className="text-section-title text-[#1C2620]" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
              Fiches d&apos;expédition.
            </h2>
          </div>
          <Link href="/kits" className="flex items-center gap-2 text-sm font-medium text-[#E4501C] hover:text-[#cc3d10] transition-colors flex-shrink-0">
            Voir tous les kits
            <Icon name="ArrowRightIcon" size={14} variant="outline" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {POPULAR_KITS?.map((kit, i) => (
            <div
              key={kit?.slug}
              className={`group relative rounded-3xl overflow-hidden border border-[#C8C3B0] hover:border-[#E4501C]/40 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/10 cursor-pointer ${i === 0 ? 'sm:col-span-2 lg:col-span-1' : ''}`}
              style={{
                background: `linear-gradient(135deg, ${kit?.color} 0%, #1C2620 100%)`,
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(24px)',
                transition: `opacity 0.6s ease ${i * 60}ms, transform 0.6s ease ${i * 60}ms, box-shadow 0.3s ease, border-color 0.3s ease`,
              }}
            >
              <div
                className="absolute inset-0 opacity-[0.06]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Ccircle cx='100' cy='100' r='80' fill='none' stroke='white' stroke-width='1'/%3E%3Ccircle cx='100' cy='100' r='60' fill='none' stroke='white' stroke-width='1'/%3E%3Ccircle cx='100' cy='100' r='40' fill='none' stroke='white' stroke-width='1'/%3E%3C/svg%3E")`,
                  backgroundSize: '200px 200px',
                  backgroundPosition: 'right bottom',
                }}
              />
              <div className="relative p-7">
                <p className="text-[9px] font-mono text-white/35 tracking-[0.2em] uppercase mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
                  {kit?.tag}
                </p>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-white text-xl leading-tight" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                    {kit?.name}
                  </h3>
                  <span className="text-3xl ml-3 flex-shrink-0">{kit?.emoji}</span>
                </div>
                <p className="text-white/45 text-sm mb-6 leading-relaxed">{kit?.desc}</p>
                <div className="flex items-center gap-4 mb-6">
                  {[
                    { v: `${kit?.items}`, l: 'objets' },
                    { v: kit?.weight, l: 'poids' },
                    { v: kit?.price, l: 'budget' },
                  ]?.map(({ v, l }) => (
                    <div key={l}>
                      <p className="text-white font-mono font-bold text-sm" style={{ fontFamily: 'var(--font-mono)' }}>{v}</p>
                      <p className="text-white/30 text-[9px] font-mono tracking-wide uppercase" style={{ fontFamily: 'var(--font-mono)' }}>{l}</p>
                    </div>
                  ))}
                  <div className="ml-auto">
                    <div className="flex items-center gap-1.5 bg-white/8 rounded-full px-2.5 py-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E4501C]" />
                      <span className="text-[10px] font-mono text-white/60" style={{ fontFamily: 'var(--font-mono)' }}>
                        {kit?.trust}/100
                      </span>
                    </div>
                  </div>
                </div>
                <Link
                  href={`/kits/${kit?.slug}`}
                  className="flex items-center justify-between w-full bg-white/8 hover:bg-white/16 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 text-white/70 hover:text-white text-sm font-medium transition-all duration-200 group-hover:bg-white/12"
                >
                  Voir le kit
                  <Icon name="ArrowRightIcon" size={14} variant="outline" className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
