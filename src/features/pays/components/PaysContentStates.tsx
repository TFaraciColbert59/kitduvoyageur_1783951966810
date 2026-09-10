import React from 'react';

/** Squelette de chargement (respecte le langage glass LKDV). */
export function PaysSectionSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="glass rounded-[1.5rem] p-5 border border-white/50 shadow-xs animate-pulse space-y-3"
        >
          <div className="h-3 w-32 rounded-full bg-[#EAE6DF]/80" />
          <div className="h-3 w-full rounded-full bg-[#EAE6DF]/70" />
          <div className="h-3 w-5/6 rounded-full bg-[#EAE6DF]/70" />
          <div className="h-3 w-2/3 rounded-full bg-[#EAE6DF]/60" />
        </div>
      ))}
    </div>
  );
}

/** État vide explicite (jamais de faux contenu). */
export function PaysSectionEmpty({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/60 px-4 py-5 text-center">
      <p className="text-xs text-[#5A7064] font-mono">{label}</p>
    </div>
  );
}

/** Message discret (erreur, indisponibilité) — ne bloque jamais la page. */
export function PaysSectionNotice({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="rounded-2xl border border-white/60 bg-white/60 px-4 py-4 text-center text-xs font-mono text-[#5A7064]"
    >
      {children}
    </div>
  );
}
