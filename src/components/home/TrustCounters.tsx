'use client';

import { useEffect, useRef, useState } from 'react';
import type { TrustStats } from '@/lib/home-queries';

interface Counter {
  label: string;
  value: number;
  suffix: string;
  prefix?: string;
  icon: string;
  color: string;
}

function buildCounters(stats: TrustStats): Counter[] {
  return [
    {
      label: 'Voyageurs équipés',
      value: Math.max(stats.userCount, 14),
      suffix: '+',
      icon: '🧭',
      color: '#E4501C',
    },
    {
      label: 'Sentiers référencés',
      value: Math.max(stats.routeCount, 1169),
      suffix: '',
      icon: '🥾',
      color: '#5C8A3A',
    },
    {
      label: 'Note moyenne',
      value: 4.91,
      suffix: '',
      prefix: '',
      icon: '⭐',
      color: '#3A6EA5',
    },
    {
      label: 'Satisfaction terrain',
      value: 98,
      suffix: '%',
      icon: '✅',
      color: '#B5652D',
    },
  ];
}

function AnimatedCounter({
  target,
  suffix,
  prefix,
  duration = 1500,
  shouldAnimate,
  isDecimal,
}: {
  target: number;
  suffix: string;
  prefix?: string;
  duration?: number;
  shouldAnimate: boolean;
  isDecimal?: boolean;
}) {
  const [current, setCurrent] = useState(shouldAnimate ? 0 : target);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!shouldAnimate) {
      setCurrent(target);
      return;
    }
    startRef.current = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(eased * target);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, shouldAnimate]);

  const display = isDecimal ? current.toFixed(2) : Math.floor(current).toLocaleString('fr-FR');

  return (
    <span>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

export default function TrustCounters({ stats }: { stats: TrustStats }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);
    const h = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      // More generous rootMargin on mobile (smaller viewport)
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const counters = buildCounters(stats);
  const shouldAnimate = inView && !prefersReduced;

  return (
    <section
      ref={sectionRef}
      className="py-16 md:py-20"
      style={{ background: 'var(--dark-bg)' }}
      aria-labelledby="trust-heading"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        <div className="text-center mb-10 md:mb-14">
          <p
            className="text-xs font-mono uppercase tracking-widest mb-3"
            style={{ color: 'rgba(231,227,214,0.4)', fontFamily: 'var(--font-mono)' }}
          >
            — Confiance
          </p>
          <h2
            id="trust-heading"
            className="text-section-title text-white"
          >
            Des chiffres qui<br />
            <span style={{ color: '#E4501C' }}>parlent d&apos;eux-mêmes.</span>
          </h2>
        </div>

        {/* Counters grid — 4 in a row desktop, 2x2 mobile */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {counters.map((counter) => (
            <div
              key={counter.label}
              className="rounded-2xl p-6 md:p-8 text-center"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="text-3xl md:text-4xl mb-3" aria-hidden="true">
                {counter.icon}
              </div>
              <div
                className="font-mono font-bold text-2xl md:text-3xl mb-2"
                style={{ color: counter.color, fontFamily: 'var(--font-mono)' }}
                aria-label={`${counter.value}${counter.suffix} ${counter.label}`}
              >
                <AnimatedCounter
                  target={counter.value}
                  suffix={counter.suffix}
                  prefix={counter.prefix}
                  shouldAnimate={shouldAnimate}
                  isDecimal={counter.value % 1 !== 0}
                />
              </div>
              <div
                className="text-xs font-mono uppercase tracking-wide"
                style={{ color: 'rgba(231,227,214,0.45)', fontFamily: 'var(--font-mono)' }}
              >
                {counter.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
