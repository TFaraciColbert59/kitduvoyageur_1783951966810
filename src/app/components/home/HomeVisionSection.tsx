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

export default function HomeVisionSection() {
  const { ref, visible } = useInViewLocal();

  return (
    <section ref={ref} className="py-32 bg-[#1C2620] relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Cpath d='M400 50 Q700 200 750 400 Q700 600 400 750 Q100 600 50 400 Q100 200 400 50Z' fill='none' stroke='%23E7E3D6' stroke-width='1'/%3E%3Cpath d='M400 120 Q650 250 690 400 Q650 550 400 680 Q150 550 110 400 Q150 250 400 120Z' fill='none' stroke='%23E7E3D6' stroke-width='1'/%3E%3Cpath d='M400 190 Q600 300 630 400 Q600 500 400 610 Q200 500 170 400 Q200 300 400 190Z' fill='none' stroke='%23E7E3D6' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '800px 800px',
          backgroundPosition: 'center',
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-[0.03]"
        style={{ background: 'radial-gradient(circle, #E4501C 0%, transparent 70%)' }}
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
        <div className={`transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          <p className="text-[10px] font-mono text-[#E4501C] tracking-[0.25em] uppercase mb-8" style={{ fontFamily: 'var(--font-mono)' }}>
            Notre vision
          </p>
          <h2
            className="text-white mb-8 leading-[1.05]"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(2rem, 5vw, 4rem)', letterSpacing: '-0.03em' }}
          >
            Le futur du voyage
            <br />
            n&apos;est pas de transporter plus.
            <br />
            <span className="text-[#E4501C]">C&apos;est de savoir exactement</span>
            <br />
            quoi emporter.
          </h2>
          <p className="text-white/40 text-lg leading-relaxed max-w-2xl mx-auto mb-12">
            Une technologie née de l&apos;univers outdoor. Une intelligence construite pour les voyageurs qui refusent le superflu. Une plateforme qui grandit avec vous.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-14">
            {[
              { v: '500+', l: 'Produits vérifiés' },
              { v: '120+', l: 'Destinations' },
              { v: '12k+', l: 'Voyageurs actifs' },
              { v: '98%', l: 'Satisfaction' },
            ]?.map(({ v, l }) => (
              <div key={l} className="text-center">
                <p className="text-white font-mono font-bold text-3xl mb-1" style={{ fontFamily: 'var(--font-mono)' }}>{v}</p>
                <p className="text-white/30 text-[10px] font-mono tracking-[0.15em] uppercase" style={{ fontFamily: 'var(--font-mono)' }}>{l}</p>
              </div>
            ))}
          </div>
          <Link
            href="/ai-configurator"
            className="inline-flex items-center gap-3 bg-[#E4501C] hover:bg-[#cc3d10] text-white px-10 py-5 rounded-2xl font-semibold text-base transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-[#E4501C]/30"
          >
            <Icon name="SparklesIcon" size={18} variant="outline" />
            Commencer mon premier kit
            <Icon name="ArrowRightIcon" size={16} variant="outline" />
          </Link>
        </div>
      </div>
    </section>
  );
}
