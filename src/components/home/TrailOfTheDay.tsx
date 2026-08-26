import Link from 'next/link';
import type { TrailOfDay } from '@/lib/home-queries';

interface TrailOfTheDayProps {
  trail: TrailOfDay | null;
}

const NETWORK_LABELS: Record<string, string> = {
  iwn: 'International',
  nwn: 'National',
  rwn: 'Régional',
  lwn: 'Local',
};

export default function TrailOfTheDay({ trail }: TrailOfTheDayProps) {
  // If no trail data, hide section entirely — no placeholder
  if (!trail) return null;

  const networkLabel = trail.network ? (NETWORK_LABELS[trail.network] ?? trail.network.toUpperCase()) : 'Sentier';
  const distanceLabel = trail.distance_km ? `${trail.distance_km.toFixed(1)} km` : null;

  return (
    <section
      className="py-16 md:py-20"
      style={{ background: 'var(--card)' }}
      aria-labelledby="trail-heading"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 md:mb-10">
          <div>
            <p
              className="text-xs font-mono uppercase tracking-widest mb-2"
              style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}
            >
              — Sentier du jour
            </p>
            <h2
              id="trail-heading"
              className="text-section-title"
              style={{ color: 'var(--foreground)' }}
            >
              Votre prochaine<br />
              <span style={{ color: 'var(--primary)' }}>randonnée.</span>
            </h2>
          </div>
          {/* Date badge */}
          <div
            className="hidden md:flex flex-col items-end"
            aria-label="Mis à jour quotidiennement"
          >
            <span
              className="text-xs font-mono uppercase tracking-widest"
              style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}
            >
              Mis à jour chaque jour
            </span>
          </div>
        </div>

        {/* Trail card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--dark-bg)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex flex-col md:flex-row">
            {/* Map preview — desktop: visible, mobile: icon fallback */}
            <div
              className="hidden md:flex w-64 lg:w-80 flex-shrink-0 items-center justify-center relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #0d1a14 0%, #1a3020 100%)', minHeight: 200 }}
              aria-hidden="true"
            >
              {/* Topo SVG preview */}
              <svg
                className="absolute inset-0 w-full h-full opacity-20"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="xMidYMid slice"
              >
                <defs>
                  <pattern id="trail-topo" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                    <path d="M0 40 Q20 10 40 40 Q60 70 80 40" fill="none" stroke="#5C8A3A" strokeWidth="1.5"/>
                    <path d="M0 55 Q20 25 40 55 Q60 85 80 55" fill="none" stroke="#5C8A3A" strokeWidth="0.8"/>
                    <path d="M0 25 Q20 -5 40 25 Q60 55 80 25" fill="none" stroke="#3A6EA5" strokeWidth="0.6"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#trail-topo)"/>
              </svg>
              {/* Mountain icon */}
              <div className="relative z-10 flex flex-col items-center gap-2">
                <span className="text-5xl">🥾</span>
                {trail.ref && (
                  <span
                    className="px-3 py-1 rounded-full text-xs font-mono font-bold"
                    style={{
                      background: 'rgba(228,80,28,0.2)',
                      color: '#17402C',
                      border: '1px solid rgba(228,80,28,0.3)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {trail.ref}
                  </span>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 md:p-8">
              {/* Mobile icon */}
              <div className="flex md:hidden items-center gap-3 mb-4">
                <span className="text-3xl" aria-hidden="true">🥾</span>
                {trail.ref && (
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-mono font-bold"
                    style={{
                      background: 'rgba(228,80,28,0.2)',
                      color: '#17402C',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {trail.ref}
                  </span>
                )}
              </div>

              {/* Network badge */}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-mono uppercase tracking-wide"
                  style={{
                    background: 'rgba(92,138,58,0.15)',
                    color: '#5C8A3A',
                    border: '1px solid rgba(92,138,58,0.25)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {networkLabel}
                </span>
              </div>

              {/* Trail name */}
              <h3
                className="font-display font-bold text-white text-xl md:text-2xl mb-4 leading-tight"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {trail.name}
              </h3>

              {/* Stats row */}
              <div className="flex flex-wrap gap-4 md:gap-6 mb-6">
                {distanceLabel && (
                  <div>
                    <div
                      className="text-xs font-mono uppercase tracking-wide mb-0.5"
                      style={{ color: 'rgba(231,227,214,0.4)', fontFamily: 'var(--font-mono)' }}
                    >
                      Distance
                    </div>
                    <div
                      className="font-mono font-bold text-lg"
                      style={{ color: '#17402C', fontFamily: 'var(--font-mono)' }}
                    >
                      {distanceLabel}
                    </div>
                  </div>
                )}
                {trail.network && (
                  <div>
                    <div
                      className="text-xs font-mono uppercase tracking-wide mb-0.5"
                      style={{ color: 'rgba(231,227,214,0.4)', fontFamily: 'var(--font-mono)' }}
                    >
                      Réseau
                    </div>
                    <div
                      className="font-mono font-bold text-lg text-white"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {trail.network.toUpperCase()}
                    </div>
                  </div>
                )}
              </div>

              {/* CTA */}
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/explorer?trail=${trail.id}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17402C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#17402C] min-h-[44px]"
                  style={{ background: '#17402C' }}
                >
                  Voir sur la carte
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M2.5 7h9M8 3.5l3.5 3.5L8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
                <Link
                  href="/ai-configurator"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17402C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#17402C] min-h-[44px]"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(231,227,214,0.8)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  Préparer mon kit
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
