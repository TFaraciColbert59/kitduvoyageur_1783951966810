'use client';

import React, { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import type { TrustStats } from '@/lib/home-queries';

interface Props {
  stats: TrustStats;
}

const STATS = [
  { val: '47+', label: 'Poids d\'équipement', unit: 'références testées' },
  { val: '1.4', label: 'kg moyen économisé', unit: 'par rapport au sac habituel' },
  { val: '6 sem.', label: 'de délai moyen', unit: 'pour préparer un trek' },
  { val: '100%', label: 'des recommandations', unit: 'vérifiées terrain' },
];

export default function HomepageAIDemoSection({ stats }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // Show real route count if available, fallback to static
  const routeCount = stats.routeCount > 0 ? `${stats.routeCount.toLocaleString('fr-FR')}` : '1 169';

  return (
    <section
      ref={sectionRef}
      className="py-20 md:py-28 relative overflow-hidden"
      style={{ background: '#243028' }}
      aria-labelledby="ai-demo-heading"
    >
      {/* Subtle topo lines */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]" aria-hidden="true">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="topo-demo" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
              <circle cx="60" cy="60" r="50" fill="none" stroke="white" strokeWidth="0.8"/>
              <circle cx="60" cy="60" r="35" fill="none" stroke="white" strokeWidth="0.5"/>
              <circle cx="60" cy="60" r="20" fill="none" stroke="white" strokeWidth="0.4"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#topo-demo)"/>
        </svg>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left — text block */}
          <div>
            <p
              className="label-eyebrow-dark mb-5"
              style={{
                opacity: visible ? 1 : 0,
                transition: 'opacity 0.5s ease',
              }}
            >
              — Notre promesse
            </p>
            <h2
              id="ai-demo-heading"
              className="text-section-title text-white mb-6"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(24px)',
                transition: 'opacity 0.7s ease 0.1s, transform 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s',
              }}
            >
              Un sac. Une carte.
              <br />
              <em className="not-italic" style={{ fontStyle: 'italic', fontWeight: 400, color: 'rgba(245,243,238,0.45)' }}>
                Le reste vient de vous.
              </em>
            </h2>

            <p
              className="text-white/55 text-base leading-relaxed max-w-md mb-10"
              style={{
                opacity: visible ? 1 : 0,
                transition: 'opacity 0.6s ease 0.2s',
              }}
            >
              Nous traitons ce que les autres ignorent : le poids exact, les alternatives, la météo du terrain.
              Vous, vous décidez où aller. Le kit fait le reste.
            </p>

            {/* Stats grid */}
            <div
              className="grid grid-cols-2 gap-5 mb-10"
              style={{
                opacity: visible ? 1 : 0,
                transition: 'opacity 0.6s ease 0.3s',
              }}
            >
              {STATS.map((s) => (
                <div key={s.label}>
                  <p
                    className="text-2xl font-bold text-white mb-0.5"
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                  >
                    {s.val}
                  </p>
                  <p className="text-xs font-medium text-white/60">{s.label}</p>
                  <p className="text-[10px] text-white/30 mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                    {s.unit}
                  </p>
                </div>
              ))}
            </div>

            <Link
              href="/ai-configurator"
              className="btn-primary"
              style={{
                opacity: visible ? 1 : 0,
                transition: 'opacity 0.5s ease 0.4s',
              }}
            >
              <Icon name="SparklesIcon" size={16} variant="outline" />
              Lancer mon configurateur
            </Link>
          </div>

          {/* Right — mountain photography */}
          <div
            className="relative"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateX(0)' : 'translateX(32px)',
              transition: 'opacity 0.8s ease 0.2s, transform 0.8s cubic-bezier(0.16,1,0.3,1) 0.2s',
            }}
          >
            <div className="relative overflow-hidden rounded-2xl" style={{ aspectRatio: '4/5' }}>
              <AppImage
                src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=700&q=80"
                alt="Vue aérienne d'une vallée alpine avec forêts denses et sommets enneigés"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                loading="lazy"
                className="object-cover"
              />
              {/* Caption overlay */}
              <div
                className="absolute bottom-0 left-0 right-0 p-5"
                style={{ background: 'linear-gradient(to top, rgba(26,31,28,0.8), transparent)' }}
              >
                <p
                  className="text-[9px] uppercase tracking-[0.18em] text-white/45 mb-1"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  — Référence terrain
                </p>
                <p className="text-sm font-semibold text-white">
                  Trois jours dans la Chartreuse.
                </p>
              </div>
            </div>

            {/* Floating stat badge */}
            <div
              className="absolute -left-6 top-1/2 -translate-y-1/2 hidden lg:block"
            >
              <div
                className="rounded-xl px-4 py-3 text-center"
                style={{
                  background: 'rgba(245,243,238,0.97)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
                }}
              >
                <p
                  className="text-xl font-bold text-[#17402C]"
                  style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                >
                  {routeCount}
                </p>
                <p className="text-[9px] text-[#6B7568] mt-0.5 leading-tight" style={{ fontFamily: 'var(--font-mono)' }}>
                  sentiers<br/>référencés
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
