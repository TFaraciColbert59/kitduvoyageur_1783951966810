'use client';

import { useEffect, useRef, useState } from 'react';

interface PulsePoint {
  x: number;
  y: number;
  label: string;
}

const STATIC_POINTS: PulsePoint[] = [
  { x: 48, y: 35, label: 'Mont Blanc' },
  { x: 62, y: 55, label: 'Alpes' },
  { x: 30, y: 60, label: 'Pyrénées' },
  { x: 72, y: 28, label: 'Vosges' },
];

export default function HeroMapBackground() {
  const [prefersReduced, setPrefersReduced] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(motionMq.matches);
    const motionHandler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    motionMq.addEventListener('change', motionHandler);

    const mobileMq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mobileMq.matches);
    const mobileHandler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mobileMq.addEventListener('change', mobileHandler);

    return () => {
      motionMq.removeEventListener('change', motionHandler);
      mobileMq.removeEventListener('change', mobileHandler);
    };
  }, []);

  const shouldAnimate = mounted && !prefersReduced && !isMobile;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      aria-hidden="true"
      role="presentation"
    >
      {/* Base topo SVG */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(160deg, #0d1a14 0%, #1C2620 40%, #0f1e18 100%)',
        }}
      />

      {/* Topographic contour lines */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.08]"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="hero-topo" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
            <path d="M0 100 Q25 60 50 100 Q75 140 100 100 Q125 60 150 100 Q175 140 200 100" fill="none" stroke="#5C8A3A" strokeWidth="1.2"/>
            <path d="M0 130 Q25 90 50 130 Q75 170 100 130 Q125 90 150 130 Q175 170 200 130" fill="none" stroke="#5C8A3A" strokeWidth="0.6"/>
            <path d="M0 70 Q25 30 50 70 Q75 110 100 70 Q125 30 150 70 Q175 110 200 70" fill="none" stroke="#5C8A3A" strokeWidth="0.6"/>
            <path d="M0 160 Q50 120 100 160 Q150 200 200 160" fill="none" stroke="#3A6EA5" strokeWidth="0.4"/>
            <path d="M0 40 Q50 0 100 40 Q150 80 200 40" fill="none" stroke="#3A6EA5" strokeWidth="0.4"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-topo)" />
      </svg>

      {/* Animated zoom container — desktop only, no animation on mobile or reduced-motion */}
      <div
        className="absolute inset-0"
        style={
          shouldAnimate
            ? {
                animation: 'heroMapZoom 60s ease-in-out infinite alternate',
                transformOrigin: 'center center',
              }
            : {}
        }
      >
        {/* Gradient orbs for depth */}
        <div
          className="absolute top-1/4 right-1/3 w-[500px] h-[500px] rounded-full blur-[100px] opacity-15 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #5C8A3A 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] rounded-full blur-[80px] opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #3A6EA5 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-1/2 right-1/4 w-[300px] h-[300px] rounded-full blur-[60px] opacity-8 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #E4501C 0%, transparent 70%)' }}
        />
      </div>

      {/* Pulse points on trails */}
      {STATIC_POINTS.map((pt, i) => (
        <div
          key={pt.label}
          className="absolute"
          style={{ left: `${pt.x}%`, top: `${pt.y}%`, transform: 'translate(-50%, -50%)' }}
        >
          {/* Outer pulse ring */}
          {shouldAnimate && (
            <div
              className="absolute inset-0 rounded-full border border-[#E4501C]/40"
              style={{
                width: 32,
                height: 32,
                top: -10,
                left: -10,
                animation: `heroPulse 3s ease-out infinite`,
                animationDelay: `${i * 0.8}s`,
              }}
            />
          )}
          {/* Dot */}
          <div
            className="w-3 h-3 rounded-full border-2 border-[#E4501C]/80"
            style={{ background: '#E4501C', boxShadow: '0 0 8px rgba(228,80,28,0.6)' }}
          />
        </div>
      ))}

      {/* Bottom gradient fade to content */}
      <div
        className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, rgba(28,38,32,0.95))' }}
      />

      <style>{`
        @keyframes heroMapZoom {
          0% { transform: scale(1); }
          100% { transform: scale(1.03); }
        }
        @keyframes heroPulse {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-map-zoom { animation: none !important; }
          .hero-pulse { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
