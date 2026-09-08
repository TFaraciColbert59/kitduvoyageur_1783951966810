'use client';

import Link from 'next/link';

/**
 * H3.4 — Erreur du hub (jamais d'écran blanc : retry + sortie).
 */
export default function HubError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4" role="alert">
      <header>
        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-muted)]">
          Hub indisponible
        </p>
        <h1 className="font-display font-bold text-2xl text-[var(--lkv-text-primary)] mt-1">
          Le hub n&apos;a pas pu charger
        </h1>
        <p className="text-sm text-[var(--lkv-text-secondary)] mt-1">
          {error.message || 'Une erreur inattendue est survenue.'}
        </p>
      </header>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="glass-capsule-btn primary min-h-[44px] px-5 cursor-pointer"
        >
          Réessayer
        </button>
        <Link href="/hub" className="glass-capsule-btn secondary min-h-[44px] px-5 inline-flex items-center">
          Retour au hub
        </Link>
      </div>
    </div>
  );
}
