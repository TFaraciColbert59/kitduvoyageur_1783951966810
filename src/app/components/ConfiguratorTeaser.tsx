'use client';

import React, { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

const steps = [
  { id: 1, icon: 'MapPinIcon', label: 'Destination', desc: 'Choisissez votre pays ou région' },
  { id: 2, icon: 'CalendarDaysIcon', label: 'Saison & Dates', desc: 'Météo et période de voyage' },
  { id: 3, icon: 'UserCircleIcon', label: 'Profil', desc: 'Activité, niveau, contraintes' },
  { id: 4, icon: 'SparklesIcon', label: 'Résultat IA', desc: 'Liste + sac + budget optimisés' },
];

export default function ConfiguratorTeaser() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-16 sm:py-20 bg-dark-bg relative overflow-hidden"
      aria-labelledby="configurator-title"
    >
      {/* Subtle topo background pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" aria-hidden="true">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="topo" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M0,40 C20,20 60,60 80,40" fill="none" stroke="#E7E3D6" strokeWidth="0.5" />
              <path d="M0,60 C20,40 60,80 80,60" fill="none" stroke="#E7E3D6" strokeWidth="0.5" />
              <path d="M0,20 C20,0 60,40 80,20" fill="none" stroke="#E7E3D6" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#topo)" />
        </svg>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Left: Text */}
          <div className="flex-1 text-center lg:text-left">
            <div className="flex items-center gap-2 justify-center lg:justify-start mb-4">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse-orange" />
              <span className="text-xs font-mono-data text-primary uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>
                RACE MODE ACTIF
              </span>
            </div>
            <h2
              id="configurator-title"
              className="text-section-title text-white mb-4"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(24px)',
                transition: 'opacity 0.7s ease, transform 0.7s cubic-bezier(0.16,1,0.3,1)',
              }}
            >
              Le configurateur IA
              <br />
              <span style={{ color: 'var(--primary)' }}>qui prépare votre sac.</span>
            </h2>
            <p className="text-white/60 text-base leading-relaxed max-w-md mx-auto lg:mx-0 mb-8">
              Entrez votre destination, vos dates et votre profil. L&apos;IA génère une liste d&apos;équipement optimisée poids/budget/sécurité en moins de 2 minutes.
            </p>

            {/* Mini stats */}
            <div className="flex flex-wrap gap-6 justify-center lg:justify-start mb-8">
              {[
                { val: '12 847', label: 'voyages configurés', unit: '' },
                { val: '4.2', label: 'kg économisés en moy.', unit: 'kg' },
                { val: '98%', label: 'satisfaction', unit: '' },
              ].map(({ val, label }) => (
                <div key={label} className="flex flex-col">
                  <span className="font-mono-data text-xl font-600 text-white" style={{ fontFamily: 'var(--font-mono)' }}>
                    {val}
                  </span>
                  <span className="text-xs text-white/40 mt-0.5">{label}</span>
                </div>
              ))}
            </div>

            <Link href="/ai-configurator" className="btn-primary text-base px-8 py-3.5">
              <Icon name="SparklesIcon" size={18} variant="outline" />
              Lancer le configurateur
            </Link>
          </div>

          {/* Right: Step cards */}
          <div className="flex-1 w-full max-w-md">
            <div className="flex flex-col gap-3">
              {steps.map((step, idx) => (
                <div
                  key={step.id}
                  className="flex items-center gap-4 rounded-xl px-5 py-4"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    opacity: visible ? 1 : 0,
                    transform: visible ? 'translateX(0)' : 'translateX(24px)',
                    transition: `opacity 0.6s ease ${idx * 0.1}s, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${idx * 0.1}s`,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: idx === 3 ? 'rgba(228,80,28,0.2)' : 'rgba(51,70,60,0.4)',
                    }}
                  >
                    <Icon
                      name={step.icon as Parameters<typeof Icon>[0]['name']}
                      size={20}
                      variant="outline"
                      className={idx === 3 ? 'text-primary' : 'text-white/70'}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-display font-600 text-sm" style={{ fontFamily: 'var(--font-display)' }}>
                      {step.label}
                    </p>
                    <p className="text-white/40 text-xs mt-0.5 truncate">{step.desc}</p>
                  </div>
                  <span className="font-mono-data text-xs text-white/20 flex-shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>
                    0{step.id}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}