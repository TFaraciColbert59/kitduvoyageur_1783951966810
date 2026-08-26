import React from 'react';

export default function EarthLoading() {
  return (
    <div
      className="fixed inset-0 bg-[#FBFAF6] overflow-hidden select-none"
      aria-busy="true"
      aria-label="Chargement du globe terrestre…"
    >
      {/* Header skeleton */}
      <div
        className="absolute top-2.5 left-2.5 right-2.5 z-[900] h-12 rounded-full border border-white/60 animate-pulse"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.38) 100%)',
          backdropFilter: 'blur(24px)',
        }}
      />

      {/* Globe placeholder (cercle) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-[46vw] h-[46vw] max-w-[280px] max-h-[280px] rounded-full animate-pulse"
          style={{
            background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.85) 0%, rgba(166,193,160,0.35) 45%, rgba(23,64,44,0.10) 100%)',
            border: '1px solid rgba(255,255,255,0.80)',
            boxShadow: '0 24px 60px -24px rgba(23,64,44,0.20), inset 0 1px 1px rgba(255,255,255,0.9)',
          }}
        />
      </div>

      {/* Spinner */}
      <div className="absolute inset-x-0 top-[38vh] flex flex-col items-center gap-2">
        <div className="w-8 h-8 rounded-full border-[3px] border-[#17402C] border-t-transparent animate-spin" />
        <span className="text-[11px] font-mono font-bold text-[#17402C]">Chargement des pays…</span>
      </div>

      {/* Continents strip skeleton */}
      <div
        className="absolute left-0 right-0 flex gap-2 px-4 py-2 overflow-hidden"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 74px)' }}
      >
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="flex-shrink-0 h-9 w-20 rounded-full animate-pulse"
            style={{
              background: 'rgba(255,255,255,0.60)',
              border: '1px solid rgba(255,255,255,0.70)',
            }}
          />
        ))}
      </div>
    </div>
  );
}