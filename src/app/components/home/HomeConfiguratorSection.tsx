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

export default function HomeConfiguratorSection() {
  const { ref, visible } = useInViewLocal();
  const [activeField, setActiveField] = useState<string | null>(null);

  const fields = [
    { key: 'destination', label: 'Destination', value: 'Islande', icon: 'MapPinIcon' },
    { key: 'dates', label: 'Dates', value: '12 – 22 octobre', icon: 'CalendarIcon' },
    { key: 'style', label: 'Style de voyage', value: 'Aventure / Trek', icon: 'BoltIcon' },
    { key: 'budget', label: 'Budget', value: '800 €', icon: 'BanknotesIcon' },
  ];

  return (
    <section ref={ref} className="py-28 bg-[#E7E3D6] relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600'%3E%3Cellipse cx='300' cy='300' rx='250' ry='200' fill='none' stroke='%231C2620' stroke-width='1'/%3E%3Cellipse cx='300' cy='300' rx='200' ry='160' fill='none' stroke='%231C2620' stroke-width='1'/%3E%3Cellipse cx='300' cy='300' rx='150' ry='120' fill='none' stroke='%231C2620' stroke-width='1'/%3E%3Cellipse cx='300' cy='300' rx='100' ry='80' fill='none' stroke='%231C2620' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '600px 600px',
          backgroundPosition: 'right center',
        }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className={`mb-16 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-[10px] font-mono text-[#E4501C] tracking-[0.25em] uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
            Configurateur IA
          </p>
          <h2 className="text-section-title text-[#1C2620] max-w-xl" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
            Laissez l&apos;IA préparer votre sac.
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className={`transition-all duration-700 delay-150 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="bg-white border border-[#C8C3B0] rounded-3xl p-8 shadow-sm">
              <div className="space-y-4 mb-8">
                {fields?.map(({ key, label, value, icon }) => (
                  <div
                    key={key}
                    onClick={() => setActiveField(activeField === key ? null : key)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                      activeField === key
                        ? 'border-[#E4501C] bg-[#E4501C]/5 shadow-sm'
                        : 'border-[#C8C3B0] bg-[#EDEAE0] hover:border-[#E4501C]/40'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${activeField === key ? 'bg-[#E4501C]/15' : 'bg-[#D4CFBF]'}`}>
                      <Icon name={icon} size={18} variant="outline" className={activeField === key ? 'text-[#E4501C]' : 'text-[#5C6B5E]'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-mono text-[#5C6B5E] tracking-[0.15em] uppercase mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                        {label}
                      </p>
                      <p className="text-[#1C2620] font-semibold text-sm truncate">{value}</p>
                    </div>
                    <Icon name="ChevronRightIcon" size={14} variant="outline" className={`text-[#5C6B5E] transition-transform ${activeField === key ? 'rotate-90' : ''}`} />
                  </div>
                ))}
              </div>
              <Link
                href="/ai-configurator"
                className="w-full flex items-center justify-center gap-2.5 bg-[#E4501C] hover:bg-[#cc3d10] text-white py-4 rounded-2xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#E4501C]/30"
              >
                <Icon name="SparklesIcon" size={16} variant="outline" />
                Générer mon kit personnalisé
              </Link>
            </div>
          </div>

          <div className={`transition-all duration-700 delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="bg-[#1C2620] rounded-3xl p-8 text-white">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-2 rounded-full bg-[#E4501C] animate-pulse" />
                <span className="text-[10px] font-mono text-white/40 tracking-[0.2em] uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
                  Résultat généré · 8 secondes
                </span>
              </div>
              <h3 className="text-2xl text-white mb-6" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                Kit Islande Automne
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { v: '32', l: 'objets' },
                  { v: '8,4 kg', l: 'poids total' },
                  { v: '1 240 €', l: 'budget estimé' },
                  { v: '94/100', l: 'Trust Score' },
                ]?.map(({ v, l }) => (
                  <div key={l} className="bg-white/6 rounded-2xl p-4">
                    <p className="text-white font-mono font-bold text-xl mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>{v}</p>
                    <p className="text-white/35 text-[10px] font-mono tracking-wide uppercase" style={{ fontFamily: 'var(--font-mono)' }}>{l}</p>
                  </div>
                ))}
              </div>
              <p className="text-white/50 text-sm leading-relaxed mb-6">
                L&apos;IA a analysé les conditions météo d&apos;octobre en Islande, votre profil aventure et votre budget pour sélectionner les 32 objets essentiels.
              </p>
              <div className="flex items-center gap-2 text-[#E4501C]">
                <Icon name="ArrowRightIcon" size={14} variant="outline" />
                <span className="text-sm font-medium">Pas une checklist. Un équipement optimisé.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
