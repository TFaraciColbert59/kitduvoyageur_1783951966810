import React from 'react';

export default function ExplorerLoading() {
  return (
    <div
      className="fixed inset-0"
      style={{ top: 64, background: '#e8e3d8' }}
      aria-busy="true"
      aria-label="Chargement de l'espace Aventures…"
    >
      {/* Map skeleton */}
      <div className="absolute inset-0 animate-pulse bg-[#ddd8cc]" />

      {/* Header skeleton */}
      <div
        className="absolute top-3 left-3 right-3 z-[700] h-12 rounded-2xl border border-white/50 animate-pulse"
        style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(28px)',
        }}
      />

      {/* ── DESKTOP : panneau de liste latéral gauche ── */}
      <div
        className="hidden md:flex absolute left-3 top-[60px] bottom-3 z-[600] w-[360px] rounded-2xl border border-white/50 flex-col gap-2 p-3 animate-pulse"
        style={{
          background: 'rgba(255,255,255,0.68)',
          backdropFilter: 'blur(32px)',
        }}
      >
        <div className="h-10 bg-[#17402C]/10 rounded-xl" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-[88px] bg-[#17402C]/[0.07] rounded-xl border border-[#17402C]/10 flex gap-3 p-3">
            <div className="w-20 h-full bg-[#17402C]/10 rounded-lg shrink-0" />
            <div className="flex-1 flex flex-col justify-between py-1 gap-2">
              <div className="h-3 w-3/4 bg-[#17402C]/10 rounded-md" />
              <div className="h-2.5 w-1/2 bg-[#17402C]/10 rounded-md" />
              <div className="h-2.5 w-2/3 bg-[#17402C]/10 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* ── MOBILE : bottom sheet skeleton au-dessus de la bottom bar ── */}
      <div
        className="md:hidden absolute left-2.5 right-2.5 z-[600] rounded-[26px] border border-white/60 flex flex-col gap-2 p-3 animate-pulse"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 74px)',
          height: '30vh',
          background: 'rgba(255,255,255,0.60)',
          backdropFilter: 'blur(24px)',
        }}
      >
        <div className="w-10 h-1.5 mx-auto bg-[#17402C]/20 rounded-full" />
        <div className="h-5 w-28 bg-[#17402C]/10 rounded-full" />
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-[78px] bg-[#17402C]/[0.06] rounded-2xl border border-[#17402C]/10 flex gap-2.5 p-2">
            <div className="w-16 h-full bg-[#17402C]/10 rounded-xl shrink-0" />
            <div className="flex-1 flex flex-col justify-between py-1 gap-2">
              <div className="h-3 w-3/4 bg-[#17402C]/10 rounded-md" />
              <div className="h-2.5 w-2/3 bg-[#17402C]/10 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Spinner */}
      <div className="absolute bottom-8 right-8 flex flex-col items-center gap-2">
        <div className="w-8 h-8 rounded-full border-[3px] border-[#17402C] border-t-transparent animate-spin" />
        <span className="text-[11px] font-mono font-bold text-[#17402C]">Chargement…</span>
      </div>
    </div>
  );
}
