import React from 'react';

export function DiscoverySkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="glass rounded-[1.5rem] overflow-hidden border border-white/50 animate-pulse"
        >
          <div className="h-40 w-full bg-[#EAE6DF]/70" />
          <div className="p-4 space-y-2.5">
            <div className="h-3.5 w-3/4 rounded-full bg-[#EAE6DF]/80" />
            <div className="h-3 w-1/2 rounded-full bg-[#EAE6DF]/70" />
            <div className="h-4 w-28 rounded-md bg-white/90" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DiscoveryEmpty({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/60 px-4 py-6 text-center">
      <p className="text-xs text-[#5A7064] font-mono">{label}</p>
    </div>
  );
}

export function DiscoveryNotice({
  children,
  tone = 'neutral',
  onRetry,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'warn';
  onRetry?: () => void;
}) {
  return (
    <div
      role="status"
      className={`flex flex-wrap items-center justify-center gap-3 rounded-2xl border px-4 py-4 text-center text-xs font-mono ${
        tone === 'warn'
          ? 'border-[rgba(200,154,59,0.35)] bg-[rgba(200,154,59,0.08)] text-[#7A5B1E]'
          : 'border-white/60 bg-white/60 text-[#5A7064]'
      }`}
    >
      <span>{children}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-[44px] px-4 rounded-full bg-white/90 border border-white text-[11px] font-bold text-[#17402C] hover:bg-white transition-colors"
        >
          Réessayer
        </button>
      ) : null}
    </div>
  );
}
